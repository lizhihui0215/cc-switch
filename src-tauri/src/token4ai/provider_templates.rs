use super::constants::Token4AIProduct;

pub struct Token4AIProviderTemplate {
    pub product: Token4AIProduct,
    pub provider_name: &'static str,
    pub default_base_url: &'static str,
    pub supports_claude_code_compat: bool,
    pub default_claude_code_compat_enabled: bool,
}

pub fn token4ai_provider_templates() -> [Token4AIProviderTemplate; 4] {
    [
        template(Token4AIProduct::OpenAI, true),
        template(Token4AIProduct::Anthropic, true),
        template(Token4AIProduct::Gemini, false),
        template(Token4AIProduct::MiniMax, true),
    ]
}

fn template(
    product: Token4AIProduct,
    supports_claude_code_compat: bool,
) -> Token4AIProviderTemplate {
    Token4AIProviderTemplate {
        product,
        provider_name: product.default_provider_name(),
        default_base_url: product.default_base_url(),
        supports_claude_code_compat,
        default_claude_code_compat_enabled: product.default_claude_code_compat(),
    }
}
