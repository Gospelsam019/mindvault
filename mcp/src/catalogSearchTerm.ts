/**
 * Search-term normalization shared by the MCP client-side catalog filter and
 * documented as the contract the server catalog search follows (#82).
 *
 * Both sides fold a keyword the same way before substring matching:
 *   1. Unicode NFC, so a composed "é" (U+00E9) matches "e" + U+0301.
 *   2. Locale-independent lower-casing (`toLowerCase`, never `toLocaleLowerCase`).
 *   3. Any run of whitespace (including NBSP and ideographic space) collapses to
 *      a single ASCII space, and leading/trailing whitespace is dropped.
 */
export function normalizeSearchTerm(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/\s+/gu, " ").trim();
}
