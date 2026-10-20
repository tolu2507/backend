import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { CurrentUser, PARENT_ROLES, Roles, type AuthUser } from '../common/auth.js';
import { ExamsService } from '../exams/exams.service.js';
import { PlanService } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from './progress.service.js';

/** Parents: how each child is doing, from their own practice and Friday mocks. */
@Roles(...PARENT_ROLES)
@Controller('parent')
export class ProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly exams: ExamsService,
    private readonly prisma: PrismaService,
    private readonly plan: PlanService,
  ) {}

  /** A card for every child on the account. */
  @Get('progress') async cards(@CurrentUser() u: AuthUser) {
    const links = await this.prisma.guardianship.findMany({ where: { parentId: u.id, confirmedAt: { not: null } }, orderBy: { createdAt: 'asc' }, select: { studentId: true } });
    const cards = await this.progress.cards(links.map((l) => l.studentId));
    if (await this.plan.parentHasAccess(u.id)) return cards;
    // Plan ended: Friday mock results stay free; the week's practice numbers need the plan.
    return cards.map((c) => ({ ...c, week: null, locked: true }));
  }

  @Get('children/:id/progress') async detail(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.exams.assertGuardian(u.id, id);
    const detail = await this.progress.detail(id);
    if (await this.plan.parentHasAccess(u.id)) return detail;
    return { ...detail, week: null, subjects: [], weakTopics: [], strongTopics: [], locked: true };
  }
}
