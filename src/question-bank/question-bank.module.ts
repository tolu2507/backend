import { Module } from '@nestjs/common';

import { PracticeController, QuestionBankController } from './question-bank.controller.js';
import { PracticeService } from './practice.service.js';
import { QuestionBankService } from './question-bank.service.js';

@Module({ controllers: [PracticeController, QuestionBankController], providers: [PracticeService, QuestionBankService] })
export class QuestionBankModule {}
