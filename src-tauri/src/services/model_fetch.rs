//! 模型列表获取服务
//!
//! 通过 OpenAI 兼容的 GET /v1/models 端点获取供应商可用模型列表。
//! 主要面向第三方聚合站（硅基流动、OpenRouter 等），以及把 Anthropic
//! 协议挂在兼容子路径上的官方供应商（DeepSeek、Kimi、智谱 GLM 等）。

use reqwest::StatusCode;
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

/// 404/405 响应体截断长度：避免把几十 KB HTML 404 页整页保留到错误串里。
const ERROR_BODY_MAX_CHARS: usize = 512;

/// 已知的「Anthropic 协议兼容子路径」后缀；按长度降序，最长前缀优先匹配。
/// baseURL 命中这些后缀时，候选列表会追加「剥离后缀再拼 /v1/models / /models」的版本。
const KNOWN_COMPAT_SUFFIXES: &[&str] = &[
    "/api/claudecode",
    "/api/anthropic",
    "/apps/anthropic",
    "/api/coding",
    "/claudecode",
    "/anthropic",
    "/step_plan",
    "/coding",
    "/claude",
];

/// 获取供应商的可用模型列表
///
/// 使用 OpenAI 兼容的 GET /v1/models 端点，按候选列表顺序尝试。
pub async fn fetch_models(
    base_url: &str,
    api_key: &str,
    is_full_url: bool,
    models_url_override: Option<&str>,
) -> Result<Vec<FetchedModel>, String> {
    if api_key.is_empty() {
        return Err("API Key is required to fetch models".to_string());
    }

    let candidates = build_models_url_candidates(base_url, is_full_url, models_url_override)?;
    let client = crate::proxy::http_client::get();
    let mut last_err: Option<String> = None;

    for url in &candidates {
        log::debug!("[ModelFetch] Trying endpoint: {url}");
        let response = match client
            .get(url)
            .header("Authorization", format!("Bearer {api_key}"))
            .timeout(Duration::from_secs(FETCH_TIMEOUT_SECS))
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => return Err(map_request_error(e)),
        };

        let status = response.status();

        if status.is_success() {
            let body = response
                .text()
                .await
                .map_err(|e| format!("Failed to read response body: {e}"))?;
            let value: Value = serde_json::from_str(&body).map_err(|e| {
                format!("Failed to parse response: response is not valid JSON ({e})")
            })?;
            let mut models = parse_models_response(value)?;

            models.sort_by(|a, b| a.id.cmp(&b.id));
            models.dedup_by(|a, b| a.id == b.id);
            return Ok(models);
        }

        if status == StatusCode::NOT_FOUND || status == StatusCode::METHOD_NOT_ALLOWED {
            let body = response.text().await.unwrap_or_default();
            last_err = Some(format_http_error(status.as_u16(), &body));
            continue;
        }

        let body = response.text().await.unwrap_or_default();
        return Err(format_http_error(status.as_u16(), &body));
    }

    Err(format!(
        "All candidates failed: {}",
        last_err.unwrap_or_else(|| "no candidates".to_string())
    ))
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
        _ => {
            let body = truncate_body(body);
            if body.is_empty() {
                format!("HTTP {status}")
            } else {
                format!("HTTP {status}: {body}")
            }
        }
    }
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

