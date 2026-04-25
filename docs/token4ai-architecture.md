# Token4AI 模块化架构说明

本文档说明 Token4AI 产品 fork 在 `farion1231/cc-switch` 基础上如何组织代码，目标是降低未来合并 `upstream/main` 时的冲突概率。

## 分支边界

- `main`：官方镜像基线，保持与 `origin/main` / `upstream/main` 对齐。
- `token4ai/main`：Token4AI 产品主线，承载 Token4AI unified provider 和产品定制。
- `feat/*`：功能分支，从 `token4ai/main` 切出，完成后合回产品主线。
- `sync/upstream-YYYYMMDD`：官方同步集成分支，用于解决冲突和跑回归测试。
- `upstream`：官方仓库远端，只 fetch，不 push；本地 push URL 应保持 `DISABLED`。

建议开启 Git 冲突复用：

```bash
git config rerere.enabled true
# 或全局启用
git config --global rerere.enabled true
```

## 模块位置

Token4AI 前端逻辑集中在：

```text
src/features/token4ai/
```

主要职责：

- `token4ai.constants.ts`：Token4AI provider ID、tab ID、默认 Base URL、默认 provider 名称、兼容策略。
- `token4ai.providers.ts`：四个产品的 provider 创建模板和 capability 定义。
- `token4ai.url.ts`：URL 规范化和 models endpoint 拼接，避免 `/v1/v1/models`。
- `token4ai.validation.ts`：保存前校验和 Claude Code compatibility 策略判断。
- `token4ai.model-discovery.ts`：Token4AI 模型发现入口。
- `components/`：Token4AI tab、产品卡片、Claude Code 兼容说明。
- `hooks/`：表单状态和批量创建 provider 流程。

Token4AI 后端侧边界集中在：

```text
src-tauri/src/token4ai/
```

主要职责：

- `constants.rs`：与前端保持命名一致的 Token4AI 常量。
- `provider_templates.rs`：后端可复用的产品模板元数据。
- `url.rs`：URL 拼接和模型发现 URL。
- `validation.rs`：基础 URL 与 compatibility 策略校验。
- `tests.rs`：后端 Token4AI 边界测试。

当前项目没有 TS/Rust 共享常量生成机制，因此前端与 Rust 各保留一份常量；两边文件都通过注释说明需要保持命名一致。

## 官方文件挂载点

为了降低 upstream merge 冲突，官方原文件只保留少量挂载点：

- `src/components/providers/AddProviderDialog.tsx`：只注册 Token4AI tab、footer form id 和内容组件。
- `src/components/providers/Token4AIUnifiedProviderForm.tsx`：兼容旧路径的 re-export。
- `src/lib/token4aiUnifiedProviders.ts`：兼容旧测试/引用路径的 re-export。
- `src-tauri/src/lib.rs`：注册 `token4ai` Rust module。
- `src/types.ts`：保留 provider meta 中的 Token4AI/capability 字段。
- locale 文件：保留 `token4aiUnified` section。

核心代理转换链路仍保留在原 proxy/provider 文件中，因为 Claude Code + GPT/OpenAI-compatible path 依赖现有 proxy 架构。强行抽离会变成重写 proxy，风险高于收益。

## Provider capability 策略

- OpenAI/Codex：
  - 默认 Base URL：`https://api.token4ai.cloud/v1`
  - 默认用于 Codex，同时默认启用 Claude Code 兼容。
  - 通过 OpenAI-compatible / Responses API 路径支持 Claude Code。
- Anthropic/Claude：
  - 默认 Base URL：`https://api.token4ai.cloud`
  - 默认用于 Claude Code。
  - 走 Anthropic-compatible 原生路径。
- Gemini：
  - 默认 Base URL：`https://api.token4ai.cloud`
  - 默认只用于 Gemini CLI。
  - 不默认启用 Claude Code compatibility。
- MiniMax：
  - 默认 Base URL：`https://api.token4ai.cloud/v1`
  - 默认用于 Codex / OpenAI-compatible。
  - 只有在用户显式开启时，才尝试复用现有 OpenAI-compatible Claude Code 路径。

## Upstream 同步流程

推荐流程：

```bash
git fetch upstream origin --prune

git switch main
git merge --ff-only upstream/main
git push origin main

git switch token4ai/main
git pull --ff-only origin token4ai/main
git switch -c sync/upstream-YYYYMMDD
git merge --no-ff upstream/main

# 解决冲突、运行测试

git switch token4ai/main
git merge --no-ff sync/upstream-YYYYMMDD
git push origin token4ai/main
```

合并冲突处理优先级：

1. 保留官方新增修复和安全更新。
2. 保留 Token4AI provider 模板、URL、validation、batch create 模块边界。
3. 如果 `AddProviderDialog.tsx` 冲突，只恢复 Token4AI tab registry 小挂载点。
4. 如果 proxy/provider 核心路径冲突，优先确认 Claude Code + OpenAI-compatible path 回归测试。
