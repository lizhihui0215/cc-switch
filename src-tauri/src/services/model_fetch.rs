//! 模型列表获取服务
//!
//! 通过 OpenAI 兼容的 GET /v1/models 端点获取供应商可用模型列表。
//! 主要面向第三方聚合站（硅基流动、OpenRouter 等）。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

/// 获取到的模型信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchedModel {
    pub id: String,
    pub owned_by: Option<String>,
}

const FETCH_TIMEOUT_SECS: u64 = 15;

/// 获取供应商的可用模型列表
///
/// 使用 OpenAI 兼容的 GET /v1/models 端点。
pub async fn fetch_models(
    base_url: &str,
    api_key: &str,
    is_full_url: bool,
) -> Result<Vec<FetchedModel>, String> {
    if api_key.is_empty() {
        return Err("API Key is required to fetch models".to_string());
    }

    let models_url = build_models_url(base_url, is_full_url)?;
    let client = crate::proxy::http_client::get();

    let response = client
        .get(&models_url)
        .header("Authorization", format!("Bearer {api_key}"))
        .timeout(Duration::from_secs(FETCH_TIMEOUT_SECS))
        .send()
        .await
        .map_err(map_request_error)?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format_http_error(status.as_u16(), &body));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;
    let value: Value = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse response: response is not valid JSON ({e})"))?;

    let mut models = parse_models_response(value)?;

    models.sort_by(|a, b| a.id.cmp(&b.id));
    models.dedup_by(|a, b| a.id == b.id);
    Ok(models)
}

fn map_request_error(err: reqwest::Error) -> String {
    if err.is_timeout() {
        return "Request timeout: provider endpoint did not respond".to_string();
    }
    if err.is_connect() {
        return format!("Endpoint connection failed: {err}");
    }
    format!("Request failed: {err}")
}

fn format_http_error(status: u16, body: &str) -> String {
    match status {
        401 | 403 => format!("HTTP {status}: API Key is invalid or lacks permission"),
        404 => format!(
            "HTTP 404: Base URL may be incorrect; ensure the models endpoint is not duplicated as /v1/v1/models"
        ),
        _ => {
            let body = truncate_body(body, 300);
            if body.is_empty() {
                format!("HTTP {status}")
            } else {
                format!("HTTP {status}: {body}")
            }
        }
    }
}

fn truncate_body(body: &str, max_len: usize) -> String {
    if body.len() <= max_len {
        return body.to_string();
    }
    let mut end = max_len;
    while end > 0 && !body.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}...", &body[..end])
}