/// 构造「模型列表端点」的候选 URL 列表
///
/// 候选顺序：
/// 1. `models_url_override` 非空 → 只返回它
/// 2. baseURL 直接拼 `/v1/models`（若已有 `/v1` 结尾则拼 `/models`）
/// 3. 若 baseURL 命中 [`KNOWN_COMPAT_SUFFIXES`]，剥离后缀再拼 `/v1/models`
/// 4. 同上，但拼 `/models`（部分站点如 DeepSeek 官方只暴露 `/models`）
///
/// 结果已去重且保持首次出现顺序。
pub fn build_models_url_candidates(
    base_url: &str,
    is_full_url: bool,
    models_url_override: Option<&str>,
) -> Result<Vec<String>, String> {
    if let Some(raw) = models_url_override {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            return Ok(vec![trimmed.to_string()]);
        }
    }

    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Base URL is empty".to_string());
    }

    let mut candidates: Vec<String> = Vec::new();

    if is_full_url {
        if let Some(idx) = trimmed.find("/v1/") {
            candidates.push(format!("{}/v1/models", &trimmed[..idx]));
        } else if let Some(idx) = trimmed.rfind('/') {
            let root = &trimmed[..idx];
            if root.contains("://") && root.len() > root.find("://").unwrap() + 3 {
                candidates.push(format!("{root}/v1/models"));
            }
        }
        if candidates.is_empty() {
            return Err("Cannot derive models endpoint from full URL".to_string());
        }
        return Ok(candidates);
    }

    let primary = if trimmed.ends_with("/v1") {
        format!("{trimmed}/models")
    } else {
        format!("{trimmed}/v1/models")
    };
    candidates.push(primary);

    if let Some(stripped) = strip_compat_suffix(trimmed) {
        let root = stripped.trim_end_matches('/');
        if !root.is_empty() && root.contains("://") {
            candidates.push(format!("{root}/v1/models"));
            candidates.push(format!("{root}/models"));
        }
    }

    // 候选最多 3 条，线性去重即可，不值得上 HashSet。
    let mut unique: Vec<String> = Vec::with_capacity(candidates.len());
    for url in candidates {
        if !unique.iter().any(|u| u == &url) {
            unique.push(url);
        }
    }

    Ok(unique)
}

/// 截断响应体到 [`ERROR_BODY_MAX_CHARS`] 字符，避免 HTML 404 页占用错误串。
fn truncate_body(body: &str) -> String {
    if body.chars().count() <= ERROR_BODY_MAX_CHARS {
        body.to_string()
    } else {
        let mut s: String = body.chars().take(ERROR_BODY_MAX_CHARS).collect();
        s.push('…');
        s
    }
}

