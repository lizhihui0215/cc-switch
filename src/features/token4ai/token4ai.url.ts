import {
  TOKEN4AI_ANTHROPIC_BASE_URL,
  TOKEN4AI_GEMINI_BASE_URL,
  TOKEN4AI_MINIMAX_BASE_URL,
  TOKEN4AI_OPENAI_BASE_URL,
} from "./token4ai.constants";
import type { Token4AIProductId } from "./token4ai.types";

const DEFAULT_BASE_URLS: Record<Token4AIProductId, string> = {
  openai: TOKEN4AI_OPENAI_BASE_URL,
  anthropic: TOKEN4AI_ANTHROPIC_BASE_URL,
  gemini: TOKEN4AI_GEMINI_BASE_URL,
  minimax: TOKEN4AI_MINIMAX_BASE_URL,
};

export function joinApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const suffix = path.trim().replace(/^\/+/, "");
  return suffix ? `${base}/${suffix}` : base;
}

export function normalizeToken4AIBaseUrl(
  productId: Token4AIProductId,
  baseUrl: string,
): string {
  return baseUrl.trim().replace(/\/+$/, "") || DEFAULT_BASE_URLS[productId];
}

export function getToken4AIModelDiscoveryUrl(
  productId: Token4AIProductId,
  baseUrl: string,
): string | null {
  const normalized = normalizeToken4AIBaseUrl(productId, baseUrl);
  if (productId === "openai" || productId === "minimax") {
    return normalized.endsWith("/v1")
      ? joinApiUrl(normalized, "models")
      : joinApiUrl(normalized, "v1/models");
  }
  return null;
}

export function isValidToken4AIUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
