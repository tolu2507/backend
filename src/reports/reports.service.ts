import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { AiService } from '../ai/ai.service.js';
import { addDays, lagosMidnightInstant, weekLabel, weekStart } from '../common/dates.js';
import { DEFAULT_PREFS, type NotificationPrefs } from '../messaging/prefs.js';
import { esc, layout, MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const STALE_AFTER_MS = 3 * 60 * 60 * 1000; // a week-to-date report refreshes at most every 3 hours

type Metrics = {
  childName: string;
  grade: string | null;
  attendance: { present: number; total: number } | null;
  xpEarned: number;
  streak: number;
  subjects: { name: string; score: number; from: string[] }[];
  lessons: { subject: string; topics: string[]; quizScore: number | null }[];
  teacherNotes: string[];
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly messaging: MessagingService,
  ) {}

  /** Collects the real facts for one student's week. Returns null when there's nothing to report. */
  async metrics(studentId: string, week: Date): Promise<Metrics | null> {
    const from = lagosMidnightInstant(week);
    const to = lagosMidnightInstant(addDays(week, 7));
    const student = await this.prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId }, include: { user: true } });

    const [attendance, results, attempts, quizzes, xp, notes] = await Promise.all([
      this.prisma.attendance.findMany({ where: { studentId, date: { gte: week, lt: addDays(week, 7) } } }),
      this.prisma.assessmentResult.findMany({
        where: { studentId, assessment: { heldOn: { gte: week, lt: addDays(week, 7) } } },
        include: { assessment: { include: { classSubject: { include: { subject: true } } } } },
      }),
      this.prisma.activityAttempt.findMany({ where: { studentId, completedAt: { gte: from, lt: to } }, include: { activity: true } }),
      this.prisma.lessonQuiz.findMany({ where: { studentId, completedAt: { gte: from, lt: to } }, include: { session: { include: { booking: { include: { request: true } } } } } }),
      this.prisma.xpEvent.aggregate({ where: { studentId, createdAt: { gte: from, lt: to } }, _sum: { amount: true } }),
      this.prisma.teacherNote.findMany({ where: { studentId, visibleToParent: true, createdAt: { gte: from, lt: to } } }),
    ]);
    const sessions = await this.prisma.tutorSession.findMany({
      where: { status: 'COMPLETED', completedAt: { gte: from, lt: to }, booking: { studentId } },
      include: { booking: { include: { request: true } }, quiz: true },
    });

    if (!attendance.length && !results.length && !attempts.length && !quizzes.length && !sessions.length) return null;

    const bySubject = new Map<string, { total: number; n: number; from: Set<string> }>();
    const add = (subject: string, score: number, source: string) => {
      const s = bySubject.get(subject) ?? { total: 0, n: 0, from: new Set<string>() };
      s.total += score;
      s.n += 1;
      s.from.add(source);
      bySubject.set(subject, s);
    };
    for (const r of results) add(r.assessment.classSubject.subject.name, r.score / r.assessment.maxScore, 'school test');
    for (const a of attempts) if (a.score != null) add(a.activity.subject, a.score, 'Nexus quests');
    for (const q of quizzes) if (q.score != null) add(q.session.booking.request?.subject ?? q.title.split(' · ')[0], q.score, 'lesson quiz');

    return {
      childName: student.user.firstName,
      grade: student.gradeName,
      attendance: attendance.length ? { present: attendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length, total: attendance.length } : null,
      xpEarned: xp._sum.amount ?? 0,
      streak: student.currentStreak,
      subjects: [...bySubject.entries()]
        .map(([name, s]) => ({ name, score: Math.round((s.total / s.n) * 100), from: [...s.from] }))
        .sort((a, b) => b.score - a.score),
      lessons: sessions.map((s) => ({ subject: s.booking.request?.subject ?? 'Lesson', topics: s.topicsCovered, quizScore: s.quiz?.score != null ? Math.round(s.quiz.score * 100) : null })),
      teacherNotes: notes.map((n) => n.body),
    };
  }

  /** Plain-English summary used when AI isn't available. Built only from the facts. */
  private fallbackText(m: Metrics) {
    const best = m.subjects[0];
    const weakest = m.subjects.length > 1 ? m.subjects[m.subjects.length - 1] : null;
    const parts = [`${m.childName} earned ${m.xpEarned} XP this week`];
    if (best) parts.push(`and did best in ${best.name} (${best.score}%)`);
    const headline = `${parts.join(' ')}.${weakest && weakest.score < 60 ? ` ${weakest.name} needs some extra practice.` : ''}`;
    const homeTip = weakest
      ? `Spend 10 minutes asking ${m.childName} to teach you one thing from ${weakest.name} this week. Explaining it out loud is one of the fastest ways to learn.`
      : `Ask ${m.childName} to show you their favourite quest in the app and explain how they solved it.`;
    return { headline, summary: '', homeTip };
  }

  async generate(studentId: string, week = weekStart()) {
    const m = await this.metrics(studentId, week);
    if (!m) return null;
    const ai = await this.ai.weeklySummary({ ...m, subjects: m.subjects.map(({ name, score }) => ({ name, score })) });
    const text = ai ?? this.fallbackText(m);

    const weakest = m.subjects.length ? m.subjects[m.subjects.length - 1] : null;
    let tutorSuggestion: { subject: string; count: number } | null = null;
    if (weakest && weakest.score < 55) {
      const student = await this.prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId } });
      const count = await this.prisma.tutorSubject.count({
        where: { subject: weakest.name, level: student.level, approvedAt: { not: null }, tutor: { verificationStatus: 'VERIFIED', isAcceptingStudents: true } },
      });
      if (count > 0) tutorSuggestion = { subject: weakest.name, count };
    }

    return this.prisma.weeklyReport.upsert({
      where: { studentId_weekStart: { studentId, weekStart: week } },
      update: { headline: text.headline, summary: text.summary, metrics: m, suggestions: { homeTip: text.homeTip, tutorSuggestion }, model: ai ? this.ai.model : 'summary', status: 'READY', generatedAt: new Date() },
      create: { studentId, weekStart: week, headline: text.headline, summary: text.summary, metrics: m, suggestions: { homeTip: text.homeTip, tutorSuggestion }, model: ai ? this.ai.model : 'summary', status: 'READY', generatedAt: new Date() },
    });
  }

  /** This week's report so far (refreshed when stale), else last week's, else null. */
  async latest(studentId: string) {
    const week = weekStart();
    let report = await this.prisma.weeklyReport.findUnique({ where: { studentId_weekStart: { studentId, weekStart: week } } });
    if (!report || !report.generatedAt || Date.now() - report.generatedAt.getTime() > STALE_AFTER_MS) {
      report = (await this.generate(studentId, week)) ?? report;
    }
    report ??= await this.prisma.weeklyReport.findFirst({ where: { studentId, status: 'READY' }, orderBy: { weekStart: 'desc' } });
    if (!report) return null;

    const m = report.metrics as unknown as Metrics;
    const s = report.suggestions as { homeTip: string; tutorSuggestion: { subject: string; count: number } | null };
    return {
      id: report.id,
      studentId,
      weekLabel: weekLabel(report.weekStart),
      isThisWeek: report.weekStart.getTime() === week.getTime(),
      headline: report.headline,
      summary: report.summary,
      attendance: m.attendance,
      xpEarned: m.xpEarned,
      streak: m.streak,
      subjects: m.subjects.map(({ name, score }) => ({ name, score })),
      lessons: m.lessons,
      homeTip: s.homeTip,
      tutorSuggestion: s.tutorSuggestion,
      writtenBy: report.model === 'summary' ? 'summary' : 'ai',
      updatedAt: report.generatedAt,
    };
  }

  /** Fridays 4pm Lagos: finalise the week's report for every child whose parent agreed to AI reports. */
  @Cron('0 16 * * 5', { timeZone: 'Africa/Lagos' })
  async weeklyRun() {
    const students = await this.prisma.studentProfile.findMany({
      where: { guardians: { some: {} }, consents: { some: { type: 'AI_REPORTS', revokedAt: null } } },
      include: { guardians: true },
    });
    let made = 0;
    for (const s of students) {
      try {
        const report = await this.generate(s.id);
        if (!report) continue;
        made++;
        for (const g of s.guardians) await this.deliver(report.id, g.parentId);
      } catch (e) {
        this.logger.error(`Report for ${s.id} failed: ${(e as Error).message}`);
      }
    }
    this.logger.log(`Weekly reports: ${made} generated`);
  }

  /** In the app always; by email when the parent has one; on WhatsApp only if they opted in (it costs per message). */
  private async deliver(reportId: string, parentId: string) {
    const [report, parent] = await Promise.all([
      this.prisma.weeklyReport.findUniqueOrThrow({ where: { id: reportId }, include: { student: { include: { user: true } } } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: parentId } }),
    ]);
    const prefs: NotificationPrefs = { ...DEFAULT_PREFS, ...(parent.notificationPrefs as Partial<NotificationPrefs> | null) };
    const record = async (channel: 'APP' | 'EMAIL' | 'WHATSAPP', send: () => Promise<boolean>) => {
      const done = await this.prisma.reportDelivery.findUnique({ where: { reportId_parentId_channel: { reportId, parentId, channel } } });
      if (done?.sentAt) return;
      const ok = await send();
      const data = { sentAt: ok ? new Date() : null, error: ok ? null : 'not delivered' };
      await this.prisma.reportDelivery.upsert({ where: { reportId_parentId_channel: { reportId, parentId, channel } }, update: data, create: { reportId, parentId, channel, ...data } });
    };

    await record('APP', async () => true);
    if (!prefs.weeklyReport) return;

    const child = report.student.user.firstName;
    await this.messaging.push([parentId], { title: `${child}'s weekly report is ready`, body: report.headline ?? 'See how the week went.', url: '/parent' });
    const m = report.metrics as unknown as Metrics;
    const tip = (report.suggestions as { homeTip?: string }).homeTip;
    const headline = report.headline ?? `${child}'s week at a glance`;
    if (parent.email) {
      const rows = m.subjects.map((x) => `<tr><td style="padding:4px 12px 4px 0">${esc(x.name)}</td><td style="font-weight:700">${x.score}%</td></tr>`).join('');
      await record('EMAIL', () =>
        this.messaging.email({
          to: parent.email!,
          subject: `${child}'s week: ${headline}`,
          text: [`Hi ${parent.firstName},`, '', headline, report.summary ?? '', m.attendance ? `Attendance: ${m.attendance.present}/${m.attendance.total} days` : '', ...m.subjects.map((x) => `${x.name}: ${x.score}%`), tip ? `\nThis week at home: ${tip}` : '', '', 'Open the Nexus app for the full report.'].filter(Boolean).join('\n'),
          html: layout(
            `<p>Hi ${esc(parent.firstName)},</p><h2 style="margin:8px 0">${esc(headline)}</h2><p>${esc(report.summary ?? '').replace(/\n/g, '<br>')}</p>` +
              (m.attendance ? `<p><b>Attendance:</b> ${m.attendance.present} of ${m.attendance.total} days</p>` : '') +
              (rows ? `<table style="margin:8px 0">${rows}</table>` : '') +
              (tip ? `<p style="background:#E2F5EF;padding:12px;border-radius:12px"><b>This week at home:</b> ${esc(tip)}</p>` : '') +
              `<p>Open the Nexus app for the full report.</p>`,
          ),
        }),
      );
    }
    if (prefs.whatsAppReports && parent.phone) {
      await record('WHATSAPP', () => this.messaging.whatsApp({ to: parent.phone!, name: process.env.WHATSAPP_REPORT_TEMPLATE ?? 'weekly_report', params: [parent.firstName, child, headline] }));
    }
  }
}
