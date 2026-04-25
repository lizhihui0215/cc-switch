import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

export function Token4AIClaudeCompatibilityNotice() {
  const { t } = useTranslation();

  return (
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
  );
}
