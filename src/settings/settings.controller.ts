import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsObject } from 'class-validator';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { SettingsService } from './settings.service.js';

class SettingsDto {
  /** { planPriceNaira: 2000, rewardsEnabled: false, ... }: only the settings being changed. Each is checked in settings.ts. */
  @IsObject() changes: Record<string, unknown>;
}

/** Overwatch: prices, trial, free plan, coins and rewards. */
@Roles('PLATFORM_ADMIN')
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get() list() {
    return this.settings.list();
  }

  @Put() update(@CurrentUser() u: AuthUser, @Body() dto: SettingsDto) {
    return this.settings.update(u.id, dto.changes);
  }
}
