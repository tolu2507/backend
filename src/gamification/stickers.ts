import type { StickerRarity } from '@prisma/client';

/**
 * Every sticker a child can collect. Synced to the Badge table when the API starts, so this file is the source of truth.
 * The harder the sticker, the rarer it is and the more coins it gives (10,000 coins = ₦1,000 for the family).
 */
export const RARITY_COINS: Record<StickerRarity, number> = { COMMON: 200, RARE: 500, EPIC: 1_500, LEGENDARY: 5_000 };

/** What a child has done so far, from their own activity. Stickers are checked against it. */
export type StickerStats = {
  xp: number;
  longestStreak: number;
  daysActive: number;
  right: number; // practice answers they got right (new questions and reviews)
  conquered: number; // subtopics whose boss round they beat
  subjectsMastered: number; // subjects where every subtopic is conquered
  perfectRounds: number;
  mocksSat: number;
  /** Friday mocks with results out: national rank, percentile and how many sat it. */
  mockResults: { rank: number; percentile: number; sat: number }[];
  leagueTier: number; // highest reached: 1 Bronze, 2 Silver, 3 Gold, 4 Diamond
  leagueTop5: number; // weeks finished in the top 5 of their league
  leagueWins: number; // weeks finished first
};

type Count = { metric: Exclude<keyof StickerStats, 'mockResults'>; target: number };
/** Mock stickers need a big enough field to mean something: "top 10%" of 3 people isn't. */
type Mock = { metric: 'mockPercentile'; target: number; minSat: number } | { metric: 'mockRank'; target: number; minSat: number };
/** Given by other parts of the app (school lesson quizzes), not checked here. */
type Manual = { metric: 'manual' };

export type Sticker = { code: string; name: string; description: string; rarity: StickerRarity; icon: string; rule: Count | Mock | Manual };

const s = (code: string, name: string, description: string, rarity: StickerRarity, icon: string, rule: Sticker['rule']): Sticker => ({ code, name, description, rarity, icon, rule });

