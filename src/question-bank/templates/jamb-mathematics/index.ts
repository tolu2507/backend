import type { Template } from '../engine.js';
import { algebra } from './algebra.js';
import { calculusStats } from './calculus-stats.js';
import { geometry } from './geometry.js';
import { number } from './number.js';

export const jambMathematics: Template[] = [...number, ...algebra, ...geometry, ...calculusStats];
