import { useCallback, useEffect, useRef, useState } from "react";
import { GatewayClient } from "@/lib/gatewayClient";
import type { ToolEntry } from "@/components/ToolCall";

// ── Types ──

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "request";
  text: string;
  rendered?: string;
  status: "streaming" | "complete" | "interrupted" | "error";
  thinking?: string;
  toolCalls: ToolEntry[];
  usage?: { input_tokens: number; output_tokens: number };
  startedAt: number;
  completedAt?: number;
  request?: {
    type: "approval" | "clarify" | "sudo" | "secret";
    requestId?: string;
    question?: string;
    prompt?: string;
    choices?: string[];
    envVar?: string;
    responded?: boolean;
    responseValue?: string;
  };
}

export interface SessionInfo {
  model?: string;
  provider?: string;
}

export type ConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";

// ── Hook ──

export function useChatSession(channel?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({});
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gwRef = useRef<GatewayClient | null>(null);
  const eventsWsRef = useRef<WebSocket | null>(null);
  const pendingTextRef = useRef("");
  const rafIdRef = useRef(0);
  const channelRef = useRef("");

  // Use the passed channel if available, or generate a fallback
  const activeChannel = channel || channelRef.current || generateChannelId();
  if (!channelRef.current) {
    channelRef.current = activeChannel;
  }

  // Flush accumulated streaming text into the last assistant message.
  const flushPendingText = useCallback(() => {
    const pending = pendingTextRef.current;
    if (!pending) return;
    pendingTextRef.current = "";
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.role === "assistant" && last.status === "streaming") {
        updated[updated.length - 1] = { ...last, text: last.text + pending };
      }
      return updated;
    });
  }, []);

  // ── Connect ──

  const connect = useCallback(() => {
    const gw = new GatewayClient();
    gwRef.current = gw;

    gw.onState((state) => {
      setConnectionState(state as ConnectionState);
    });

    // Create or resume session once connected
    gw.on("gateway.ready", async () => {
      try {
        const resumeParam = new URLSearchParams(window.location.search).get("resume");
        let res;
        if (resumeParam) {
          res = await gw.request<{ session_id: string; messages?: any[]; info?: any }>(
            "session.resume",
            { session_id: resumeParam },
          );
          if (res.messages && Array.isArray(res.messages)) {
            // Map historical messages to ChatMessage structure
            const mapped = res.messages.map((m: any, index: number) => {
              if (m.role === "tool") {
                const toolEntry: ToolEntry = {
                  kind: "tool",
                  id: `tool-hist-${index}`,
                  tool_id: `hist-${index}`,
                  name: m.name || "tool",
                  context: m.context,
                  status: "done",
                  startedAt: 0,
                  completedAt: 0,
                };
                return {
                  id: `msg-hist-${index}`,
                  role: "assistant" as const,
                  text: "",
                  status: "complete" as const,
                  toolCalls: [toolEntry],
                  startedAt: Date.now(),
                };
              }
              return {
                id: `msg-hist-${index}`,
                role: m.role === "user" ? ("user" as const) : ("assistant" as const),
                text: m.text || "",
                status: "complete" as const,
                toolCalls: [],
                startedAt: Date.now(),
              };
            });
            setMessages(mapped);
          }
          if (res.info) {
            setSessionInfo({
              model: res.info.model as string | undefined,
              provider: res.info.provider as string | undefined,
            });
          }
        } else {
          res = await gw.request<{ session_id: string }>(
            "session.create",
            {},
          );
        }
        setSessionId(res.session_id);
        setError(null);
      } catch (e: any) {
        setError(e.message ?? "Failed to initialize session");
      }
    });

    // Listen for session info updates
    gw.on("session.info", (ev) => {
      const p = ev.payload as Record<string, unknown>;
      setSessionInfo({
        model: p.model as string | undefined,
        provider: p.provider as string | undefined,
      });
    });

    // Message lifecycle events
    gw.on("message.start", () => {
      const msg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        text: "",
        status: "streaming",
        toolCalls: [],
        startedAt: Date.now(),
      };
      setMessages((prev) => [...prev, msg]);
      setIsGenerating(true);
    });

    gw.on("message.delta", (ev) => {
      const p = ev.payload as { text?: string; rendered?: string };
      if (p.text) {
        pendingTextRef.current += p.text;
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = 0;
            flushPendingText();
          });
        }
      }
    });

    gw.on("message.complete", (ev) => {
      // Flush any remaining text first
      flushPendingText();

      const p = ev.payload as {
        text?: string;
        status?: string;
        usage?: Record<string, unknown>;
        reasoning?: string;
      };

      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant" && last.status === "streaming") {
          updated[updated.length - 1] = {
            ...last,
            status: (p.status as ChatMessage["status"]) ?? "complete",
            text: p.text ?? last.text,
            usage: p.usage as ChatMessage["usage"],
            completedAt: Date.now(),
          };
        }
        return updated;
      });
      setIsGenerating(false);
    });

    // Tool call lifecycle events
    gw.on("tool.start", (ev) => {
      const p = ev.payload as {
        tool_id: string;
        name: string;
        context?: string;
      };
      const entry: ToolEntry = {
        kind: "tool",
        id: `tool-${Date.now()}-${p.tool_id}`,
        tool_id: p.tool_id,
        name: p.name,
        context: p.context,
        status: "running",
        startedAt: Date.now(),
      };
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            toolCalls: [...last.toolCalls, entry],
          };
        }
        return updated;
      });
    });

    gw.on("tool.progress", (ev) => {
      const p = ev.payload as { name?: string; preview?: string };
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          const tools = [...last.toolCalls];
          const idx = tools.findIndex(
            (t) => t.status === "running" && t.name === (p.name ?? t.name),
          );
          if (idx >= 0) {
            tools[idx] = { ...tools[idx], preview: p.preview };
          }
          updated[updated.length - 1] = { ...last, toolCalls: tools };
        }
        return updated;
      });
    });

    gw.on("tool.complete", (ev) => {
      const p = ev.payload as {
        tool_id: string;
        name?: string;
        duration_s?: number;
        summary?: string;
        error?: string;
        inline_diff?: string;
      };
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          const tools = [...last.toolCalls];
          const idx = tools.findIndex((t) => t.tool_id === p.tool_id);
          if (idx >= 0) {
            tools[idx] = {
              ...tools[idx],
              status: p.error ? "error" : "done",
              summary: p.summary,
              error: p.error,
              inline_diff: p.inline_diff,
              completedAt: Date.now(),
            };
          }
          updated[updated.length - 1] = { ...last, toolCalls: tools };
        }
        return updated;
      });
    });

    // Thinking/reasoning
    gw.on("thinking.delta", (ev) => {
      const p = ev.payload as { text?: string };
      if (!p.text) return;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant" && last.status === "streaming") {
          updated[updated.length - 1] = {
            ...last,
            thinking: (last.thinking ?? "") + p.text,
          };
        }
        return updated;
      });
    });

    gw.on("reasoning.delta", (ev) => {
      const p = ev.payload as { text?: string };
      if (!p.text) return;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant" && last.status === "streaming") {
          updated[updated.length - 1] = {
            ...last,
            thinking: (last.thinking ?? "") + p.text,
          };
        }
        return updated;
      });
    });

    // Interactive Request listeners
    gw.on("approval.request", (ev) => {
      const p = ev.payload as {
        command?: string;
        description?: string;
        pattern_keys?: string[];
      };
      const msg: ChatMessage = {
        id: `req-app-${Date.now()}`,
        role: "request",
        text: "",
        status: "complete",
        toolCalls: [],
        startedAt: Date.now(),
        request: {
          type: "approval",
          question: p.description || `Approval required for command: ${p.command}`,
          prompt: p.command,
          choices: ["once", "session", "always", "deny"],
          responded: false,
        },
      };
      setMessages((prev) => [...prev, msg]);
    });

    gw.on("clarify.request", (ev) => {
      const p = ev.payload as {
        request_id: string;
        question: string;
        choices?: string[];
      };
      const msg: ChatMessage = {
        id: `req-clar-${Date.now()}`,
        role: "request",
        text: "",
        status: "complete",
        toolCalls: [],
        startedAt: Date.now(),
        request: {
          type: "clarify",
          requestId: p.request_id,
          question: p.question,
          choices: p.choices,
          responded: false,
        },
      };
      setMessages((prev) => [...prev, msg]);
    });

    gw.on("sudo.request", (ev) => {
      const p = ev.payload as {
        request_id: string;
      };
      const msg: ChatMessage = {
        id: `req-sudo-${Date.now()}`,
        role: "request",
        text: "",
        status: "complete",
        toolCalls: [],
        startedAt: Date.now(),
        request: {
          type: "sudo",
          requestId: p.request_id,
          question: "Sudo privileges required. Enter password:",
          responded: false,
        },
      };
      setMessages((prev) => [...prev, msg]);
    });

    gw.on("secret.request", (ev) => {
      const p = ev.payload as {
        request_id: string;
        prompt: string;
        env_var: string;
      };
      const msg: ChatMessage = {
        id: `req-sec-${Date.now()}`,
        role: "request",
        text: "",
        status: "complete",
        toolCalls: [],
        startedAt: Date.now(),
        request: {
          type: "secret",
          requestId: p.request_id,
          question: p.prompt,
          envVar: p.env_var,
          responded: false,
        },
      };
      setMessages((prev) => [...prev, msg]);
    });

    // Error handling
    gw.on("error", (ev) => {
      const p = ev.payload as { message?: string };
      setError(p.message ?? "Unknown error");
    });

    gw.connect().catch((e: Error) => {
      setError(e.message);
      setConnectionState("error");
    });

    // Also connect to /api/events for real-time event streaming
    const token = window.__HERMES_SESSION_TOKEN__ ?? "";
    const pubTok = window.__HERMES_PUBLIC_TOKEN__;
    const pubQS = pubTok ? `&pub=${encodeURIComponent(pubTok)}` : "";
    const eventsUrl = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/events?token=${encodeURIComponent(token)}&channel=${activeChannel}${pubQS}`;
    const evWs = new WebSocket(eventsUrl);
    eventsWsRef.current = evWs;
    evWs.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.method === "event" && data.params) {
          // Re-dispatch through gateway's event system
          (gw as any).dispatch(data);
        }
      } catch {
        // ignore malformed
      }
    });
  }, [flushPendingText, activeChannel]);

  // ── Actions ──

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      // Add user message immediately for instant feedback
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        text: text.trim(),
        status: "complete",
        toolCalls: [],
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setError(null);

      // Send via gateway
      const gw = gwRef.current;
      if (!gw || gw.state !== "open" || !sessionId) {
        setError("Not connected");
        return;
      }

      gw
        .request("prompt.submit", {
          session_id: sessionId,
          text: text.trim(),
        })
        .catch((e: Error) => {
          setError(e.message);
        });
    },
    [sessionId],
  );

  const interrupt = useCallback(() => {
    const gw = gwRef.current;
    if (!gw || gw.state !== "open" || !sessionId) return;
    gw.request("session.interrupt", { session_id: sessionId }).catch(() => {});
    setIsGenerating(false);
  }, [sessionId]);

  const reconnect = useCallback(() => {
    gwRef.current?.close();
    eventsWsRef.current?.close();
    setConnectionState("idle");
    setError(null);
    connect();
  }, [connect]);

  const respondToRequest = useCallback(
    async (msgId: string, choiceOrValue: string) => {
      const gw = gwRef.current;
      if (!gw || gw.state !== "open" || !sessionId) {
        setError("Not connected");
        return;
      }

      setMessages((prev) => {
        const msg = prev.find((m) => m.id === msgId);
        if (!msg || !msg.request || msg.request.responded) return prev;

        const { type, requestId } = msg.request;

        // Perform the request asynchronously
        let reqPromise;
        if (type === "approval") {
          reqPromise = gw.request("approval.respond", {
            session_id: sessionId,
            choice: choiceOrValue,
          });
        } else if (type === "clarify") {
          reqPromise = gw.request("clarify.respond", {
            request_id: requestId,
            answer: choiceOrValue,
          });
        } else if (type === "sudo") {
          reqPromise = gw.request("sudo.respond", {
            request_id: requestId,
            password: choiceOrValue,
          });
        } else if (type === "secret") {
          reqPromise = gw.request("secret.respond", {
            request_id: requestId,
            value: choiceOrValue,
          });
        }

        if (reqPromise) {
          reqPromise.catch((e: Error) => {
            setError(e.message);
          });
        }

        // Return updated list mapping the specific message as responded
        return prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                request: {
                  ...m.request!,
                  responded: true,
                  responseValue: choiceOrValue,
                },
              }
            : m,
        );
      });
    },
    [sessionId],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      gwRef.current?.close();
      eventsWsRef.current?.close();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  return {
    messages,
    sessionInfo,
    connectionState,
    isGenerating,
    error,
    sessionId,
    sendMessage,
    interrupt,
    reconnect,
    respondToRequest,
  };
}

function generateChannelId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `chat-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
