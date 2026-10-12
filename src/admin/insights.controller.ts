import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateIf, ValidateNested } from 'class-validator';
import type { ActivityType, Curriculum, EducationLevel, LedgerEntryType, PaymentPurpose, PaymentStatus, RevenueStream, TermName, WalletType } from '@prisma/client';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { ContentService } from './content.service.js';
import { InsightsService, type PeopleKind } from './insights.service.js';

const LEVELS = ['NURSERY', 'PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY'];
const TERMS = ['FIRST', 'SECOND', 'THIRD'];
const CURRICULA = ['NIGERIAN', 'BRITISH', 'AMERICAN', 'MONTESSORI', 'IB', 'BLENDED'];
const ACTIVITY_TYPES = ['QUIZ', 'PRACTICE', 'READING', 'CHALLENGE', 'GAME'];
const WALLET_TYPES = ['STUDENT_SPEND', 'TUTOR_EARNINGS', 'SCHOOL_REVENUE', 'PLATFORM_REVENUE', 'ESCROW'];
const ENTRY_TYPES = ['TOPUP', 'PURCHASE', 'FEE_PAYMENT', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'PLATFORM_FEE', 'PAYOUT', 'REFUND', 'ADJUSTMENT'];
const STREAMS = ['SCHOOL_FEES', 'TUCK_SHOP', 'SUBSCRIPTION', 'TUTORING', 'OTHER'];
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const bool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) pageSize?: number;
  @IsOptional() @IsString() @Length(0, 100) q?: string;
}
class DaysQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number;
  @IsOptional() @IsUUID() schoolId?: string;
}
class PeopleQuery extends PageQuery {
  @IsIn(['STUDENT', 'PARENT', 'STAFF', 'TUTOR']) kind: PeopleKind;
  @IsOptional() @IsUUID() schoolId?: string;
  @IsOptional() @IsString() @Length(0, 30) status?: string;
}
class ActivityQuery extends PageQuery {
  @IsOptional() @IsString() schoolId?: string; // a school id, or "none" for platform-wide actions
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number;
}
class WalletQuery extends PageQuery {
  @IsOptional() @IsIn(WALLET_TYPES) type?: WalletType;
  @IsOptional() @Transform(bool) @IsBoolean() frozen?: boolean;
}
class FreezeDto {
  @IsBoolean() frozen: boolean;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 300) reason?: string;
}
class TransactionQuery extends PageQuery {
  @IsOptional() @IsIn(ENTRY_TYPES) type?: LedgerEntryType;
  @IsOptional() @IsIn(STREAMS) stream?: RevenueStream;
  @IsOptional() @IsIn(WALLET_TYPES) walletType?: WalletType;
  @IsOptional() @IsUUID() schoolId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
class PaymentQuery extends PageQuery {
  @IsOptional() @IsIn(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']) status?: PaymentStatus;
  @IsOptional() @IsIn(['WALLET_TOPUP', 'SCHOOL_FEE', 'TUTOR_SESSION', 'SUBSCRIPTION']) purpose?: PaymentPurpose;
  @IsOptional() @IsUUID() schoolId?: string;
}

class SchoolAiDto {
  @IsIn(CURRICULA) curriculum: Curriculum;
  @IsOptional() @IsString() @Length(0, 4000) instructions?: string;
  @IsBoolean() aiEnabled: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) monthlyBudgetKobo?: number | null;
}
class TopicLineDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(20) week?: number | null;
  @Transform(trim) @IsString() @Length(1, 200) topic: string;
  @IsOptional() @IsString() @Length(0, 500) objectives?: string | null;
}
class TopicsDto {
  @IsIn(LEVELS) level: EducationLevel;
  @IsOptional() @IsString() @Length(0, 30) gradeName?: string | null;
  @Transform(trim) @IsString() @Length(2, 60) subject: string;
  @IsIn(TERMS) term: TermName;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => TopicLineDto) topics: TopicLineDto[];
}
class AiTestDto {
  @Transform(trim) @IsString() @Length(2, 60) subject: string;
  @IsIn(LEVELS) level: EducationLevel;
  @IsOptional() @IsString() @Length(0, 30) gradeName?: string;
  @Transform(trim) @IsString() @Length(2, 200) topic: string;
}

