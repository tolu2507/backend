import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { ContentService } from './content.service.js';
import { InsightsService } from './insights.service.js';
import { OverwatchInsightsController } from './insights.controller.js';
import { OverwatchService } from './overwatch.service.js';
import { SchoolModule } from '../school/school.module.js';

@Module({
  imports: [SchoolModule],
  controllers: [AdminController, OverwatchInsightsController],
  providers: [AdminService, OverwatchService, InsightsService, ContentService],
  exports: [AdminService],
})
export class AdminModule {}
