use super::constants::Token4AIProduct;

pub fn join_api_url(base_url: &str, path: &str) -> String {
    let base = base_url.trim().trim_end_matches('/');
    let suffix = path.trim().trim_start_matches('/');
    if suffix.is_empty() {
        base.to_string()
    } else {
        format!("{base}/{suffix}")
    }
}

pub fn normalize_token4ai_base_url(product: Token4AIProduct, base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        product.default_base_url().to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn token4ai_model_discovery_url(product: Token4AIProduct, base_url: &str) -> Option<String> {
    let normalized = normalize_token4ai_base_url(product, base_url);
    match product {
        Token4AIProduct::OpenAI | Token4AIProduct::MiniMax => {
            if normalized.ends_with("/v1") {
                Some(join_api_url(&normalized, "models"))
            } else {
                Some(join_api_url(&normalized, "v1/models"))
            }
        }
        Token4AIProduct::Anthropic | Token4AIProduct::Gemini => None,
    }
}
