import { TOKEN4AI_PRODUCT_ORDER } from "./token4ai.constants";
import { TOKEN4AI_PRODUCTS } from "./token4ai.providers";
import type {
  Token4AIProductFormState,
  Token4AIProductId,
  Token4AIUnifiedFormState,
  Token4AIValidationIssue,
} from "./token4ai.types";
import { isValidToken4AIUrl, normalizeToken4AIBaseUrl } from "./token4ai.url";

export function shouldCreateToken4AIProduct(
  product: Token4AIProductFormState,
): boolean {
  return product.enabled && product.apiKey.trim().length > 0;
}

export function getSkippedToken4AIProducts(
  state: Token4AIUnifiedFormState,
): Token4AIProductId[] {
  return TOKEN4AI_PRODUCT_ORDER.filter(
    (productId) => state[productId].enabled && !state[productId].apiKey.trim(),
  );
}

export function canEnableToken4AIClaudeCompat(
  productId: Token4AIProductId,
): boolean {
  return TOKEN4AI_PRODUCTS[productId].supportsClaudeCodeCompat;
}

export function validateToken4AIForm(
  state: Token4AIUnifiedFormState,
): Token4AIValidationIssue[] {
  const issues: Token4AIValidationIssue[] = [];
  const hasCreatableProduct = TOKEN4AI_PRODUCT_ORDER.some((productId) =>
    shouldCreateToken4AIProduct(state[productId]),
  );

  if (!hasCreatableProduct) {
    issues.push({
      code: "require_one_api_key",
      message: "Please enter at least one Token4AI API key",
    });
  }

  for (const productId of TOKEN4AI_PRODUCT_ORDER) {
    const product = state[productId];
    if (!product.enabled) {
      continue;
    }

    if (!shouldCreateToken4AIProduct(product)) {
      continue;
    }

    const baseUrl = normalizeToken4AIBaseUrl(productId, product.baseUrl);
    if (!isValidToken4AIUrl(baseUrl)) {
      issues.push({
        productId,
        code: "invalid_base_url",
        message: `${TOKEN4AI_PRODUCTS[productId].defaultLabel} Base URL is invalid`,
      });
    }

    if (
      (productId === "gemini" || productId === "anthropic") &&
      (product.alsoUseClaudeCode || product.tryClaudeCode)
    ) {
      issues.push({
        productId,
        code: "unsupported_claude_compat",
        message: `${TOKEN4AI_PRODUCTS[productId].defaultLabel} does not enable Claude Code compatibility by default`,
      });
    }
  }

  return issues;
}
