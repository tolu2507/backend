import { Controller, Get, Post } from '@nestjs/common';

import { CurrentUser, PARENT_ROLES, Roles, type AuthUser } from '../common/auth.js';
import { RequestOrigin } from '../common/origin.js';
import { PlanService } from './plan.service.js';

/** The parent's BrainBox plan: free trial, then ₦1,500 for 30 days at a time. */
@Roles(...PARENT_ROLES)
@Controller('parent/plan')
export class PlanController {
  constructor(private readonly plan: PlanService) {}

  @Get() status(@CurrentUser() u: AuthUser) {
    return this.plan.status(u.id);
  }

  @Post('pay') pay(@RequestOrigin() origin: string, @CurrentUser() u: AuthUser) {
    return this.plan.startPayment(origin, u.id);
  }
}
