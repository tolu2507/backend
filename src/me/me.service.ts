import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConsentType, DataRequestType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuthService } from '../auth/auth.service.js';
import { DEFAULT_PREFS, type NotificationPrefs } from '../messaging/prefs.js';
import { PrismaService } from '../prisma/prisma.service.js';

export { DEFAULT_PREFS, type NotificationPrefs };

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async updateProfile(userId: string, data: { firstName: string; lastName: string; email?: string; phone?: string }) {
    const clash = await this.prisma.user.findFirst({
      where: { id: { not: userId }, OR: [...(data.email ? [{ email: data.email }] : []), ...(data.phone ? [{ phone: data.phone }] : [])] },
    });
    if (clash) throw new ConflictException('That email or phone is already used by another account.');
    await this.prisma.user.update({ where: { id: userId }, data: { firstName: data.firstName, lastName: data.lastName, email: data.email || undefined, phone: data.phone || undefined } });
    return this.auth.sessionUser(userId);
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(current, user.passwordHash))) throw new BadRequestException('Your current password is wrong.');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, 12) } });
    return { ok: true };
  }

  async prefs(userId: string): Promise<NotificationPrefs> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { ...DEFAULT_PREFS, ...((user.notificationPrefs as Partial<NotificationPrefs>) ?? {}) };
  }

  async savePushToken(userId: string, token: string, platform: string) {
    // A token belongs to one phone; if someone else signs in on it, it moves to them.
    await this.prisma.pushToken.upsert({ where: { token }, update: { userId, platform, lastSeenAt: new Date() }, create: { userId, token, platform } });
    return { ok: true };
  }

  async removePushToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { token, userId } });
    return { ok: true };
  }

  async setPrefs(userId: string, prefs: Partial<NotificationPrefs>) {
    const merged = { ...(await this.prefs(userId)), ...prefs };
    await this.prisma.user.update({ where: { id: userId }, data: { notificationPrefs: merged } });
    return merged;
  }

  /** A parent can become a lesson teacher (and vice versa) on the same account. */
  async addRole(userId: string, role: 'PARENT' | 'TUTOR') {
    const has = await this.prisma.membership.findFirst({ where: { userId, role, schoolId: null } });
    if (has) return this.auth.issueSession(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.create({ data: { userId, role } });
      if (role === 'TUTOR' && !(await tx.tutorProfile.findUnique({ where: { userId } }))) await AuthService.startTutorApplication(tx, userId);
    });
    return this.auth.issueSession(userId); // new roles go into a fresh access token
  }

  async privacy(userId: string) {
    const [links, requests] = await Promise.all([
      this.prisma.guardianship.findMany({ where: { parentId: userId, confirmedAt: { not: null } }, include: { student: { include: { user: true, consents: { where: { revokedAt: null } } } } } }),
      this.prisma.dataRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      children: links.map(({ student: s }) => ({
        studentId: s.id,
        firstName: s.user.firstName,
        consents: {
          DATA_PROCESSING: s.consents.some((c) => c.type === 'DATA_PROCESSING'),
          AI_REPORTS: s.consents.some((c) => c.type === 'AI_REPORTS'),
          TUTOR_MATCHING: s.consents.some((c) => c.type === 'TUTOR_MATCHING'),
        },
      })),
      requests: requests.map((r) => ({ id: r.id, type: r.type, status: r.status, subjectId: r.subjectId, createdAt: r.createdAt })),
    };
  }

  async setConsent(userId: string, studentId: string, type: ConsentType, granted: boolean) {
    const link = await this.prisma.guardianship.findFirst({ where: { parentId: userId, studentId, confirmedAt: { not: null } } });
    if (!link) throw new NotFoundException('Child not found on your account.');
    if (type === 'DATA_PROCESSING' && !granted) throw new BadRequestException('To stop all data processing, request deletion of your child’s account instead.');
    if (granted) {
      const active = await this.prisma.consent.findFirst({ where: { studentId, type, revokedAt: null } });
      if (!active) await this.prisma.consent.create({ data: { givenById: userId, studentId, type, version: '2026-10' } });
    } else {
      await this.prisma.consent.updateMany({ where: { studentId, type, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return this.privacy(userId);
  }

  async requestData(userId: string, type: DataRequestType, studentId?: string) {
    if (studentId) {
      const link = await this.prisma.guardianship.findFirst({ where: { parentId: userId, studentId, confirmedAt: { not: null } } });
      if (!link) throw new NotFoundException('Child not found on your account.');
    }
    const open = await this.prisma.dataRequest.findFirst({ where: { userId, type, subjectId: studentId ?? null, status: { not: 'DONE' } } });
    if (open) throw new ConflictException('We are already working on that request.');
    await this.prisma.dataRequest.create({ data: { userId, type, subjectId: studentId } });
    return this.privacy(userId);
  }
}
