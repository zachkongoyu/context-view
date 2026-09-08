import { REVIEWED_ON, SITE_URL, TERMS } from "../lib/agent-knowledge";

export const dynamic = "force-static";

export default function sitemap() {
  return [
    { url: SITE_URL, lastModified: REVIEWED_ON },
    { url: `${SITE_URL}/learn`, lastModified: REVIEWED_ON },
    ...TERMS.map((term) => ({ url: `${SITE_URL}/learn/${term.slug}`, lastModified: REVIEWED_ON })),
  ];
}
