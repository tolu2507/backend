import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';
import { ExamBody, QuestionOrigin, QuestionStatus } from '@prisma/client';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { PlanService } from '../plan/plan.service.js';
import { PracticeService } from './practice.service.js';
import { QuestionBankService } from './question-bank.service.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const bool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

class RoundDto {
  @IsUUID() topicId: string;
}
class SubmitRoundDto extends RoundDto {
  @IsObject() answers: Record<string, string>;
}
class ReportDto {
  @IsIn(['wrong answer', 'typo', 'unclear', 'other']) reason: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 500) note?: string;
}

/** Topic practice for students. */
@Roles('STUDENT')
@Controller('me/student/practice')
export class PracticeController {
  constructor(
    private readonly practice: PracticeService,
    private readonly plan: PlanService,
  ) {}

  @Get('subjects/:id') async map(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.practice.map(await this.practice.studentByUser(u.id), id);
  }

  @HttpCode(200) @Post('rounds') async round(@CurrentUser() u: AuthUser, @Body() dto: RoundDto) {
    const studentId = await this.practice.studentByUser(u.id);
    return this.practice.round(studentId, dto.topicId, await this.plan.practiceAllowance(studentId));
  }

  @HttpCode(200) @Post('rounds/submit') async submit(@CurrentUser() u: AuthUser, @Body() dto: SubmitRoundDto) {
    return this.practice.submit(await this.practice.studentByUser(u.id), dto.topicId, dto.answers);
  }

  @HttpCode(200) @Post('questions/:id/report') async report(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportDto) {
    return this.practice.report(await this.practice.studentByUser(u.id), id, dto.reason, dto.note);
  }
}

class QuestionQuery {
  @IsOptional() @IsIn(Object.values(ExamBody)) exam?: ExamBody;
  @IsOptional() @IsUUID() subjectId?: string;
  @IsOptional() @IsUUID() topicId?: string;
  @IsOptional() @IsIn(Object.values(QuestionStatus)) status?: QuestionStatus;
  @IsOptional() @IsIn(Object.values(QuestionOrigin)) origin?: QuestionOrigin;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) difficulty?: number;
  @IsOptional() @Transform(bool) @IsBoolean() reported?: boolean;
  @IsOptional() @IsString() @Length(0, 100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
class TemplateStatusDto {
  @IsIn(Object.values(QuestionStatus)) status: QuestionStatus;
}
class StatusDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsUUID('4', { each: true }) ids: string[];
  @IsIn(Object.values(QuestionStatus)) status: QuestionStatus;
}
class OptionDto {
  @IsString() @Length(1, 8) id: string;
  @Transform(trim) @IsString() @Length(1, 400) label: string;
}
class EditDto {
  @IsOptional() @Transform(trim) @IsString() @Length(5, 3000) stem?: string;
  @IsOptional() @IsArray() @ArrayMinSize(2) @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => OptionDto) options?: OptionDto[];
  @IsOptional() @IsString() @Length(1, 8) answerId?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 4000) explanation?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) difficulty?: number;
  @IsOptional() @IsUUID() topicId?: string;
}

/** Overwatch: the question bank. */
@Roles('PLATFORM_ADMIN')
@Controller('admin/question-bank')
export class QuestionBankController {
  constructor(private readonly bank: QuestionBankService) {}

  @Get() summary() {
    return this.bank.summary();
  }

  @Get('subjects/:id/topics') topics(@Param('id', ParseUUIDPipe) id: string) {
    return this.bank.topics(id);
  }

  @Get('subjects/:id/templates') templates(@Param('id', ParseUUIDPipe) id: string) {
    return this.bank.templates(id);
  }

  @Get('questions') list(@Query() q: QuestionQuery) {
    return this.bank.list(q);
  }

  @HttpCode(200) @Post('questions/status') status(@CurrentUser() u: AuthUser, @Body() dto: StatusDto) {
    return this.bank.setStatus(u.id, dto.ids, dto.status);
  }

  /** Approve everything waiting review that matches these filters (the status filter is ignored). */
  @HttpCode(200) @Post('questions/approve-matching') approveMatching(@CurrentUser() u: AuthUser, @Body() f: QuestionQuery) {
    return this.bank.approveMatching(u.id, f);
  }

  @HttpCode(200) @Post('templates/:id/status') templateStatus(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TemplateStatusDto) {
    return this.bank.setTemplateStatus(u.id, id, dto.status);
  }

  @Patch('questions/:id') edit(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EditDto) {
    return this.bank.edit(u.id, id, dto);
  }

  @HttpCode(200) @Post('reports/:id/dismiss') dismiss(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bank.dismissReport(u.id, id);
  }
}
