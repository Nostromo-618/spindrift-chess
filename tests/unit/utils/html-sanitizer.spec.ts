import { describe, expect, it } from "vitest";
import { escapeHtml, sanitizeMoveHistory } from "../../../js/utils/html-sanitizer.js";

describe("HTML Sanitizer - escapeHtml", () => {
  it("escapes angle brackets, ampersand, and quotes", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("\"hello\" & 'world'")).toBe("&quot;hello&quot; &amp; &#39;world&#39;");
  });

  it("handles nullish and safe values", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml("e2-e4")).toBe("e2-e4");
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("HTML Sanitizer - sanitizeMoveHistory", () => {
  it("sanitizes array entries", () => {
    expect(sanitizeMoveHistory(["e2-e4", "<b>Nf3</b>", "O-O"])).toEqual([
      "e2-e4",
      "&lt;b&gt;Nf3&lt;/b&gt;",
      "O-O",
    ]);
  });

  it("returns empty array for non-arrays", () => {
    expect(sanitizeMoveHistory(null)).toEqual([]);
    expect(sanitizeMoveHistory(undefined)).toEqual([]);
    expect(sanitizeMoveHistory("not an array")).toEqual([]);
    expect(sanitizeMoveHistory(42)).toEqual([]);
  });

  it("stringifies nullish entries and handles empty arrays", () => {
    expect(sanitizeMoveHistory([null, undefined, "e4"])).toEqual(["null", "undefined", "e4"]);
    expect(sanitizeMoveHistory([])).toEqual([]);
  });
});
