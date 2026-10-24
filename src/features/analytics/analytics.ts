import { PostHog } from 'posthog-react-native';

import { config, isConfigured } from '@/lib/config';

import type { EventName } from './events';

let client: PostHog | null = null;

export function getAnalytics(): PostHog | null {
  if (client) return client;
  if (!isConfigured.posthog || !config.posthog.apiKey) return null;
  client = new PostHog(config.posthog.apiKey, {
    host: config.posthog.host,
    captureAppLifecycleEvents: true,
  });
  return client;
}

export function track(event: EventName, properties?: Record<string, string | number | boolean | null>) {
  const c = getAnalytics();
  if (!c) {
    if (__DEV__) console.log(`[analytics] ${event}`, properties ?? '');
    return;
  }
  c.capture(event, properties);
}

export function screen(name: string) {
  getAnalytics()?.screen(name);
}

export function identify(userId: string, props?: Record<string, string | number | boolean | null>) {
  getAnalytics()?.identify(userId, props);
}

export async function resetAnalytics() {
  await getAnalytics()?.reset();
}
