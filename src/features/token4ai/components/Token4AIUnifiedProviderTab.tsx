import { FormEvent, useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ProviderIcon } from "@/components/ProviderIcon";
import { showFetchModelsError, type FetchedModel } from "@/lib/api/model-fetch";
import { TOKEN4AI_DISPLAY_NAME } from "../token4ai.constants";
import { fetchToken4AIModels } from "../token4ai.model-discovery";
import { TOKEN4AI_PRODUCTS } from "../token4ai.providers";
import type { Token4AIProductId } from "../token4ai.types";
import { validateToken4AIForm } from "../token4ai.validation";
import { useToken4AIBatchCreateProviders } from "../hooks/useToken4AIBatchCreateProviders";
import { useToken4AIProviderForm } from "../hooks/useToken4AIProviderForm";
import { Token4AIClaudeCompatibilityNotice } from "./Token4AIClaudeCompatibilityNotice";
import { Token4AIProductCard } from "./Token4AIProductCard";

interface Token4AIUnifiedProviderTabProps {
  formId: string;
  onOpenChange: (open: boolean) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

type FetchState = Partial<Record<Token4AIProductId, FetchedModel[]>>;
type LoadingState = Partial<Record<Token4AIProductId, boolean>>;

export function Token4AIUnifiedProviderTab({
  formId,
  onOpenChange,
  onSubmittingChange,
}: Token4AIUnifiedProviderTabProps) {
  const { t } = useTranslation();
  const { state, productOrder, skippedProductIds, updateProduct } =
    useToken4AIProviderForm();
  const { createProviders } = useToken4AIBatchCreateProviders();
  const [fetchedModels, setFetchedModels] = useState<FetchState>({});
  const [loadingModels, setLoadingModels] = useState<LoadingState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchModels = useCallback(
    async (productId: Token4AIProductId) => {
      const product = state[productId];
      if (!product.baseUrl || !product.apiKey) {
        showFetchModelsError(null, t, {
          hasApiKey: !!product.apiKey,
          hasBaseUrl: !!product.baseUrl,
        });
        return;
      }

      setLoadingModels((current) => ({ ...current, [productId]: true }));
      try {
        const models = await fetchToken4AIModels({
          productId,
          baseUrl: product.baseUrl,
          apiKey: product.apiKey,
        });
        setFetchedModels((current) => ({ ...current, [productId]: models }));
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
        setLoadingModels((current) => ({ ...current, [productId]: false }));
      }
    },
    [state, t],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const validationIssues = validateToken4AIForm(state);
      const blockingIssue = validationIssues.find(
        (issue) => issue.code === "require_one_api_key",
      );

      if (blockingIssue) {
        toast.error(
          t("token4aiUnified.validation.requireOneApiKey", {
            defaultValue: "请至少填写一个 Token4AI 产品的 API Key",
          }),
        );
        return;
      }

      const validationIssue = validationIssues[0];
      if (validationIssue) {
        toast.error(
          t(`token4aiUnified.validation.${validationIssue.code}`, {
            defaultValue: validationIssue.message,
          }),
        );
        return;
      }

      setIsSubmitting(true);
      onSubmittingChange?.(true);

      try {
        const summary = await createProviders(state, skippedProductIds);

        if (summary.skipped.length > 0) {
          toast.info(
            t("token4aiUnified.toast.skipped", {
              products: summary.skipped.join(", "),
              defaultValue:
                "未填写 API Key 的 Token4AI 产品已跳过：{{products}}",
            }),
          );
        }

        if (summary.created.length > 0) {
          toast.success(
            t("token4aiUnified.toast.created", {
              count: summary.created.length,
              providers: summary.created.join(", "),
              defaultValue:
                "已创建 {{count}} 个 Token4AI 供应商：{{providers}}",
            }),
            { closeButton: true },
          );
        }

        if (summary.failed.length > 0) {
          toast.error(
            t("token4aiUnified.toast.partialFailed", {
              success: summary.created.join(", ") || "-",
              failed: summary.failed.join("; "),
              defaultValue:
                "Token4AI 部分供应商创建失败。成功：{{success}}。失败：{{failed}}",
            }),
            { duration: 8000, closeButton: true },
          );
          return;
        }

        if (summary.created.length > 0) {
          onOpenChange(false);
        }
      } finally {
        setIsSubmitting(false);
        onSubmittingChange?.(false);
      }
    },
    [
      createProviders,
      onOpenChange,
      onSubmittingChange,
      skippedProductIds,
      state,
      t,
    ],
  );

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-border-default bg-card p-5">
        <div className="flex items-start gap-3">
          <ProviderIcon
            icon="token4ai"
            name={TOKEN4AI_DISPLAY_NAME}
            size={28}
          />
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
        {productOrder.map((productId) => (
          <Token4AIProductCard
            key={productId}
            productId={productId}
            formValue={state[productId]}
            fetchedModels={fetchedModels[productId] ?? []}
            isFetchingModels={!!loadingModels[productId]}
            onChange={(patch) => updateProduct(productId, patch)}
            onFetchModels={
              TOKEN4AI_PRODUCTS[productId].supportsModelDiscovery
                ? () => fetchModels(productId)
                : undefined
            }
          />
        ))}
      </div>

      <Token4AIClaudeCompatibilityNotice />

      {isSubmitting && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </p>
      )}
    </form>
  );
}
