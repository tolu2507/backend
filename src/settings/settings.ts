/**
 * Every number Overwatch can change from its Settings page, with its default, limits and the words Overwatch shows.
 * A key nobody has saved yet uses its default here.
 */
type NumberSetting = { kind: 'number'; group: Group; label: string; help: string; unit: string; min: number; max: number; default: number };
type SwitchSetting = { kind: 'switch'; group: Group; label: string; help: string; default: boolean };
export type Group = 'Plan' | 'Free plan' | 'Coins' | 'Sticker coins' | 'Rewards';

const num = (group: Group, label: string, help: string, unit: string, min: number, max: number, def: number): NumberSetting => ({ kind: 'number', group, label, help, unit, min, max, default: def });

export const SETTINGS = {
  planPriceNaira: num('Plan', 'Plan price', 'What parents pay for each paid period, for all their children. New payments only.', '₦', 100, 100_000, 1_500),
  planDays: num('Plan', 'Days per payment', 'How long each payment lasts. Paying early adds this on top of what is left.', 'days', 7, 366, 30),
  trialDays: num('Plan', 'Free trial', 'Days of the paid plan a new parent gets free. Making it longer also extends trials already running; making it shorter only affects new trials, so nobody’s trial is cut.', 'days', 0, 90, 21),

  freeDailyQuestions: num('Free plan', 'Questions a day', 'Practice questions each child on the free plan gets per day. The Friday mock is always free.', 'questions', 0, 100, 10),

  coinsPerCorrect: num('Coins', 'Coins per new question right', 'Repeat questions earn nothing.', 'coins', 0, 1_000, 10),
  practiceCoinsPerDay: num('Coins', 'Daily practice coin limit', 'Most coins a child can earn from practice in a day. Stickers and mocks are on top.', 'coins', 0, 10_000, 100),
  coinsPerMock: num('Coins', 'Coins per Friday mock', 'For finishing a Friday mock.', 'coins', 0, 10_000, 200),

  coinsCommon: num('Sticker coins', 'Common sticker', 'Coins for unlocking a Common sticker.', 'coins', 0, 100_000, 200),
  coinsRare: num('Sticker coins', 'Rare sticker', 'Coins for unlocking a Rare sticker.', 'coins', 0, 100_000, 500),
  coinsEpic: num('Sticker coins', 'Epic sticker', 'Coins for unlocking an Epic sticker.', 'coins', 0, 100_000, 1_500),
  coinsLegendary: num('Sticker coins', 'Legendary sticker', 'Coins for unlocking a Legendary sticker.', 'coins', 0, 1_000_000, 5_000),

  rewardsEnabled: { kind: 'switch', group: 'Rewards', label: 'Rewards on', help: 'Off: children stop earning coins and parents can’t collect. Balances are kept.', default: true } as SwitchSetting,
  coinsPerReward: num('Rewards', 'Coins for one reward', 'How many coins fill the bar.', 'coins', 100, 1_000_000, 10_000),
  rewardNaira: num('Rewards', 'Value of one reward', 'What a full bar puts in the parent’s rewards balance.', '₦', 50, 100_000, 1_000),
  rewardsMonthlyBudgetNaira: num('Rewards', 'Monthly rewards budget', 'Most airtime and data sent per month, for everyone together. After that, parents are asked to collect on the 1st.', '₦', 0, 10_000_000, 30_000),
} satisfies Record<string, NumberSetting | SwitchSetting>;

export type SettingKey = keyof typeof SETTINGS;
export type Settings = { [K in SettingKey]: (typeof SETTINGS)[K] extends SwitchSetting ? boolean : number };

export const DEFAULTS = Object.fromEntries(Object.entries(SETTINGS).map(([k, d]) => [k, d.default])) as Settings;

/** Kobo helpers, so money settings are only ever turned into kobo in one place. */
export const planPriceKobo = (s: Settings) => BigInt(Math.round(s.planPriceNaira * 100));
export const rewardKobo = (s: Settings) => BigInt(Math.round(s.rewardNaira * 100));
export const rewardsBudgetKobo = (s: Settings) => BigInt(Math.round(s.rewardsMonthlyBudgetNaira * 100));
export const stickerCoins = (s: Settings) => ({ COMMON: s.coinsCommon, RARE: s.coinsRare, EPIC: s.coinsEpic, LEGENDARY: s.coinsLegendary });

/** Checks one value against its definition. Returns an error sentence, or null when it's fine. */
export function invalid(key: string, value: unknown): string | null {
  const d = (SETTINGS as Record<string, NumberSetting | SwitchSetting>)[key];
  if (!d) return `There is no setting called "${key}".`;
  if (d.kind === 'switch') return typeof value === 'boolean' ? null : `${d.label} must be on or off.`;
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) return `${d.label} must be a whole number.`;
  if (value < d.min || value > d.max) return `${d.label} must be between ${d.min.toLocaleString()} and ${d.max.toLocaleString()} ${d.unit}.`;
  return null;
}
