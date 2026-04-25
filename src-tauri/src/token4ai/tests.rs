#[cfg(test)]
mod tests {
    use super::super::constants::Token4AIProduct;
    use super::super::provider_templates::token4ai_provider_templates;
    use super::super::url::{join_api_url, token4ai_model_discovery_url};
    use super::super::validation::{can_enable_claude_code_compat, is_valid_token4ai_base_url};

    #[test]
    fn openai_and_minimax_model_urls_do_not_duplicate_v1() {
        assert_eq!(
            token4ai_model_discovery_url(Token4AIProduct::OpenAI, "https://api.token4ai.cloud/v1")
                .as_deref(),
            Some("https://api.token4ai.cloud/v1/models")
        );
        assert_eq!(
            token4ai_model_discovery_url(
                Token4AIProduct::MiniMax,
                "https://api.token4ai.cloud/v1/"
            )
            .as_deref(),
            Some("https://api.token4ai.cloud/v1/models")
        );
    }

    #[test]
    fn anthropic_and_gemini_do_not_force_openai_model_discovery() {
        assert_eq!(
            token4ai_model_discovery_url(Token4AIProduct::Anthropic, "https://api.token4ai.cloud"),
            None
        );
        assert_eq!(
            token4ai_model_discovery_url(Token4AIProduct::Gemini, "https://api.token4ai.cloud"),
            None
        );
    }

    #[test]
    fn helper_joins_api_urls_without_double_slashes() {
        assert_eq!(
            join_api_url("https://api.token4ai.cloud/v1/", "/models"),
            "https://api.token4ai.cloud/v1/models"
        );
    }

    #[test]
    fn validates_base_url_and_compat_policy() {
        assert!(is_valid_token4ai_base_url(Token4AIProduct::OpenAI, ""));
        assert!(!is_valid_token4ai_base_url(
            Token4AIProduct::OpenAI,
            "not a url"
        ));
        assert!(can_enable_claude_code_compat(Token4AIProduct::OpenAI));
        assert!(can_enable_claude_code_compat(Token4AIProduct::Anthropic));
        assert!(can_enable_claude_code_compat(Token4AIProduct::MiniMax));
        assert!(!can_enable_claude_code_compat(Token4AIProduct::Gemini));
    }

    #[test]
    fn provider_templates_keep_default_names_and_flags() {
        let templates = token4ai_provider_templates();
        assert_eq!(templates[0].provider_name, "Token4AI OpenAI");
        assert!(templates[0].default_claude_code_compat_enabled);
        assert_eq!(templates[2].provider_name, "Token4AI Gemini");
        assert!(!templates[2].supports_claude_code_compat);
    }
}
