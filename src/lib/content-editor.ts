import type { SiteContent } from "./site-content";

/**
 * Keep the editable text EXACTLY as the user typed it. A controlled input
 * whose value differs from the DOM value on each keystroke can move the
 * caret to the end, especially when editing earlier lines.
 *
 * Do not trim, filter or reformat drafts during onChange.
 */
export const splitLinesForEditing = (text: string): string[] => text.split("\n");
export const splitCommasForEditing = (text: string): string[] => text.split(",");

const cleanList = (items: readonly string[]): string[] =>
  items.map((item) => item.trim()).filter((item) => item.length > 0);

/** Normalize only when the administrator deliberately saves a section. */
export function prepareSectionForSave(
  section: keyof SiteContent,
  content: SiteContent
): SiteContent[keyof SiteContent] {
  switch (section) {
    case "hero":
      return { ...content.hero, trust: cleanList(content.hero.trust) };
    case "marquee":
      return { ...content.marquee, extras: cleanList(content.marquee.extras) };
    case "payment":
      return {
        ...content.payment,
        steps: cleanList(content.payment.steps),
        methods: cleanList(content.payment.methods),
      };
    default:
      return content[section];
  }
}
