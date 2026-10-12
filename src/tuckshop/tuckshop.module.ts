import { Module } from '@nestjs/common';

import { TuckShopController } from './tuckshop.controller.js';
import { TuckShopService } from './tuckshop.service.js';

@Module({ controllers: [TuckShopController], providers: [TuckShopService] })
export class TuckShopModule {}
