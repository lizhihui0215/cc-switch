import { Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import ApiKeyInput from "@/components/providers/forms/ApiKeyInput";
import { ModelInputWithFetch } from "@/components/providers/forms/shared";
import type { FetchedModel } from "@/lib/api/model-fetch";
import { TOKEN4AI_PRODUCTS } from "../token4ai.providers";
import type {
  Token4AIProductFormState,
  Token4AIProductId,
} from "../token4ai.types";

interface Token4AIProductCardProps {
  productId: Token4AIProductId;
  formValue: Token4AIProductFormState;
  fetchedModels: FetchedModel[];
  isFetchingModels: boolean;
  onChange: (patch: Partial<Token4AIProductFormState>) => void;
  onFetchModels?: () => void;
  onTestConnection?: () => void;
}

export function Token4AIProductCard({
  productId,
  formValue,
  fetchedModels,
  isFetchingModels,
  onChange,
  onFetchModels,
  onTestConnection,
}: Token4AIProductCardProps) {
  const { t } = useTranslation();
  const product = TOKEN4AI_PRODUCTS[productId];
  const disabled = !formValue.enabled;
  const productDomId = `token4ai-${productId}`;

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
              apiFormat: product.defaultApiFormat,
              defaultValue: "API Format: {{apiFormat}}",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${productDomId}-enabled`} className="text-xs">
            {t("token4aiUnified.fields.enabled", { defaultValue: "启用" })}
          </Label>
          <Switch
            id={`${productDomId}-enabled`}
            checked={formValue.enabled}
            onCheckedChange={(checked) => onChange({ enabled: checked })}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${productDomId}-name`}>
            {t("token4aiUnified.fields.providerName", {
              defaultValue: "Provider 名称",
            })}
          </Label>
          <Input
            id={`${productDomId}-name`}
            value={formValue.providerName}
            onChange={(event) => onChange({ providerName: event.target.value })}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${productDomId}-base-url`}>
            {t("token4aiUnified.fields.baseUrl", { defaultValue: "Base URL" })}
          </Label>
          <Input
            id={`${productDomId}-base-url`}
            value={formValue.baseUrl}
            onChange={(event) => onChange({ baseUrl: event.target.value })}
            disabled={disabled}
            autoComplete="off"
          />
        </div>

        <ApiKeyInput
          id={`${productDomId}-api-key`}
          label={t("token4aiUnified.fields.apiKey", {
            product: product.defaultLabel,
            defaultValue: "API Key",
          })}
          value={formValue.apiKey}
          onChange={(apiKey) => onChange({ apiKey })}
          disabled={disabled}
          placeholder={t("token4aiUnified.fields.apiKeyPlaceholder", {
            product: product.defaultLabel,
            defaultValue: "Token4AI {{product}} API Key",
          })}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`${productDomId}-model`}>
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
            id={`${productDomId}-model`}
            value={formValue.model}
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
        {productId === "openai" && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={!!formValue.alsoUseClaudeCode}
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

        {productId === "minimax" && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={!!formValue.tryClaudeCode}
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

        {productId === "gemini" && (
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
          onClick={
            onTestConnection ??
            (() =>
              toast.info(
                t("token4aiUnified.toast.testAfterSave", {
                  defaultValue:
                    "创建 provider 后，可在供应商列表中使用 Stream Check 测试连接。",
                }),
              ))
          }
        >
          {t("token4aiUnified.actions.testConnection", {
            defaultValue: "测试连接",
          })}
        </Button>
      </div>

      {(productId === "openai" || productId === "minimax") && (
        <p className="mt-2 text-xs text-muted-foreground">
          {productId === "openai"
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
