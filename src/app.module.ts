import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AdminModule } from './admin/admin.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { EnquiriesController } from './enquiries/enquiries.controller.js';
import { GamificationModule } from './gamification/gamification.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { MeModule } from './me/me.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { ParentModule } from './parent/parent.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SchoolModule } from './school/school.module.js';
import { StudentModule } from './student/student.module.js';
import { TuckShopModule } from './tuckshop/tuckshop.module.js';
import { TutorModule } from './tutor/tutor.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    MessagingModule,
    AuthModule,
    AiModule,
    LedgerModule,
    GamificationModule,
    PaymentsModule,
    ReportsModule,
    MeModule,
    StudentModule,
    ParentModule,
    TutorModule,
    AdminModule,
    SchoolModule,
    TuckShopModule,
  ],
  controllers: [CatalogController, EnquiriesController, HealthController],
})
export class AppModule {}
