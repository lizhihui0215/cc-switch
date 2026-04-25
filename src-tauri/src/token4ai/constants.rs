// Keep names aligned with src/features/token4ai/token4ai.constants.ts.

pub const TOKEN4AI_PROVIDER_ID: &str = "token4ai";
pub const TOKEN4AI_DISPLAY_NAME: &str = "Token4AI";
pub const TOKEN4AI_OPENAI_BASE_URL: &str = "https://api.token4ai.cloud/v1";
pub const TOKEN4AI_ANTHROPIC_BASE_URL: &str = "https://api.token4ai.cloud";
pub const TOKEN4AI_GEMINI_BASE_URL: &str = "https://api.token4ai.cloud";
pub const TOKEN4AI_MINIMAX_BASE_URL: &str = "https://api.token4ai.cloud/v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Token4AIProduct {
    OpenAI,
    Anthropic,
    Gemini,
    MiniMax,
}

impl Token4AIProduct {
    pub fn id(self) -> &'static str {
        match self {
            Self::OpenAI => "openai",
            Self::Anthropic => "anthropic",
            Self::Gemini => "gemini",
            Self::MiniMax => "minimax",
        }
    }

    pub fn default_provider_name(self) -> &'static str {
        match self {
            Self::OpenAI => "Token4AI OpenAI",
            Self::Anthropic => "Token4AI Claude",
            Self::Gemini => "Token4AI Gemini",
            Self::MiniMax => "Token4AI MiniMax",
        }
    }

    pub fn default_base_url(self) -> &'static str {
        match self {
            Self::OpenAI => TOKEN4AI_OPENAI_BASE_URL,
            Self::Anthropic => TOKEN4AI_ANTHROPIC_BASE_URL,
            Self::Gemini => TOKEN4AI_GEMINI_BASE_URL,
            Self::MiniMax => TOKEN4AI_MINIMAX_BASE_URL,
        }
    }

    pub fn default_claude_code_compat(self) -> bool {
        match self {
            Self::OpenAI | Self::Anthropic => true,
            Self::Gemini | Self::MiniMax => false,
        }
    }
}
