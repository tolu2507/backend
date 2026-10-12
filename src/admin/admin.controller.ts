import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import type { RevenueStream } from '@prisma/client';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { AdminService } from './admin.service.js';
import { OverwatchService } from './overwatch.service.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const PHONE = /^\+?[0-9]{10,15}$/;

class OwnerDto {
  @Transform(trim) @IsString() @Length(1, 60) firstName: string;
  @Transform(trim) @IsString() @Length(1, 60) lastName: string;
  @Transform(trim) @IsEmail({}, { message: 'Enter the owner’s email. Their invite goes there.' }) email: string;
  @IsOptional() @Transform(trim) @Matches(PHONE, { message: 'Enter a valid phone number.' }) phone?: string;
}
class CreateSchoolDto {
  @IsOptional() @IsUUID() enquiryId?: string;
  @Transform(trim) @IsString() @Length(2, 120) name: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 200) address?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 40) state?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 60) lga?: string;
  @IsOptional() @Transform(trim) @IsEmail() email?: string;
  @IsOptional() @Transform(trim) @Matches(PHONE, { message: 'Enter a valid phone number.' }) phone?: string;
  @ValidateNested() @Type(() => OwnerDto) owner: OwnerDto;
}
class SchoolStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED']) status: 'ACTIVE' | 'SUSPENDED';
}
class AgreementDto {
  @Transform(trim) @IsString() @Length(2, 60) planName: string;
  @IsInt() @Min(0) @Max(10_000) revenueShareBp: number;
  @IsArray() @ArrayMinSize(1) @IsIn(['SCHOOL_FEES', 'TUCK_SHOP', 'SUBSCRIPTION', 'OTHER'], { each: true }) sharedStreams: RevenueStream[];
  @IsDateString() startsAt: string;
  @IsOptional() @IsDateString() endsAt?: string;
}
class StatementDto {
  @IsDateString() from: string;
  @IsDateString() to: string;
}

class DecisionDto {
  @IsOptional() @IsString() @Length(0, 500) note?: string;
}
class DisputeDecisionDto {
  @IsBoolean() release: boolean;
}

@Roles('PLATFORM_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly overwatch: OverwatchService,
  ) {}

  @Get('overview') overview() {
    return this.overwatch.overview();
  }

  @Get('schools') schools() {
    return this.overwatch.schools();
  }

  @Post('schools') createSchool(@CurrentUser() u: AuthUser, @Body() dto: CreateSchoolDto) {
    return this.overwatch.createSchool(u.id, dto);
  }

  @Get('schools/:id') school(@Param('id') id: string) {
    return this.overwatch.school(id);
  }

  @Patch('schools/:id') schoolStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SchoolStatusDto) {
    return this.overwatch.setSchoolStatus(u.id, id, dto.status);
  }

  @Post('schools/:id/agreements') agreement(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AgreementDto) {
    return this.overwatch.addAgreement(u.id, id, dto);
  }

  @HttpCode(200) @Post('schools/:id/statements') statement(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: StatementDto) {
    return this.overwatch.statement(u.id, id, dto.from, dto.to);
  }

  @Get('disputes') disputes() {
    return this.overwatch.disputes();
  }

  @Get('tutor-applications') list(@Query('status') status?: string) {
    return this.admin.tutorApplications(status);
  }

  @HttpCode(200) @Post('tutor-applications/:id/approve') approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.admin.decide(u.id, id, true, dto.note);
  }

  @HttpCode(200) @Post('tutor-applications/:id/reject') reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.admin.decide(u.id, id, false, dto.note);
  }

  @HttpCode(200) @Post('sessions/:id/resolve-dispute') resolve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DisputeDecisionDto) {
    return this.admin.resolveDispute(u.id, id, dto.release);
  }
}
