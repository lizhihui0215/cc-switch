import type { AppId } from "@/lib/api";
import type { CustomEndpoint, Provider, ProviderMeta } from "@/types";
import { generateThirdPartyConfig } from "@/config/codexProviderPresets";

export type Token4AIProductKey = "openai" | "claude" | "gemini" | "minimax";

export interface Token4AIProductDefinition {
  key: Token4AIProductKey;
  labelKey: string;
  defaultLabel: string;
  targetKey: string;
  defaultTarget: string;
  defaultProviderName: string;
  defaultBaseUrl: string;
  defaultModel: string;
  apiFormat: "openai_responses" | "anthropic" | "gemini";
  supportsModelFetch: boolean;
}

export interface Token4AIProductFormState {
  enabled: boolean;
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  alsoUseClaudeCode?: boolean;
  tryClaudeCode?: boolean;
}

export type Token4AIUnifiedFormState = Record<
  Token4AIProductKey,
  Token4AIProductFormState
>;

export interface Token4AIProviderTarget {
  appId: AppId;
  label: string;
  productKey: Token4AIProductKey;
  provider: Omit<Provider, "id">;
}

export interface BuildToken4AITargetsOptions {
  now?: number;
}

export const TOKEN4AI_WEBSITE_URL = "https://token4ai.cloud";

export const TOKEN4AI_PRODUCTS: Record<
  Token4AIProductKey,
  Token4AIProductDefinition
> = {
  openai: {
    key: "openai",
    labelKey: "token4aiUnified.products.openai.title",
    defaultLabel: "OpenAI / Codex",
    targetKey: "token4aiUnified.products.openai.target",
    defaultTarget: "Codex / Claude Code",
    defaultProviderName: "Token4AI OpenAI",
    defaultBaseUrl: "https://api.token4ai.cloud/v1",
    defaultModel: "gpt-5.4",
    apiFormat: "openai_responses",
    supportsModelFetch: true,
  },
  claude: {
    key: "claude",
    labelKey: "token4aiUnified.products.claude.title",
    defaultLabel: "Anthropic / Claude",
    targetKey: "token4aiUnified.products.claude.target",
    defaultTarget: "Claude Code",
    defaultProviderName: "Token4AI Claude",
    defaultBaseUrl: "https://api.token4ai.cloud",
    defaultModel: "",
    apiFormat: "anthropic",
    supportsModelFetch: false,
  },
  gemini: {
    key: "gemini",
    labelKey: "token4aiUnified.products.gemini.title",
    defaultLabel: "Gemini",
    targetKey: "token4aiUnified.products.gemini.target",
    defaultTarget: "Gemini CLI",
    defaultProviderName: "Token4AI Gemini",
    defaultBaseUrl: "https://api.token4ai.cloud",
    defaultModel: "",
    apiFormat: "gemini",
    supportsModelFetch: false,
  },
  minimax: {
    key: "minimax",
    labelKey: "token4aiUnified.products.minimax.title",
    defaultLabel: "MiniMax",
    targetKey: "token4aiUnified.products.minimax.target",
    defaultTarget: "Codex / OpenAI-compatible",
    defaultProviderName: "Token4AI MiniMax",
    defaultBaseUrl: "https://api.token4ai.cloud/v1",
    defaultModel: "MiniMax-M2.7",
    apiFormat: "openai_responses",
    supportsModelFetch: true,
  },
};

export const TOKEN4AI_PRODUCT_ORDER: Token4AIProductKey[] = [
  "openai",
  "claude",
  "gemini",
  "minimax",
];

export function createDefaultToken4AIUnifiedState(): Token4AIUnifiedFormState {
  return TOKEN4AI_PRODUCT_ORDER.reduce((acc, key) => {
    const product = TOKEN4AI_PRODUCTS[key];
    acc[key] = {
      enabled: true,
      providerName: product.defaultProviderName,
      baseUrl: product.defaultBaseUrl,
      apiKey: "",
      model: "",
      alsoUseClaudeCode: key === "openai" ? true : undefined,
      tryClaudeCode: key === "minimax" ? false : undefined,
    };
    return acc;
  }, {} as Token4AIUnifiedFormState);
}

