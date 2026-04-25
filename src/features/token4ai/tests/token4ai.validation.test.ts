import { describe, expect, it } from "vitest";
import { createDefaultToken4AIUnifiedState } from "../token4ai.providers";
import {
  canEnableToken4AIClaudeCompat,
  getSkippedToken4AIProducts,
  shouldCreateToken4AIProduct,
  validateToken4AIForm,
} from "../token4ai.validation";

describe("Token4AI validation", () => {
  it("requires at least one enabled product with an API key", () => {
    const state = createDefaultToken4AIUnifiedState();
    expect(validateToken4AIForm(state).map((issue) => issue.code)).toContain(
      "require_one_api_key",
    );
  });

  it("skips disabled products and empty enabled products", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.openai.apiKey = "token4ai-openai-test-key";
    state.gemini.enabled = false;
    state.gemini.apiKey = "token4ai-gemini-test-key";

    expect(shouldCreateToken4AIProduct(state.openai)).toBe(true);
    expect(shouldCreateToken4AIProduct(state.gemini)).toBe(false);
    expect(getSkippedToken4AIProducts(state)).toEqual(["anthropic", "minimax"]);
  });

  it("keeps Claude Code compatibility policy conservative", () => {
    expect(canEnableToken4AIClaudeCompat("openai")).toBe(true);
    expect(canEnableToken4AIClaudeCompat("anthropic")).toBe(true);
    expect(canEnableToken4AIClaudeCompat("minimax")).toBe(true);
    expect(canEnableToken4AIClaudeCompat("gemini")).toBe(false);
  });

  it("validates base URL format without requiring model fields", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.openai.apiKey = "token4ai-openai-test-key";
    state.openai.baseUrl = "not a url";
    state.openai.model = "";

    expect(validateToken4AIForm(state).map((issue) => issue.code)).toContain(
      "invalid_base_url",
    );
  });

  it("does not validate skipped products without API keys", () => {
    const state = createDefaultToken4AIUnifiedState();
    state.openai.apiKey = "token4ai-openai-test-key";
    state.gemini.baseUrl = "not a url";

    expect(validateToken4AIForm(state).map((issue) => issue.code)).not.toContain(
      "invalid_base_url",
    );
  });
});
