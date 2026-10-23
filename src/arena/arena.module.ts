import { Module } from '@nestjs/common';

import { ArenaAdminController } from './arena-admin.controller.js';
import { ArenaAdminService } from './arena-admin.service.js';
import { ArenaController } from './arena.controller.js';
import { ArenaGateway } from './arena.gateway.js';
import { ArenaService } from './arena.service.js';
import { OlympiadService } from './olympiad.service.js';
import { RoomsService } from './rooms.service.js';

@Module({ controllers: [ArenaController, ArenaAdminController], providers: [ArenaService, RoomsService, OlympiadService, ArenaGateway, ArenaAdminService] })
export class ArenaModule {}
