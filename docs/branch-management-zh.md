# cc-switch 分支管理说明

本文档说明 Token4AI 团队基于上游仓库 `farion1231/cc-switch` 做长期定制开发时，如何保持官方同步能力，同时降低自研改动和上游变更之间的冲突风险。

## 远端约定

当前仓库建议保留两个远端：

```bash
origin   git@github.com:lizhihui0215/cc-switch.git
upstream https://github.com/farion1231/cc-switch.git
```

- `origin`：团队自己的 fork 仓库，用于保存 Token4AI 自研代码、产品分支、功能分支和发布分支。
- `upstream`：官方仓库，只作为同步来源使用，不在本地向它推送代码。

建议禁用 `upstream` 的 push 地址，避免误推官方仓库：

```bash
git remote set-url --push upstream DISABLED
```

## 长期分支

### `upstream/main`

官方主线分支，只通过 `git fetch upstream` 更新。

用途：

- 获取官方最新修复、功能、依赖升级和文档更新。
- 作为同步源，定期合入团队产品主线。
- 对比官方和团队改动范围。

禁止事项：

- 不直接修改。
- 不向该远端分支推送。

### `origin/main`

团队 fork 中的官方镜像主线，尽量保持和 `upstream/main` 一致。

用途：

- 作为干净基线，便于随时观察团队 fork 与官方主线的差异。
- 方便未来向官方提交通用修复 PR。
- 方便创建临时对比、回滚和 cherry-pick。

同步方式：

```bash
git fetch upstream origin --prune
git switch main
git merge --ff-only upstream/main
git push origin main
```

原则：

- `main` 不承载 Token4AI 私有能力。
- `main` 尽量只做快进合并，不制造额外 merge commit。
- 如果 `main` 无法快进，说明有人把自研改动合入了 `main`，需要先整理历史。

### `token4ai/main`

Token4AI 产品主线，承载团队长期自研能力。

用途：

- 保存 Token4AI 的供应商预设、代理逻辑、配置能力、文档和产品定制。
- 作为所有 Token4AI 功能分支的默认基线。
- 作为官方同步后的最终集成目标。

建议：

- 长期保留。
- 禁止直接在该分支上做大改动，功能开发从 `feat/*` 分支进入。
- 同步官方时使用 merge，不使用 rebase，避免多人协作历史被重写。

## 临时分支

### `feat/*`

功能开发分支。

命名示例：

```bash
feat/token4ai-unified-provider
feat/token4ai-codex-preset
feat/proxy-usage-logging
```

使用方式：

```bash
git switch token4ai/main
git pull origin token4ai/main
git switch -c feat/token4ai-unified-provider
```

完成后合回：

```bash
git switch token4ai/main
git merge --no-ff feat/token4ai-unified-provider
git push origin token4ai/main
```

原则：

- 功能分支生命周期要短。
- 一个分支只解决一个主题。
- 合并前至少完成构建或相关测试。

### `sync/upstream-YYYYMMDD`

官方同步集成分支。

命名示例：

```bash
sync/upstream-20260425
```

用途：

- 专门承接 `upstream/main` 到 `token4ai/main` 的合并。
- 在该分支解决冲突、跑测试、验证产品行为。
- 验证通过后再合回 `token4ai/main`。

标准流程：

```bash
git fetch upstream origin --prune

git switch main
git merge --ff-only upstream/main
git push origin main

git switch token4ai/main
git pull origin token4ai/main
git switch -c sync/upstream-20260425
git merge --no-ff upstream/main

# 解决冲突、运行测试、验证核心功能

git switch token4ai/main
git merge --no-ff sync/upstream-20260425
git push origin token4ai/main
```

建议每次同步后保留该分支一段时间，便于追踪冲突处理过程。

### `release/*`

发布分支。

命名示例：

```bash
release/token4ai-3.14.1
release/token4ai-2026.04
```

用途：

- 发布前冻结代码。
- 只接受 bugfix、版本号、发布说明和安装包配置更新。
- 生产问题修复可以从这里 cherry-pick 回 `token4ai/main`。

## 日常开发流程

1. 从 `token4ai/main` 拉出功能分支：

```bash
git switch token4ai/main
git pull origin token4ai/main
git switch -c feat/my-feature
```

2. 开发并提交：

```bash
git add <changed-files>
git commit -m "feat: describe my feature"
```

3. 合并前同步产品主线：

```bash
git fetch origin
git merge origin/token4ai/main
```

4. 跑测试或构建：

```bash
pnpm test
pnpm build
```

5. 合回产品主线：

```bash
git switch token4ai/main
git merge --no-ff feat/my-feature
git push origin token4ai/main
```

## 官方同步频率

建议按改动活跃度选择节奏：

- 官方更新频繁时：每周同步一次。
- 官方发布重要版本时：当天创建 `sync/upstream-YYYYMMDD` 分支验证。
- 团队发布前：必须同步或明确记录暂不同步原因。
- 出现安全修复、代理层修复、依赖升级时：优先同步。

## 冲突处理原则

同步官方时优先保护 Token4AI 的产品能力，但不要盲目覆盖官方实现。

建议顺序：

1. 先阅读官方相关提交，理解它为什么改。
2. 对代理、供应商、配置、用量统计等核心模块逐文件解决冲突。
3. 尽量把 Token4AI 改动收敛到独立模块、配置项和 preset 中。
4. 如果官方引入了同类能力，优先评估能否复用官方实现，再保留 Token4AI 差异。
5. 冲突解决后跑关键测试，至少验证供应商创建、代理转发、用量日志和配置保存。

## 风险与收益

### 收益

- 可以持续获得官方 bugfix、新功能、依赖升级和生态适配。
- `main` 保持干净，方便对比官方差异和提交通用 PR。
- `token4ai/main` 独立承载产品能力，不影响官方同步基线。
- `sync/*` 分支隔离同步风险，冲突不会直接污染产品主线。

### 风险

- 自研改动越深入核心模块，同步冲突越多。
- 官方重构代理、供应商、配置结构时，Token4AI 功能可能需要重新适配。
- 如果团队成员绕过 `token4ai/main` 流程直接改 `main`，后续同步成本会上升。
- 如果缺少测试，同步后可能出现隐性行为回归。

## 推荐检查命令

查看官方比本地 `main` 多了什么：

```bash
git log --oneline main..upstream/main
```

查看产品主线相对官方主线的自研差异：

```bash
git log --oneline main..token4ai/main
git diff --stat main..token4ai/main
```

查看当前分支和远端关系：

```bash
git branch -vv
git remote -v
```

查看最近一次同步的冲突处理历史：

```bash
git log --oneline --graph --decorate --all --max-count=50
```

## 当前建议落地步骤

本仓库当前已经存在：

- `origin`：团队 fork。
- `upstream`：官方仓库。
- `main`：当前跟随 `origin/main`。
- `feat/token4ai-token4AI-unified-provider`：当前 Token4AI unified provider 功能分支。

建议接下来执行：

```bash
git branch token4ai/main
git push origin token4ai/main
git remote set-url --push upstream DISABLED
```

之后团队默认从 `token4ai/main` 创建功能分支，不再从 `main` 直接做 Token4AI 定制开发。
