import { Module } from '@nestjs/common';

import { ClassroomService } from './classroom.service.js';
import { FeesService } from './fees.service.js';
import { InvitesService } from './invites.service.js';
import { SchoolController } from './school.controller.js';
import { SchoolService } from './school.service.js';

@Module({ controllers: [SchoolController], providers: [SchoolService, ClassroomService, FeesService, InvitesService], exports: [SchoolService, InvitesService] })
export class SchoolModule {}
