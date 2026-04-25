import { describe, expect, it } from "vitest";
import {
  buildToken4AIProviderTargets,
  createDefaultToken4AIUnifiedState,
  getUniqueProviderName,
  TOKEN4AI_PRODUCTS,
} from "@/lib/token4aiUnifiedProviders";

describe("Token4AI unified provider builder", () => {
  it("keeps the requested product default base URLs", () => {
    expect(TOKEN4AI_PRODUCTS.openai.defaultBaseUrl).toBe(
      "https://api.token4ai.cloud/v1",
    );
    expect(TOKEN4AI_PRODUCTS.claude.defaultBaseUrl).toBe(
      "https://api.token4ai.cloud",
    );
    expect(TOKEN4AI_PRODUCTS.gemini.defaultBaseUrl).toBe(
      "https://api.token4ai.cloud",
    );
    expect(TOKEN4AI_PRODUCTS.minimax.defaultBaseUrl).toBe(
      "https://api.token4ai.cloud/v1",
    );
  });

  it("does not build any provider when all API keys are empty", () => {
    const state = createDefaultToken4AIUnifiedState();

    expect(buildToken4AIProviderTargets(state)).toEqual([]);
  });

  it("builds Codex and Claude Code compatible providers for OpenAI", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.openai.apiKey = "token4ai-openai-test-key";

    const targets = buildToken4AIProviderTargets(state, { now: 1 });

    expect(targets.map((target) => target.appId)).toEqual(["codex", "claude"]);
    expect(targets[0].provider.name).toBe("Token4AI OpenAI");
    expect(targets[0].provider.meta?.usableBy).toEqual(["codex", "claude"]);
    expect(targets[0].provider.meta?.apiFormat).toBe("openai_responses");
    expect(targets[0].provider.meta?.providerType).toBe("openai_compatible");
    expect(targets[0].provider.meta?.supportsProxyTakeover).toBe(true);
    expect(targets[0].provider.meta?.supportsClaudeCodeCompat).toBe(true);

    const claudeConfig = targets[1].provider.settingsConfig.env;
    expect(claudeConfig.ANTHROPIC_BASE_URL).toBe(
      "https://api.token4ai.cloud/v1",
    );
    expect(claudeConfig.ANTHROPIC_AUTH_TOKEN).toBe("token4ai-openai-test-key");
    expect(targets[1].provider.meta?.apiFormat).toBe("openai_responses");
  });

  it("builds OpenAI only for Codex when Claude Code compatibility is off", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.openai.apiKey = "token4ai-openai-test-key";
    state.openai.alsoUseClaudeCode = false;

    const targets = buildToken4AIProviderTargets(state);

    expect(targets).toHaveLength(1);
    expect(targets[0].appId).toBe("codex");
    expect(targets[0].provider.meta?.usableBy).toEqual(["codex"]);
    expect(targets[0].provider.meta?.supportsClaudeCodeCompat).toBe(false);
  });

  it("builds Claude native provider with Anthropic-compatible metadata", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.claude.apiKey = "token4ai-claude-test-key";
    state.claude.model = "claude-sonnet";

    const [target] = buildToken4AIProviderTargets(state);

    expect(target.appId).toBe("claude");
    expect(target.provider.name).toBe("Token4AI Claude");
    expect(target.provider.settingsConfig.env.ANTHROPIC_BASE_URL).toBe(
      "https://api.token4ai.cloud",
    );
    expect(target.provider.meta?.apiFormat).toBe("anthropic");
    expect(target.provider.meta?.supportsClaudeCodeCompat).toBe(true);
  });

  it("builds both OpenAI and Claude products when both API keys are filled", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.openai.apiKey = "token4ai-openai-test-key";
    state.claude.apiKey = "token4ai-claude-test-key";

    const targets = buildToken4AIProviderTargets(state);

    expect(targets.map((target) => target.productKey)).toEqual([
      "openai",
      "openai",
      "claude",
    ]);
    expect(targets.map((target) => target.appId)).toEqual([
      "codex",
      "claude",
      "claude",
    ]);
  });

  it("builds Gemini only for Gemini CLI by default", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.gemini.apiKey = "token4ai-gemini-test-key";

    const [target] = buildToken4AIProviderTargets(state);

    expect(target.appId).toBe("gemini");
    expect(target.provider.meta?.usableBy).toEqual(["gemini"]);
    expect(target.provider.meta?.supportsClaudeCodeCompat).toBe(false);
  });

  it("skips a disabled product even when its API key is filled", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.gemini.apiKey = "token4ai-gemini-test-key";
    state.gemini.enabled = false;

    expect(buildToken4AIProviderTargets(state)).toEqual([]);
  });

  it("does not mark MiniMax Claude compatibility unless explicitly enabled", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.minimax.apiKey = "token4ai-minimax-test-key";

    const targets = buildToken4AIProviderTargets(state);

    expect(targets).toHaveLength(1);
    expect(targets[0].appId).toBe("codex");
    expect(targets[0].provider.meta?.usableBy).toEqual(["codex"]);
    expect(targets[0].provider.meta?.supportsClaudeCodeCompat).toBe(false);
  });

  it("can opt MiniMax into the existing OpenAI Responses Claude path", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.minimax.apiKey = "token4ai-minimax-test-key";
    state.minimax.tryClaudeCode = true;

    const targets = buildToken4AIProviderTargets(state);

    expect(targets.map((target) => target.appId)).toEqual(["codex", "claude"]);
    expect(targets[1].provider.meta?.apiFormat).toBe("openai_responses");
    expect(targets[1].provider.meta?.providerType).toBe("openai_compatible");
  });

  it("generates a gentle duplicate display name suffix", () => {
    expect(
      getUniqueProviderName("Token4AI OpenAI", [
        "Token4AI OpenAI",
        "Token4AI OpenAI 2",
      ]),
    ).toBe("Token4AI OpenAI 3");
  });

  it("falls back to product defaults when optional name or base URL is cleared", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.openai.apiKey = "token4ai-openai-test-key";
    state.openai.providerName = " ";
    state.openai.baseUrl = " ";

    const [codexTarget, claudeTarget] = buildToken4AIProviderTargets(state);

    expect(codexTarget.provider.name).toBe("Token4AI OpenAI");
    expect(
      codexTarget.provider.meta?.custom_endpoints?.[
        "https://api.token4ai.cloud/v1"
      ]?.url,
    ).toBe("https://api.token4ai.cloud/v1");
    expect(claudeTarget.provider.settingsConfig.env.ANTHROPIC_BASE_URL).toBe(
      "https://api.token4ai.cloud/v1",
    );
  });
});
