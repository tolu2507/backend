import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { RedemptionStatus, RewardKind } from '@prisma/client';
import { IsIn, IsNumberString, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

import { CurrentUser, PARENT_ROLES, Roles, type AuthUser } from '../common/auth.js';
import { NETWORKS, RewardsService } from './rewards.service.js';

class NetworkQuery {
  @IsIn(NETWORKS) network: string;
}
class RedeemDto {
  @IsIn(Object.values(RewardKind)) kind: RewardKind;
  @IsIn(NETWORKS) network: string;
  @IsString() @Length(10, 16) phone: string;
  @ValidateIf((d: RedeemDto) => d.kind === 'AIRTIME') @IsNumberString() amountKobo?: string;
  @ValidateIf((d: RedeemDto) => d.kind === 'DATA') @IsString() @Length(1, 20) planCode?: string;
}
class StatusQuery {
  @IsOptional() @IsIn(Object.values(RedemptionStatus)) status?: RedemptionStatus;
}
class ResolveDto {
  @IsIn(['SUCCESS', 'FAILED']) outcome: 'SUCCESS' | 'FAILED';
}

/** Parents: what their children earned, and collecting it as airtime or data. */
@Roles(...PARENT_ROLES)
@Controller('parent/rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get() overview(@CurrentUser() u: AuthUser) {
    return this.rewards.overview(u.id);
  }

  @Get('data-plans') dataPlans(@Query() q: NetworkQuery) {
    return this.rewards.dataPlans(q.network);
  }

  @HttpCode(200) @Post('redeem') redeem(@CurrentUser() u: AuthUser, @Body() dto: RedeemDto) {
    return this.rewards.redeem(u.id, dto);
  }
}

/** Overwatch: the month's rewards spend against the budget, and sends that need a human to check. */
@Roles('PLATFORM_ADMIN')
@Controller('admin/rewards')
export class AdminRewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get() overview(@Query() q: StatusQuery) {
    return this.rewards.adminOverview(q.status);
  }

  @HttpCode(200) @Post(':id/resolve') resolve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveDto) {
    return this.rewards.resolve(u.id, id, dto.outcome);
  }
}
