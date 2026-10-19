import type { Template } from '../engine.js';
import { energyOrganic } from './energy-organic.js';
import { molesGases } from './moles-gases.js';
import { structureSolutions } from './structure-solutions.js';

export const jambChemistry: Template[] = [...molesGases, ...structureSolutions, ...energyOrganic];
