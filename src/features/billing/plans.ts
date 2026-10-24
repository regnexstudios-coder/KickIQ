export type PlanId = 'weekly' | 'annual' | 'family';

export interface Plan {
  id: PlanId;
  /** Store product identifier. */
  productId: string;
  priceString: string;
  price: number;
  currency: string;
  /** Per-week equivalent string for comparison copy. */
  perWeekString?: string | null;
  trialDays: number;
  highlight: boolean;
}

/** Product identifiers configured in App Store Connect / Play Console and RevenueCat. */
export const PRODUCT_IDS: Record<PlanId, string> = {
  weekly: 'kickiq_pro_weekly',
  annual: 'kickiq_pro_annual',
  family: 'kickiq_family_annual',
};

/** Used when RevenueCat is not configured (dev, simulators, CI). Prices mirror the store setup. */
export const MOCK_PLANS: Plan[] = [
  { id: 'weekly', productId: PRODUCT_IDS.weekly, priceString: '$3.99', price: 3.99, currency: 'USD', perWeekString: '$3.99', trialDays: 3, highlight: false },
  { id: 'annual', productId: PRODUCT_IDS.annual, priceString: '$49.99', price: 49.99, currency: 'USD', perWeekString: '$0.96', trialDays: 3, highlight: true },
  { id: 'family', productId: PRODUCT_IDS.family, priceString: '$69.99', price: 69.99, currency: 'USD', perWeekString: '$1.35', trialDays: 3, highlight: false },
];

export function sortPlans(plans: Plan[]): Plan[] {
  const order: PlanId[] = ['weekly', 'annual', 'family'];
  return [...plans].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
