import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { addDays, lagosDay, lagosMidnightInstant } from '../common/dates.js';
import { formatNaira } from '../common/money.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { planPriceKobo } from '../settings/settings.js';
import { SettingsService } from '../settings/settings.service.js';
import { accessUntil } from './plan.js';

const DAY = 86_400_000;

/** Thrown when a parent's view needs the paid plan. The apps show `message` as is. */
export class PlanRequiredException extends HttpException {
  constructor(message: string) {
    super({ statusCode: HttpStatus.PAYMENT_REQUIRED, code: 'PLAN_REQUIRED', message }, HttpStatus.PAYMENT_REQUIRED);
  }
}

/** A child on the free plan has used today's questions. Children are never asked to pay: this only says "come back tomorrow". */
export class DailyLimitException extends HttpException {
  constructor(perDay: number) {
    super(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, code: 'DAILY_LIMIT', message: `That’s your ${perDay} questions for today. Great work! Come back tomorrow for more.` },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly messaging: MessagingService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * The parent's plan. The free trial starts the first time we see a child on the account,
   * however the child got there (added by the parent, accepted from a school, or created by a school).
   */
  async status(parentId: string, now = new Date()) {
    const s = await this.settings.get();
    let user = await this.prisma.user.findUniqueOrThrow({ where: { id: parentId }, select: { trialEndsAt: true, paidUntil: true } });
    const hasChildren = (await this.prisma.guardianship.count({ where: { parentId, confirmedAt: { not: null } } })) > 0;
    if (!user.trialEndsAt && hasChildren) {
      // Conditional so two requests at once can't both start (and lengthen) the trial.
      await this.prisma.user.updateMany({ where: { id: parentId, trialEndsAt: null }, data: { trialEndsAt: addDays(now, s.trialDays) } });
      user = await this.prisma.user.findUniqueOrThrow({ where: { id: parentId }, select: { trialEndsAt: true, paidUntil: true } });
    }
    const until = accessUntil(user);
    const active = !!until && until > now;
    const paid = !!user.paidUntil && user.paidUntil > now;
    const state = !hasChildren && !until ? 'NO_CHILDREN' : paid ? 'ACTIVE' : active ? 'TRIAL' : 'FREE';
    return {
      state,
      trialEndsAt: user.trialEndsAt,
      paidUntil: user.paidUntil,
      accessUntil: until,
      daysLeft: active ? Math.ceil((until.getTime() - now.getTime()) / DAY) : 0,
      priceKobo: planPriceKobo(s).toString(),
      planDays: s.planDays,
      trialDays: s.trialDays,
      freeDailyQuestions: s.freeDailyQuestions,
    } as const;
  }

  /** Everything included: the trial or the paid plan. (A parent with no children yet has nothing to limit.) */
  async parentHasAccess(parentId: string) {
    return (await this.status(parentId)).state !== 'FREE';
  }

  /** Full practice while any of the child's parents is on the trial or plan. Children with no parent on BrainBox yet (school-only) aren't limited. */
  async studentHasAccess(studentId: string) {
    const links = await this.prisma.guardianship.findMany({ where: { studentId, confirmedAt: { not: null } }, select: { parentId: true } });
    if (!links.length) return true;
    for (const l of links) if (await this.parentHasAccess(l.parentId)) return true;
    return false;
  }

  /** The child's practice today: no limit (null) on the trial or plan, otherwise the free 10 and what's left. */
  async practiceToday(studentId: string): Promise<{ limit: number | null; left: number | null }> {
    if (await this.studentHasAccess(studentId)) return { limit: null, left: null };
    const [{ freeDailyQuestions: limit }, today] = await Promise.all([
      this.settings.get(),
      this.prisma.questionSeen.count({ where: { studentId, lastSeenAt: { gte: lagosMidnightInstant(lagosDay()) } } }),
    ]);
    return { limit, left: Math.max(0, limit - today) };
  }

  /** How many questions the next round may have: null for no limit. Throws once the free 10 are used. */
  async practiceAllowance(studentId: string): Promise<number | null> {
    const { limit, left } = await this.practiceToday(studentId);
    if (left === 0) throw new DailyLimitException(limit ?? 0);
    return left;
  }

  /**
   * The parent whose rewards wallet the child's coins go to: the primary parent first, and only one on the trial or paid plan.
   * null means the child doesn't earn coins right now.
   */
  async rewardsParent(studentId: string): Promise<string | null> {
    const links = await this.prisma.guardianship.findMany({ where: { studentId, confirmedAt: { not: null } }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], select: { parentId: true } });
    for (const l of links) if (await this.parentHasAccess(l.parentId)) return l.parentId;
    return null;
  }

  async assertParentAccess(parentId: string) {
    if (!(await this.parentHasAccess(parentId))) {
      throw new PlanRequiredException(`Weekly reports are part of the ${formatNaira(planPriceKobo(await this.settings.get()))} plan. Upgrade to see them again.`);
    }
  }

  startPayment(origin: string, parentId: string) {
    return this.payments.startSubscription(origin, parentId);
  }

  /** 9am Lagos: a reminder 3 days before access ends, and one on the day it ends. Each falls in exactly one daily window. */
  @Cron('0 9 * * *', { timeZone: 'Africa/Lagos' })
  async remind(now = new Date()) {
    const s = await this.settings.get();
    const price = formatNaira(planPriceKobo(s));
    const parents = await this.prisma.user.findMany({
      where: {
        childrenLinks: { some: { confirmedAt: { not: null } } },
        OR: [{ trialEndsAt: { gte: addDays(now, -1) } }, { paidUntil: { gte: addDays(now, -1) } }],
      },
      select: { id: true, trialEndsAt: true, paidUntil: true },
    });
    let sent = 0;
    for (const p of parents) {
      const until = accessUntil(p)!;
      const paid = !!p.paidUntil && p.paidUntil.getTime() === until.getTime();
      const left = until.getTime() - now.getTime();
      if (left > 2 * DAY && left <= 3 * DAY) {
        this.messaging.notify([p.id], 'payments', {
          title: paid ? 'Your BrainBox plan ends in 3 days' : 'Your free trial ends in 3 days',
          body: `Keep unlimited practice, reports and rewards: ${price} for the next ${s.planDays} days, for all your children.`,
          url: '/parent/plan',
        });
        sent++;
      } else if (left <= 0 && left > -DAY) {
        this.messaging.notify([p.id], 'payments', {
          title: paid ? 'Your BrainBox plan has ended' : 'Your free trial has ended',
          body: `You’re on the free plan now: ${s.freeDailyQuestions} questions a day, no reports or rewards. Upgrade for ${price} to get everything back.`,
          url: '/parent/plan',
        });
        sent++;
      }
    }
    if (sent) this.logger.log(`Sent ${sent} plan reminders`);
  }
}