fn parse_models_response(value: Value) -> Result<Vec<FetchedModel>, String> {
    let entries = value
        .get("data")
        .and_then(Value::as_array)
        .or_else(|| value.get("models").and_then(Value::as_array))
        .or_else(|| value.as_array())
        .ok_or_else(|| {
            "Failed to parse response: not a standard OpenAI-compatible /models response"
                .to_string()
        })?;

    let mut models = Vec::new();

    for entry in entries {
        if let Some(id) = entry.as_str().map(str::trim).filter(|id| !id.is_empty()) {
            models.push(FetchedModel {
                id: id.to_string(),
                owned_by: None,
            });
            continue;
        }

        let Some(obj) = entry.as_object() else {
            continue;
        };

        let id = obj
            .get("id")
            .or_else(|| obj.get("name"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|id| !id.is_empty());

        let Some(id) = id else {
            continue;
        };

        let owned_by = obj
            .get("owned_by")
            .or_else(|| obj.get("ownedBy"))
            .and_then(Value::as_str)
            .map(ToString::to_string);

        models.push(FetchedModel {
            id: id.to_string(),
            owned_by,
        });
    }

    if !entries.is_empty() && models.is_empty() {
        return Err(
            "Failed to parse response: model entries do not contain id or name".to_string(),
        );
    }

    Ok(models)
}

/// 构造 /v1/models 的完整 URL
fn build_models_url(base_url: &str, is_full_url: bool) -> Result<String, String> {
    let trimmed = base_url.trim().trim_end_matches('/');

    if trimmed.is_empty() {
        return Err("Base URL is empty".to_string());
    }

    if is_full_url {
        // 尝试从完整端点 URL 推导 API 根路径
        // 例如: https://proxy.example.com/v1/chat/completions → https://proxy.example.com/v1/models
        if let Some(idx) = trimmed.find("/v1/") {
            return Ok(format!("{}/v1/models", &trimmed[..idx]));
        }
        // 如果没有 /v1/ 路径，直接去掉最后一段路径
        if let Some(idx) = trimmed.rfind('/') {
            let root = &trimmed[..idx];
            if root.contains("://") && root.len() > root.find("://").unwrap() + 3 {
                return Ok(format!("{root}/v1/models"));
            }
        }
        return Err("Cannot derive models endpoint from full URL".to_string());
    }

    // 常规情况: base_url 是 API 根路径
    // 如果已经包含 /v1 路径，直接追加 /models
    if trimmed.ends_with("/v1") {
        return Ok(format!("{trimmed}/models"));
    }

    Ok(format!("{trimmed}/v1/models"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_models_url_basic() {
        assert_eq!(
            build_models_url("https://api.siliconflow.cn", false).unwrap(),
            "https://api.siliconflow.cn/v1/models"
        );
    }

    #[test]
    fn test_build_models_url_trailing_slash() {
        assert_eq!(
            build_models_url("https://api.example.com/", false).unwrap(),
            "https://api.example.com/v1/models"
        );
    }

    #[test]
    fn test_build_models_url_with_v1() {
        assert_eq!(
            build_models_url("https://api.example.com/v1", false).unwrap(),
            "https://api.example.com/v1/models"
        );
    }

    #[test]
    fn test_build_models_url_token4ai_with_v1() {
        assert_eq!(
            build_models_url("https://api.token4ai.cloud/v1", false).unwrap(),
            "https://api.token4ai.cloud/v1/models"
        );
    }

    #[test]
    fn test_build_models_url_full_url() {
        assert_eq!(
            build_models_url("https://proxy.example.com/v1/chat/completions", true).unwrap(),
            "https://proxy.example.com/v1/models"
        );
    }

    #[test]
    fn test_build_models_url_empty() {
        assert!(build_models_url("", false).is_err());
    }

    #[test]
    fn test_parse_response() {
        let json = r#"{"object":"list","data":[{"id":"gpt-4","object":"model","owned_by":"openai"},{"id":"claude-3-sonnet","object":"model","owned_by":"anthropic"}]}"#;
        let data = parse_models_response(serde_json::from_str(json).unwrap()).unwrap();
        assert_eq!(data.len(), 2);
        assert_eq!(data[0].id, "gpt-4");
        assert_eq!(data[0].owned_by.as_deref(), Some("openai"));
        assert_eq!(data[1].id, "claude-3-sonnet");
    }

    #[test]
    fn test_parse_response_no_owned_by() {
        let json = r#"{"object":"list","data":[{"id":"my-model","object":"model"}]}"#;
        let data = parse_models_response(serde_json::from_str(json).unwrap()).unwrap();
        assert_eq!(data[0].id, "my-model");
        assert!(data[0].owned_by.is_none());
    }

    #[test]
    fn test_parse_response_empty_data() {
        let json = r#"{"object":"list","data":[]}"#;
        let data = parse_models_response(serde_json::from_str(json).unwrap()).unwrap();
        assert!(data.is_empty());
    }

    #[test]
    fn test_parse_response_data_name_fallback() {
        let json = r#"{"data":[{"name":"provider-model"}]}"#;
        let data = parse_models_response(serde_json::from_str(json).unwrap()).unwrap();
        assert_eq!(data[0].id, "provider-model");
    }

    #[test]
    fn test_parse_response_models_array() {
        let json = r#"{"models":[{"id":"model-a"},{"name":"model-b"}]}"#;
        let data = parse_models_response(serde_json::from_str(json).unwrap()).unwrap();
        assert_eq!(
            data.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(),
            vec!["model-a", "model-b"]
        );
    }

    #[test]
    fn test_parse_response_string_array() {
        let json = r#"["model-a","model-b"]"#;
        let data = parse_models_response(serde_json::from_str(json).unwrap()).unwrap();
        assert_eq!(
            data.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(),
            vec!["model-a", "model-b"]
        );
    }

    #[test]
    fn test_parse_response_rejects_invalid_shape() {
        let json = r#"{"items":[{"value":"not-a-model"}]}"#;
        let err = parse_models_response(serde_json::from_str(json).unwrap()).unwrap_err();
        assert!(err.contains("not a standard OpenAI-compatible"));
    }

    #[test]
    fn test_parse_response_rejects_invalid_json() {
        let err = serde_json::from_str::<Value>("{not-json").unwrap_err();
        assert!(err.is_syntax());
    }
}
