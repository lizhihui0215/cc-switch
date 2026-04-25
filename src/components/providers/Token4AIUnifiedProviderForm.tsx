import { FormEvent, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import ApiKeyInput from "@/components/providers/forms/ApiKeyInput";
import { ModelInputWithFetch } from "@/components/providers/forms/shared";
import { ProviderIcon } from "@/components/ProviderIcon";
import { providersApi } from "@/lib/api";
import { queryClient } from "@/lib/query";
import {
  fetchModelsForConfig,
  showFetchModelsError,
  type FetchedModel,
} from "@/lib/api/model-fetch";
import {
  buildToken4AIProviderTargets,
  createDefaultToken4AIUnifiedState,
  getUniqueProviderName,
  TOKEN4AI_PRODUCTS,
  TOKEN4AI_PRODUCT_ORDER,
  type Token4AIProductKey,
  type Token4AIProductFormState,
  type Token4AIUnifiedFormState,
} from "@/lib/token4aiUnifiedProviders";
import type { AppId } from "@/lib/api";
import type { Provider } from "@/types";
import { generateUUID } from "@/utils/uuid";

interface Token4AIUnifiedProviderFormProps {
  formId: string;
  onOpenChange: (open: boolean) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

type FetchState = Partial<Record<Token4AIProductKey, FetchedModel[]>>;
type LoadingState = Partial<Record<Token4AIProductKey, boolean>>;

export function Token4AIUnifiedProviderForm({
  formId,
  onOpenChange,
  onSubmittingChange,
}: Token4AIUnifiedProviderFormProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<Token4AIUnifiedFormState>(() =>
    createDefaultToken4AIUnifiedState(),
  );
  const [fetchedModels, setFetchedModels] = useState<FetchState>({});
  const [loadingModels, setLoadingModels] = useState<LoadingState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateProduct = useCallback(
    (key: Token4AIProductKey, patch: Partial<Token4AIProductFormState>) => {
      setState((current) => ({
        ...current,
        [key]: {
          ...current[key],
          ...patch,
        },
      }));
    },
    [],
  );

  const enabledMissingKeys = useMemo(
    () =>
      TOKEN4AI_PRODUCT_ORDER.filter(
        (key) => state[key].enabled && !state[key].apiKey.trim(),
      ),
    [state],
  );

  const fetchModels = useCallback(
    async (key: Token4AIProductKey) => {
      const product = state[key];
      if (!product.baseUrl || !product.apiKey) {
        showFetchModelsError(null, t, {
          hasApiKey: !!product.apiKey,
          hasBaseUrl: !!product.baseUrl,
        });
        return;
      }

      setLoadingModels((current) => ({ ...current, [key]: true }));
      try {
        const models = await fetchModelsForConfig(
          product.baseUrl,
          product.apiKey,
        );
        setFetchedModels((current) => ({ ...current, [key]: models }));
        if (models.length === 0) {
          toast.info(t("providerForm.fetchModelsEmpty"));
        } else {
          toast.success(
            t("providerForm.fetchModelsSuccess", { count: models.length }),
          );
        }
      } catch (error) {
        showFetchModelsError(error, t);
      } finally {
        setLoadingModels((current) => ({ ...current, [key]: false }));
      }
    },
    [state, t],
  );

  const resolveUniqueNames = useCallback(
    async (targets: ReturnType<typeof buildToken4AIProviderTargets>) => {
      const existingNamesByApp = new Map<AppId, Set<string>>();

      const getNames = async (appId: AppId) => {
        const cached = existingNamesByApp.get(appId);
        if (cached) {
          return cached;
        }

        try {
          const providers = await providersApi.getAll(appId);
          const names = new Set(
            Object.values(providers).map((provider) => provider.name),
          );
          existingNamesByApp.set(appId, names);
          return names;
        } catch {
          const names = new Set<string>();
          existingNamesByApp.set(appId, names);
          return names;
        }
      };

      const resolved: Array<{
        appId: AppId;
        label: string;
        provider: Provider;
      }> = [];

      for (const target of targets) {
        const names = await getNames(target.appId);
        const providerName = getUniqueProviderName(target.provider.name, names);
        names.add(providerName);

        resolved.push({
          appId: target.appId,
          label:
            providerName === target.provider.name
              ? target.label
              : target.label.replace(target.provider.name, providerName),
          provider: {
            ...target.provider,
            id: generateUUID(),
            name: providerName,
            createdAt: Date.now(),
          },
        });
      }

      return resolved;
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const targets = buildToken4AIProviderTargets(state);

      if (targets.length === 0) {
        toast.error(
          t("token4aiUnified.validation.requireOneApiKey", {
            defaultValue: "请至少填写一个 Token4AI 产品的 API Key",
          }),
        );
        return;
      }

      setIsSubmitting(true);
      onSubmittingChange?.(true);

      const skipped = enabledMissingKeys.map(
        (key) => TOKEN4AI_PRODUCTS[key].defaultLabel,
      );
      const created: string[] = [];
      const failed: string[] = [];
      const touchedApps = new Set<AppId>();

      try {
        const resolvedTargets = await resolveUniqueNames(targets);

        for (const target of resolvedTargets) {
          try {
            await providersApi.add(target.provider, target.appId);
            created.push(target.label);
            touchedApps.add(target.appId);
          } catch (error) {
            const detail =
              error instanceof Error ? error.message : String(error);
            failed.push(`${target.label}: ${detail}`);
          }
        }

        for (const appId of touchedApps) {
          await queryClient.invalidateQueries({
            queryKey: ["providers", appId],
          });
        }

        if (touchedApps.size > 0) {
          try {
            await providersApi.updateTrayMenu();
          } catch {
            // 托盘刷新失败不影响 provider 创建结果。
          }
        }

        if (skipped.length > 0) {
          toast.info(
            t("token4aiUnified.toast.skipped", {
              products: skipped.join(", "),
              defaultValue:
                "未填写 API Key 的 Token4AI 产品已跳过：{{products}}",
            }),
          );
        }

        if (created.length > 0) {
          toast.success(
            t("token4aiUnified.toast.created", {
              count: created.length,
              providers: created.join(", "),
              defaultValue:
                "已创建 {{count}} 个 Token4AI 供应商：{{providers}}",
            }),
            { closeButton: true },
          );
        }

        if (failed.length > 0) {
          toast.error(
            t("token4aiUnified.toast.partialFailed", {
              success: created.join(", ") || "-",
              failed: failed.join("; "),
              defaultValue:
                "Token4AI 部分供应商创建失败。成功：{{success}}。失败：{{failed}}",
            }),
            { duration: 8000, closeButton: true },
          );
          return;
        }

        if (created.length > 0) {
          onOpenChange(false);
        }
      } finally {
        setIsSubmitting(false);
        onSubmittingChange?.(false);
      }
    },
    [
      enabledMissingKeys,
      onOpenChange,
      onSubmittingChange,
      resolveUniqueNames,
      state,
      t,
    ],
  );

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-border-default bg-card p-5">
        <div className="flex items-start gap-3">
          <ProviderIcon icon="token4ai" name="token4AI" size={28} />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              {t("token4aiUnified.title", {
                defaultValue: "Token4AI 统一供应商",
              })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("token4aiUnified.description", {
                defaultValue:
                  "通过 Token4AI 一次性配置 Codex、Claude、Gemini、MiniMax。每个产品使用独立 API Key，未填写 API Key 的产品将跳过创建。",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {TOKEN4AI_PRODUCT_ORDER.map((key) => (
          <ProductBlock
            key={key}
            productKey={key}
            value={state[key]}
            fetchedModels={fetchedModels[key] ?? []}
            isFetchingModels={!!loadingModels[key]}
            onChange={(patch) => updateProduct(key, patch)}
            onFetchModels={
              TOKEN4AI_PRODUCTS[key].supportsModelFetch
                ? () => fetchModels(key)
                : undefined
            }
          />
        ))}
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-300" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              {t("token4aiUnified.compat.title", {
                defaultValue: "Claude Code 多模型兼容",
              })}
            </p>
            <ul className="space-y-1 text-blue-800 dark:text-blue-200">
              <li>
                {t("token4aiUnified.compat.openai", {
                  defaultValue:
                    "OpenAI/GPT：已通过 OpenAI-compatible / Responses API 路径支持 Claude Code。",
                })}
              </li>
              <li>
                {t("token4aiUnified.compat.claude", {
                  defaultValue:
                    "Claude：通过 Anthropic-compatible 路径支持 Claude Code。",
                })}
              </li>
              <li>
                {t("token4aiUnified.compat.minimax", {
                  defaultValue:
                    "MiniMax：仅当接口兼容 OpenAI-compatible 且模型支持 tool calling / streaming 时建议启用 Claude Code 兼容。",
                })}
              </li>
              <li>
                {t("token4aiUnified.compat.gemini", {
                  defaultValue: "Gemini：默认用于 Gemini CLI。",
                })}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {isSubmitting && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </p>
      )}
    </form>
  );
}

