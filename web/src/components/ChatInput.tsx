import { Send, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export function ChatInput({
  onSend,
  onStop,
  disabled,
  isGenerating,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
  isGenerating: boolean;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const handleSubmit = useCallback(() => {
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
    // Reset height
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="border-t border-current/10 bg-background-base/80 backdrop-blur-sm">
      <div className="flex items-end gap-2 p-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? t.chat.connecting : t.chat.placeholder}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-lg border border-current/15 bg-secondary/30 px-3 py-2",
            "text-sm text-foreground placeholder:text-muted-foreground/50",
            "focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        />
        {isGenerating ? (
          <button
            onClick={onStop}
            className="shrink-0 rounded-lg bg-destructive/80 px-3 py-2 text-xs font-medium text-destructive-foreground hover:bg-destructive transition-colors"
            aria-label={t.chat.stop}
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              disabled || !value.trim()
                ? "bg-secondary/30 text-muted-foreground/40 cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            aria-label={t.chat.send}
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}