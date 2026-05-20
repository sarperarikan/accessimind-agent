import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { useState, useId } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/Markdown";
import { ToolCall } from "@/components/ToolCall";
import type { ChatMessage } from "@/hooks/useChatSession";
import { useI18n } from "@/i18n";

function fmtElapsed(ms: number): string {
  const sec = Math.max(0, ms) / 1000;
  if (sec < 1) return `${Math.round(ms)}ms`;
  if (sec < 10) return `${sec.toFixed(1)}s`;
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

function ThinkingBlock({ text }: { text: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return (
    <div className="mt-2 rounded border border-current/10 bg-secondary/30">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded transition-shadow"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        <span className="font-medium">{t.chat.thinking}</span>
      </button>
      {open && (
        <div id={contentId} className="border-t border-current/10 px-3 py-2">
          <div className="text-xs text-muted-foreground/90 whitespace-pre-wrap">
            {text}
          </div>
        </div>
      )}
    </div>
  );
}

function RequestBubble({
  message,
  onRespond,
}: {
  message: ChatMessage;
  onRespond?: (msgId: string, value: string) => void;
}) {
  const req = message.request;
  if (!req) return null;

  const [inputValue, setInputValue] = useState("");

  const handleAction = (choice: string) => {
    if (onRespond) {
      onRespond(message.id, choice);
    }
  };

  return (
    <div className="w-full max-w-[85%] rounded-lg border border-primary/20 bg-secondary/20 p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <span>⚠️</span>
        <span>{req.type} request</span>
      </div>

      <div className="text-sm font-medium text-foreground">{req.question}</div>

      {req.prompt && (
        <pre className="rounded bg-muted/60 p-2.5 font-mono text-xs overflow-x-auto border border-current/5 whitespace-pre">
          {req.prompt}
        </pre>
      )}

      {req.responded ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
          <span className="text-emerald-500 font-medium">✓ Responded:</span>
          <span className="font-mono bg-emerald-500/5 px-1.5 py-0.5 rounded">{req.responseValue}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {req.type === "approval" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => handleAction("once")}
                className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors"
              >
                Allow Once
              </button>
              <button
                onClick={() => handleAction("session")}
                className="rounded bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary border border-current/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors"
              >
                Allow for Session
              </button>
              <button
                onClick={() => handleAction("always")}
                className="rounded bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary border border-current/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors"
              >
                Allow Always
              </button>
              <button
                onClick={() => handleAction("deny")}
                className="rounded bg-destructive/80 px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-destructive transition-colors"
              >
                Deny
              </button>
            </div>
          )}

          {req.type === "clarify" && (
            <div className="space-y-2">
              {req.choices && req.choices.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {req.choices.map((choice) => (
                    <button
                      key={choice}
                      onClick={() => handleAction(choice)}
                      className="rounded bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your response..."
                    aria-label={req.question || "Clarification response"}
                    className="flex-1 rounded border border-current/15 bg-secondary/30 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <button
                    onClick={() => handleAction(inputValue)}
                    disabled={!inputValue.trim()}
                    className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              )}
            </div>
          )}

          {(req.type === "sudo" || req.type === "secret") && (
            <div className="flex gap-2">
              <input
                type="password"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={req.type === "sudo" ? "Password..." : "Secret value..."}
                aria-label={req.type === "sudo" ? (req.question || "Sudo password input") : (req.question || "Secret value input")}
                className="flex-1 rounded border border-current/15 bg-secondary/30 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <button
                onClick={() => handleAction(inputValue)}
                disabled={!inputValue.trim()}
                className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors disabled:opacity-50"
              >
                Submit
              </button>
              {req.type === "secret" && (
                <button
                  onClick={() => handleAction("")}
                  className="rounded bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary border border-current/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors"
                >
                  Skip
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({
  message,
  onRespond,
}: {
  message: ChatMessage;
  onRespond?: (msgId: string, value: string) => void;
}) {
  const { t } = useI18n();
  const isUser = message.role === "user";
  const isRequest = message.role === "request";
  const isStreaming = message.status === "streaming";

  if (isRequest) {
    return <RequestBubble message={message} onRespond={onRespond} />;
  }

  const elapsed = message.completedAt
    ? fmtElapsed(message.completedAt - message.startedAt)
    : isStreaming
      ? fmtElapsed(Date.now() - message.startedAt)
      : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start",
      )}
    >
      {/* Role label */}
      <div
        className={cn(
          "text-[0.65rem] font-medium tracking-wider uppercase",
          isUser ? "text-primary/85" : "text-muted-foreground/85",
        )}
      >
        {isUser ? "You" : "AccessiMind"}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-3",
          isUser
            ? "bg-primary/15 text-foreground"
            : "bg-secondary/40 text-foreground",
        )}
      >
        {/* Message text */}
        {(message.text || isStreaming) && (
          <Markdown
            content={message.text || ""}
            streaming={isStreaming && !message.text.endsWith("\n")}
          />
        )}

        {/* Thinking block */}
        {message.thinking && <ThinkingBlock text={message.thinking} />}

        {/* Tool calls */}
        {message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.toolCalls.map((tool) => (
              <ToolCall key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </div>

      {/* Status line */}
      <div className="flex items-center gap-2 text-[0.6rem] text-muted-foreground/80">
        {isStreaming && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        )}
        {message.status === "interrupted" && (
          <span className="inline-flex items-center gap-1 text-warning/70">
            <AlertCircle className="h-2.5 w-2.5" />
            {t.chat.interrupted}
          </span>
        )}
        {message.status === "error" && (
          <span className="inline-flex items-center gap-1 text-destructive/70">
            <AlertCircle className="h-2.5 w-2.5" />
            {t.chat.errorMessage}
          </span>
        )}
        {elapsed && <span>{elapsed}</span>}
        {message.usage && (
          <span>
            {(message.usage.input_tokens / 1000).toFixed(1)}k↓{" "}
            {(message.usage.output_tokens / 1000).toFixed(1)}k↑
          </span>
        )}
      </div>
    </div>
  );
}
