import { Platform } from 'react-native';

/** Expo inlines `process.env.EXPO_PUBLIC_*` only when accessed statically, so every key is spelled out. */
const nonEmpty = (v: string | undefined): string | undefined => (v && v.length > 0 ? v : undefined);

const ENV = {
  geminiApiKey: nonEmpty(process.env.EXPO_PUBLIC_GEMINI_API_KEY),
  geminiModel: nonEmpty(process.env.EXPO_PUBLIC_GEMINI_MODEL),
  analyzeEndpoint: nonEmpty(process.env.EXPO_PUBLIC_ANALYZE_ENDPOINT),
  supabaseUrl: nonEmpty(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: nonEmpty(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  revenueCatIos: nonEmpty(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY),
  revenueCatAndroid: nonEmpty(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY),
  posthogKey: nonEmpty(process.env.EXPO_PUBLIC_POSTHOG_KEY),
  posthogHost: nonEmpty(process.env.EXPO_PUBLIC_POSTHOG_HOST),
  appStoreUrl: nonEmpty(process.env.EXPO_PUBLIC_APP_STORE_URL),
  playStoreUrl: nonEmpty(process.env.EXPO_PUBLIC_PLAY_STORE_URL),
  supportEmail: nonEmpty(process.env.EXPO_PUBLIC_SUPPORT_EMAIL),
  poseModelUrl: nonEmpty(process.env.EXPO_PUBLIC_POSE_MODEL_URL),
};

export const config = {
  gemini: {
    apiKey: ENV.geminiApiKey,
    model: ENV.geminiModel ?? 'gemini-2.5-flash',
    /** Supabase Edge Function URL. When set, the app never talks to Gemini directly. */
    analyzeEndpoint: ENV.analyzeEndpoint,
  },
  supabase: { url: ENV.supabaseUrl, anonKey: ENV.supabaseAnonKey },
  revenueCat: {
    apiKey: Platform.select({ ios: ENV.revenueCatIos, android: ENV.revenueCatAndroid, default: undefined }),
    entitlementId: 'pro',
  },
  posthog: { apiKey: ENV.posthogKey, host: ENV.posthogHost ?? 'https://us.i.posthog.com' },
  pose: { modelUrl: ENV.poseModelUrl },
  links: {
    appStore: ENV.appStoreUrl ?? 'https://kickiq.app/download',
    playStore: ENV.playStoreUrl ?? 'https://kickiq.app/download',
    deepLink: 'kickiq://rate',
    web: 'https://kickiq.app',
    privacy: 'https://kickiq.app/privacy',
    terms: 'https://kickiq.app/terms',
    supportEmail: ENV.supportEmail ?? 'support@kickiq.app',
  },
  limits: {
    minClipSeconds: 3,
    maxClipSeconds: 15,
    analysisTimeoutMs: 45_000,
    minAge: 13,
  },
} as const;

export const isConfigured = {
  gemini: Boolean(config.gemini.apiKey || config.gemini.analyzeEndpoint),
  supabase: Boolean(config.supabase.url && config.supabase.anonKey),
  revenueCat: Boolean(config.revenueCat.apiKey),
  posthog: Boolean(config.posthog.apiKey),
  poseModel: Boolean(config.pose.modelUrl),
};

export const storeUrl = Platform.OS === 'android' ? config.links.playStore : config.links.appStore;
