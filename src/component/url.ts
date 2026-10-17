/** URL identity policy. Page mode preserves the legacy behavior exactly. */
export type UrlMode = "page" | "full";

export function normalizeFeedbackUrl(url: string, mode: UrlMode = "page") {
  if (mode !== "page" && mode !== "full") {
    throw new Error("urlMode must be page or full");
  }
  const trimmed = url.trim();
  const normalized = mode === "full" ? trimmed : trimmed.split("?")[0]!.trim();
  if (!normalized) throw new Error("url is required");
  return normalized;
}
