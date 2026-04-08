/**
 * Thank-You Animation catalog.
 *
 * The set of dotLottie animations an org admin can pick from for their
 * org's `/donate/[mosque]/thank-you?statusAction=PAID` page. The selected
 * id is stored in `organizations.thankyou_animation_id`. NULL falls back
 * to DEFAULT_THANK_YOU_ANIMATION_ID.
 *
 * Adding a new animation:
 *   1. Drop the .lottie file in `public/animations/`
 *   2. Add an entry to THANK_YOU_ANIMATIONS below
 *   3. (Optional) update DEFAULT_THANK_YOU_ANIMATION_ID
 *
 * Cancelled state uses a single fixed animation across all mosques (the
 * user has no choice on cancel — see CANCELLED_ANIMATION below).
 */

export interface ThankYouAnimation {
  /** Slug stored in DB. URL-safe, lowercase, kebab-case. */
  id: string;
  /** Shown to mosque admins in the picker UI. */
  label: string;
  /** One-line caption shown under the label in the picker. */
  description: string;
  /** Public asset path Vercel serves directly. */
  file: string;
  /** Grouping shown in the picker. */
  category: 'celebration' | 'islamic' | 'charity';
}

export const THANK_YOU_ANIMATIONS = {
  confetti: {
    id: 'confetti',
    label: 'Confetti',
    description: 'Classic celebration burst',
    file: '/animations/confetti.lottie',
    category: 'celebration',
  },
  'coins-drop': {
    id: 'coins-drop',
    label: 'Coins Drop',
    description: 'Coins falling into place',
    file: '/animations/coins-drop.lottie',
    category: 'celebration',
  },
  'money-stack': {
    id: 'money-stack',
    label: 'Money Stack',
    description: 'Stack of bills appearing',
    file: '/animations/money-stack.lottie',
    category: 'celebration',
  },
  money: {
    id: 'money',
    label: 'Money',
    description: 'Floating bills',
    file: '/animations/money.lottie',
    category: 'celebration',
  },
  'coin-3d': {
    id: 'coin-3d',
    label: '3D Coin',
    description: 'Single rotating coin',
    file: '/animations/coin-3d.lottie',
    category: 'celebration',
  },
  quran: {
    id: 'quran',
    label: 'Quran',
    description: 'Quran opening',
    file: '/animations/quran.lottie',
    category: 'islamic',
  },
  'eid-mubarak': {
    id: 'eid-mubarak',
    label: 'Eid Mubarak',
    description: 'Festive Eid celebration',
    file: '/animations/eid-mubarak.lottie',
    category: 'islamic',
  },
  'ramadan-mubarak': {
    id: 'ramadan-mubarak',
    label: 'Ramadan Mubarak',
    description: 'Ramadan crescent and lanterns',
    file: '/animations/ramadan-mubarak.lottie',
    category: 'islamic',
  },
  'charity-box': {
    id: 'charity-box',
    label: 'Charity Box',
    description: 'Giving alms (sadaqah)',
    file: '/animations/charity-box.lottie',
    category: 'charity',
  },
} as const satisfies Record<string, ThankYouAnimation>;

export type ThankYouAnimationId = keyof typeof THANK_YOU_ANIMATIONS;

/** Used for new mosques and as a safe fallback when the stored id is invalid. */
export const DEFAULT_THANK_YOU_ANIMATION_ID: ThankYouAnimationId = 'confetti';

/**
 * Single fixed animation shown for cancelled donations on every mosque page.
 * Mosques cannot customize this — the cancel UX should feel consistent
 * regardless of which mosque the donor came from.
 */
export const CANCELLED_ANIMATION = {
  file: '/animations/payment-failed.lottie',
} as const;

/**
 * Type-safe lookup. Returns the requested animation or the default if the
 * id is null/missing/unknown. Never throws — safe to call from server
 * components and unauthenticated routes.
 */
export function getThankYouAnimation(id: string | null | undefined): ThankYouAnimation {
  if (id && id in THANK_YOU_ANIMATIONS) {
    return THANK_YOU_ANIMATIONS[id as ThankYouAnimationId];
  }
  return THANK_YOU_ANIMATIONS[DEFAULT_THANK_YOU_ANIMATION_ID];
}

/** All animations as an array, useful for rendering the picker grid. */
export const THANK_YOU_ANIMATION_LIST: ThankYouAnimation[] = Object.values(THANK_YOU_ANIMATIONS);

/** Grouping helper for the picker UI. */
export function groupAnimationsByCategory(): Record<ThankYouAnimation['category'], ThankYouAnimation[]> {
  const groups: Record<ThankYouAnimation['category'], ThankYouAnimation[]> = {
    celebration: [],
    islamic: [],
    charity: [],
  };
  for (const anim of THANK_YOU_ANIMATION_LIST) {
    groups[anim.category].push(anim);
  }
  return groups;
}
