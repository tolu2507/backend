import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Put } from '@nestjs/common';
import { ExamBody } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsUUID } from 'class-validator';

import { CurrentUser, Public, Roles, type AuthUser } from '../common/auth.js';
import { ExamsService } from './exams.service.js';

class ChooseExamDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @IsUUID('4', { each: true }) subjectIds: string[];
  @IsOptional() @IsInt() targetYear?: number | null;
}

const examParam = new ParseEnumPipe(ExamBody);

@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  /** Exams, their subjects and the rules for choosing them. */
  @Public() @Get() catalog() {
    return this.exams.catalog();
  }
}

@Roles('STUDENT')
@Controller('me/student/exams')
export class StudentExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get() async mine(@CurrentUser() u: AuthUser) {
    return this.exams.chosen(await this.exams.studentByUser(u.id));
  }

  @Put(':exam') async choose(@CurrentUser() u: AuthUser, @Param('exam', examParam) exam: ExamBody, @Body() dto: ChooseExamDto) {
    return this.exams.choose(await this.exams.studentByUser(u.id), exam, dto.subjectIds, dto.targetYear);
  }

  @Delete(':exam') async drop(@CurrentUser() u: AuthUser, @Param('exam', examParam) exam: ExamBody) {
    return this.exams.drop(await this.exams.studentByUser(u.id), exam);
  }
}

/** Parents can set up exams for a child (handy for younger children, or before the child first signs in). */
@Roles('PARENT')
@Controller('parent/children/:studentId/exams')
export class ParentExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get() async list(@CurrentUser() u: AuthUser, @Param('studentId') studentId: string) {
    await this.exams.assertGuardian(u.id, studentId);
    return this.exams.chosen(studentId);
  }

  @Put(':exam') async choose(@CurrentUser() u: AuthUser, @Param('studentId') studentId: string, @Param('exam', examParam) exam: ExamBody, @Body() dto: ChooseExamDto) {
    await this.exams.assertGuardian(u.id, studentId);
    return this.exams.choose(studentId, exam, dto.subjectIds, dto.targetYear);
  }

  @Delete(':exam') async drop(@CurrentUser() u: AuthUser, @Param('studentId') studentId: string, @Param('exam', examParam) exam: ExamBody) {
    await this.exams.assertGuardian(u.id, studentId);
    return this.exams.drop(studentId, exam);
  }
}
