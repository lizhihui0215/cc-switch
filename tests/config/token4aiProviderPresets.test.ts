import { describe, expect, it } from "vitest";
import { providerPresets } from "@/config/claudeProviderPresets";
import { codexProviderPresets } from "@/config/codexProviderPresets";
import { geminiProviderPresets } from "@/config/geminiProviderPresets";

describe("token4AI Claude provider preset", () => {
  const preset = providerPresets.find((item) => item.name === "token4AI");

  it("is available as a Claude provider preset", () => {
    expect(preset).toBeDefined();
    expect(preset?.nameKey).toBe("providerForm.presets.token4ai");
    expect(preset?.category).toBe("aggregator");
    expect(preset?.providerType).toBe("openai_compatible");
    expect(preset?.isPartner).toBe(true);
    expect(preset?.icon).toBe("token4ai");
  });

  it("defaults to OpenAI Responses with token4AI v1 base URL", () => {
    expect(preset?.apiFormat).toBe("openai_responses");
    expect(preset?.endpointCandidates).toEqual([
      "https://api.token4ai.cloud/v1",
    ]);

    const env = (preset?.settingsConfig as { env: Record<string, string> }).env;
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.token4ai.cloud/v1");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("");
    expect(env.ANTHROPIC_MODEL).toBe("");
  });

  it("keeps model fields manually editable for /models fallback", () => {
    const env = (preset?.settingsConfig as { env: Record<string, string> }).env;

    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe("");
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe("");
    expect(env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe("");
  });

  it("is ordered before Shengsuanyun in the Claude preset list", () => {
    const token4aiIndex = providerPresets.findIndex(
      (item) => item.name === "token4AI",
    );
    const shengsuanyunIndex = providerPresets.findIndex(
      (item) => item.name === "Shengsuanyun",
    );

    expect(token4aiIndex).toBeGreaterThanOrEqual(0);
    expect(shengsuanyunIndex).toBeGreaterThanOrEqual(0);
    expect(token4aiIndex).toBeLessThan(shengsuanyunIndex);
  });
});

describe("Token4AI Codex provider preset", () => {
  const preset = codexProviderPresets.find((item) => item.name === "Token4AI");

  it("is available before Shengsuanyun with partner branding", () => {
    const token4aiIndex = codexProviderPresets.findIndex(
      (item) => item.name === "Token4AI",
    );
    const shengsuanyunIndex = codexProviderPresets.findIndex(
      (item) => item.name === "Shengsuanyun",
    );

    expect(preset).toBeDefined();
    expect(preset?.nameKey).toBe("providerForm.presets.token4ai");
    expect(preset?.category).toBe("aggregator");
    expect(preset?.isPartner).toBe(true);
    expect(preset?.icon).toBe("token4ai");
    expect(token4aiIndex).toBeGreaterThanOrEqual(0);
    expect(shengsuanyunIndex).toBeGreaterThanOrEqual(0);
    expect(token4aiIndex).toBeLessThan(shengsuanyunIndex);
  });

  it("defaults Codex to the Token4AI OpenAI-compatible Responses endpoint", () => {
    expect(preset?.endpointCandidates).toEqual([
      "https://api.token4ai.cloud/v1",
    ]);
    expect(preset?.auth.OPENAI_API_KEY).toBe("");
    expect(preset?.config).toContain('model_provider = "token4ai_openai"');
    expect(preset?.config).toContain('model = "gpt-5.4"');
    expect(preset?.config).toContain(
      'base_url = "https://api.token4ai.cloud/v1"',
    );
    expect(preset?.config).toContain('wire_api = "responses"');
  });
});

describe("Token4AI Gemini provider preset", () => {
  const preset = geminiProviderPresets.find((item) => item.name === "Token4AI");

  it("is available before Shengsuanyun with partner branding", () => {
    const token4aiIndex = geminiProviderPresets.findIndex(
      (item) => item.name === "Token4AI",
    );
    const shengsuanyunIndex = geminiProviderPresets.findIndex(
      (item) => item.name === "Shengsuanyun",
    );

    expect(preset).toBeDefined();
    expect(preset?.nameKey).toBe("providerForm.presets.token4ai");
    expect(preset?.category).toBe("aggregator");
    expect(preset?.isPartner).toBe(true);
    expect(preset?.icon).toBe("token4ai");
    expect(token4aiIndex).toBeGreaterThanOrEqual(0);
    expect(shengsuanyunIndex).toBeGreaterThanOrEqual(0);
    expect(token4aiIndex).toBeLessThan(shengsuanyunIndex);
  });

  it("defaults Gemini to the Token4AI Gemini endpoint", () => {
    const env = (preset?.settingsConfig as { env: Record<string, string> })
      .env;

    expect(preset?.endpointCandidates).toEqual([
      "https://api.token4ai.cloud",
    ]);
    expect(preset?.baseURL).toBe("https://api.token4ai.cloud");
    expect(env.GOOGLE_GEMINI_BASE_URL).toBe("https://api.token4ai.cloud");
    expect(env.GEMINI_API_KEY).toBe("");
    expect(env.GEMINI_MODEL).toBe("");
  });
});
