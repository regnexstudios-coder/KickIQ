import { Linking, Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { config, isConfigured } from '@/lib/config';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';

import { MOCK_PLANS, PRODUCT_IDS, sortPlans, type Plan, type PlanId } from './plans';

let configured = false;
let packagesByPlan: Partial<Record<PlanId, PurchasesPackage>> = {};

export const billingMode = (): 'revenuecat' | 'mock' => (isConfigured.revenueCat ? 'revenuecat' : 'mock');

export async function initBilling(appUserId?: string): Promise<void> {
  if (billingMode() === 'mock') {
    const s = useSubscriptionStore.getState();
    if (s.status === 'unknown') s.setStatus({ status: 'none', expiresAt: null, productId: null, mock: true });
    return;
  }
  if (configured) {
    if (appUserId) await Purchases.logIn(appUserId).catch(() => {});
    return;
  }
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey: config.revenueCat.apiKey!, appUserID: appUserId ?? null });
  configured = true;
  Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
  try {
    applyCustomerInfo(await Purchases.getCustomerInfo());
  } catch {
    // offline: keep persisted status
  }
}

function applyCustomerInfo(info: CustomerInfo) {
  const ent = info.entitlements.active[config.revenueCat.entitlementId];
  const store = useSubscriptionStore.getState();
  if (!ent) {
    // Keep a locally granted promo (referral) alive even without a store entitlement.
    if (store.status === 'promo') return;
    store.setStatus({ status: 'none', expiresAt: null, productId: null, mock: false });
    return;
  }
  store.setStatus({
    status: ent.periodType === 'TRIAL' ? 'trial' : 'active',
    expiresAt: ent.expirationDate,
    productId: ent.productIdentifier,
    mock: false,
  });
}

function planIdFor(pkg: PurchasesPackage): PlanId | null {
  const pid = pkg.product.identifier;
  for (const [k, v] of Object.entries(PRODUCT_IDS) as [PlanId, string][]) if (v === pid) return k;
  if (pkg.packageType === 'WEEKLY') return 'weekly';
  if (pkg.packageType === 'ANNUAL') return 'annual';
  if (pkg.identifier.toLowerCase().includes('family')) return 'family';
  return null;
}

export async function getPlans(): Promise<Plan[]> {
  if (billingMode() === 'mock') return MOCK_PLANS;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return MOCK_PLANS;
    const plans: Plan[] = [];
    packagesByPlan = {};
    for (const pkg of current.availablePackages) {
      const id = planIdFor(pkg);
      if (!id) continue;
      packagesByPlan[id] = pkg;
      const p = pkg.product;
      plans.push({
        id,
        productId: p.identifier,
        priceString: p.priceString,
        price: p.price,
        currency: p.currencyCode,
        perWeekString: p.pricePerWeekString,
        trialDays: p.introPrice?.price === 0 ? p.introPrice.periodNumberOfUnits * (p.introPrice.periodUnit === 'DAY' ? 1 : 7) : 3,
        highlight: id === 'annual',
      });
    }
    return plans.length ? sortPlans(plans) : MOCK_PLANS;
  } catch {
    return MOCK_PLANS;
  }
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'failed';

export async function purchasePlan(plan: Plan): Promise<PurchaseOutcome> {
  const store = useSubscriptionStore.getState();
  if (billingMode() === 'mock') {
    const expires = new Date();
    expires.setDate(expires.getDate() + plan.trialDays);
    store.setStatus({ status: 'trial', expiresAt: expires.toISOString(), productId: plan.productId, mock: true });
    return 'purchased';
  }
  const pkg = packagesByPlan[plan.id];
  if (!pkg) return 'failed';
  try {
    const result = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(result.customerInfo);
    return 'purchased';
  } catch (e) {
    const err = e as { userCancelled?: boolean };
    return err?.userCancelled ? 'cancelled' : 'failed';
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (billingMode() === 'mock') return useSubscriptionStore.getState().status !== 'none';
  try {
    const info = await Purchases.restorePurchases();
    applyCustomerInfo(info);
    return Boolean(info.entitlements.active[config.revenueCat.entitlementId]);
  } catch {
    return false;
  }
}

export async function openManageSubscriptions(): Promise<void> {
  const url =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : `https://play.google.com/store/account/subscriptions?package=com.kickiq.app`;
  await Linking.openURL(url).catch(() => {});
}
