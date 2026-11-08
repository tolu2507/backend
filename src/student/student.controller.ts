import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsUUID } from 'class-validator';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { StudentService } from './student.service.js';

class AnswersDto {
  @IsObject() answers: Record<string, string>;
}
/** The cartoon avatars a child can pick; the pictures themselves ship in the app. */
export const AVATARS = Array.from({ length: 24 }, (_, i) => `a${String(i + 1).padStart(2, '0')}`);
class AvatarDto {
  @IsOptional() @IsIn(AVATARS) avatar: string | null;
}
class SeenDto {
  @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) ids: string[];
}

@Roles('STUDENT')
@Controller('me/student')
export class StudentController {
  constructor(private readonly students: StudentService) {}

  @Get('home') home(@CurrentUser() u: AuthUser) {
    return this.students.home(u.id);
  }

  /** Pick a cartoon avatar, or null to go back to initials. */
  @Put('avatar') avatar(@CurrentUser() u: AuthUser, @Body() dto: AvatarDto) {
    return this.students.setAvatar(u.id, dto.avatar ?? null);
  }

  @Get('league') league(@CurrentUser() u: AuthUser) {
    return this.students.league(u.id);
  }

  @Get('badges') badges(@CurrentUser() u: AuthUser) {
    return this.students.badges(u.id);
  }

  /** How rare a collected sticker is, and where the child's collection ranks. */
  @Get('badges/:id/stats') badgeStats(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.students.badgeStats(u.id, id);
  }

  /** The app played the unlock celebration for these stickers. */
  @HttpCode(200) @Post('badges/seen') seen(@CurrentUser() u: AuthUser, @Body() dto: SeenDto) {
    return this.students.badgesSeen(u.id, dto.ids);
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