export function getUniqueProviderName(
  desiredName: string,
  existingNames: Iterable<string>,
): string {
  const base = desiredName.trim();
  const names = new Set(Array.from(existingNames).map((name) => name.trim()));
  if (!names.has(base)) {
    return base;
  }

  let index = 2;
  while (names.has(`${base} ${index}`)) {
    index += 1;
  }
  return `${base} ${index}`;
}

export function buildToken4AIProviderTargets(
  state: Token4AIUnifiedFormState,
  options: BuildToken4AITargetsOptions = {},
): Token4AIProviderTarget[] {
  const now = options.now ?? Date.now();
  const targets: Token4AIProviderTarget[] = [];

  const openai = state.openai;
  if (shouldCreate(openai)) {
    const name = resolveProviderName(openai, "openai");
    const baseUrl = resolveBaseUrl(openai, "openai");
    const apiKey = openai.apiKey.trim();
    const model = openai.model.trim() || TOKEN4AI_PRODUCTS.openai.defaultModel;

    targets.push({
      appId: "codex",
      productKey: "openai",
      label: `${name} (Codex)`,
      provider: buildCodexProvider({
        name,
        baseUrl,
        apiKey,
        model,
        providerKey: "token4ai_openai",
        productKey: "openai",
        usableBy: openai.alsoUseClaudeCode ? ["codex", "claude"] : ["codex"],
        supportsClaudeCodeCompat: !!openai.alsoUseClaudeCode,
        now,
      }),
    });

    if (openai.alsoUseClaudeCode) {
      targets.push({
        appId: "claude",
        productKey: "openai",
        label: `${name} (Claude Code)`,
        provider: buildClaudeProvider({
          name,
          baseUrl,
          apiKey,
          model,
          productKey: "openai",
          apiFormat: "openai_responses",
          providerType: "openai_compatible",
          supportsClaudeCodeCompat: true,
          now,
        }),
      });
    }
  }

  const claude = state.claude;
  if (shouldCreate(claude)) {
    const name = resolveProviderName(claude, "claude");
    const model = claude.model.trim();
    targets.push({
      appId: "claude",
      productKey: "claude",
      label: name,
      provider: buildClaudeProvider({
        name,
        baseUrl: resolveBaseUrl(claude, "claude"),
        apiKey: claude.apiKey.trim(),
        model,
        productKey: "claude",
        apiFormat: "anthropic",
        providerType: undefined,
        supportsClaudeCodeCompat: true,
        now,
      }),
    });
  }

  const gemini = state.gemini;
  if (shouldCreate(gemini)) {
    const name = resolveProviderName(gemini, "gemini");
    const env: Record<string, string> = {
      GOOGLE_GEMINI_BASE_URL: resolveBaseUrl(gemini, "gemini"),
      GEMINI_API_KEY: gemini.apiKey.trim(),
    };
    const model = gemini.model.trim();
    if (model) {
      env.GEMINI_MODEL = model;
    }

    targets.push({
      appId: "gemini",
      productKey: "gemini",
      label: name,
      provider: {
        name,
        websiteUrl: TOKEN4AI_WEBSITE_URL,
        category: "aggregator",
        settingsConfig: { env },
        icon: "token4ai",
        meta: buildMeta({
          productKey: "gemini",
          usableBy: ["gemini"],
          supportsProxyTakeover: false,
          supportsClaudeCodeCompat: false,
          now,
          baseUrl: env.GOOGLE_GEMINI_BASE_URL,
        }),
      },
    });
  }

  const minimax = state.minimax;
  if (shouldCreate(minimax)) {
    const name = resolveProviderName(minimax, "minimax");
    const baseUrl = resolveBaseUrl(minimax, "minimax");
    const apiKey = minimax.apiKey.trim();
    const model =
      minimax.model.trim() || TOKEN4AI_PRODUCTS.minimax.defaultModel;

    targets.push({
      appId: "codex",
      productKey: "minimax",
      label: `${name} (Codex)`,
      provider: buildCodexProvider({
        name,
        baseUrl,
        apiKey,
        model,
        providerKey: "token4ai_minimax",
        productKey: "minimax",
        usableBy: minimax.tryClaudeCode ? ["codex", "claude"] : ["codex"],
        supportsClaudeCodeCompat: !!minimax.tryClaudeCode,
        now,
      }),
    });

    if (minimax.tryClaudeCode) {
      targets.push({
        appId: "claude",
        productKey: "minimax",
        label: `${name} (Claude Code)`,
        provider: buildClaudeProvider({
          name,
          baseUrl,
          apiKey,
          model,
          productKey: "minimax",
          apiFormat: "openai_responses",
          providerType: "openai_compatible",
          supportsClaudeCodeCompat: true,
          now,
        }),
      });
    }
  }

  return targets;
}

