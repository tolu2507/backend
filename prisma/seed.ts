/**
 * Loads the content Nexus needs to work: badges, platform wallets, student quests,
 * tutor subject tests and one Overwatch admin. Safe to run repeatedly.
 *   pnpm db:seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';

import { ACTIVITIES } from './content/activities.js';
import { VETTING_TESTS } from './content/vetting.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const prisma = new PrismaClient();

const BADGES = [
  { code: 'FIRST_QUEST', name: 'First quest', description: 'Finished your first quest' },
  { code: 'STREAK_3', name: '3-day streak', description: 'Learned 3 days in a row' },
  { code: 'STREAK_7', name: 'Week warrior', description: 'Learned 7 days in a row' },
  { code: 'STREAK_30', name: 'Unstoppable', description: 'Learned 30 days in a row' },
  { code: 'XP_500', name: 'Rising star', description: 'Earned 500 XP' },
  { code: 'XP_2000', name: 'Scholar', description: 'Earned 2,000 XP' },
  { code: 'FIRST_LESSON_QUIZ', name: 'Lesson champ', description: 'Finished your first lesson quiz' },
  { code: 'PERFECT_SCORE', name: 'Perfect score', description: 'Got every question right in a lesson quiz' },
];

async function main() {
  for (const b of BADGES) await prisma.badge.upsert({ where: { code: b.code }, update: b, create: { ...b, criteria: {} } });

  for (const type of ['ESCROW', 'PLATFORM_REVENUE'] as const) {
    const exists = await prisma.wallet.findFirst({ where: { type, userId: null, schoolId: null } });
    if (!exists) await prisma.wallet.create({ data: { type } });
  }

  for (const act of ACTIVITIES) {
    const existing = await prisma.learningActivity.findFirst({ where: { title: act.title, level: act.level, schoolId: null } });
    const data = { subject: act.subject, level: act.level, topic: act.topic, title: act.title, type: act.type, xpReward: act.xpReward, content: { questions: act.questions }, isPublished: true };
    if (existing) await prisma.learningActivity.update({ where: { id: existing.id }, data });
    else await prisma.learningActivity.create({ data });
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'overwatch@nexus.local').toLowerCase();
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const password = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(9).toString('base64url');
    admin = await prisma.user.create({
      data: { email: adminEmail, firstName: 'Overwatch', lastName: 'Admin', passwordHash: await bcrypt.hash(password, 12), memberships: { create: { role: 'PLATFORM_ADMIN' } } },
    });
    console.log(`\nOverwatch admin created: ${adminEmail} / ${password}  (save this; it is not shown again)\n`);
  }

  for (const test of VETTING_TESTS) {
    await prisma.vettingTest.upsert({
      where: { subject_level_version: { subject: test.subject, level: test.level, version: 1 } },
      update: { title: test.title, passMark: test.passMark, durationMinutes: test.durationMinutes, questions: test.questions },
      create: { ...test, version: 1, authorId: admin.id },
    });
  }

  console.log(`Seeded ${BADGES.length} badges, ${ACTIVITIES.length} quests, ${VETTING_TESTS.length} tutor tests.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
