import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { Token4AIUnifiedProviderTab } from "../components/Token4AIUnifiedProviderTab";

const createProvidersMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("../hooks/useToken4AIBatchCreateProviders", () => ({
  useToken4AIBatchCreateProviders: () => ({
    createProviders: createProvidersMock,
  }),
}));

describe("Token4AIUnifiedProviderTab", () => {
  beforeEach(() => {
    createProvidersMock.mockReset();
    createProvidersMock.mockResolvedValue({
      created: [],
      skipped: [],
      failed: [],
    });
  });

  it("blocks provider creation when an enabled product has an invalid Base URL", async () => {
    const user = userEvent.setup();

    render(
      <Token4AIUnifiedProviderTab
        formId="token4ai-test-form"
        onOpenChange={vi.fn()}
      />,
    );

    await user.type(
      screen.getByLabelText("API Key", {
        selector: "#token4ai-openai-api-key",
      }),
      "token4ai-openai-test-key",
    );
    await user.clear(
      screen.getByLabelText("Base URL", {
        selector: "#token4ai-openai-base-url",
      }),
    );
    await user.type(
      screen.getByLabelText("Base URL", {
        selector: "#token4ai-openai-base-url",
      }),
      "not a url",
    );

    fireEvent.submit(document.getElementById("token4ai-test-form")!);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Base URL is invalid"),
      ),
    );
    expect(createProvidersMock).not.toHaveBeenCalled();
  });
});
