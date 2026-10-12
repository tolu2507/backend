import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { CurrentSeller, TUCK_SHOP_ROLES, type Seller } from './tuckshop.context.js';
import { ChargeDto, PhonepayDto } from './tuckshop.dto.js';
import { TuckShopService } from './tuckshop.service.js';

@Roles(...TUCK_SHOP_ROLES)
@Controller('tuckshop')
export class TuckShopController {
  constructor(private readonly shop: TuckShopService) {}

  @Get('classes') classes(@CurrentSeller() s: Seller) {
    return this.shop.classes(s);
  }

  @Get('students') students(@CurrentSeller() s: Seller, @Query('q') q?: string, @Query('classId') classId?: string) {
    return this.shop.students(s, { q, classId });
  }

  @Get('lookup') lookup(@CurrentSeller() s: Seller, @Query('code') code = '') {
    return this.shop.lookup(s, code);
  }

  @HttpCode(200) @Post('charge') charge(@CurrentSeller() s: Seller, @Body() dto: ChargeDto) {
    return this.shop.charge(s, dto);
  }

  @Get('sales') sales(@CurrentSeller() s: Seller, @Query('date') date?: string) {
    return this.shop.sales(s, date);
  }

  @HttpCode(200) @Post('sales/:id/refund') refund(@CurrentSeller() s: Seller, @Param('id') id: string) {
    return this.shop.refund(s, id);
  }

  // ── Children paying from their own phone (overrides the class-level staff roles) ──

  @Roles('STUDENT') @Get('schools') schools(@Query('q') q?: string) {
    return this.shop.payableSchools(q);
  }

  @Roles('STUDENT') @HttpCode(200) @Post('pay') pay(@CurrentUser() u: AuthUser, @Body() dto: PhonepayDto) {
    return this.shop.payFromPhone(u.id, dto);
  }
}
