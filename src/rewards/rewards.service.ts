import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Prisma, RedemptionStatus, RewardKind, RewardRedemption } from '@prisma/client';

import { lagosDay, lagosMidnightInstant } from '../common/dates.js';
import { formatNaira } from '../common/money.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { SquadService, type DataPlan, type VendResult } from '../payments/squad.service.js';
import { GamificationService } from '../gamification/gamification.service.js';
import { PlanRequiredException, PlanService } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { planPriceKobo, rewardKobo, rewardsBudgetKobo, stickerCoins } from '../settings/settings.js';
import { SettingsService } from '../settings/settings.service.js';

export const NETWORKS = ['MTN', 'GLO', 'AIRTEL', '9MOBILE'] as const;
const AIRTIME_OPTIONS_KOBO = [50_000n, 100_000n, 200_000n, 500_000n]; // ₦500, ₦1,000, ₦2,000, ₦5,000
const PLANS_CACHE_MS = 30 * 60_000;
const OPEN: RedemptionStatus[] = ['SENDING', 'PENDING', 'SUCCESS', 'CHECK']; // count against the budget

/** 08031234567 or +2348031234567 → 08031234567. null if it isn't a Nigerian mobile number. */
export function nigerianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.startsWith('234') && digits.length === 13 ? `0${digits.slice(3)}` : digits;
  return /^0[789][01]\d{8}$/.test(local) ? local : null;
}

