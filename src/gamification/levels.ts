/** XP needed to reach a level: L1 0, L2 100, L3 300, L4 600, L5 1000 … (50·L·(L−1)). */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelFor(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const title = level >= 15 ? 'Champion' : level >= 10 ? 'Scholar' : level >= 6 ? 'Achiever' : level >= 3 ? 'Explorer' : 'Starter';
  return { level, title, current: xp, next: xpForLevel(level + 1), levelStart: xpForLevel(level) };
}

/** Primary pupils see stars instead of XP: one star per 10 XP. */
export const starsFor = (xp: number) => Math.floor(xp / 10);
