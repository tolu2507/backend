import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { ArenaKind, ArenaStatus } from '@prisma/client';

import { Roles } from '../common/auth.js';
import { ArenaAdminService } from './arena-admin.service.js';

class DaysQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number;
}
class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
class MatchQuery extends PageQuery {
  @IsOptional() @IsIn(['GHOST', 'ROOM', 'LIVE', 'OLYMPIAD']) kind?: ArenaKind;
  @IsOptional() @IsIn(['WAITING', 'PLAYING', 'FINISHED', 'CANCELLED']) status?: ArenaStatus;
}

/** Overwatch: the arena and the Daily Olympiad. */
@Roles('PLATFORM_ADMIN')
@Controller('admin/arena')
export class ArenaAdminController {
  constructor(private readonly admin: ArenaAdminService) {}

  @Get() overview(@Query() q: DaysQuery) {
    return this.admin.overview(q.days ?? 30);
  }

  @Get('olympiads') olympiads(@Query() q: PageQuery) {
    return this.admin.olympiads(q.page, q.pageSize);
  }

  @Get('matches') matches(@Query() q: MatchQuery) {
    return this.admin.matches(q);
  }
}