/** First instant of the current Lagos calendar month. */
function monthStart() {
  const d = lagosDay();
  return lagosMidnightInstant(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

/**
 * Earn while you learn, the parent's side: children's coins become naira in the parent's rewards wallet,
 * and the parent collects it as airtime or data through Squad.
 */
@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);
  private readonly plansCache = new Map<string, { at: number; plans: DataPlan[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly squad: SquadService,
    private readonly plan: PlanService,
    private readonly messaging: MessagingService,
    private readonly settings: SettingsService,
    private readonly game: GamificationService,
  ) {}

  private wallet(parentId: string) {
    return this.prisma.$transaction((tx) => this.ledger.userWallet(tx, parentId, 'REWARDS'));
  }

  async overview(parentId: string) {
    const [wallet, plan, links, s] = await Promise.all([
      this.wallet(parentId),
      this.plan.status(parentId),
      this.prisma.guardianship.findMany({ where: { parentId, confirmedAt: { not: null } }, orderBy: { createdAt: 'asc' }, include: { student: { include: { user: { select: { firstName: true } } } } } }),
      this.settings.get(),
    ]);
    const [entries, redemptions, earned] = await Promise.all([
      this.prisma.ledgerEntry.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.rewardRedemption.findMany({ where: { parentId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.game.earnedKobo(links.map((l) => l.studentId)),
    ]);
    return {
      balanceKobo: wallet.balanceKobo.toString(),
      planState: plan.state,
      // Children earn on the trial and the plan; collecting needs the paid plan (so free trials can't be farmed for airtime).
      earning: s.rewardsEnabled && (plan.state === 'TRIAL' || plan.state === 'ACTIVE'),
      canCollect: s.rewardsEnabled && plan.state === 'ACTIVE',
      rewardsEnabled: s.rewardsEnabled,
      coinsPerReward: s.coinsPerReward,
      rewardKobo: rewardKobo(s).toString(),
      // How children earn, for the "How your children earn" card (all Overwatch settings).
      rates: { perCorrect: s.coinsPerCorrect, practicePerDay: s.practiceCoinsPerDay, perMock: s.coinsPerMock, stickers: stickerCoins(s) },
      airtimeOptionsKobo: AIRTIME_OPTIONS_KOBO.map(String),
      networks: NETWORKS,
      children: links.map((l) => ({
        studentId: l.studentId,
        firstName: l.student.user.firstName,
        coins: l.student.coins,
        earnedKobo: (earned.get(l.studentId) ?? 0n).toString(),
      })),
      activity: entries.map((e) => ({ id: e.id, description: e.description, amountKobo: e.amountKobo.toString(), createdAt: e.createdAt })),
      redemptions: redemptions.map(publicRedemption),
    };
  }

  async dataPlans(network: string) {
    const cached = this.plansCache.get(network);
    const plans = cached && Date.now() - cached.at < PLANS_CACHE_MS ? cached.plans : await this.squad.dataBundles(network);
    this.plansCache.set(network, { at: cached?.at && plans === cached.plans ? cached.at : Date.now(), plans });
    return plans.map((p) => ({ planCode: p.planCode, name: p.name, priceKobo: p.priceKobo.toString() }));
  }

  /** Sends airtime or data to the parent's phone. Money leaves the rewards wallet first and comes back if Squad says no. */
  async redeem(parentId: string, input: { kind: RewardKind; network: string; phone: string; amountKobo?: string; planCode?: string }) {
    const [plan, s] = await Promise.all([this.plan.status(parentId), this.settings.get()]);
    if (!s.rewardsEnabled) throw new ServiceUnavailableException('Rewards are paused for now. Your balance is safe.');
    if (plan.state !== 'ACTIVE') {
      throw new PlanRequiredException(`Collecting rewards is part of the ${formatNaira(planPriceKobo(s))} plan. Everything your children earn stays in your rewards balance until then.`);
    }
    const phone = nigerianMobile(input.phone);
    if (!phone) throw new BadRequestException('Enter an 11-digit Nigerian mobile number, like 08031234567.');
    this.squad.assertReady();

    let amountKobo: bigint;
    let planName: string | null = null;
    if (input.kind === 'AIRTIME') {
      amountKobo = BigInt(input.amountKobo ?? '0');
      if (!AIRTIME_OPTIONS_KOBO.includes(amountKobo)) throw new BadRequestException(`Choose ${AIRTIME_OPTIONS_KOBO.map(formatNaira).join(', ')} of airtime.`);
    } else {
      const found = (await this.dataPlans(input.network)).find((p) => p.planCode === input.planCode);
      if (!found) throw new BadRequestException('That data plan is no longer available. Pick another one.');
      amountKobo = BigInt(found.priceKobo);
      planName = found.name;
    }

    const wallet = await this.wallet(parentId);
    if (wallet.balanceKobo < amountKobo) throw new BadRequestException(`You have ${formatNaira(wallet.balanceKobo)} in rewards. Pick something up to that amount.`);
    const spent = await this.prisma.rewardRedemption.aggregate({ where: { status: { in: OPEN }, createdAt: { gte: monthStart() } }, _sum: { amountKobo: true } });
    if ((spent._sum.amountKobo ?? 0n) + amountKobo > rewardsBudgetKobo(s)) {
      this.logger.warn(`Rewards budget for the month reached; ${parentId} asked for ${formatNaira(amountKobo)}`);
      throw new ServiceUnavailableException('We’ve sent out all of this month’s rewards. Please try again on the 1st: your balance is safe.');
    }
    if (await this.prisma.rewardRedemption.count({ where: { parentId, status: 'SENDING' } })) {
      throw new BadRequestException('Your last reward is still sending. Give it a minute.');
    }

    const r = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rewardRedemption.create({ data: { parentId, kind: input.kind, network: input.network, phone, planCode: input.planCode ?? null, planName, amountKobo } });
      await this.ledger.post(tx, {
        walletId: wallet.id,
        amountKobo: -amountKobo,
        type: 'REWARD_REDEEMED',
        stream: 'OTHER',
        description: input.kind === 'AIRTIME' ? `${formatNaira(amountKobo)} ${input.network} airtime to ${phone}` : `${planName} ${input.network} data to ${phone}`,
        actorId: parentId,
        idempotencyKey: `redeem:${created.id}`,
      });
      return created;
    });

    const result = await this.squad.vend({ kind: input.kind, phone, amountKobo, planCode: input.planCode });
    return publicRedemption(await this.settle(r, result));
  }

  /** Records what Squad said. FAILED puts the money back; UNKNOWN waits for Overwatch. */
  private async settle(r: RewardRedemption, result: VendResult) {
    const status: RedemptionStatus = result.outcome === 'UNKNOWN' ? 'CHECK' : result.outcome;
    const data: Prisma.RewardRedemptionUpdateInput = {
      status,
      providerRef: result.reference ?? null,
      providerMeta: (result.raw ?? undefined) as Prisma.InputJsonValue | undefined,
      error: result.error ?? null,
      completedAt: status === 'SUCCESS' || status === 'FAILED' ? new Date() : null,
    };
    if (status === 'FAILED') return this.fail(r, data);
    const updated = await this.prisma.rewardRedemption.update({ where: { id: r.id }, data });
    if (status === 'SUCCESS') this.sentNotice(updated);
    return updated;
  }

  private async fail(r: RewardRedemption, data: Prisma.RewardRedemptionUpdateInput = { status: 'FAILED', completedAt: new Date() }) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.rewardRedemption.updateMany({ where: { id: r.id, status: { not: 'FAILED' } }, data: { ...(data as Prisma.RewardRedemptionUpdateManyMutationInput), status: 'FAILED' } });
      if (claimed.count) {
        const wallet = await this.ledger.userWallet(tx, r.parentId, 'REWARDS');
        await this.ledger.post(tx, { walletId: wallet.id, amountKobo: r.amountKobo, type: 'REFUND', stream: 'OTHER', description: 'Reward didn’t send, money returned', actorId: r.parentId, idempotencyKey: `refund:${r.id}` });
      }
      return tx.rewardRedemption.findUniqueOrThrow({ where: { id: r.id } });
    });
  }

  private sentNotice(r: RewardRedemption) {
    const what = r.kind === 'AIRTIME' ? `${formatNaira(r.amountKobo)} airtime` : `${r.planName} data`;
    this.messaging.notify([r.parentId], 'payments', { title: 'Reward sent', body: `${what} is on its way to ${r.phone}.`, url: '/parent/rewards' });
  }

  /** Every 10 minutes: ask Squad about sends it was still delivering. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async followUp() {
    const open = await this.prisma.rewardRedemption.findMany({ where: { status: 'PENDING', providerRef: { not: null } }, take: 50 });
    for (const r of open) {
      try {
        const status = await this.squad.vendStatus(r.providerRef!);
        if (status === 'success') this.sentNotice(await this.prisma.rewardRedemption.update({ where: { id: r.id }, data: { status: 'SUCCESS', completedAt: new Date() } }));
        else if (status === 'failed') await this.fail(r);
      } catch (e) {
        this.logger.warn(`Checking reward ${r.id} failed: ${(e as Error).message}`);
      }
    }
  }

  // ── Overwatch ─────────────────────────────────────────

  async adminOverview(status?: RedemptionStatus) {
    const since = monthStart();
    const [spent, liability, byStatus, rows, s] = await Promise.all([
      this.prisma.rewardRedemption.aggregate({ where: { status: { in: OPEN }, createdAt: { gte: since } }, _sum: { amountKobo: true } }),
      this.prisma.wallet.aggregate({ where: { type: 'REWARDS' }, _sum: { balanceKobo: true } }),
      this.prisma.rewardRedemption.groupBy({ by: ['status'], _count: true }),
      this.prisma.rewardRedemption.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { parent: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.settings.get(),
    ]);
    return {
      month: { spentKobo: (spent._sum.amountKobo ?? 0n).toString(), budgetKobo: rewardsBudgetKobo(s).toString() },
      // Earned by children but not collected yet: what BrainBox owes parents.
      unclaimedKobo: (liability._sum.balanceKobo ?? 0n).toString(),
      counts: Object.fromEntries(byStatus.map((b) => [b.status, b._count])),
      redemptions: rows.map((r) => ({ ...publicRedemption(r), parent: `${r.parent.firstName} ${r.parent.lastName}`, email: r.parent.email, providerRef: r.providerRef, error: r.error })),
    };
  }

  /** After checking the Squad dashboard: it arrived, or it didn't (the parent gets the money back). */
  async resolve(adminId: string, id: string, outcome: 'SUCCESS' | 'FAILED') {
    const r = await this.prisma.rewardRedemption.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Reward not found.');
    if (r.status === 'SUCCESS' || r.status === 'FAILED') throw new BadRequestException(`This reward is already marked ${r.status.toLowerCase()}.`);
    const updated =
      outcome === 'FAILED'
        ? await this.fail(r)
        : await this.prisma.rewardRedemption.update({ where: { id }, data: { status: 'SUCCESS', completedAt: new Date() } });
    if (outcome === 'SUCCESS') this.sentNotice(updated);
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: `reward.${outcome.toLowerCase()}`, entityType: 'RewardRedemption', entityId: id, meta: { from: r.status } } });
    return publicRedemption(updated);
  }
}

function publicRedemption(r: RewardRedemption) {
  return {
    id: r.id,
    kind: r.kind,
    network: r.network,
    phone: r.phone,
    planName: r.planName,
    amountKobo: r.amountKobo.toString(),
    status: r.status,
    createdAt: r.createdAt,
    completedAt: r.completedAt,
  };
}
