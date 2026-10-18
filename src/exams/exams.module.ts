import { Module } from '@nestjs/common';

import { ExamsController, ParentExamsController, StudentExamsController } from './exams.controller.js';
import { ExamsService } from './exams.service.js';

@Module({ controllers: [ExamsController, StudentExamsController, ParentExamsController], providers: [ExamsService], exports: [ExamsService] })
export class ExamsModule {}
