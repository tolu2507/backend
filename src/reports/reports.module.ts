import { Global, Module } from '@nestjs/common';

import { ReportsService } from './reports.service.js';

@Global()
@Module({ providers: [ReportsService], exports: [ReportsService] })
export class ReportsModule {}
