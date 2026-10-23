import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { ArenaService } from './arena.service.js';
import { OLYMPIAD_QUESTIONS, OlympiadService } from './olympiad.service.js';
import { RoomsService } from './rooms.service.js';

class SubjectDto {
  @IsUUID() subjectId: string;
}
class AnswerDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(OLYMPIAD_QUESTIONS - 1) index: number;
  /** Missing when time ran out. */
  @IsOptional() @IsString() @Length(1, 40) optionId?: string;
}

/** The arena over HTTP: the lobby, leaderboards, Ghost Races, the Daily Olympiad, and opening a room (rooms and Quick Match run live on the /arena socket). */
@Roles('STUDENT')
@Controller('me/student/arena')
export class ArenaController {
  constructor(
    private readonly arena: ArenaService,
    private readonly rooms: RoomsService,
    private readonly olympiad: OlympiadService,
  ) {}

  /** The arena's front page: trophies, today's free matches and tonight's Olympiad. Subjects come from the student's exam choices. */
  @Get() async hub(@CurrentUser() u: AuthUser) {
    const me = await this.arena.student(u.id);
    const [matches, olympiad] = await Promise.all([this.arena.matchesLeft(me.id), this.olympiad.tonight()]);
    return { trophies: me.trophies, matches, olympiad };
  }

  @Get('subjects/:id') lobby(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.arena.lobby(u.id, id, (studentId) => this.rooms.openRoom(studentId, id));
  }

  @Get('subjects/:id/leaderboard') leaderboard(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.arena.leaderboard(u.id, id);
  }

  @Get('subjects/:id/olympiad') today(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.olympiad.today(u.id, id);
  }

  @HttpCode(200) @Post('olympiad') enter(@CurrentUser() u: AuthUser, @Body() dto: SubjectDto) {
    return this.olympiad.enter(u.id, dto.subjectId);
  }

  @HttpCode(200) @Post('ghost') ghost(@CurrentUser() u: AuthUser, @Body() dto: SubjectDto) {
    return this.arena.startGhost(u.id, dto.subjectId);
  }

  @HttpCode(200) @Post('matches/:id/questions/:index') question(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('index', ParseIntPipe) index: number) {
    return this.arena.serve(u.id, id, index);
  }

  @HttpCode(200) @Post('matches/:id/answers') answer(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AnswerDto) {
    return this.arena.answerSolo(u.id, id, dto.index, dto.optionId ?? null, (playerId) => this.olympiad.finish(playerId));
  }

  @Post('rooms') room(@CurrentUser() u: AuthUser, @Body() dto: SubjectDto) {
    return this.rooms.create(u.id, dto.subjectId);
  }
}
