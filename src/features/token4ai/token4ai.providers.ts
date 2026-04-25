import { generateThirdPartyConfig } from "@/config/codexProviderPresets";
import type { CustomEndpoint, Provider, ProviderMeta } from "@/types";
import {
  TOKEN4AI_CLAUDE_CODE_COMPAT_DEFAULTS,
  TOKEN4AI_ANTHROPIC_BASE_URL,
  TOKEN4AI_GEMINI_BASE_URL,
  TOKEN4AI_MINIMAX_BASE_URL,
  TOKEN4AI_OPENAI_BASE_URL,
  TOKEN4AI_PRODUCT_ORDER,
  TOKEN4AI_PROVIDER_ID,
  TOKEN4AI_PROVIDER_NAMES,
  TOKEN4AI_WEBSITE_URL,
} from "./token4ai.constants";
import type {
  BuildToken4AITargetsOptions,
  Token4AIProductDefinition,
  Token4AIProductFormState,
  Token4AIProductId,
  Token4AIProviderTarget,
  Token4AIUnifiedFormState,
} from "./token4ai.types";
import { normalizeToken4AIBaseUrl } from "./token4ai.url";

export const TOKEN4AI_PRODUCTS: Record<
  Token4AIProductId,
  Token4AIProductDefinition
> = {
  openai: {
    productId: "openai",
    labelKey: "token4aiUnified.products.openai.title",
    defaultLabel: "OpenAI / Codex",
    targetKey: "token4aiUnified.products.openai.target",
    defaultTarget: "Codex / Claude Code",
    providerName: TOKEN4AI_PROVIDER_NAMES.openai,
    defaultBaseUrl: TOKEN4AI_OPENAI_BASE_URL,
    defaultModel: "gpt-5.4",
    appTarget: "codex",
    defaultApiFormat: "openai_responses",
    supportsModelDiscovery: true,
    supportsClaudeCodeCompat: true,
    defaultClaudeCodeCompatEnabled: TOKEN4AI_CLAUDE_CODE_COMPAT_DEFAULTS.openai,
    modelDiscoveryKind: "openai_models",
    secretKeyFieldName: "OPENAI_API_KEY",
  },
  anthropic: {
    productId: "anthropic",
    labelKey: "token4aiUnified.products.claude.title",
    defaultLabel: "Anthropic / Claude",
    targetKey: "token4aiUnified.products.claude.target",
    defaultTarget: "Claude Code",
    providerName: TOKEN4AI_PROVIDER_NAMES.anthropic,
    defaultBaseUrl: TOKEN4AI_ANTHROPIC_BASE_URL,
    defaultModel: "",
    appTarget: "claude",
    defaultApiFormat: "anthropic",
    supportsModelDiscovery: false,
    supportsClaudeCodeCompat: true,
    defaultClaudeCodeCompatEnabled:
      TOKEN4AI_CLAUDE_CODE_COMPAT_DEFAULTS.anthropic,
    modelDiscoveryKind: "anthropic_native",
    secretKeyFieldName: "ANTHROPIC_AUTH_TOKEN",
  },
  gemini: {
    productId: "gemini",
    labelKey: "token4aiUnified.products.gemini.title",
    defaultLabel: "Gemini",
    targetKey: "token4aiUnified.products.gemini.target",
    defaultTarget: "Gemini CLI",
    providerName: TOKEN4AI_PROVIDER_NAMES.gemini,
    defaultBaseUrl: TOKEN4AI_GEMINI_BASE_URL,
    defaultModel: "",
    appTarget: "gemini",
    defaultApiFormat: "gemini",
    supportsModelDiscovery: false,
    supportsClaudeCodeCompat: false,
    defaultClaudeCodeCompatEnabled: TOKEN4AI_CLAUDE_CODE_COMPAT_DEFAULTS.gemini,
    modelDiscoveryKind: "gemini_native",
    secretKeyFieldName: "GEMINI_API_KEY",
  },
  minimax: {
    productId: "minimax",
    labelKey: "token4aiUnified.products.minimax.title",
    defaultLabel: "MiniMax",
    targetKey: "token4aiUnified.products.minimax.target",
    defaultTarget: "Codex / OpenAI-compatible",
    providerName: TOKEN4AI_PROVIDER_NAMES.minimax,
    defaultBaseUrl: TOKEN4AI_MINIMAX_BASE_URL,
    defaultModel: "MiniMax-M2.7",
    appTarget: "codex",
    defaultApiFormat: "openai_responses",
    supportsModelDiscovery: true,
    supportsClaudeCodeCompat: true,
    defaultClaudeCodeCompatEnabled:
      TOKEN4AI_CLAUDE_CODE_COMPAT_DEFAULTS.minimax,
    modelDiscoveryKind: "openai_models",
    secretKeyFieldName: "OPENAI_API_KEY",
  },
};

export { TOKEN4AI_PRODUCT_ORDER };

export function createDefaultToken4AIUnifiedState(): Token4AIUnifiedFormState {
  return TOKEN4AI_PRODUCT_ORDER.reduce((acc, productId) => {
    const product = TOKEN4AI_PRODUCTS[productId];
    acc[productId] = {
      enabled: true,
      providerName: product.providerName,
      baseUrl: product.defaultBaseUrl,
      apiKey: "",
      model: "",
      alsoUseClaudeCode:
        productId === "openai"
          ? product.defaultClaudeCodeCompatEnabled
          : undefined,
      tryClaudeCode:
        productId === "minimax"
          ? product.defaultClaudeCodeCompatEnabled
          : undefined,
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

export function buildToken4AIProviderTemplates(
  state: Token4AIUnifiedFormState,
  options: BuildToken4AITargetsOptions = {},
): Token4AIProviderTarget[] {
  return buildToken4AIProviderTargets(state, options);
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

  const anthropic = state.anthropic;
  if (shouldCreate(anthropic)) {
    const name = resolveProviderName(anthropic, "anthropic");
    const model = anthropic.model.trim();
    targets.push({
      appId: "claude",
      productKey: "anthropic",
      label: name,
      provider: buildClaudeProvider({
        name,
        baseUrl: resolveBaseUrl(anthropic, "anthropic"),
        apiKey: anthropic.apiKey.trim(),
        model,
        productKey: "anthropic",
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
        icon: TOKEN4AI_PROVIDER_ID,
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

function resolveProviderName(
  product: Token4AIProductFormState,
  productId: Token4AIProductId,
): string {
  return (
    product.providerName.trim() || TOKEN4AI_PRODUCTS[productId].providerName
  );
}

function resolveBaseUrl(
  product: Token4AIProductFormState,
  productId: Token4AIProductId,
): string {
  return normalizeToken4AIBaseUrl(productId, product.baseUrl);
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
  productKey: Token4AIProductId;
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
  productKey: Token4AIProductId;
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
    icon: TOKEN4AI_PROVIDER_ID,
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
  productKey: Token4AIProductId;
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
    icon: TOKEN4AI_PROVIDER_ID,
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
