// The 7 translation files: every language has every text, and every text is
// valid ICU (the {name} / {n, plural, ...} syntax next-intl uses). A missing
// or broken text would show the raw key, or crash the page, in that language.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TYPE, parse, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";

const LOCALES = ["en", "mk", "sq", "de", "fr", "it", "sr"] as const;

type Tree = { [key: string]: string | Tree };
const load = (locale: string): Tree => JSON.parse(readFileSync(`src/messages/${locale}.json`, "utf8"));

/** Every text as [key, text], e.g. ["matches.levelTitle", "Your level"]. */
function flatten(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [[prefix + k, v] as [string, string]] : flatten(v, `${prefix}${k}.`),
  );
}

/** The {placeholders} a text uses. */
function placeholders(elements: MessageFormatElement[], out = new Set<string>()) {
  for (const e of elements) {
    if (e.type === TYPE.argument || e.type === TYPE.number || e.type === TYPE.date || e.type === TYPE.time) out.add(e.value);
    if (e.type === TYPE.plural || e.type === TYPE.select) {
      out.add(e.value);
      for (const option of Object.values(e.options)) placeholders(option.value, out);
    }
    if (e.type === TYPE.tag) placeholders(e.children, out);
  }
  return out;
}

const english = new Map(flatten(load("en")));

describe.each(LOCALES)("%s.json", (locale) => {
  const texts = new Map(flatten(load(locale)));

  it("has every text English has, and no extras", () => {
    const missing = [...english.keys()].filter((k) => !texts.has(k));
    const extra = [...texts.keys()].filter((k) => !english.has(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("has only valid ICU texts", () => {
    const broken: string[] = [];
    for (const [key, text] of texts) {
      try {
        parse(text);
      } catch (e) {
        broken.push(`${key}: ${(e as Error).message}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("uses the same {placeholders} as English", () => {
    const different: string[] = [];
    for (const [key, text] of texts) {
      const en = english.get(key);
      if (!en) continue;
      try {
        const want = [...placeholders(parse(en))].sort().join(",");
        const got = [...placeholders(parse(text))].sort().join(",");
        if (want !== got) different.push(`${key}: {${got}} instead of {${want}}`);
      } catch {
        // Reported by the ICU test above.
      }
    }
    expect(different).toEqual([]);
  });
});
