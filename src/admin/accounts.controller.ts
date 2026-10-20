import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { AccountsService } from './accounts.service.js';

class DeleteDto {
  /** Also delete the parent's children who have no other parent on BrainBox. */
  @IsBoolean() withChildren: boolean;
}
class RequestsQuery {
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() open?: boolean;
}
class RequestStatusDto {
  @IsIn(['PROCESSING', 'DONE']) status: 'PROCESSING' | 'DONE';
}

/** Overwatch: deleting parents and children, and privacy requests from the app. */
@Roles('PLATFORM_ADMIN')
@Controller('admin')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get('people/:userId/delete-preview') preview(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.accounts.deletePreview(userId);
  }

  @HttpCode(200) @Post('people/:userId/delete') delete(@CurrentUser() u: AuthUser, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: DeleteDto) {
    return this.accounts.delete(u.id, userId, dto.withChildren);
  }

  @Get('people/:userId/export') export(@CurrentUser() u: AuthUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.accounts.export(u.id, userId);
  }

  @Get('data-requests') requests(@Query() q: RequestsQuery) {
    return this.accounts.dataRequests(q.open ?? false);
  }

  @HttpCode(200) @Post('data-requests/:id/status') status(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestStatusDto) {
    return this.accounts.setRequestStatus(u.id, id, dto.status);
  }
}