/// 若 baseURL 以任一已知兼容子路径结尾，返回剥离后的剩余部分；否则 `None`。
///
/// 依赖 [`KNOWN_COMPAT_SUFFIXES`] 按长度降序排列，确保最长前缀优先命中
/// （否则 `/anthropic` 会提前匹配掉 `/api/anthropic` 的场景）。
fn strip_compat_suffix(base_url: &str) -> Option<&str> {
    for suffix in KNOWN_COMPAT_SUFFIXES {
        if base_url.ends_with(*suffix) {
            return Some(&base_url[..base_url.len() - suffix.len()]);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_candidates_plain_root() {
        let c = build_models_url_candidates("https://api.siliconflow.cn", false, None).unwrap();
        assert_eq!(c, vec!["https://api.siliconflow.cn/v1/models"]);
    }

    #[test]
    fn test_candidates_trailing_slash() {
        let c = build_models_url_candidates("https://api.example.com/", false, None).unwrap();
        assert_eq!(c, vec!["https://api.example.com/v1/models"]);
    }

    #[test]
    fn test_candidates_with_v1() {
        let c = build_models_url_candidates("https://api.example.com/v1", false, None).unwrap();
        assert_eq!(c, vec!["https://api.example.com/v1/models"]);
    }

    #[test]
    fn test_candidates_full_url() {
        let c = build_models_url_candidates(
            "https://proxy.example.com/v1/chat/completions",
            true,
            None,
        )
        .unwrap();
        assert_eq!(c, vec!["https://proxy.example.com/v1/models"]);
    }

    #[test]
    fn test_candidates_empty() {
        assert!(build_models_url_candidates("", false, None).is_err());
    }

    #[test]
    fn test_candidates_override_returns_single() {
        let c = build_models_url_candidates(
            "https://api.deepseek.com/anthropic",
            false,
            Some("https://api.deepseek.com/models"),
        )
        .unwrap();
        assert_eq!(c, vec!["https://api.deepseek.com/models"]);
    }

    #[test]
    fn test_candidates_override_empty_falls_through() {
        let c =
            build_models_url_candidates("https://api.siliconflow.cn", false, Some("   ")).unwrap();
        assert_eq!(c, vec!["https://api.siliconflow.cn/v1/models"]);
    }

    #[test]
    fn test_candidates_deepseek_strip_anthropic() {
        let c =
            build_models_url_candidates("https://api.deepseek.com/anthropic", false, None).unwrap();
        assert_eq!(
            c,
            vec![
                "https://api.deepseek.com/anthropic/v1/models",
                "https://api.deepseek.com/v1/models",
                "https://api.deepseek.com/models",
            ]
        );
    }

    #[test]
    fn test_candidates_zhipu_strip_api_anthropic() {
        let c = build_models_url_candidates("https://open.bigmodel.cn/api/anthropic", false, None)
            .unwrap();
        assert_eq!(
            c,
            vec![
                "https://open.bigmodel.cn/api/anthropic/v1/models",
                "https://open.bigmodel.cn/v1/models",
                "https://open.bigmodel.cn/models",
            ]
        );
    }

    #[test]
    fn test_candidates_bailian_strip_apps_anthropic() {
        let c = build_models_url_candidates(
            "https://dashscope.aliyuncs.com/apps/anthropic",
            false,
            None,
        )
        .unwrap();
        assert_eq!(
            c,
            vec![
                "https://dashscope.aliyuncs.com/apps/anthropic/v1/models",
                "https://dashscope.aliyuncs.com/v1/models",
                "https://dashscope.aliyuncs.com/models",
            ]
        );
    }

    #[test]
    fn test_candidates_stepfun_strip_step_plan() {
        let c =
            build_models_url_candidates("https://api.stepfun.com/step_plan", false, None).unwrap();
        assert_eq!(
            c,
            vec![
                "https://api.stepfun.com/step_plan/v1/models",
                "https://api.stepfun.com/v1/models",
                "https://api.stepfun.com/models",
            ]
        );
    }

    #[test]
    fn test_candidates_doubao_strip_api_coding() {
        let c = build_models_url_candidates(
            "https://ark.cn-beijing.volces.com/api/coding",
            false,
            None,
        )
        .unwrap();
        assert_eq!(
            c,
            vec![
                "https://ark.cn-beijing.volces.com/api/coding/v1/models",
                "https://ark.cn-beijing.volces.com/v1/models",
                "https://ark.cn-beijing.volces.com/models",
            ]
        );
    }

    #[test]
    fn test_candidates_rightcode_strip_claude() {
        let c = build_models_url_candidates("https://www.right.codes/claude", false, None).unwrap();
        assert_eq!(
            c,
            vec![
                "https://www.right.codes/claude/v1/models",
                "https://www.right.codes/v1/models",
                "https://www.right.codes/models",
            ]
        );
    }

    #[test]
    fn test_candidates_longer_suffix_wins() {
        // baseURL 以 /api/anthropic 结尾时，应剥离整个 /api/anthropic，
        // 而不是只剥离 /anthropic（那样会得到残缺的 https://.../api 根）。
        let c = build_models_url_candidates("https://api.z.ai/api/anthropic", false, None).unwrap();
        assert_eq!(
            c,
            vec![
                "https://api.z.ai/api/anthropic/v1/models",
                "https://api.z.ai/v1/models",
                "https://api.z.ai/models",
            ]
        );
    }

    #[test]
    fn test_candidates_no_suffix_no_strip() {
        let c = build_models_url_candidates("https://openrouter.ai/api", false, None).unwrap();
        assert_eq!(c, vec!["https://openrouter.ai/api/v1/models"]);
    }

    #[test]
    fn test_candidates_deduplicate() {
        // 虚构 case：baseURL 就是 "scheme://host"，剥不出子路径，应只有一个候选。
        let c = build_models_url_candidates("https://host.example.com", false, None).unwrap();
        assert_eq!(c.len(), 1);
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