interface ProductBlockProps {
  productKey: Token4AIProductKey;
  value: Token4AIProductFormState;
  fetchedModels: FetchedModel[];
  isFetchingModels: boolean;
  onChange: (patch: Partial<Token4AIProductFormState>) => void;
  onFetchModels?: () => void;
}

function ProductBlock({
  productKey,
  value,
  fetchedModels,
  isFetchingModels,
  onChange,
  onFetchModels,
}: ProductBlockProps) {
  const { t } = useTranslation();
  const product = TOKEN4AI_PRODUCTS[productKey];
  const disabled = !value.enabled;
  const productId = `token4ai-${productKey}`;

  return (
    <section className="rounded-lg border border-border-default bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              {t(product.labelKey, { defaultValue: product.defaultLabel })}
            </h4>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {t(product.targetKey, { defaultValue: product.defaultTarget })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("token4aiUnified.productApiFormat", {
              apiFormat: product.apiFormat,
              defaultValue: "API Format: {{apiFormat}}",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${productId}-enabled`} className="text-xs">
            {t("token4aiUnified.fields.enabled", { defaultValue: "启用" })}
          </Label>
          <Switch
            id={`${productId}-enabled`}
            checked={value.enabled}
            onCheckedChange={(checked) => onChange({ enabled: checked })}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${productId}-name`}>
            {t("token4aiUnified.fields.providerName", {
              defaultValue: "Provider 名称",
            })}
          </Label>
          <Input
            id={`${productId}-name`}
            value={value.providerName}
            onChange={(event) => onChange({ providerName: event.target.value })}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${productId}-base-url`}>
            {t("token4aiUnified.fields.baseUrl", { defaultValue: "Base URL" })}
          </Label>
          <Input
            id={`${productId}-base-url`}
            value={value.baseUrl}
            onChange={(event) => onChange({ baseUrl: event.target.value })}
            disabled={disabled}
            autoComplete="off"
          />
        </div>

        <ApiKeyInput
          id={`${productId}-api-key`}
          label={t("token4aiUnified.fields.apiKey", {
            product: product.defaultLabel,
            defaultValue: "API Key",
          })}
          value={value.apiKey}
          onChange={(apiKey) => onChange({ apiKey })}
          disabled={disabled}
          placeholder={t("token4aiUnified.fields.apiKeyPlaceholder", {
            product: product.defaultLabel,
            defaultValue: "Token4AI {{product}} API Key",
          })}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`${productId}-model`}>
              {t("token4aiUnified.fields.model", { defaultValue: "模型" })}
            </Label>
            {onFetchModels && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onFetchModels}
                disabled={disabled || isFetchingModels}
                className="h-7 gap-1"
              >
                {isFetchingModels ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {t("token4aiUnified.actions.fetchModels", {
                  defaultValue: "获取模型",
                })}
              </Button>
            )}
          </div>
          <ModelInputWithFetch
            id={`${productId}-model`}
            value={value.model}
            onChange={(model) => onChange({ model })}
            placeholder={
              product.defaultModel ||
              t("token4aiUnified.fields.modelPlaceholder", {
                defaultValue: "可手动输入模型名",
              })
            }
            fetchedModels={fetchedModels}
            isLoading={isFetchingModels}
          />
          <p className="text-xs text-muted-foreground">
            {t("token4aiUnified.modelHint", {
              defaultValue: "模型可留空；模型发现失败时可手动输入。",
            })}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {productKey === "openai" && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={!!value.alsoUseClaudeCode}
              disabled={disabled}
              onCheckedChange={(checked) =>
                onChange({ alsoUseClaudeCode: checked })
              }
            />
            {t("token4aiUnified.fields.alsoUseClaudeCode", {
              defaultValue: "同时用于 Claude Code",
            })}
          </label>
        )}

        {productKey === "minimax" && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={!!value.tryClaudeCode}
              disabled={disabled}
              onCheckedChange={(checked) =>
                onChange({ tryClaudeCode: checked })
              }
            />
            {t("token4aiUnified.fields.tryClaudeCode", {
              defaultValue: "尝试用于 Claude Code",
            })}
          </label>
        )}

        {productKey === "gemini" && (
          <p className="text-sm text-muted-foreground">
            {t("token4aiUnified.compat.geminiDefault", {
              defaultValue: "Gemini 默认用于 Gemini CLI。",
            })}
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() =>
            toast.info(
              t("token4aiUnified.toast.testAfterSave", {
                defaultValue:
                  "创建 provider 后，可在供应商列表中使用 Stream Check 测试连接。",
              }),
            )
          }
        >
          {t("token4aiUnified.actions.testConnection", {
            defaultValue: "测试连接",
          })}
        </Button>
      </div>

      {(productKey === "openai" || productKey === "minimax") && (
        <p className="mt-2 text-xs text-muted-foreground">
          {productKey === "openai"
            ? t("token4aiUnified.compat.openaiShort", {
                defaultValue:
                  "通过 cc-switch proxy takeover / openai_responses 兼容 Claude Code。",
              })
            : t("token4aiUnified.compat.minimaxShort", {
                defaultValue:
                  "仅当模型支持 tool calling / streaming 时建议开启 Claude Code 兼容。",
              })}
        </p>
      )}
    </section>
  );
}
