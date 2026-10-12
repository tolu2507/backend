import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'node:crypto';

import type { AccessClaims } from '../common/auth.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, RegisterDto, ResetPasswordDto, StudentLoginDto } from './auth.dto.js';

const REFRESH_DAYS = 60;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Small in-memory brake on PIN guessing: 5 wrong PINs locks a username for 15 minutes. */
const pinFailures = new Map<string, { count: number; until: number }>();

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly messaging: MessagingService,
  ) {}

  /** The user object every app receives after login or refresh. */
  async sessionUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      // Staff of a suspended school lose access to it; their other roles keep working.
      include: { memberships: { where: { status: 'ACTIVE', OR: [{ schoolId: null }, { school: { status: { not: 'SUSPENDED' } } }] }, include: { school: { select: { name: true } } } } },
    });
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      username: user.username,
      photoUrl: user.photoUrl,
      memberships: user.memberships.map((m) => ({ id: m.id, role: m.role, schoolId: m.schoolId, schoolName: m.school?.name ?? null })),
    };
  }

  async issueSession(userId: string) {
    const user = await this.sessionUser(userId);
    const claims: AccessClaims = { sub: userId, roles: user.memberships.map((m) => ({ role: m.role as Role, schoolId: m.schoolId })) };
    const accessToken = await this.jwt.signAsync(claims);
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + REFRESH_DAYS * 86_400_000) },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    return { accessToken, refreshToken, user };
  }

  async register(dto: RegisterDto) {
    const clash = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
    });
    if (clash && !clash.passwordHash) {
      // A school set this account up; the parent claims it with the school's code rather than a second account.
      throw new ConflictException('Your school has already set up an account for you. On the sign-in screen, tap "Got a code from your school?" and enter the code from your school. If you don’t have it, ask the school to resend it.');
    }
    if (clash) throw new ConflictException('An account with that email or phone already exists. Try signing in.');

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          passwordHash: await bcrypt.hash(dto.password, 12),
          memberships: { create: { role: dto.role } },
        },
      });
      if (dto.role === 'TUTOR') await AuthService.startTutorApplication(tx, u.id);
      return u;
    });
    return this.issueSession(user.id);
  }

  /** Creates the tutor profile + application. Used at signup and when a parent adds the tutor role. */
  static async startTutorApplication(tx: Pick<PrismaService, 'tutorProfile' | 'tutorApplication'>, userId: string) {
    const profile = await tx.tutorProfile.create({ data: { userId, rateKobo: 0n } });
    await tx.tutorApplication.create({ data: { applicantId: userId, tutorProfileId: profile.id, subjectsApplied: [] } });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: dto.identifier }, { phone: dto.identifier }] } });
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("That email/phone and password don't match.");
    }
    return this.signedIn(user.id, 'password');
  }

  async studentLogin(dto: StudentLoginDto) {
    const lock = pinFailures.get(dto.username);
    if (lock && lock.until > Date.now()) {
      throw new UnauthorizedException('Too many wrong PINs. Wait 15 minutes or ask a parent to reset your PIN.');
    }
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user?.pinHash || !(await bcrypt.compare(dto.pin, user.pinHash))) {
      const count = (lock?.count ?? 0) + 1;
      pinFailures.set(dto.username, { count, until: count >= 5 ? Date.now() + 15 * 60_000 : 0 });
      throw new UnauthorizedException("That username and PIN don't match.");
    }
    pinFailures.delete(dto.username);
    return this.signedIn(user.id, 'pin');
  }

  /** Issues the session and records the sign-in in the activity log (refreshes are not logged). */
  private async signedIn(userId: string, method: 'password' | 'pin') {
    const session = await this.issueSession(userId);
    const schools = [...new Set(session.user.memberships.map((m) => m.schoolId).filter(Boolean))];
    await this.prisma.auditLog
      .create({ data: { actorId: userId, action: 'auth.login', entityType: 'User', entityId: userId, schoolId: schools.length === 1 ? schools[0] : null, meta: { method } } })
      .catch(() => undefined);
    return session;
  }

  /** Rotates the refresh token: the old one stops working the moment a new one is issued. */
  async refresh(refreshToken: string) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) throw new UnauthorizedException('Please sign in again.');
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return this.issueSession(row.userId);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async forgotPassword(identifier: string) {
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: identifier }, { phone: identifier }] } });
    if (user?.passwordHash) {
      const code = String(randomInt(100000, 1000000));
      await this.prisma.passwordReset.create({
        data: { userId: user.id, tokenHash: sha256(`${user.id}:${code}`), expiresAt: new Date(Date.now() + 30 * 60_000) },
      });
      await this.messaging.sendCode(identifier, code, 'reset your password');
    }
    // Same answer whether or not the account exists, so this can't be used to discover accounts.
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: dto.identifier }, { phone: dto.identifier }] } });
    const row = user && (await this.prisma.passwordReset.findUnique({ where: { tokenHash: sha256(`${user.id}:${dto.code}`) } }));
    if (!user || !row || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException('That code is wrong or has expired. Request a new one.');
    await this.prisma.$transaction([
      this.prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(dto.password, 12) } }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return this.issueSession(user.id);
  }
}
