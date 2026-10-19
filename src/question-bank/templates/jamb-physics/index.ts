import type { Template } from '../engine.js';
import { electricityModern } from './electricity-modern.js';
import { matterHeat } from './matter-heat.js';
import { mechanics } from './mechanics.js';
import { wavesLight } from './waves-light.js';

export const jambPhysics: Template[] = [...mechanics, ...matterHeat, ...wavesLight, ...electricityModern];
