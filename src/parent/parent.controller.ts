import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';

import { CurrentUser, PARENT_ROLES, Roles, type AuthUser } from '../common/auth.js';
import { RequestOrigin } from '../common/origin.js';
import { PlanService } from '../plan/plan.service.js';
import { BookDto, ChangePinDto, CreateChildDto, DailyLimitDto, DisputeDto, PayInvoiceDto, TopupDto, TutorRequestDto } from './parent.dto.js';
import { ParentService } from './parent.service.js';

@Roles(...PARENT_ROLES)
@Controller('parent')
export class ParentController {
  constructor(
    private readonly parents: ParentService,
    private readonly plan: PlanService,
  ) {}

  @Get('children') children(@CurrentUser() u: AuthUser) {
    return this.parents.children(u.id);
  }

  @Get('children/pending') pendingChildren(@CurrentUser() u: AuthUser) {
    return this.parents.pendingChildren(u.id);
  }

  @HttpCode(200) @Post('children/pending/:studentId/accept') acceptChild(@CurrentUser() u: AuthUser, @Param('studentId') id: string) {
    return this.parents.respondToChild(u.id, id, true);
  }

  @HttpCode(200) @Post('children/pending/:studentId/decline') declineChild(@CurrentUser() u: AuthUser, @Param('studentId') id: string) {
    return this.parents.respondToChild(u.id, id, false);
  }

  @Post('children') createChild(@CurrentUser() u: AuthUser, @Body() dto: CreateChildDto) {
    return this.parents.createChild(u.id, dto);
  }

  @Patch('children/:id/pin') changePin(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ChangePinDto) {
    return this.parents.changePin(u.id, id, dto.pin);
  }

  @Get('children/:id/reports/latest') async report(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.plan.assertParentAccess(u.id);
    return this.parents.report(u.id, id);
  }

  @Get('children/:id/wallet') wallet(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.wallet(u.id, id);
  }

  @Get('children/:id/invoices') invoices(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.invoices(u.id, id);
  }

  @Post('invoices/:id/pay') payInvoice(@RequestOrigin() origin: string, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: PayInvoiceDto) {
    return this.parents.payInvoice(origin, u.id, id, dto.amountKobo);
  }

  @Put('children/:id/wallet/limit') limit(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DailyLimitDto) {
    return this.parents.setDailyLimit(u.id, id, dto.dailyLimitKobo ?? null);
  }

  @Post('children/:id/wallet/topup') topup(@RequestOrigin() origin: string, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: TopupDto) {
    return this.parents.topup(origin, u.id, id, dto.amountKobo);
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

  @Post('sessions/:id/pay') pay(@RequestOrigin() origin: string, @CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.payForSession(origin, u.id, id);
  }

  @HttpCode(200) @Post('sessions/:id/confirm') confirm(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.parents.confirmSession(u.id, id);
  }

  @HttpCode(200) @Post('sessions/:id/dispute') dispute(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DisputeDto) {
    return this.parents.disputeSession(u.id, id, dto.reason);
  }
}
