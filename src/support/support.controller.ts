import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { SupportStatus } from '@prisma/client';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { SupportService } from './support.service.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class OpenDto {
  @Transform(trim) @IsString() @Length(3, 120) subject: string;
  @Transform(trim) @IsString() @Length(5, 4000) body: string;
  @IsOptional() @IsUUID() studentId?: string;
}
class MessageDto {
  @Transform(trim) @IsString() @Length(1, 4000) body: string;
}
class StaffReplyDto extends MessageDto {
  @IsOptional() @IsBoolean() resolve?: boolean;
}
class StatusDto {
  @IsIn(Object.values(SupportStatus)) status: SupportStatus;
}
class InboxQuery {
  @IsOptional() @IsIn(Object.values(SupportStatus)) status?: SupportStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

/** Help requests, for anyone signed in (parents and students). */
@Controller('me/support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get() mine(@CurrentUser() u: AuthUser) {
    return this.support.mine(u.id);
  }

  @Post() open(@CurrentUser() u: AuthUser, @Body() dto: OpenDto) {
    return this.support.open(u.id, dto);
  }

  @Get(':id') thread(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.thread(id, { userId: u.id });
  }

  @HttpCode(200) @Post(':id/messages') reply(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MessageDto) {
    return this.support.reply(u.id, id, dto.body);
  }
}

/** Overwatch: the support inbox. */
@Roles('PLATFORM_ADMIN')
@Controller('admin/support')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get() inbox(@Query() q: InboxQuery) {
    return this.support.inbox(q);
  }

  @Get(':id') thread(@Param('id', ParseUUIDPipe) id: string) {
    return this.support.thread(id, {});
  }

  @HttpCode(200) @Post(':id/reply') reply(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StaffReplyDto) {
    return this.support.staffReply(u.id, id, dto.body, dto.resolve ?? false);
  }

  @HttpCode(200) @Post(':id/status') status(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto) {
    return this.support.setStatus(u.id, id, dto.status);
  }
}
