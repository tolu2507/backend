import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { OverwatchService } from './overwatch.service.js';
import { SchoolModule } from '../school/school.module.js';

@Module({ imports: [SchoolModule], controllers: [AdminController], providers: [AdminService, OverwatchService], exports: [AdminService] })
export class AdminModule {}
