import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { IsObject } from 'class-validator';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { MocksService } from './mocks.service.js';

class AnswersDto {
  @IsObject() answers: Record<string, string>;
}

/** The Friday mock, for students. */
@Roles('STUDENT')
@Controller('me/student/mocks')
export class MocksController {
  constructor(private readonly mocks: MocksService) {}

  @Get() async overview(@CurrentUser() u: AuthUser) {
    return this.mocks.overview(await this.mocks.studentByUser(u.id));
  }

  @HttpCode(200) @Post(':id/start') async start(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.mocks.start(await this.mocks.studentByUser(u.id), id);
  }

  @Get('sittings/:id') async paper(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.mocks.paper(await this.mocks.studentByUser(u.id), id);
  }

  @Put('sittings/:id/answers') async save(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AnswersDto) {
    return this.mocks.save(await this.mocks.studentByUser(u.id), id, dto.answers);
  }

  @HttpCode(200) @Post('sittings/:id/submit') async submit(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AnswersDto) {
    return this.mocks.submit(await this.mocks.studentByUser(u.id), id, dto.answers);
  }

  @Get('sittings/:id/result') async result(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.mocks.result(await this.mocks.studentByUser(u.id), id);
  }
}
