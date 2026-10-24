import { getLocales } from 'expo-localization';

import en from './en';
import es from './es';

type Dict = Record<string, unknown>;
const dictionaries: Record<string, Dict> = { en, es };

let currentLocale = 'en';

export function detectLocale(): string {
  try {
    const code = getLocales()[0]?.languageCode ?? 'en';
    return dictionaries[code] ? code : 'en';
  } catch {
    return 'en';
  }
}

export function setLocale(code: string) {
  currentLocale = dictionaries[code] ? code : 'en';
}

export function getLocale() {
  return currentLocale;
}

function lookup(dict: Dict | undefined, path: string[]): unknown {
  let node: unknown = dict;
  for (const key of path) {
    if (node == null || typeof node !== 'object') return undefined;
    node = (node as Dict)[key];
  }
  return node;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    vars[k] === undefined ? `{{${k}}}` : String(vars[k]),
  );
}

/**
 * Translate a dotted key. Supports `{{var}}` interpolation and a `_one` plural suffix
 * when `vars.count === 1`. Falls back to English, then to the key itself.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const path = key.split('.');
  if (vars && vars.count === 1) {
    const singular = lookup(dictionaries[currentLocale], [...path.slice(0, -1), `${path.at(-1)}_one`]) ??
      lookup(en, [...path.slice(0, -1), `${path.at(-1)}_one`]);
    if (typeof singular === 'string') return interpolate(singular, vars);
  }
  const value = lookup(dictionaries[currentLocale], path) ?? lookup(en, path);
  if (typeof value === 'string') return interpolate(value, vars);
  if (__DEV__ && value === undefined) console.warn(`[i18n] missing key: ${key}`);
  return key;
}

/** Fetch a string array (e.g. tip lists). */
export function tList(key: string): string[] {
  const value = lookup(dictionaries[currentLocale], key.split('.')) ?? lookup(en, key.split('.'));
  return Array.isArray(value) ? (value as string[]) : [];
}

export type TranslationKey = string;
