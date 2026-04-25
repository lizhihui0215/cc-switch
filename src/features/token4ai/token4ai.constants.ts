import type { Token4AIProductId } from "./token4ai.types";

export const TOKEN4AI_PROVIDER_ID = "token4ai";
export const TOKEN4AI_TAB_ID = "token4ai";
export const TOKEN4AI_DISPLAY_NAME = "Token4AI";
export const TOKEN4AI_WEBSITE_URL = "https://token4ai.cloud";

export const TOKEN4AI_OPENAI_BASE_URL = "https://api.token4ai.cloud/v1";
export const TOKEN4AI_ANTHROPIC_BASE_URL = "https://api.token4ai.cloud";
export const TOKEN4AI_GEMINI_BASE_URL = "https://api.token4ai.cloud";
export const TOKEN4AI_MINIMAX_BASE_URL = "https://api.token4ai.cloud/v1";

export const TOKEN4AI_PROVIDER_NAMES = {
  openai: "Token4AI OpenAI",
  anthropic: "Token4AI Claude",
  gemini: "Token4AI Gemini",
  minimax: "Token4AI MiniMax",
} as const satisfies Record<Token4AIProductId, string>;

export const TOKEN4AI_PRODUCT_IDS = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  GEMINI: "gemini",
  MINIMAX: "minimax",
} as const;

export const TOKEN4AI_PRODUCT_ORDER: Token4AIProductId[] = [
  TOKEN4AI_PRODUCT_IDS.OPENAI,
  TOKEN4AI_PRODUCT_IDS.ANTHROPIC,
  TOKEN4AI_PRODUCT_IDS.GEMINI,
  TOKEN4AI_PRODUCT_IDS.MINIMAX,
];

export const TOKEN4AI_CLAUDE_CODE_COMPAT_DEFAULTS = {
  openai: true,
  anthropic: true,
  gemini: false,
  minimax: false,
} as const satisfies Record<Token4AIProductId, boolean>;
