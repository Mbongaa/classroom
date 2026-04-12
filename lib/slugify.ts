/**
 * Convert a display name into a URL-safe slug.
 *
 * Used when creating or renaming organizations so the slug always
 * stays in sync with the name.
 *
 *   "Masjid El Feth"  →  "masjid-el-feth"
 *   "Café & Co."      →  "caf-co"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}
