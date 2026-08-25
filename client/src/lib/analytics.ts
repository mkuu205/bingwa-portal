const PLACEHOLDER_PATTERN = /%[^%]+%/;

function isResolved(value: string | undefined): value is string {
  const normalized = value?.trim();
  return Boolean(normalized && !PLACEHOLDER_PATTERN.test(normalized));
}

export function getAnalyticsScriptUrl(endpoint: string | undefined): string | null {
  const normalized = endpoint?.trim();
  if (!normalized || PLACEHOLDER_PATTERN.test(normalized)) return null;

  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    return `${parsed.toString().replace(/\/$/, "")}/umami`;
  } catch {
    return null;
  }
}

export function loadAnalytics(): void {
  if (typeof document === "undefined") return;
  if (
    document.querySelector("script[data-bingwa-analytics]") ||
    !isResolved(import.meta.env.VITE_ANALYTICS_WEBSITE_ID)
  ) return;

  const src = getAnalyticsScriptUrl(import.meta.env.VITE_ANALYTICS_ENDPOINT);
  if (!src) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = src;
  script.dataset.websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
  script.dataset.bingwaAnalytics = "true";
  document.head.appendChild(script);
}
