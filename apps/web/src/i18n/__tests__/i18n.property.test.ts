/**
 * Feature: web-booking-app, Property 18: Translation key completeness
 * Validates: Requirements 10.1, 10.6
 *
 * For any translation key present in the French locale file,
 * the English locale file should also contain that key, and vice versa.
 */

import { describe, expect, test } from "vitest";
import en from "../dictionaries/en.json";
import fr from "../dictionaries/fr.json";

type NestedRecord = { [key: string]: string | NestedRecord };

const flatten = (obj: NestedRecord, prefix = ""): Array<string> => {
  const keys: Array<string> = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      keys.push(path);
    } else {
      keys.push(...flatten(value as NestedRecord, path));
    }
  }
  return keys;
};

const resolve = (obj: NestedRecord, dotPath: string): string | undefined => {
  const parts = dotPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
};

const frKeys = flatten(fr as NestedRecord);
const enKeys = flatten(en as NestedRecord);

describe("Property 18: Translation key completeness", () => {
  test.each(frKeys)("French key '%s' exists in English", (key) => {
    const value = resolve(en as NestedRecord, key);
    expect(value).not.toBeUndefined();
  });

  test.each(enKeys)("English key '%s' exists in French", (key) => {
    const value = resolve(fr as NestedRecord, key);
    expect(value).not.toBeUndefined();
  });

  test("both locale files have the same number of keys", () => {
    expect(frKeys.length).toBe(enKeys.length);
  });
});
