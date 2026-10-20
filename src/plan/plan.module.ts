import { Global, Module } from '@nestjs/common';

import { PlanController } from './plan.controller.js';
import { PlanService } from './plan.service.js';

@Global()
@Module({ controllers: [PlanController], providers: [PlanService], exports: [PlanService] })
export class PlanModule {}
