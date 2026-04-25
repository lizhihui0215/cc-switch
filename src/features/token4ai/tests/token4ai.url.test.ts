import { describe, expect, it } from "vitest";
import {
  getToken4AIModelDiscoveryUrl,
  joinApiUrl,
  normalizeToken4AIBaseUrl,
} from "../token4ai.url";

describe("Token4AI URL helpers", () => {
  it("keeps OpenAI and MiniMax default base URLs on /v1", () => {
    expect(normalizeToken4AIBaseUrl("openai", "")).toBe(
      "https://api.token4ai.cloud/v1",
    );
    expect(normalizeToken4AIBaseUrl("minimax", "")).toBe(
      "https://api.token4ai.cloud/v1",
    );
  });

  it("does not duplicate /v1 for OpenAI and MiniMax model discovery", () => {
    expect(
      getToken4AIModelDiscoveryUrl("openai", "https://api.token4ai.cloud/v1"),
    ).toBe("https://api.token4ai.cloud/v1/models");
    expect(
      getToken4AIModelDiscoveryUrl("minimax", "https://api.token4ai.cloud/v1/"),
    ).toBe("https://api.token4ai.cloud/v1/models");
  });

  it("does not force OpenAI model discovery on Anthropic or Gemini", () => {
    expect(
      getToken4AIModelDiscoveryUrl("anthropic", "https://api.token4ai.cloud"),
    ).toBeNull();
    expect(
      getToken4AIModelDiscoveryUrl("gemini", "https://api.token4ai.cloud"),
    ).toBeNull();
  });

  it("joins API URLs without double slashes", () => {
    expect(joinApiUrl("https://api.token4ai.cloud/v1/", "/models")).toBe(
      "https://api.token4ai.cloud/v1/models",
    );
  });
});
