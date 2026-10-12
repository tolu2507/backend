import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { TutorRequest } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { isSubject, LEVEL_LABEL } from '../catalog/catalog.js';
import { formatNaira } from '../common/money.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { scoreMatch } from './matching.js';
import type { CreateChildDto, TutorRequestDto } from './parent.dto.js';

const CONSENT_VERSION = '2026-10';
const MODE_LABEL = { IN_PERSON: 'Home lessons', ONLINE: 'Online', BOTH: 'Home or online' } as const;
const initials = (first: string, last: string) => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();

@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly messaging: MessagingService,
  ) {}

  private platformFeeBp() {
    return Number(process.env.PLATFORM_FEE_BP ?? 1500);
  }

  /** Throws unless this parent is linked to this child. */
  async ownChild(parentId: string, studentId: string) {
    const link = await this.prisma.guardianship.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      include: { student: { include: { user: true, school: true, consents: { where: { revokedAt: null } } } } },
    });
    if (!link) throw new NotFoundException('Child not found on your account.');
    return link.student;
  }

  async children(parentId: string) {
    const links = await this.prisma.guardianship.findMany({
      where: { parentId },
      orderBy: { createdAt: 'asc' },
      include: { student: { include: { user: true, school: true } } },
    });
    return links.map(({ student: s }) => ({
      id: s.id,
      userId: s.userId,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
      username: s.user.username,
      level: s.level,
      className: s.gradeName ?? LEVEL_LABEL[s.level],
      schoolName: s.school?.name ?? null,
    }));
  }

  /** A parent creates a child account directly — no school needed. */
  async createChild(parentId: string, dto: CreateChildDto) {
    if (!dto.consentDataProcessing) throw new BadRequestException('We need your consent to store your child’s learning data before creating their account.');
    if (await this.prisma.user.findUnique({ where: { username: dto.username } })) {
      throw new ConflictException('That username is taken. Try adding a number, like ' + dto.username + '7.');
    }
    const student = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          username: dto.username,
          pinHash: await bcrypt.hash(dto.pin, 10),
          memberships: { create: { role: 'STUDENT' } },
        },
      });
      const profile = await tx.studentProfile.create({ data: { userId: user.id, level: dto.level, gradeName: dto.gradeName } });
      await tx.guardianship.create({ data: { parentId, studentId: profile.id, relationship: 'PARENT', isPrimary: true } });
      const consents = [
        dto.consentDataProcessing && 'DATA_PROCESSING',
        dto.consentAiReports && 'AI_REPORTS',
        dto.consentTutorMatching && 'TUTOR_MATCHING',
      ].filter(Boolean) as ('DATA_PROCESSING' | 'AI_REPORTS' | 'TUTOR_MATCHING')[];
      await tx.consent.createMany({ data: consents.map((type) => ({ givenById: parentId, studentId: profile.id, type, version: CONSENT_VERSION })) });
      await tx.wallet.create({ data: { userId: user.id, type: 'STUDENT_SPEND' } });
      return profile;
    });
    return (await this.children(parentId)).find((c) => c.id === student.id);
  }

  async invoices(parentId: string, studentId: string) {
    await this.ownChild(parentId, studentId);
    const rows = await this.prisma.feeInvoice.findMany({
      where: { studentId, status: { not: 'VOID' } },
      include: { school: { select: { name: true } }, term: { include: { academicYear: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((i) => ({
      id: i.id,
      schoolName: i.school.name,
      term: `${i.term.academicYear.name} · ${i.term.name[0]}${i.term.name.slice(1).toLowerCase()} term`,
      items: i.items as { label: string; amountKobo: string }[],
      totalKobo: i.totalKobo,
      paidKobo: i.paidKobo,
      status: i.status,
      dueDate: i.dueDate,
    }));
  }

  payInvoice(origin: string, parentId: string, invoiceId: string, amountKobo?: number) {
    return this.payments.startFeePayment(origin, parentId, invoiceId, amountKobo !== undefined ? BigInt(amountKobo) : undefined);
  }

  async changePin(parentId: string, studentId: string, pin: string) {
    const child = await this.ownChild(parentId, studentId);
    await this.prisma.user.update({ where: { id: child.userId }, data: { pinHash: await bcrypt.hash(pin, 10) } });
    await this.prisma.refreshToken.updateMany({ where: { userId: child.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async report(parentId: string, studentId: string) {
    const child = await this.ownChild(parentId, studentId);
    if (!child.consents.some((c) => c.type === 'AI_REPORTS')) return null;
    return this.reports.latest(studentId);
  }

  async wallet(parentId: string, studentId: string) {
    const child = await this.ownChild(parentId, studentId);
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId_type: { userId: child.userId, type: 'STUDENT_SPEND' } },
      include: { entries: { orderBy: { createdAt: 'desc' }, take: 30 } },
    });
    return {
      balanceKobo: wallet?.balanceKobo ?? 0n,
      entries: (wallet?.entries ?? []).map((e) => ({ id: e.id, amountKobo: e.amountKobo, description: e.description ?? '', createdAt: e.createdAt })),
    };
  }

  topup(origin: string, parentId: string, studentId: string, amountKobo: number) {
    return this.payments.startTopup(origin, parentId, studentId, BigInt(amountKobo));
  }

  // ── Lesson teachers ───────────────────────────────────────

  private presentRequest(r: TutorRequest, grade: string | null) {
    const schedule = r.schedule as { days?: string[] };
    const prefs = r.preferences as { tags?: string[] };
    const criteria = [
      `${r.subject} · ${grade ?? LEVEL_LABEL[r.level]}`,
      MODE_LABEL[r.mode],
      ...(r.lga || r.state ? [[r.lga, r.state].filter(Boolean).join(', ')] : []),
      ...(schedule.days?.length ? [schedule.days.join(', ')] : []),
      ...(r.budgetMaxKobo ? [`Up to ${formatNaira(r.budgetMaxKobo)}/hr`] : []),
      ...(prefs.tags ?? []),
    ];
    return {
      id: r.id,
      studentId: r.studentId,
      status: r.status,
      subject: r.subject,
      level: r.level,
      goals: r.goals,
      mode: r.mode,
      state: r.state,
      lga: r.lga,
      budgetMaxKobo: r.budgetMaxKobo,
      days: schedule.days ?? [],
      preferences: prefs.tags ?? [],
      criteria,
    };
  }

  async currentRequest(parentId: string, studentId: string) {
    const child = await this.ownChild(parentId, studentId);
    const r = await this.prisma.tutorRequest.findFirst({ where: { parentId, studentId, status: { not: 'CLOSED' } }, orderBy: { createdAt: 'desc' } });
    return r ? this.presentRequest(r, child.gradeName) : null;
  }

  async saveRequest(parentId: string, dto: TutorRequestDto, requestId?: string) {
    const child = await this.ownChild(parentId, dto.studentId);
    if (!child.consents.some((c) => c.type === 'TUTOR_MATCHING')) {
      throw new ForbiddenException('Turn on lesson-teacher matching for this child in Privacy & data first.');
    }
    if (!isSubject(dto.subject, child.level)) throw new BadRequestException(`Pick a subject from the list for ${LEVEL_LABEL[child.level]}.`);
    const data = {
      subject: dto.subject,
      level: child.level,
      goals: dto.goals || null,
      mode: dto.mode,
      state: dto.state || null,
      lga: dto.lga || null,
      budgetMaxKobo: dto.budgetMaxKobo ? BigInt(dto.budgetMaxKobo) : null,
      schedule: { days: dto.days },
      preferences: { tags: dto.preferences },
    };
    let r: TutorRequest;
    if (requestId) {
      const existing = await this.prisma.tutorRequest.findFirst({ where: { id: requestId, parentId } });
      if (!existing) throw new NotFoundException('Request not found.');
      r = await this.prisma.tutorRequest.update({ where: { id: requestId }, data });
      await this.prisma.tutorMatch.deleteMany({ where: { requestId, status: { in: ['SUGGESTED', 'VIEWED'] } } });
    } else {
      r = await this.prisma.tutorRequest.create({ data: { ...data, parentId, studentId: dto.studentId } });
    }
    return this.presentRequest(r, child.gradeName);
  }

  /** Re-scores approved tutors against the request every time, so new tutors appear automatically. */
  async matches(parentId: string, requestId: string) {
    const req = await this.prisma.tutorRequest.findFirst({ where: { id: requestId, parentId } });
    if (!req) throw new NotFoundException('Request not found.');
    const candidates = await this.prisma.tutorProfile.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        isAcceptingStudents: true,
        userId: { not: parentId },
        subjects: { some: { subject: req.subject, level: req.level, approvedAt: { not: null } } },
      },
      include: { user: true, subjects: true },
    });
    const fee = this.platformFeeBp();
    const scored = candidates
      .map((t) => ({ t, m: scoreMatch(req, t, fee) }))
      .filter((x): x is { t: (typeof candidates)[number]; m: NonNullable<ReturnType<typeof scoreMatch>> } => !!x.m)
      .sort((a, b) => b.m.score - a.m.score)
      .slice(0, 10);

    const rows = [];
    for (const { t, m } of scored) {
      const row = await this.prisma.tutorMatch.upsert({
        where: { requestId_tutorId: { requestId, tutorId: t.id } },
        update: { score: m.score, reasons: m.reasons },
        create: { requestId, tutorId: t.id, score: m.score, reasons: m.reasons },
      });
      rows.push({
        id: row.id,
        tutorId: t.id,
        status: row.status,
        name: `${t.user.firstName} ${t.user.lastName[0] ?? ''}.`,
        initials: initials(t.user.firstName, t.user.lastName),
        headline: [t.headline, t.yearsExperience ? `${t.yearsExperience} yrs` : null, t.lga ?? t.state].filter(Boolean).join(' · '),
        bio: t.bio,
        matchScore: m.score,
        testScore: m.testScore,
        rating: t.ratingAvg,
        reviewCount: t.ratingCount,
        rateKobo: m.parentPrice,
        mode: m.mode,
        reasons: m.reasons,
      });
    }
    return rows;
  }

  async book(parentId: string, matchId: string) {
    const match = await this.prisma.tutorMatch.findUnique({ where: { id: matchId }, include: { request: true, tutor: true } });
    if (!match || match.request.parentId !== parentId) throw new NotFoundException('Match not found.');
    const open = await this.prisma.tutorBooking.findFirst({
      where: { parentId, studentId: match.request.studentId, tutorId: match.tutorId, status: { in: ['PENDING', 'ACTIVE'] } },
    });
    if (open) throw new ConflictException('You already have a booking with this teacher.');
    const booking = await this.prisma.$transaction(async (tx) => {
      const b = await tx.tutorBooking.create({
        data: {
          parentId,
          studentId: match.request.studentId,
          tutorId: match.tutorId,
          requestId: match.requestId,
          tutorRateKobo: match.tutor.rateKobo,
          platformFeeBp: this.platformFeeBp(),
        },
      });
      await tx.tutorMatch.update({ where: { id: matchId }, data: { status: 'BOOKED' } });
      await tx.tutorRequest.update({ where: { id: match.requestId }, data: { status: 'MATCHED' } });
      return b;
    });
    this.messaging.notify([match.tutor.userId], 'lessonReminders', { title: 'New lesson request', body: 'A parent wants to book you. Accept it to schedule a free trial.', url: `/tutor/booking/${booking.id}` });
    return { id: booking.id, status: booking.status };
  }

  async bookings(parentId: string, studentId: string) {
    await this.ownChild(parentId, studentId);
    const rows = await this.prisma.tutorBooking.findMany({
      where: { parentId, studentId },
      orderBy: { createdAt: 'desc' },
      include: { tutor: { include: { user: true } }, request: true, sessions: { orderBy: { scheduledAt: 'asc' }, include: { quiz: true } } },
    });
    return rows.map((b) => ({
      id: b.id,
      status: b.status,
      subject: b.request?.subject ?? null,
      tutor: { name: `${b.tutor.user.firstName} ${b.tutor.user.lastName[0] ?? ''}.`, initials: initials(b.tutor.user.firstName, b.tutor.user.lastName) },
      sessions: b.sessions.map((s) => ({
        id: s.id,
        scheduledAt: s.scheduledAt,
        durationMinutes: s.durationMinutes,
        status: s.status,
        escrowStatus: s.escrowStatus,
        isTrial: s.isTrial,
        totalKobo: s.totalKobo,
        topicsCovered: s.topicsCovered,
        quiz: s.quiz ? { status: s.quiz.status, score: s.quiz.score } : null,
      })),
    }));
  }

  private async ownSession(parentId: string, sessionId: string) {
    const s = await this.prisma.tutorSession.findUnique({ where: { id: sessionId }, include: { booking: true } });
    if (!s || s.booking.parentId !== parentId) throw new NotFoundException('Lesson not found.');
    return s;
  }

  payForSession(origin: string, parentId: string, sessionId: string) {
    return this.payments.startSessionPayment(origin, parentId, sessionId);
  }

  /** Parent confirms the lesson happened (used when the child hasn't done the quiz). */
  async confirmSession(parentId: string, sessionId: string) {
    const s = await this.ownSession(parentId, sessionId);
    if (s.scheduledAt > new Date()) throw new BadRequestException('You can confirm a lesson after it has started.');
    await this.prisma.tutorSession.update({ where: { id: s.id }, data: { parentConfirmedAt: new Date() } });
    const released = await this.ledger.releaseEscrow(s.id, 'parent confirmed the lesson');
    return { ok: true, released };
  }

  async disputeSession(parentId: string, sessionId: string, reason: string) {
    const s = await this.ownSession(parentId, sessionId);
    const updated = await this.prisma.tutorSession.updateMany({
      where: { id: s.id, escrowStatus: 'HELD' },
      data: { escrowStatus: 'DISPUTED', disputedAt: new Date(), disputeReason: reason },
    });
    if (!updated.count) throw new BadRequestException('Only paid lessons that haven’t been released can be disputed.');
    return { ok: true };
  }
}
