/**
 * Serial numbers as typed or scanned into a text field: one per line (a scanner ends
 * each with Enter), commas and semicolons also accepted; blanks dropped, order kept.
 */
export const parseSerials = (text: string) =>
  text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
