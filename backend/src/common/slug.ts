// URL slugs for the shop: "Veš mašina 8 kg Đurđevdan" → "ves-masina-8-kg-djurdjevdan".
// The same rules as the migration that filled the existing rows.

const LETTERS: Record<string, string> = {
  č: 'c',
  ć: 'c',
  ž: 'z',
  š: 's',
  đ: 'dj',
};

export function slugify(text: string) {
  const slug = text
    .toLowerCase()
    .replace(/[čćžšđ]/g, (c) => LETTERS[c])
    .normalize('NFKD')
    // Remaining accents (é → e) after splitting letters from their marks.
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/, '');
  return slug || 'stavka';
}

/** The slug, or slug-2, slug-3, ... when it is taken. */
export async function uniqueSlug(
  text: string,
  taken: (slug: string) => Promise<boolean>,
) {
  const base = slugify(text);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await taken(slug))) return slug;
  }
}
