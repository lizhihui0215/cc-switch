import { useCallback } from "react";
import { providersApi, type AppId } from "@/lib/api";
import { queryClient } from "@/lib/query";
import type { Provider } from "@/types";
import { generateUUID } from "@/utils/uuid";
import {
  buildToken4AIProviderTemplates,
  getUniqueProviderName,
  TOKEN4AI_PRODUCTS,
} from "../token4ai.providers";
import type {
  Token4AICreateSummary,
  Token4AIProductId,
  Token4AIProviderTarget,
  Token4AIUnifiedFormState,
} from "../token4ai.types";

export function useToken4AIBatchCreateProviders() {
  const resolveUniqueNames = useCallback(
    async (targets: Token4AIProviderTarget[]) => {
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

  const createProviders = useCallback(
    async (
      state: Token4AIUnifiedFormState,
      skippedProductIds: Token4AIProductId[],
    ): Promise<Token4AICreateSummary> => {
      const targets = buildToken4AIProviderTemplates(state);
      const skipped = skippedProductIds.map(
        (productId) => TOKEN4AI_PRODUCTS[productId].defaultLabel,
      );
      const created: string[] = [];
      const failed: string[] = [];
      const touchedApps = new Set<AppId>();
      const resolvedTargets = await resolveUniqueNames(targets);

      for (const target of resolvedTargets) {
        try {
          await providersApi.add(target.provider, target.appId);
          created.push(target.label);
          touchedApps.add(target.appId);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
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

      return { created, skipped, failed };
    },
    [resolveUniqueNames],
  );

  return { createProviders };
}
