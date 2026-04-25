import type { AppId } from "@/lib/api";
import type { Provider, ProviderMeta } from "@/types";

export type Token4AIProductId = "openai" | "anthropic" | "gemini" | "minimax";
export type Token4AIProductKey = Token4AIProductId;

export type Token4AIModelDiscoveryKind =
  | "openai_models"
  | "anthropic_native"
  | "gemini_native"
  | "none";

export interface Token4AIProductDefinition {
  productId: Token4AIProductId;
  labelKey: string;
  defaultLabel: string;
  targetKey: string;
  defaultTarget: string;
  providerName: string;
  defaultBaseUrl: string;
  defaultModel: string;
  appTarget: AppId;
  defaultApiFormat: ProviderMeta["apiFormat"] | "gemini";
  supportsModelDiscovery: boolean;
  supportsClaudeCodeCompat: boolean;
  defaultClaudeCodeCompatEnabled: boolean;
  modelDiscoveryKind: Token4AIModelDiscoveryKind;
  secretKeyFieldName: string;
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
  Token4AIProductId,
  Token4AIProductFormState
>;

export interface Token4AIProviderTarget {
  appId: AppId;
  label: string;
  productKey: Token4AIProductId;
  provider: Omit<Provider, "id">;
}

export interface BuildToken4AITargetsOptions {
  now?: number;
}

export interface Token4AIValidationIssue {
  productId?: Token4AIProductId;
  code: string;
  message: string;
}

export interface Token4AICreateSummary {
  created: string[];
  skipped: string[];
  failed: string[];
}
