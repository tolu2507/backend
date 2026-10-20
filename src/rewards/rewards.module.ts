import { Module } from '@nestjs/common';

import { AdminRewardsController, RewardsController } from './rewards.controller.js';
import { RewardsService } from './rewards.service.js';

@Module({ controllers: [RewardsController, AdminRewardsController], providers: [RewardsService] })
export class RewardsModule {}
