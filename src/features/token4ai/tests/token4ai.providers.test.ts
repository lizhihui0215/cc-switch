import { describe, expect, it } from "vitest";
import {
  buildToken4AIProviderTemplates,
  createDefaultToken4AIUnifiedState,
  TOKEN4AI_PRODUCTS,
} from "../token4ai.providers";

describe("Token4AI provider templates", () => {
  it("creates providers only for enabled products with non-empty API keys", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.openai.apiKey = "token4ai-openai-test-key";
    state.anthropic.apiKey = "";
    state.gemini.enabled = false;
    state.gemini.apiKey = "token4ai-gemini-test-key";

    const targets = buildToken4AIProviderTemplates(state, { now: 1 });

    expect(targets.map((target) => target.productKey)).toEqual([
      "openai",
      "openai",
    ]);
  });

  it("keeps OpenAI and Anthropic available to Claude Code", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.openai.apiKey = "token4ai-openai-test-key";
    state.anthropic.apiKey = "token4ai-claude-test-key";

    const targets = buildToken4AIProviderTemplates(state, { now: 1 });
    const openaiCodex = targets.find(
      (target) => target.productKey === "openai" && target.appId === "codex",
    );
    const openaiClaude = targets.find(
      (target) => target.productKey === "openai" && target.appId === "claude",
    );
    const anthropicClaude = targets.find(
      (target) =>
        target.productKey === "anthropic" && target.appId === "claude",
    );

    expect(openaiCodex?.provider.meta?.usableBy).toEqual(["codex", "claude"]);
    expect(openaiClaude?.provider.meta?.providerType).toBe("openai_compatible");
    expect(anthropicClaude?.provider.meta?.apiFormat).toBe("anthropic");
    expect(anthropicClaude?.provider.meta?.supportsClaudeCodeCompat).toBe(true);
  });

  it("keeps MiniMax and Gemini Claude Code compatibility off by default", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.minimax.apiKey = "token4ai-minimax-test-key";
    state.gemini.apiKey = "token4ai-gemini-test-key";

    const targets = buildToken4AIProviderTemplates(state, { now: 1 });

    expect(TOKEN4AI_PRODUCTS.minimax.defaultClaudeCodeCompatEnabled).toBe(
      false,
    );
    expect(TOKEN4AI_PRODUCTS.gemini.defaultClaudeCodeCompatEnabled).toBe(false);
    expect(
      targets.find((target) => target.productKey === "minimax")?.provider.meta
        ?.supportsClaudeCodeCompat,
    ).toBe(false);
    expect(
      targets.find((target) => target.productKey === "gemini")?.provider.meta
        ?.supportsClaudeCodeCompat,
    ).toBe(false);
  });

  it("does not expose API keys through provider metadata", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.openai.apiKey = "token4ai-openai-secret";

    const targets = buildToken4AIProviderTemplates(state, { now: 1 });

    expect(
      JSON.stringify(targets.map((target) => target.provider.meta)),
    ).not.toContain("token4ai-openai-secret");
  });
});