function shouldCreate(product: Token4AIProductFormState): boolean {
  return product.enabled && product.apiKey.trim().length > 0;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function resolveProviderName(
  product: Token4AIProductFormState,
  key: Token4AIProductKey,
): string {
  return (
    product.providerName.trim() || TOKEN4AI_PRODUCTS[key].defaultProviderName
  );
}

function resolveBaseUrl(
  product: Token4AIProductFormState,
  key: Token4AIProductKey,
): string {
  return (
    normalizeBaseUrl(product.baseUrl) || TOKEN4AI_PRODUCTS[key].defaultBaseUrl
  );
}

function customEndpointsFor(baseUrl: string, now: number) {
  const endpoint: CustomEndpoint = {
    url: baseUrl,
    addedAt: now,
    lastUsed: undefined,
  };
  return { [baseUrl]: endpoint };
}

function buildMeta(args: {
  productKey: Token4AIProductKey;
  usableBy: string[];
  supportsProxyTakeover: boolean;
  supportsClaudeCodeCompat: boolean;
  now: number;
  baseUrl: string;
  apiFormat?: ProviderMeta["apiFormat"];
  providerType?: string;
}): ProviderMeta {
  return {
    isPartner: true,
    usableBy: args.usableBy,
    supportsProxyTakeover: args.supportsProxyTakeover,
    supportsClaudeCodeCompat: args.supportsClaudeCodeCompat,
    token4aiProduct: args.productKey,
    custom_endpoints: customEndpointsFor(args.baseUrl, args.now),
    ...(args.apiFormat ? { apiFormat: args.apiFormat } : {}),
    ...(args.providerType ? { providerType: args.providerType } : {}),
  };
}

function buildCodexProvider(args: {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  providerKey: string;
  productKey: Token4AIProductKey;
  usableBy: string[];
  supportsClaudeCodeCompat: boolean;
  now: number;
}): Omit<Provider, "id"> {
  return {
    name: args.name,
    websiteUrl: TOKEN4AI_WEBSITE_URL,
    category: "aggregator",
    settingsConfig: {
      auth: {
        OPENAI_API_KEY: args.apiKey,
      },
      config: generateThirdPartyConfig(
        args.providerKey,
        args.baseUrl,
        args.model,
      ),
    },
    icon: "token4ai",
    meta: buildMeta({
      productKey: args.productKey,
      usableBy: args.usableBy,
      supportsProxyTakeover: args.supportsClaudeCodeCompat,
      supportsClaudeCodeCompat: args.supportsClaudeCodeCompat,
      now: args.now,
      baseUrl: args.baseUrl,
      apiFormat: "openai_responses",
      providerType: "openai_compatible",
    }),
  };
}

function buildClaudeProvider(args: {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  productKey: Token4AIProductKey;
  apiFormat: ProviderMeta["apiFormat"];
  providerType?: string;
  supportsClaudeCodeCompat: boolean;
  now: number;
}): Omit<Provider, "id"> {
  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: args.baseUrl,
    ANTHROPIC_AUTH_TOKEN: args.apiKey,
  };
  if (args.model) {
    env.ANTHROPIC_MODEL = args.model;
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = args.model;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = args.model;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = args.model;
  }

  return {
    name: args.name,
    websiteUrl: TOKEN4AI_WEBSITE_URL,
    category: "aggregator",
    settingsConfig: { env },
    icon: "token4ai",
    meta: buildMeta({
      productKey: args.productKey,
      usableBy: ["claude"],
      supportsProxyTakeover: true,
      supportsClaudeCodeCompat: args.supportsClaudeCodeCompat,
      now: args.now,
      baseUrl: args.baseUrl,
      apiFormat: args.apiFormat,
      providerType: args.providerType,
    }),
  };
}
