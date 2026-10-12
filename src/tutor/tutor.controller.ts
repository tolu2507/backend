import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { AvailabilityDto, CompleteSessionDto, IdCheckDto, ScheduleDto, StartTestDto, SubmitTestDto, TutorProfileDto } from './tutor.dto.js';
import { TutorService } from './tutor.service.js';

@Roles('TUTOR')
@Controller('tutor')
export class TutorController {
  constructor(private readonly tutors: TutorService) {}

  @Get('application') application(@CurrentUser() u: AuthUser) {
    return this.tutors.application(u.id);
  }

  @Put('profile') profile(@CurrentUser() u: AuthUser, @Body() dto: TutorProfileDto) {
    return this.tutors.saveProfile(u.id, dto);
  }

  @Put('id-check') idCheck(@CurrentUser() u: AuthUser, @Body() dto: IdCheckDto) {
    return this.tutors.saveIdCheck(u.id, dto);
  }

  @HttpCode(200) @Post('tests/start') startTest(@CurrentUser() u: AuthUser, @Body() dto: StartTestDto) {
    return this.tutors.startTest(u.id, dto.subject, dto.level);
  }

  @HttpCode(200) @Post('tests/:attemptId/submit')
  submitTest(@CurrentUser() u: AuthUser, @Param('attemptId') id: string, @Body() dto: SubmitTestDto) {
    return this.tutors.submitTest(u.id, id, dto.answers, dto.appSwitches);
  }

  @Patch('availability') availability(@CurrentUser() u: AuthUser, @Body() dto: AvailabilityDto) {
    return this.tutors.setAvailability(u.id, dto.accepting);
  }

  @Get('bookings') bookings(@CurrentUser() u: AuthUser) {
    return this.tutors.bookings(u.id);
  }

  @HttpCode(200) @Post('bookings/:id/accept') accept(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.tutors.respond(u.id, id, true);
  }

  @HttpCode(200) @Post('bookings/:id/decline') decline(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.tutors.respond(u.id, id, false);
  }

  @Post('bookings/:id/sessions') schedule(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ScheduleDto) {
    return this.tutors.schedule(u.id, id, dto);
  }

  @HttpCode(200) @Post('sessions/:id/complete') complete(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CompleteSessionDto) {
    return this.tutors.complete(u.id, id, dto);
  }

  @Get('earnings') earnings(@CurrentUser() u: AuthUser) {
    return this.tutors.earnings(u.id);
  }
}
