/**
 * Server-only helpers for loading site content (imports Prisma — never
 * import this from a client component).
 */
import { db } from "@/lib/db";
import {
  CONTENT_KEYS,
  DEFAULT_SITE_CONTENT,
  mergeSection,
  parseSection,
  type SiteContent,
} from "@/lib/site-content";

/** Load all content sections merged over the defaults. */
export async function loadSiteContent(): Promise<SiteContent> {
  const rows = await db.setting.findMany({
    where: { key: { in: Object.values(CONTENT_KEYS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as SiteContent;
  for (const section of Object.keys(CONTENT_KEYS) as Array<keyof SiteContent>) {
    Object.assign(out, {
      [section]: mergeSection(
        DEFAULT_SITE_CONTENT[section],
        parseSection(map.get(CONTENT_KEYS[section]))
      ),
    });
  }
  return out;
}
