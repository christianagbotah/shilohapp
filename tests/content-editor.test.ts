import { describe, expect, test } from "bun:test";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content";
import {
  splitLinesForEditing,
  splitCommasForEditing,
  prepareSectionForSave,
} from "../src/lib/content-editor";

describe("Back Office editor cursor safety", () => {
  test("multiline draft round-trips precisely, including blank lines and trailing spaces", () => {
    for (const text of [
      "first\nsecond\nthird",
      " edit first line\nsecond\nthird",
      "first \nsecond\nthird",
      "first\n\nthird",
      "first\nsecond\n",
      "\nfirst\nsecond",
      "",
      " x ",
    ]) {
      expect(splitLinesForEditing(text).join("\n")).toBe(text);
    }
  });

  test("inserting, deleting, or editing a prior line never rewrites the draft", () => {
    const original = "first\nsecond\nthird";
    for (const text of [
      "fXirst\nsecond\nthird",
      "first\nseXcond\nthird",
      "first\nsecond\nthird\n",
      "first\n\nsecond\nthird",
      "first\nsecond",
    ]) {
      const draft = splitLinesForEditing(text);
      expect(draft.join("\n")).toBe(text);
    }
    expect(splitLinesForEditing(original).length).toBe(3);
  });

  test("comma drafts preserve all typed delimiters and whitespace", () => {
    for (const text of [
      "MTN MoMo, Telecel Cash, Visa",
      "MTN MoMo,  Telecel Cash, Visa",
      ", Telecel Cash, Visa",
      "MTN MoMo,",
      "MTN MoMo,,Visa",
      "",
    ]) {
      expect(splitCommasForEditing(text).join(",")).toBe(text);
    }
  });

  test("normalization happens only on save, without changing the draft", () => {
    const hero = {
      ...DEFAULT_SITE_CONTENT,
      hero: { ...DEFAULT_SITE_CONTENT.hero, trust: ["  first ", "", " second", "  "] },
    };
    expect(prepareSectionForSave("hero", hero)).toEqual({
      ...hero.hero,
      trust: ["first", "second"],
    });
    expect(hero.hero.trust).toEqual(["  first ", "", " second", "  "]);

    const marquee = {
      ...DEFAULT_SITE_CONTENT,
      marquee: { extras: [" Extra  ", "", " Another"] },
    };
    expect(prepareSectionForSave("marquee", marquee)).toEqual({
      extras: ["Extra", "Another"],
    });

    const payment = {
      ...DEFAULT_SITE_CONTENT,
      payment: {
        ...DEFAULT_SITE_CONTENT.payment,
        steps: [" first ", "", " second "],
        methods: [" MTN MoMo ", "", " Visa "],
      },
    };
    expect(prepareSectionForSave("payment", payment)).toEqual({
      ...payment.payment,
      steps: ["first", "second"],
      methods: ["MTN MoMo", "Visa"],
    });
  });

  test("ordinary paragraph text is passed through unmodified", () => {
    const content = {
      ...DEFAULT_SITE_CONTENT,
      footer: { ...DEFAULT_SITE_CONTENT.footer, about: " Leading whitespace\nTrailing space  " },
    };
    expect(prepareSectionForSave("footer", content)).toEqual(content.footer);
  });
});
