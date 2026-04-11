/**
 * Campaign icon catalog.
 *
 * Each campaign can have a Lottie animation displayed as its icon on
 * the donate landing page. The selected id is stored in `campaigns.icon`.
 * NULL means no icon — just the title.
 *
 * These reuse the same .lottie files from `public/animations/` that the
 * thank-you animation system uses, plus any additional ones added for
 * campaign-specific purposes.
 *
 * Adding a new icon:
 *   1. Drop the .lottie file in `public/animations/`
 *   2. Add an entry to CAMPAIGN_ICONS below
 */

export interface CampaignIcon {
  /** Slug stored in DB. URL-safe, lowercase, kebab-case. */
  id: string;
  /** Shown to mosque admins in the picker UI. */
  label: string;
  /** Public asset path Vercel serves directly. */
  file: string;
}

export const CAMPAIGN_ICONS: CampaignIcon[] = [
  { id: 'mosque', label: 'Mosque', file: '/animations/mosque.lottie' },
  { id: 'charity-box', label: 'Charity Box', file: '/animations/charity-box.lottie' },
  { id: 'quran', label: 'Quran', file: '/animations/quran.lottie' },
  { id: 'ramadan-mubarak', label: 'Ramadan', file: '/animations/ramadan-mubarak.lottie' },
  { id: 'eid-mubarak', label: 'Eid Mubarak', file: '/animations/eid-mubarak.lottie' },
  { id: 'coin-3d', label: '3D Coin', file: '/animations/coin-3d.lottie' },
  { id: 'coins-drop', label: 'Coins Drop', file: '/animations/coins-drop.lottie' },
  { id: 'money-stack', label: 'Money Stack', file: '/animations/money-stack.lottie' },
  { id: 'money', label: 'Money', file: '/animations/money.lottie' },
  { id: 'confetti', label: 'Confetti', file: '/animations/confetti.lottie' },
];

export const CAMPAIGN_ICON_MAP = new Map(
  CAMPAIGN_ICONS.map((entry) => [entry.id, entry]),
);

/**
 * Type-safe lookup. Returns the icon entry or null if the id is
 * unknown/null/undefined.
 */
export function getCampaignIcon(id: string | null | undefined): CampaignIcon | null {
  if (!id) return null;
  return CAMPAIGN_ICON_MAP.get(id) ?? null;
}
