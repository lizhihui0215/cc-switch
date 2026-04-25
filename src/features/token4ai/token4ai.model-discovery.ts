import { fetchModelsForConfig, type FetchedModel } from "@/lib/api/model-fetch";
import type { Token4AIProductId } from "./token4ai.types";
import { getToken4AIModelDiscoveryUrl } from "./token4ai.url";

export async function fetchToken4AIModels(args: {
  productId: Token4AIProductId;
  baseUrl: string;
  apiKey: string;
}): Promise<FetchedModel[]> {
  const modelsUrl = getToken4AIModelDiscoveryUrl(args.productId, args.baseUrl);
  return fetchModelsForConfig(
    args.baseUrl,
    args.apiKey,
    false,
    modelsUrl ?? undefined,
  );
}
