export type ServiceKey = "short_form" | "long_form" | "thumbnail";
export type ServiceType = ServiceKey | "bundle";
export type QuoteStatus = "new" | "accepted" | "archived";

export interface Rates {
  short_form: number;
  long_form: number;
  thumbnail: number;
  rush_multiplier: number; // 1.3 = +30%
  min_budget: number;
}

export const DEFAULT_RATES: Rates = {
  short_form: 50,
  long_form: 150,
  thumbnail: 25,
  rush_multiplier: 1.3,
  min_budget: 100,
};

export interface Profile {
  id: string;
  handle: string | null;
  display_name: string | null;
  tagline: string | null;
  currency: string;
  rates: Rates;
  custom_notes: string | null;
  plan: "free" | "pro";
  created_at: string;
}

export interface ScopeBreakdown {
  items: { service: ServiceKey; quantity: number; unit_rate: number; line_total: number }[];
  deliverables: string[];
  timeline: string;
  turnaround_days: number;
  revision_terms: string;
  terms: string;
  currency: string;
  complexity: number;
  subtotal: number;
}

export interface QuoteResult {
  project_summary: string;
  service_type: ServiceType;
  quantity: number;
  is_rush: boolean;
  estimated_min: number;
  estimated_max: number;
  scope_breakdown: ScopeBreakdown;
}

export interface Quote extends QuoteResult {
  id: string;
  editor_id: string;
  client_name: string;
  client_contact: string;
  chat_transcript: { question: string; answer: string }[];
  status: QuoteStatus;
  created_at: string;
}

export interface Answers {
  need: string;
  volume: string;
  style: string;
  name: string;
  contact: string;
}

export const FREE_MONTHLY_LIMIT = 3;

export const RESERVED_HANDLES = [
  "login", "dashboard", "api", "auth", "admin", "app", "about", "pricing", "settings",
  "signup", "logout", "support", "help", "terms", "privacy", "quotecut", "demo", "www",
];

export const HANDLE_RE = /^[a-z0-9]{3,20}$/;

export const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || "quotecut.app";
