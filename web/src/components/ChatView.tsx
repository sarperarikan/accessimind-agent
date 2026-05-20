import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { useChatSession } from "@/hooks/useChatSession";
import { ChatSidebar } from "@/components/ChatSidebar";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { Button } from "@nous-research/ui/ui/components/button";

export function ChatView({
  channel,
}: {
  channel: string;
  isActive?: boolean;
}) {
  const { t } = useI18n();
  const {
    messages,
    sessionInfo,
    connectionState,
    isGenerating,
    error,
    sendMessage,
    interrupt,
    reconnect,
    respondToRequest,
  } = useChatSession(channel);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages or streaming updates
  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, messages.length, messages[messages.length - 1]?.text?.length]);

  const isDisconnected =
    connectionState === "closed" || connectionState === "error";

  const hasPendingRequest = messages.some(
    (m) => m.role === "request" && !m.request?.responded,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-3">
      {/* Message area */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-current/10">
        {/* Connection status banner */}
        {isDisconnected && (
          <div 
            role="status" 
            aria-live="polite" 
            className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-warning"
          >
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="flex-1 font-medium">{t.chat.disconnected}</span>
            <Button
              ghost
              size="sm"
              onClick={reconnect}
              className="text-warning hover:text-warning focus:outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-1"
            >
              <RefreshCw className="mr-1 h-3 w-3 shrink-0" aria-hidden="true" />
              {t.chat.reconnect}
            </Button>
          </div>
        )}

        {/* Error banner */}
        {error && !isDisconnected && (
          <div 
            role="alert" 
            className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
          >
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="flex-1 font-medium">{error}</span>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          tabIndex={0}
          aria-label="Chat history"
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-muted-foreground/50">
              <div className="text-4xl">💬</div>
              <div className="text-sm font-medium">{t.chat.emptyState}</div>
              {sessionInfo.model && (
                <div className="text-xs text-muted-foreground/40">
                  {sessionInfo.provider}/{sessionInfo.model}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onRespond={respondToRequest}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Pending request banner */}
        {hasPendingRequest && (
          <div 
            role="status" 
            aria-live="polite" 
            className="flex items-center gap-2 border-t border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning font-medium"
          >
            <span className="font-semibold animate-pulse" aria-hidden="true">●</span>
            <span className="sr-only">Warning:</span>
            <span>Awaiting input: Please respond to the active request in the chat history above.</span>
          </div>
        )}

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          onStop={interrupt}
          disabled={connectionState !== "open" || hasPendingRequest}
          isGenerating={isGenerating}
        />
      </div>

      {/* Sidebar (desktop only) */}
      <div
        className={cn(
          "hidden min-h-0 shrink-0 flex-col overflow-hidden lg:flex lg:w-80",
        )}
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatSidebar channel={channel} />
        </div>
      </div>
    </div>
  );
}
