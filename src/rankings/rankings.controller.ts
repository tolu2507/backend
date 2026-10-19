import { Controller, Get, Query } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { ExamBody } from '@prisma/client';

import { Roles } from '../common/auth.js';
import { RankingsService } from './rankings.service.js';

class RankingsQuery {
  @IsOptional() @IsIn(Object.values(ExamBody)) exam?: ExamBody;
  @IsOptional() @IsIn(['week', 'all']) period?: 'week' | 'all';
}

@Roles('PLATFORM_ADMIN')
@Controller('admin/rankings')
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  @Get() get(@Query() q: RankingsQuery) {
    return this.rankings.rankings({ exam: q.exam, period: q.period ?? 'week' });
  }
}
