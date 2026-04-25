//! Provider routing metadata used for diagnostics and UI display.

use crate::provider::Provider;
use serde_json::Value;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProviderRouteMetadata {
    pub upstream_model: Option<String>,
    pub base_url: Option<String>,
    pub api_format: Option<String>,
    pub provider_type: Option<String>,
    pub supports_claude_code_compat: bool,
}

pub fn provider_route_metadata(app_type: &str, provider: &Provider) -> ProviderRouteMetadata {
    let mut route = ProviderRouteMetadata::default();

    if let Some(meta) = provider.meta.as_ref() {
        route.api_format = meta.api_format.clone();
        route.provider_type = meta.provider_type.clone();
        route.supports_claude_code_compat = meta.supports_claude_code_compat.unwrap_or(false);
    }

    route.api_format = route
        .api_format
        .or_else(|| string_at(&provider.settings_config, &["api_format"]));

    match app_type {
        "claude" => {
            route.upstream_model = first_string_at(
                &provider.settings_config,
                &[
                    &["env", "ANTHROPIC_MODEL"],
                    &["env", "ANTHROPIC_DEFAULT_SONNET_MODEL"],
                    &["env", "ANTHROPIC_DEFAULT_OPUS_MODEL"],
                    &["env", "ANTHROPIC_DEFAULT_HAIKU_MODEL"],
                ],
            );
            route.base_url = string_at(&provider.settings_config, &["env", "ANTHROPIC_BASE_URL"]);
        }
        "codex" => {
            if let Some(config) = string_at(&provider.settings_config, &["config"]) {
                apply_codex_route_metadata(&mut route, &config);
            }
        }
        "gemini" => {
            route.upstream_model = first_string_at(
                &provider.settings_config,
                &[&["config", "model", "name"], &["config", "model"]],
            );
            route.base_url = first_string_at(
                &provider.settings_config,
                &[
                    &["env", "GOOGLE_GEMINI_BASE_URL"],
                    &["env", "GEMINI_BASE_URL"],
                ],
            );
        }
        _ => {}
    }

    route
}

fn apply_codex_route_metadata(route: &mut ProviderRouteMetadata, config: &str) {
    let Ok(parsed) = toml::from_str::<toml::Value>(config) else {
        return;
    };

    route.upstream_model = toml_string_at(&parsed, &["model"]);

    let selected_provider = toml_string_at(&parsed, &["model_provider"]);
    let selected_provider_table = selected_provider.as_deref().and_then(|provider_id| {
        parsed
            .get("model_providers")
            .and_then(|providers| providers.get(provider_id))
    });

    route.base_url = selected_provider_table
        .and_then(|provider| toml_string_at(provider, &["base_url"]))
        .or_else(|| first_codex_model_provider_string(&parsed, "base_url"))
        .or_else(|| toml_string_at(&parsed, &["base_url"]));

    route.api_format = route.api_format.clone().or_else(|| {
        selected_provider_table
            .and_then(|provider| toml_string_at(provider, &["wire_api"]))
            .or_else(|| first_codex_model_provider_string(&parsed, "wire_api"))
            .or_else(|| toml_string_at(&parsed, &["wire_api"]))
            .map(|wire_api| match wire_api.as_str() {
                "responses" => "openai_responses".to_string(),
                other => other.to_string(),
            })
    });
}

fn first_string_at(value: &Value, paths: &[&[&str]]) -> Option<String> {
    paths.iter().find_map(|path| string_at(value, path))
}

fn string_at(value: &Value, path: &[&str]) -> Option<String> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_str().and_then(non_empty_string)
}

fn non_empty_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn toml_string_at(value: &toml::Value, path: &[&str]) -> Option<String> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_str().and_then(non_empty_string)
}

fn first_codex_model_provider_string(value: &toml::Value, key: &str) -> Option<String> {
    value
        .get("model_providers")
        .and_then(|providers| providers.as_table())
        .and_then(|providers| {
            providers
                .values()
                .find_map(|provider| toml_string_at(provider, &[key]))
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::{Provider, ProviderMeta};
    use serde_json::json;

    #[test]
    fn extracts_token4ai_claude_compat_route() {
        let mut provider = Provider::with_id(
            "p1".to_string(),
            "Token4AI OpenAI".to_string(),
            json!({
                "env": {
                    "ANTHROPIC_BASE_URL": "https://api.token4ai.cloud/v1",
                    "ANTHROPIC_MODEL": "gpt-5.5"
                }
            }),
            None,
        );
        provider.meta = Some(ProviderMeta {
            api_format: Some("openai_responses".to_string()),
            provider_type: Some("openai_compatible".to_string()),
            supports_claude_code_compat: Some(true),
            ..Default::default()
        });

        let route = provider_route_metadata("claude", &provider);

        assert_eq!(route.upstream_model.as_deref(), Some("gpt-5.5"));
        assert_eq!(
            route.base_url.as_deref(),
            Some("https://api.token4ai.cloud/v1")
        );
        assert_eq!(route.api_format.as_deref(), Some("openai_responses"));
        assert!(route.supports_claude_code_compat);
    }

    #[test]
    fn extracts_codex_model_without_matching_model_provider() {
        let provider = Provider::with_id(
            "p2".to_string(),
            "Token4AI OpenAI".to_string(),
            json!({
                "config": r#"
model_provider = "token4ai_openai"
model = "gpt-5.5"

[model_providers.token4ai_openai]
base_url = "https://api.token4ai.cloud/v1"
wire_api = "responses"
"#
            }),
            None,
        );

        let route = provider_route_metadata("codex", &provider);

        assert_eq!(route.upstream_model.as_deref(), Some("gpt-5.5"));
        assert_eq!(
            route.base_url.as_deref(),
            Some("https://api.token4ai.cloud/v1")
        );
        assert_eq!(route.api_format.as_deref(), Some("openai_responses"));
    }
}
