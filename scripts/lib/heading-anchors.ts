// Heading anchors shared by the Markdown renderer and project-link navigation. No platform APIs.
export const slugify = (text: string): string => text.trim().toLowerCase().normalize('NFC')
  .replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

export function headingSlugger(): (text: string) => string {
  const used = new Set<string>();
  return (text) => {
    const base = slugify(text);
    let slug = base;
    for (let n = 1; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  };
}

export function headingSlugs(texts: string[]): string[] {
  return texts.map(headingSlugger());
}
