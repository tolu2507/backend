/**
 * Overwatch from the terminal, until the web dashboard is built.
 *   pnpm overwatch list                       applications and their test results
 *   pnpm overwatch approve <email> [note]     approve a tutor (after their interview)
 *   pnpm overwatch reject <email> [note]
 */
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const prisma = new PrismaClient();
const [cmd, email, ...rest] = process.argv.slice(2);

async function main() {
  if (cmd === 'list') {
    const apps = await prisma.tutorApplication.findMany({
      include: { applicant: true, tutorProfile: { include: { subjects: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    for (const a of apps) {
      const passed = a.tutorProfile.subjects.filter((s) => s.approvedAt).map((s) => `${s.subject} ${Math.round((s.testScore ?? 0) * 100)}%`);
      console.log(`${a.status.padEnd(16)} ${a.applicant.email ?? a.applicant.phone}  ${a.applicant.firstName} ${a.applicant.lastName}  NIN:${a.ninNumber ? 'yes' : 'no'}  passed: ${passed.join(', ') || '—'}`);
    }
    return;
  }
  if (cmd === 'approve' || cmd === 'reject') {
    const user = await prisma.user.findUnique({ where: { email: email?.toLowerCase() }, include: { tutorProfile: { include: { subjects: true, applications: { orderBy: { createdAt: 'desc' }, take: 1 } } } } });
    const profile = user?.tutorProfile;
    const app = profile?.applications[0];
    if (!profile || !app) throw new Error(`No tutor application for ${email}`);
    if (cmd === 'approve' && !profile.subjects.some((s) => s.approvedAt)) throw new Error('They have not passed a subject test yet.');
    const admin = await prisma.user.findFirst({ where: { memberships: { some: { role: 'PLATFORM_ADMIN' } } } });
    await prisma.$transaction([
      prisma.tutorApplication.update({ where: { id: app.id }, data: { status: cmd === 'approve' ? 'APPROVED' : 'REJECTED', reviewerId: admin?.id, decisionAt: new Date(), decisionReason: rest.join(' ') || null } }),
      prisma.tutorProfile.update({ where: { id: profile.id }, data: cmd === 'approve' ? { verificationStatus: 'VERIFIED', verifiedAt: new Date() } : { verificationStatus: 'REJECTED' } }),
    ]);
    console.log(`${cmd === 'approve' ? 'Approved' : 'Rejected'} ${email}`);
    return;
  }
  console.log('Usage: pnpm overwatch list | approve <email> [note] | reject <email> [note]');
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
