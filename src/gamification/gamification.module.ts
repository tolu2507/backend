import { Global, Module } from '@nestjs/common';

import { GamificationService } from './gamification.service.js';

@Global()
@Module({ providers: [GamificationService], exports: [GamificationService] })
export class GamificationModule {}
