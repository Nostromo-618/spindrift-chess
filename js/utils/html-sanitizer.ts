/**
 * html-sanitizer.ts
 *
 * Utility for safely rendering user-generated content.
 * Escapes HTML entities to prevent XSS attacks.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

export function sanitizeMoveHistory(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => escapeHtml(String(entry)));
}