class QuestionDto {
  @IsString() @Length(1, 500) prompt: string;
  @IsArray() @ArrayMinSize(4) @ArrayMaxSize(4) @IsString({ each: true }) @Length(1, 200, { each: true }) options: string[];
  @IsInt() @Min(0) @Max(3) answerIndex: number;
}
class ActivityDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() schoolId?: string | null;
  @Transform(trim) @IsString() @Length(2, 60) subject: string;
  @IsIn(LEVELS) level: EducationLevel;
  @IsOptional() @IsString() @Length(0, 30) gradeName?: string | null;
  @IsOptional() @IsString() @Length(0, 120) topic?: string | null;
  @Transform(trim) @IsString() @Length(2, 80) title: string;
  @IsIn(ACTIVITY_TYPES) type: ActivityType;
  @IsInt() @Min(5) @Max(200) xpReward: number;
  @IsBoolean() isPublished: boolean;
  @IsArray() @ArrayMinSize(3) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => QuestionDto) questions: QuestionDto[];
}
class ActivityPatchDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() schoolId?: string | null;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 60) subject?: string;
  @IsOptional() @IsIn(LEVELS) level?: EducationLevel;
  @IsOptional() @IsString() @Length(0, 30) gradeName?: string | null;
  @IsOptional() @IsString() @Length(0, 120) topic?: string | null;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 80) title?: string;
  @IsOptional() @IsIn(ACTIVITY_TYPES) type?: ActivityType;
  @IsOptional() @IsInt() @Min(5) @Max(200) xpReward?: number;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsArray() @ArrayMinSize(3) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => QuestionDto) questions?: QuestionDto[];
}
class ActivityListQuery extends PageQuery {
  @IsOptional() @IsIn(LEVELS) level?: EducationLevel;
  @IsOptional() @IsString() @Length(0, 60) subject?: string;
  @IsOptional() @IsString() schoolId?: string; // a school id, or "global" for quests every school gets
  @IsOptional() @Transform(bool) @IsBoolean() published?: boolean;
}
class DraftDto {
  @IsOptional() @IsUUID() schoolId?: string;
  @Transform(trim) @IsString() @Length(2, 60) subject: string;
  @IsIn(LEVELS) level: EducationLevel;
  @IsOptional() @IsString() @Length(0, 30) gradeName?: string;
  @Transform(trim) @IsString() @Length(2, 200) topic: string;
  @IsInt() @Min(3) @Max(15) count: number;
}

/** Overwatch dashboards and tools beyond school setup: analytics, people, activity, money, AI and learning. */
@Roles('PLATFORM_ADMIN')
@Controller('admin')
export class OverwatchInsightsController {
  constructor(
    private readonly insights: InsightsService,
    private readonly content: ContentService,
  ) {}

  @Get('analytics') analytics(@Query() q: DaysQuery) {
    return this.insights.analytics(q.days ?? 30);
  }

  @Get('people/counts') peopleCounts() {
    return this.insights.peopleCounts();
  }

  @Get('people') people(@Query() q: PeopleQuery) {
    return this.insights.people(q.kind, q);
  }

  @Get('activity') activity(@Query() q: ActivityQuery) {
    return this.insights.activity(q);
  }

  @Get('activity/summary') activitySummary(@Query() q: DaysQuery) {
    return this.insights.activitySummary(q.days ?? 30);
  }

  @Get('wallets') wallets(@Query() q: WalletQuery) {
    return this.insights.wallets(q);
  }

  @Get('wallets/:id') wallet(@Param('id') id: string) {
    return this.insights.wallet(id);
  }

  @Patch('wallets/:id') freeze(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: FreezeDto) {
    return this.insights.setWalletFrozen(u.id, id, dto.frozen, dto.reason);
  }

  @Get('transactions') transactions(@Query() q: TransactionQuery) {
    return this.insights.transactions(q);
  }

  @Get('transactions/flow') flow(@Query() q: DaysQuery) {
    return this.insights.moneyFlow(q.days ?? 30);
  }

  @Get('payments') payments(@Query() q: PaymentQuery) {
    return this.insights.payments(q);
  }

  @Get('ai/usage') aiUsage(@Query() q: DaysQuery) {
    return this.insights.aiUsage(q.days ?? 30);
  }

  @Get('learning') learning(@Query() q: DaysQuery) {
    return this.insights.learning(q.days ?? 30, q.schoolId);
  }

  // ── School AI & scheme of work ─────────────────────────

  @Get('schools/:id/ai') schoolAi(@Param('id') id: string) {
    return this.content.schoolAi(id);
  }

  @Put('schools/:id/ai') saveSchoolAi(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SchoolAiDto) {
    return this.content.saveSchoolAi(u.id, id, dto);
  }

  @Post('schools/:id/ai/topics') addTopics(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: TopicsDto) {
    return this.content.addTopics(u.id, id, dto);
  }

  @Delete('ai/topics/:id') deleteTopic(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.content.deleteTopic(u.id, id);
  }

  @HttpCode(200) @Post('schools/:id/ai/test') testSchoolAi(@Param('id') id: string, @Body() dto: AiTestDto) {
    return this.content.testSchoolAi(id, dto);
  }

  // ── Student quests ─────────────────────────────────────

  @Get('activities') activities(@Query() q: ActivityListQuery) {
    return this.content.activities(q);
  }

  @HttpCode(200) @Post('activities/draft') draft(@Body() dto: DraftDto) {
    return this.content.draftActivity(dto);
  }

  @Get('activities/:id') activityDetail(@Param('id') id: string) {
    return this.content.activity(id);
  }

  @Post('activities') createActivity(@CurrentUser() u: AuthUser, @Body() dto: ActivityDto) {
    return this.content.createActivity(u.id, dto);
  }

  @Patch('activities/:id') updateActivity(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ActivityPatchDto) {
    return this.content.updateActivity(u.id, id, dto);
  }

  @Delete('activities/:id') deleteActivity(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.content.deleteActivity(u.id, id);
  }
}
