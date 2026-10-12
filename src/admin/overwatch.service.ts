import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RevenueStream } from '@prisma/client';

import { addDays } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InvitesService } from '../school/invites.service.js';

type NewSchool = {
  enquiryId?: string;
  name: string;
  address?: string;
  state?: string;
  lga?: string;
  email?: string;
  phone?: string;
  owner: { firstName: string; lastName: string; email: string; phone?: string };
};

type NewAgreement = { planName: string; revenueShareBp: number; sharedStreams: RevenueStream[]; startsAt: string; endsAt?: string };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'school';

/** Overwatch: running the platform. Schools, their commercial agreements, disputes and health. */
@Injectable()
export class OverwatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invites: InvitesService,
  ) {}

  async overview() {
    const since = addDays(new Date(), -30);
    const [schools, students, parents, tutorsPending, enquiries, disputes, payments] = await Promise.all([
      this.prisma.school.groupBy({ by: ['status'], _count: true }),
      this.prisma.studentProfile.count(),
      this.prisma.membership.count({ where: { role: 'PARENT' } }),
      this.prisma.tutorApplication.count({ where: { status: { in: ['TEST_ASSIGNED', 'INTERVIEW'] } } }),
      this.prisma.schoolEnquiry.count({ where: { handled: false } }),
      this.prisma.tutorSession.count({ where: { escrowStatus: 'DISPUTED' } }),
      this.prisma.payment.groupBy({ by: ['purpose'], where: { status: 'SUCCESS', paidAt: { gte: since } }, _sum: { amountKobo: true }, _count: true }),
    ]);
    return {
      schools: Object.fromEntries(schools.map((s) => [s.status, s._count])),
      students,
      parents,
      todo: { enquiries, tutorsToReview: tutorsPending, disputes },
      payments30d: payments.map((p) => ({ purpose: p.purpose, count: p._count, amountKobo: p._sum.amountKobo ?? 0n })),
    };
  }

  async schools() {
    const rows = await this.prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { students: true } },
        memberships: { where: { role: 'SCHOOL_OWNER' }, include: { user: { select: { firstName: true, lastName: true, email: true, phone: true, lastLoginAt: true } } } },
        agreements: { where: { status: 'ACTIVE' }, take: 1 },
      },
    });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      state: s.state,
      status: s.status,
      createdAt: s.createdAt,
      students: s._count.students,
      owner: s.memberships[0]?.user ?? null,
      agreement: s.agreements[0] ? { planName: s.agreements[0].planName, revenueShareBp: s.agreements[0].revenueShareBp } : null,
    }));
  }

  /** Turns a demo enquiry (or a direct sign-up) into a live school with an owner who gets an invite. */
  async createSchool(adminId: string, dto: NewSchool) {
    const enquiry = dto.enquiryId ? await this.prisma.schoolEnquiry.findUnique({ where: { id: dto.enquiryId } }) : null;
    if (dto.enquiryId && !enquiry) throw new NotFoundException('Enquiry not found.');
    const ownerEmail = dto.owner.email.toLowerCase();
    let owner = await this.prisma.user.findUnique({ where: { email: ownerEmail } });
    if (!owner && dto.owner.phone && (await this.prisma.user.findUnique({ where: { phone: dto.owner.phone } }))) {
      throw new ConflictException('That phone number belongs to another account.');
    }
    let slug = slugify(dto.name);
    if (await this.prisma.school.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const school = await this.prisma.$transaction(async (tx) => {
      owner ??= await tx.user.create({ data: { firstName: dto.owner.firstName, lastName: dto.owner.lastName, email: ownerEmail, phone: dto.owner.phone } });
      const s = await tx.school.create({
        data: { name: dto.name, slug, address: dto.address, state: dto.state, lga: dto.lga, email: dto.email, phone: dto.phone, status: 'ACTIVE', memberships: { create: { userId: owner.id, role: 'SCHOOL_OWNER' } } },
      });
      if (enquiry) await tx.schoolEnquiry.update({ where: { id: enquiry.id }, data: { handled: true } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'school.create', entityType: 'School', entityId: s.id, schoolId: s.id } });
      return s;
    });
    const invite = owner!.passwordHash ? { sent: false, code: undefined } : await this.invites.invite(owner!.id, { schoolName: school.name, role: 'staff' });
    return { id: school.id, ownerInvited: invite.sent, ownerHasAccount: !!owner!.passwordHash, code: invite.sent ? undefined : invite.code };
  }

  async setSchoolStatus(adminId: string, id: string, status: 'ACTIVE' | 'SUSPENDED') {
    await this.prisma.school.update({ where: { id }, data: { status } });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: `school.${status.toLowerCase()}`, entityType: 'School', entityId: id, schoolId: id } });
    return { ok: true };
  }

  async school(id: string) {
    const s = await this.prisma.school.findUnique({
      where: { id },
      include: {
        agreements: { orderBy: { startsAt: 'desc' } },
        statements: { orderBy: { periodStart: 'desc' }, take: 12 },
        wallets: { where: { type: 'SCHOOL_REVENUE' } },
        memberships: { where: { role: { in: ['SCHOOL_OWNER', 'SCHOOL_ADMIN'] } }, include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        _count: { select: { students: true, classes: true } },
      },
    });
    if (!s) throw new NotFoundException('School not found.');
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      address: s.address,
      state: s.state,
      email: s.email,
      phone: s.phone,
      createdAt: s.createdAt,
      students: s._count.students,
      classes: s._count.classes,
      owedToSchoolKobo: s.wallets[0]?.balanceKobo ?? 0n,
      admins: s.memberships.map((m) => ({ role: m.role, ...m.user })),
      agreements: s.agreements,
      statements: s.statements,
    };
  }

  async addAgreement(adminId: string, schoolId: string, dto: NewAgreement) {
    if (dto.sharedStreams.includes('TUTORING')) throw new BadRequestException('Tutoring revenue is never shared with schools.');
    const a = await this.prisma.$transaction(async (tx) => {
      // One active agreement at a time: the new one replaces the old.
      await tx.schoolAgreement.updateMany({ where: { schoolId, status: 'ACTIVE' }, data: { status: 'ENDED' } });
      return tx.schoolAgreement.create({
        data: { schoolId, planName: dto.planName, revenueShareBp: dto.revenueShareBp, sharedStreams: dto.sharedStreams, startsAt: new Date(dto.startsAt), endsAt: dto.endsAt ? new Date(dto.endsAt) : null, status: 'ACTIVE', signedAt: new Date() },
      });
    });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: 'agreement.create', entityType: 'SchoolAgreement', entityId: a.id, schoolId } });
    return a;
  }

  /** Works out the school's share for a period from the ledger, and saves it as a draft statement. */
  async statement(adminId: string, schoolId: string, from: string, to: string) {
    const periodStart = new Date(from);
    const periodEnd = new Date(to);
    if (!(periodEnd > periodStart)) throw new BadRequestException('The end date must be after the start date.');
    const agreement = await this.prisma.schoolAgreement.findFirst({ where: { schoolId, status: 'ACTIVE' } });
    if (!agreement) throw new BadRequestException('Add an active agreement for this school first.');
    const entries = await this.prisma.ledgerEntry.groupBy({
      by: ['stream'],
      where: { schoolId, stream: { in: agreement.sharedStreams }, amountKobo: { gt: 0 }, createdAt: { gte: periodStart, lt: periodEnd } },
      _sum: { amountKobo: true },
    });
    const breakdown = Object.fromEntries(entries.map((e) => [e.stream, String(e._sum.amountKobo ?? 0n)]));
    const gross = entries.reduce((n, e) => n + (e._sum.amountKobo ?? 0n), 0n);
    const share = (gross * BigInt(agreement.revenueShareBp)) / 10_000n;
    const statement = await this.prisma.revenueShareStatement.upsert({
      where: { schoolId_periodStart_periodEnd: { schoolId, periodStart, periodEnd } },
      update: { grossKobo: gross, revenueShareBp: agreement.revenueShareBp, schoolKobo: share, breakdown, agreementId: agreement.id },
      create: { schoolId, agreementId: agreement.id, periodStart, periodEnd, grossKobo: gross, revenueShareBp: agreement.revenueShareBp, schoolKobo: share, breakdown },
    });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: 'statement.calculate', entityType: 'RevenueShareStatement', entityId: statement.id, schoolId } });
    return statement;
  }

  async disputes() {
    const rows = await this.prisma.tutorSession.findMany({
      where: { escrowStatus: 'DISPUTED' },
      include: { booking: { include: { parent: { select: { firstName: true, lastName: true, email: true, phone: true } }, tutor: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } }, student: { include: { user: { select: { firstName: true } } } } } } },
      orderBy: { disputedAt: 'asc' },
    });
    return rows.map((s) => ({
      sessionId: s.id,
      scheduledAt: s.scheduledAt,
      disputedAt: s.disputedAt,
      reason: s.disputeReason,
      totalKobo: s.totalKobo,
      topics: s.topicsCovered,
      tutorNotes: s.tutorNotes,
      parent: s.booking.parent,
      tutor: s.booking.tutor.user,
      child: s.booking.student.user.firstName,
    }));
  }
}
