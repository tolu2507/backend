import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma, StickerRarity } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULTS, SETTINGS, invalid, stickerCoins, type SettingKey, type Settings } from './settings.js';

/** Long enough to save a database read on every request, short enough that a change reaches every server quickly. */
const CACHE_MS = 30_000;

/** Platform settings from Overwatch, falling back to the defaults in settings.ts. */
@Injectable()
export class SettingsService {
  private cache: { at: number; value: Settings } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Settings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const rows = await this.prisma.platformSetting.findMany();
    const value = { ...DEFAULTS };
    for (const r of rows) if (r.key in SETTINGS && !invalid(r.key, r.value)) (value as Record<string, unknown>)[r.key] = r.value;
    this.cache = { at: Date.now(), value };
    return value;
  }

  /** For Overwatch: every setting with its definition, current value, and who last changed it. */
  async list() {
    const [current, rows] = await Promise.all([this.get(), this.prisma.platformSetting.findMany()]);
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.updatedById).filter((x): x is string => !!x) } }, select: { id: true, firstName: true, lastName: true } });
    const byId = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const saved = new Map(rows.map((r) => [r.key, r]));
    return Object.entries(SETTINGS).map(([key, d]) => {
      const row = saved.get(key);
      return { key, ...d, value: current[key as SettingKey], changed: !!row, updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedById ? (byId.get(row.updatedById) ?? null) : null };
    });
  }

  /** Saves the changed settings together, or none of them if any is out of range. */
  async update(adminId: string, changes: Record<string, unknown>) {
    const keys = Object.keys(changes);
    if (!keys.length) throw new BadRequestException('Nothing to save.');
    const errors = keys.map((k) => invalid(k, changes[k])).filter(Boolean);
    if (errors.length) throw new BadRequestException(errors.join(' '));

    const before = await this.get();
    await this.prisma.$transaction(async (tx) => {
      for (const key of keys) {
        const value = changes[key] as Prisma.InputJsonValue;
        await tx.platformSetting.upsert({ where: { key }, update: { value, updatedById: adminId }, create: { key, value, updatedById: adminId } });
      }
      const from = Object.fromEntries(keys.map((k) => [k, before[k as SettingKey]]));
      await tx.auditLog.create({ data: { actorId: adminId, action: 'settings.updated', entityType: 'PlatformSetting', entityId: keys.join(','), meta: { from, to: changes } as Prisma.InputJsonValue } });
    });
    this.cache = null;
    await this.syncStickerCoins();
    return this.list();
  }

  /** The sticker book shows each sticker's coins from the Badge table, so keep it in step with the rarity settings. */
  async syncStickerCoins() {
    const coins = stickerCoins(await this.get());
    for (const rarity of Object.keys(coins) as StickerRarity[]) {
      await this.prisma.badge.updateMany({ where: { rarity, coins: { not: coins[rarity] } }, data: { coins: coins[rarity] } });
    }
  }
}
