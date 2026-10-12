import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { BookDto, ChangePinDto, CreateChildDto, DisputeDto, PayInvoiceDto, TopupDto, TutorRequestDto } from './parent.dto.js';
import { ParentService } from './parent.service.js';

@Roles('PARENT')
@Controller('parent')
export class ParentController {
  constructor(private readonly parents: ParentService) {}

  @Get('children') children(@CurrentUser() u: AuthUser) {
    return this.parents.children(u.id);
  }

  @Post('children') createChild(@CurrentUser() u: AuthUser, @Body() dto: CreateChildDto) {
    return this.parents.createChild(u.id, dto);
  }

  @Patch('children/:id/pin') changePin(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ChangePinDto) {
    return this.parents.changePin(u.id, id, dto.pin);
  }

  @Get('children/:id/reports/latest') report(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.report(u.id, id);
  }

  @Get('children/:id/wallet') wallet(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.wallet(u.id, id);
  }

  @Get('children/:id/invoices') invoices(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.invoices(u.id, id);
  }

  @Post('invoices/:id/pay') payInvoice(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: PayInvoiceDto) {
    return this.parents.payInvoice(u.id, id, dto.amountKobo);
  }

  @Post('children/:id/wallet/topup') topup(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: TopupDto) {
    return this.parents.topup(u.id, id, dto.amountKobo);
  }

  @Get('children/:id/tutor-request') currentRequest(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.currentRequest(u.id, id);
  }

  @Get('children/:id/bookings') bookings(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.bookings(u.id, id);
  }

  @Post('tutor-requests') createRequest(@CurrentUser() u: AuthUser, @Body() dto: TutorRequestDto) {
    return this.parents.saveRequest(u.id, dto);
  }

  @Put('tutor-requests/:id') updateRequest(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: TutorRequestDto) {
    return this.parents.saveRequest(u.id, dto, id);
  }

  @Get('tutor-requests/:id/matches') matches(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.matches(u.id, id);
  }

  @Post('bookings') book(@CurrentUser() u: AuthUser, @Body() dto: BookDto) {
    return this.parents.book(u.id, dto.matchId);
  }

  @Post('sessions/:id/pay') pay(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.payForSession(u.id, id);
  }

  @HttpCode(200) @Post('sessions/:id/confirm') confirm(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.confirmSession(u.id, id);
  }

  @HttpCode(200) @Post('sessions/:id/dispute') dispute(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DisputeDto) {
    return this.parents.disputeSession(u.id, id, dto.reason);
  }
}
