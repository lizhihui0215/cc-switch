import { useCallback, useState } from "react";
import {
  createDefaultToken4AIUnifiedState,
  TOKEN4AI_PRODUCT_ORDER,
} from "../token4ai.providers";
import type {
  Token4AIProductFormState,
  Token4AIProductId,
  Token4AIUnifiedFormState,
} from "../token4ai.types";
import { getSkippedToken4AIProducts } from "../token4ai.validation";

export function useToken4AIProviderForm() {
  const [state, setState] = useState<Token4AIUnifiedFormState>(() =>
    createDefaultToken4AIUnifiedState(),
  );

  const updateProduct = useCallback(
    (
      productId: Token4AIProductId,
      patch: Partial<Token4AIProductFormState>,
    ) => {
      setState((current) => ({
        ...current,
        [productId]: {
          ...current[productId],
          ...patch,
        },
      }));
    },
    [],
  );

  return {
    state,
    productOrder: TOKEN4AI_PRODUCT_ORDER,
    skippedProductIds: getSkippedToken4AIProducts(state),
    updateProduct,
  };
}
