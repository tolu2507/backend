import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsObject } from 'class-validator';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { StudentService } from './student.service.js';

class AnswersDto {
  @IsObject() answers: Record<string, string>;
}

@Roles('STUDENT')
@Controller('me/student')
export class StudentController {
  constructor(private readonly students: StudentService) {}

  @Get('home') home(@CurrentUser() u: AuthUser) {
    return this.students.home(u.id);
  }

  @Get('league') league(@CurrentUser() u: AuthUser) {
    return this.students.league(u.id);
  }

  @Get('badges') badges(@CurrentUser() u: AuthUser) {
    return this.students.badges(u.id);
  }

  @Get('wallet') wallet(@CurrentUser() u: AuthUser) {
    return this.students.wallet(u.id);
  }

  @Get('activities/:id') activity(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.students.activity(u.id, id);
  }

  @HttpCode(200) @Post('activities/:id/submit')
  submitActivity(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AnswersDto) {
    return this.students.submitActivity(u.id, id, dto.answers);
  }

  @Get('quizzes/:id') quiz(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.students.quiz(u.id, id);
  }

  @HttpCode(200) @Post('quizzes/:id/submit')
  submitQuiz(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AnswersDto) {
    return this.students.submitQuiz(u.id, id, dto.answers);
  }
}
