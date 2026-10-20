import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { addDays } from '../common/dates.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { esc, layout, MessagingService } from '../messaging/messaging.service.js';
import { SquadService } from '../payments/squad.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const AUTO_RELEASE_DAYS = 7;

/** Overwatch: platform-admin actions. The web dashboard will call these. */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly squad: SquadService,
    private readonly messaging: MessagingService,
  ) {}

  async tutorApplications(status?: string) {
    const apps = await this.prisma.tutorApplication.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: { applicant: true, tutorProfile: { include: { subjects: true } }, attempts: { include: { test: true } } },
    });
    return apps.map((a) => ({
      id: a.id,
      status: a.status,
      name: `${a.applicant.firstName} ${a.applicant.lastName}`,
      email: a.applicant.email,
      phone: a.applicant.phone,
      ninNumber: a.ninNumber,
      referees: a.referees,
      profile: { headline: a.tutorProfile.headline, state: a.tutorProfile.state, rateKobo: a.tutorProfile.rateKobo },
      tests: a.attempts.map((t) => ({ subject: t.test.subject, level: t.test.level, score: t.finalScore, passed: t.passed, integrity: t.integrityFlags })),
      updatedAt: a.updatedAt,
    }));
  }

  async decide(adminId: string, applicationId: string, approve: boolean, note?: string) {
    const app = await this.prisma.tutorApplication.findUnique({ where: { id: applicationId }, include: { applicant: true, tutorProfile: { include: { subjects: true } } } });
    if (!app) throw new NotFoundException('Application not found.');
    if (approve && !app.tutorProfile.subjects.some((s) => s.approvedAt)) throw new BadRequestException('The tutor has not passed any subject test yet.');
    await this.prisma.$transaction([
      this.prisma.tutorApplication.update({
        where: { id: app.id },
        data: { status: approve ? 'APPROVED' : 'REJECTED', reviewerId: adminId, decisionAt: new Date(), decisionReason: note, interviewNotes: approve ? note : undefined },
      }),
      this.prisma.tutorProfile.update({
        where: { id: app.tutorProfileId },
        data: approve ? { verificationStatus: 'VERIFIED', verifiedAt: new Date() } : { verificationStatus: 'REJECTED' },
      }),
      this.prisma.auditLog.create({ data: { actorId: adminId, action: approve ? 'tutor.approve' : 'tutor.reject', entityType: 'TutorApplication', entityId: app.id, meta: { note } } }),
    ]);
    // Always tell them: this is the news they've been waiting for, so it ignores notification settings.
    const title = approve ? 'You’re BrainBox approved!' : 'Your BrainBox application';
    const body = approve ? 'Parents can now find and book you. Open the app to set your availability.' : 'Thanks for applying. This time we couldn’t approve your application.';
    await this.messaging.push([app.applicantId], { title, body, url: '/tutor' });
    if (app.applicant.email) {
      await this.messaging.email({ to: app.applicant.email, subject: title, text: `Hi ${app.applicant.firstName},\n\n${body}${!approve && note ? `\n\n${note}` : ''}`, html: layout(`<p>Hi ${esc(app.applicant.firstName)},</p><p>${esc(body)}</p>${!approve && note ? `<p>${esc(note)}</p>` : ''}`) });
    }
    return { ok: true };
  }

  async resolveDispute(adminId: string, sessionId: string, release: boolean) {
    const s = await this.prisma.tutorSession.findUnique({ where: { id: sessionId } });
    if (!s || s.escrowStatus !== 'DISPUTED') throw new BadRequestException('That lesson is not in dispute.');
    if (release) {
      await this.prisma.tutorSession.update({ where: { id: s.id }, data: { escrowStatus: 'HELD' } });
      await this.ledger.releaseEscrow(s.id, 'dispute resolved in tutor’s favour');
    } else {
      const payment = s.paymentId ? await this.prisma.payment.findUnique({ where: { id: s.paymentId } }) : null;
      let refundReference = '';
      if (payment) {
        const raw = (payment.rawWebhook ?? {}) as { gateway_transaction_ref?: string; gateway_ref?: string };
        const gatewayRef = raw.gateway_transaction_ref ?? raw.gateway_ref;
        if (!gatewayRef) throw new BadRequestException('This payment has no Squad gateway reference. Refund it from the Squad dashboard, then mark it here.');
        ({ refundReference } = await this.squad.refund({ transactionRef: payment.reference, gatewayRef, reason: 'Lesson dispute upheld by BrainBox' }));
      }
      await this.ledger.refundEscrow(s.id, refundReference);
    }
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: release ? 'dispute.release' : 'dispute.refund', entityType: 'TutorSession', entityId: s.id } });
    return { ok: true };
  }

  /** Daily: if a completed lesson is still held after 7 days with no dispute, pay the tutor. */
  @Cron('0 9 * * *', { timeZone: 'Africa/Lagos' })
  async autoRelease() {
    const due = await this.prisma.tutorSession.findMany({
      where: { escrowStatus: 'HELD', status: 'COMPLETED', completedAt: { lt: addDays(new Date(), -AUTO_RELEASE_DAYS) } },
      select: { id: true },
    });
    for (const s of due) await this.ledger.releaseEscrow(s.id, `no dispute within ${AUTO_RELEASE_DAYS} days`);
    if (due.length) this.logger.log(`Auto-released ${due.length} lesson payments`);
  }
}
