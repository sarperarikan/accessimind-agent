import { MessageSquare, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export type ChatMode = "terminal" | "chat";

export function ChatModeToggle({
  mode,
  onModeChange,
}: {
  mode: ChatMode;
  onModeChange: (m: ChatMode) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-current/15 bg-secondary/30 p-0.5">
      <button
        onClick={() => onModeChange("terminal")}
        className={cn(
          "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium tracking-wide transition-colors",
          mode === "terminal"
            ? "bg-foreground/10 text-foreground"
            : "text-muted-foreground hover:text-foreground/80",
        )}
        aria-label={t.chat.modeTerminal}
      >
        <Terminal className="h-3 w-3" />
        <span className="hidden min-[400px]:inline">{t.chat.modeTerminal}</span>
      </button>
      <button
        onClick={() => onModeChange("chat")}
        className={cn(
          "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium tracking-wide transition-colors",
          mode === "chat"
            ? "bg-foreground/10 text-foreground"
            : "text-muted-foreground hover:text-foreground/80",
        )}
        aria-label={t.chat.modeChat}
      >
        <MessageSquare className="h-3 w-3" />
        <span className="hidden min-[400px]:inline">{t.chat.modeChat}</span>
      </button>
    </div>
  );
}