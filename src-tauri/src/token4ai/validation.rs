use url::Url;

use super::constants::Token4AIProduct;
use super::url::normalize_token4ai_base_url;

pub fn is_valid_token4ai_base_url(product: Token4AIProduct, base_url: &str) -> bool {
    let normalized = normalize_token4ai_base_url(product, base_url);
    Url::parse(&normalized)
        .map(|url| matches!(url.scheme(), "http" | "https"))
        .unwrap_or(false)
}

pub fn can_enable_claude_code_compat(product: Token4AIProduct) -> bool {
    !matches!(product, Token4AIProduct::Gemini)
}