export const STICKERS: Sticker[] = [
  // Common: the first week or two.
  s('FIRST_QUEST', 'First quest', 'Finish your first practice round', 'COMMON', 'rocket', { metric: 'xp', target: 1 }),
  s('RIGHT_25', 'Sharp start', 'Get 25 questions right', 'COMMON', 'checkmark-done', { metric: 'right', target: 25 }),
  s('STREAK_3', '3-day streak', 'Practise 3 days in a row', 'COMMON', 'flame', { metric: 'longestStreak', target: 3 }),
  s('PERFECT_1', 'Flawless', 'Get every question right in a practice round', 'COMMON', 'sparkles', { metric: 'perfectRounds', target: 1 }),
  s('FIRST_CONQUEST', 'Boss slayer', 'Beat the boss round of a topic', 'COMMON', 'shield-checkmark', { metric: 'conquered', target: 1 }),
  s('FIRST_MOCK', 'Mock debut', 'Sit your first Friday mock', 'COMMON', 'document-text', { metric: 'mocksSat', target: 1 }),
  s('DAYS_5', 'Regular', 'Practise on 5 different days', 'COMMON', 'calendar', { metric: 'daysActive', target: 5 }),
  s('XP_500', 'Rising star', 'Earn 500 XP', 'COMMON', 'star', { metric: 'xp', target: 500 }),
  s('FIRST_LESSON_QUIZ', 'Lesson champ', 'Finish your first lesson quiz', 'COMMON', 'ribbon', { metric: 'manual' }),
  s('RIGHT_100', 'On a roll', 'Get 100 questions right', 'COMMON', 'trending-up', { metric: 'right', target: 100 }),

  // Rare: a few weeks of steady work.
  s('STREAK_7', 'Week warrior', 'Practise 7 days in a row', 'RARE', 'bonfire', { metric: 'longestStreak', target: 7 }),
  s('RIGHT_250', 'Quick thinker', 'Get 250 questions right', 'RARE', 'bulb', { metric: 'right', target: 250 }),
  s('CONQUER_5', 'Topic hunter', 'Conquer 5 topics', 'RARE', 'flag', { metric: 'conquered', target: 5 }),
  s('PERFECT_5', 'Perfectionist', 'Get 5 perfect practice rounds', 'RARE', 'diamond-outline', { metric: 'perfectRounds', target: 5 }),
  s('MOCKS_4', 'Mock regular', 'Sit 4 Friday mocks', 'RARE', 'albums', { metric: 'mocksSat', target: 4 }),
  s('MOCK_TOP_HALF', 'Top half', 'Beat half the candidates in a Friday mock', 'RARE', 'podium', { metric: 'mockPercentile', target: 50, minSat: 10 }),
  s('LEAGUE_SILVER', 'Silver league', 'Reach the Silver league', 'RARE', 'medal-outline', { metric: 'leagueTier', target: 2 }),
  s('LEAGUE_TOP5', 'Promoted', 'Finish a week in the top 5 of your league', 'RARE', 'arrow-up-circle', { metric: 'leagueTop5', target: 1 }),
  s('XP_2000', 'Scholar', 'Earn 2,000 XP', 'RARE', 'school', { metric: 'xp', target: 2_000 }),
  s('DAYS_20', 'Dedicated', 'Practise on 20 different days', 'RARE', 'calendar-number', { metric: 'daysActive', target: 20 }),
  s('PERFECT_SCORE', 'Perfect lesson', 'Get every question right in a lesson quiz', 'RARE', 'trophy-outline', { metric: 'manual' }),

  // Epic: months of effort. These start paying real airtime.
  s('STREAK_30', 'Unstoppable', 'Practise 30 days in a row', 'EPIC', 'flash', { metric: 'longestStreak', target: 30 }),
  s('RIGHT_1000', 'Question crusher', 'Get 1,000 questions right', 'EPIC', 'hammer', { metric: 'right', target: 1_000 }),
  s('CONQUER_20', 'Conqueror', 'Conquer 20 topics', 'EPIC', 'flag', { metric: 'conquered', target: 20 }),
  s('SUBJECT_1', 'Subject master', 'Conquer every topic in a subject', 'EPIC', 'library', { metric: 'subjectsMastered', target: 1 }),
  s('MOCK_TOP_10', 'Top 10%', 'Finish in the top 10% of a Friday mock', 'EPIC', 'stats-chart', { metric: 'mockPercentile', target: 90, minSat: 50 }),
  s('MOCKS_12', 'Mock veteran', 'Sit 12 Friday mocks', 'EPIC', 'file-tray-full', { metric: 'mocksSat', target: 12 }),
  s('LEAGUE_GOLD', 'Gold league', 'Reach the Gold league', 'EPIC', 'medal', { metric: 'leagueTier', target: 3 }),
  s('LEAGUE_WIN', 'League champion', 'Finish a week first in your league', 'EPIC', 'trophy', { metric: 'leagueWins', target: 1 }),
  s('PERFECT_25', 'Precision', 'Get 25 perfect practice rounds', 'EPIC', 'locate', { metric: 'perfectRounds', target: 25 }),
  s('XP_10000', 'Elite', 'Earn 10,000 XP', 'EPIC', 'rocket-outline', { metric: 'xp', target: 10_000 }),
  s('DAYS_60', 'Devoted', 'Practise on 60 different days', 'EPIC', 'heart', { metric: 'daysActive', target: 60 }),

  // Legendary: the best in the country.
  s('STREAK_100', 'Legendary streak', 'Practise 100 days in a row', 'LEGENDARY', 'infinite', { metric: 'longestStreak', target: 100 }),
  s('RIGHT_5000', 'Brainiac', 'Get 5,000 questions right', 'LEGENDARY', 'planet', { metric: 'right', target: 5_000 }),
  s('CONQUER_75', 'Syllabus legend', 'Conquer 75 topics', 'LEGENDARY', 'earth', { metric: 'conquered', target: 75 }),
  s('SUBJECT_3', 'Triple master', 'Conquer every topic in 3 subjects', 'LEGENDARY', 'layers', { metric: 'subjectsMastered', target: 3 }),
  s('LEAGUE_DIAMOND', 'Diamond league', 'Reach the Diamond league', 'LEGENDARY', 'diamond', { metric: 'leagueTier', target: 4 }),
  s('MOCK_TOP_100', 'Top 100 in Nigeria', 'Finish in the top 100 of a Friday mock with 1,000+ candidates', 'LEGENDARY', 'globe', { metric: 'mockRank', target: 100, minSat: 1_000 }),
  s('MOCK_FIRST', 'Number one', 'Come first in a Friday mock with 100+ candidates', 'LEGENDARY', 'star-half', { metric: 'mockRank', target: 1, minSat: 100 }),
  s('XP_50000', 'Grandmaster', 'Earn 50,000 XP', 'LEGENDARY', 'sunny', { metric: 'xp', target: 50_000 }),
];

/** How far along a sticker is. `target` is null for stickers that can't be shown as a bar (mock ranks, lesson quizzes). */
export function stickerProgress(st: Sticker, stats: StickerStats): { current: number; target: number | null; done: boolean } {
  const r = st.rule;
  if (r.metric === 'manual') return { current: 0, target: null, done: false };
  if (r.metric === 'mockPercentile' || r.metric === 'mockRank') {
    const field = stats.mockResults.filter((m) => m.sat >= r.minSat);
    if (r.metric === 'mockPercentile') {
      const best = Math.max(0, ...field.map((m) => m.percentile));
      return { current: best, target: null, done: best >= r.target };
    }
    const best = field.length ? Math.min(...field.map((m) => m.rank)) : 0;
    return { current: best, target: null, done: best > 0 && best <= r.target };
  }
  const current = stats[r.metric];
  return { current: Math.min(current, r.target), target: r.target, done: current >= r.target };
}
