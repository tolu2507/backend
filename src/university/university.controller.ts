import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { QuestionStatus } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

import { CurrentUser, Public, Roles, type AuthUser } from '../common/auth.js';
import { UniversityService } from './university.service.js';

class SetupDto {
  @IsString() @Length(2, 60) department: string;
  @IsInt() @Min(100) @Max(700) level: number;
  @IsInt() @Min(1) @Max(2) semester: number;
  @IsArray() @ArrayMinSize(1, { message: 'Pick at least one course.' }) @ArrayMaxSize(12) @IsUUID('4', { each: true }) courseIds: string[];
}

class ProgressDto {
  @IsInt() @Min(0) @Max(200) slide: number;
  @IsInt() @Min(0) @Max(100) checksRight: number;
  @IsInt() @Min(0) @Max(100) checksTotal: number;
  @IsBoolean() completed: boolean;
}

class StatusDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsUUID('4', { each: true }) ids: string[];
  @IsIn(Object.values(QuestionStatus)) status: QuestionStatus;
  @IsOptional() @IsBoolean() withQuestions?: boolean;
}

@Controller('university')
export class UniversityController {
  constructor(private readonly uni: UniversityService) {}

  /** Departments, their semesters and courses: the sign-up pickers. */
  @Public() @Get('departments') departments() {
    return this.uni.departments();
  }
}

/** The university student's own courses, lessons and progress. Practice rounds use /me/student/practice. */
@Roles('STUDENT')
@Controller('me/university')
export class MyUniversityController {
  constructor(private readonly uni: UniversityService) {}

  @Get() me(@CurrentUser() u: AuthUser) {
    return this.uni.me(u.id);
  }

  @Put() setup(@CurrentUser() u: AuthUser, @Body() dto: SetupDto) {
    return this.uni.setup(u.id, dto);
  }

  @Get('courses/:id') course(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.uni.course(u.id, id);
  }

  @Get('lessons/:id') lesson(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.uni.lesson(u.id, id);
  }

  @HttpCode(200) @Post('lessons/:id/progress') progress(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProgressDto) {
    return this.uni.saveProgress(u.id, id, dto);
  }
}

/** Overwatch: review the generated lessons (and their questions) before students see them. */
@Roles('PLATFORM_ADMIN')
@Controller('admin/university')
export class AdminUniversityController {
  constructor(private readonly uni: UniversityService) {}

  @Get() overview() {
    return this.uni.adminOverview();
  }

  @Get('lessons/:id') lesson(@Param('id', ParseUUIDPipe) id: string) {
    return this.uni.adminLesson(id);
  }

  @HttpCode(200) @Post('lessons/status') status(@CurrentUser() u: AuthUser, @Body() dto: StatusDto) {
    return this.uni.adminSetStatus(u.id, dto.ids, dto.status, dto.withQuestions ?? false);
  }
}
