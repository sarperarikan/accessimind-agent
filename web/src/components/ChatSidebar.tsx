/**
 * ChatSidebar — structured-events panel that sits next to the xterm.js
 * terminal in the dashboard Chat tab.
 *
 * Two WebSockets, one per concern:
 *
 *   1. **JSON-RPC sidecar** (`GatewayClient` → /api/ws) — drives the
 *      sidebar's own slot of the dashboard's in-process gateway.  Owns
 *      the model badge / picker / connection state / error banner.
 *      Independent of the PTY pane's session by design — those are the
 *      pieces the sidebar needs to be able to drive directly (model
 *      switch via slash.exec, etc.).
 *
 *   2. **Event subscriber** (/api/events?channel=…) — passive, receives
 *      every dispatcher emit from the PTY-side `tui_gateway.entry` that
 *      the dashboard fanned out.  This is how `tool.start/progress/
 *      complete` from the agent loop reach the sidebar even though the
 *      PTY child runs three processes deep from us.  The `channel` id
 *      ties this listener to the same chat tab's PTY child — see
 *      `ChatPage.tsx` for where the id is generated.
 *
 * Best-effort throughout: WS failures show in the badge / banner, the
 * terminal pane keeps working unimpaired.
 */

import { Button } from "@nous-research/ui/ui/components/button";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectOption } from "@nous-research/ui/ui/components/select";

import { ModelPickerDialog } from "@/components/ModelPickerDialog";
import { ToolCall, type ToolEntry } from "@/components/ToolCall";
import { GatewayClient, type ConnectionState } from "@/lib/gatewayClient";
import { api } from "@/lib/api";
import type { ModelOptionProvider, ModelOptionsResponse } from "@/lib/api";

import { cn } from "@/lib/utils";
import { AlertCircle, ChevronDown, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface SessionInfo {
  cwd?: string;
  model?: string;
  provider?: string;
  credential_warning?: string;
}

interface RpcEnvelope {
  method?: string;
  params?: { type?: string; payload?: unknown };
}

const TOOL_LIMIT = 20;

const STATE_LABEL: Record<ConnectionState, string> = {
  idle: "idle",
  connecting: "connecting",
  open: "live",
  closed: "closed",
  error: "error",
};

const STATE_TONE: Record<
  ConnectionState,
  "secondary" | "warning" | "success" | "destructive"
> = {
  idle: "secondary",
  connecting: "warning",
  open: "success",
  closed: "secondary",
  error: "destructive",
};

interface ChatSidebarProps {
  channel: string;
  className?: string;
}

export function ChatSidebar({ channel, className }: ChatSidebarProps) {
  // `version` bumps on reconnect; gw is derived so we never call setState
  // for it inside an effect (React 19's set-state-in-effect rule). The
  // counter is the dependency on purpose — it's not read in the memo body,
  // it's the signal that says "rebuild the client".
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gw = useMemo(() => new GatewayClient(), [version]);

  const [state, setState] = useState<ConnectionState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [info, setInfo] = useState<SessionInfo>({});
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [providers, setProviders] = useState<ModelOptionProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("ollama");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [loadingModels, setLoadingModels] = useState<boolean>(false);

  const fetchModels = useCallback(async () => {
    if (state !== "open" || !sessionId) return null;
    setLoadingModels(true);
    try {
      const r = await gw.request<ModelOptionsResponse>("model.options", { session_id: sessionId });
      if (r?.providers) {
        setProviders(r.providers);
        return r.providers;
      }
    } catch (e) {
      console.error("Failed to load model options", e);
    } finally {
      setLoadingModels(false);
    }
    return null;
  }, [state, sessionId, gw]);

  useEffect(() => {
    if (state === "open" && sessionId) {
      void fetchModels();
    }
  }, [state, sessionId, fetchModels]);

  useEffect(() => {
    if (info.provider) {
      const p = info.provider === "google" || info.provider === "gemini" ? "gemini" : info.provider;
      setSelectedProvider(p);
    }
  }, [info.provider]);

  useEffect(() => {
    if (info.model) {
      setSelectedModel(info.model);
    }
  }, [info.model]);

  const activeProviderOptions = useMemo(() => {
    const p = providers.find((x) => x.slug === selectedProvider || (selectedProvider === "gemini" && x.slug === "google"));
    let list = p?.models ?? [];
    if (list.length === 0) {
      if (selectedProvider === "ollama") {
        list = ["llama3", "qwen2.5:7b", "qwen2.5-coder", "mistral", "phi3"];
      } else {
        list = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp", "gemini-1.0-pro"];
      }
    }
    if (info.model && !list.includes(info.model)) {
      const isOllamaModel = selectedProvider === "ollama" && !info.model.includes("gemini");
      const isGeminiModel = selectedProvider === "gemini" && (info.model.includes("gemini") || info.model.includes("google"));
      if (isOllamaModel || isGeminiModel) {
        list = [info.model, ...list];
      }
    }
    return list;
  }, [providers, selectedProvider, info.model]);

  const applyModelChange = useCallback(async (prov: string, modelName: string) => {
    if (!sessionId) return;
    try {
      setInfo((prev) => ({ ...prev, provider: prov, model: modelName }));
      await api.setModelAssignment({
        scope: "main",
        provider: prov,
        model: modelName,
      });
      await gw.request("slash.exec", {
        session_id: sessionId,
        command: `/model ${modelName} --provider ${prov} --global`,
      });
    } catch (e) {
      console.error("Failed to switch model:", e);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [gw, sessionId]);

  const handleProviderChange = useCallback(async (prov: string) => {
    setSelectedProvider(prov);
    setLoadingModels(true);
    let currentProviders = providers;
    if (state === "open" && sessionId) {
      try {
        const r = await gw.request<ModelOptionsResponse>("model.options", { session_id: sessionId });
        if (r?.providers) {
          setProviders(r.providers);
          currentProviders = r.providers;
        }
      } catch (e) {
        console.error("Failed to fetch model options on provider switch", e);
      } finally {
        setLoadingModels(false);
      }
    }

    const p = currentProviders.find((x) => x.slug === prov || (prov === "gemini" && x.slug === "google"));
    const modelsList = p?.models ?? [];
    let defaultModel = modelsList[0] || "";
    if (prov === "ollama" && !defaultModel) {
      defaultModel = "llama3";
    } else if (prov === "gemini" && !defaultModel) {
      defaultModel = "gemini-1.5-flash";
    }

    if (defaultModel) {
      setSelectedModel(defaultModel);
      await applyModelChange(prov, defaultModel);
    }
  }, [state, sessionId, gw, providers, applyModelChange]);

  const handleRefresh = useCallback(async () => {
    const updatedProviders = await fetchModels();
    if (updatedProviders) {
      const p = updatedProviders.find((x) => x.slug === selectedProvider || (selectedProvider === "gemini" && x.slug === "google"));
      const modelsList = p?.models ?? [];
      if (selectedModel && !modelsList.includes(selectedModel)) {
        let defaultModel = modelsList[0] || "";
        if (selectedProvider === "ollama" && !defaultModel) {
          defaultModel = "llama3";
        } else if (selectedProvider === "gemini" && !defaultModel) {
          defaultModel = "gemini-1.5-flash";
        }
        if (defaultModel) {
          setSelectedModel(defaultModel);
          await applyModelChange(selectedProvider, defaultModel);
        }
      }
    }
  }, [selectedProvider, selectedModel, fetchModels, applyModelChange]);

  useEffect(() => {
    let cancelled = false;
    const offState = gw.onState(setState);

    const offSessionInfo = gw.on<SessionInfo>("session.info", (ev) => {
      if (ev.session_id) {
        setSessionId(ev.session_id);
      }

      if (ev.payload) {
        setInfo((prev) => ({ ...prev, ...ev.payload }));
      }
    });

    const offError = gw.on<{ message?: string }>("error", (ev) => {
      const message = ev.payload?.message;

      if (message) {
        setError(message);
      }
    });

    // Adopt whichever session the gateway hands us. session.create on the
    // sidecar is independent of the PTY pane's session by design — we
    // only need a sid to drive the model picker's slash.exec calls.
    gw.connect()
      .then(() => {
        if (cancelled) {
          return;
        }
        return gw.request<{ session_id: string }>("session.create", {});
      })
      .then((created) => {
        if (cancelled || !created?.session_id) {
          return;
        }
        setSessionId(created.session_id);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
        }
      });

    return () => {
      cancelled = true;
      offState();
      offSessionInfo();
      offError();
      gw.close();
    };
  }, [gw]);

  // Event subscriber WebSocket — receives the rebroadcast of every
  // dispatcher emit from the PTY child's gateway.  See /api/pub +
  // /api/events in hermes_cli/web_server.py for the broadcast hop.
  //
  // Failures (auth/loopback rejection, server too old to expose the
  // endpoint, transient drops) surface in the same banner as the
  // JSON-RPC sidecar so the sidebar matches its documented best-effort
  // UX and the user always has a reconnect affordance.
  useEffect(() => {
    const token = window.__HERMES_SESSION_TOKEN__;

    if (!token || !channel) {
      return;
    }

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const qs = new URLSearchParams({ token, channel });
    const pubTok = window.__HERMES_PUBLIC_TOKEN__;
    if (pubTok) qs.set("pub", pubTok);
    const ws = new WebSocket(
      `${proto}//${window.location.host}/api/events?${qs.toString()}`,
    );

    // `unmounting` suppresses the banner during cleanup — `ws.close()`
    // from the effect's return fires a close event with code 1005 that
    // would otherwise look like an unexpected drop.
    const DISCONNECTED = "events feed disconnected — tool calls may not appear";
    let unmounting = false;
    const surface = (msg: string) => !unmounting && setError(msg);

    ws.addEventListener("error", () => surface(DISCONNECTED));

    ws.addEventListener("close", (ev) => {
      if (ev.code === 4401 || ev.code === 4403) {
        surface(`events feed rejected (${ev.code}) — reload the page`);
      } else if (ev.code !== 1000) {
        surface(DISCONNECTED);
      }
    });

    ws.addEventListener("message", (ev) => {
      let frame: RpcEnvelope;

      try {
        frame = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (frame.method !== "event" || !frame.params) {
        return;
      }

      const { type, payload } = frame.params;

      if (type === "tool.start") {
        const p = payload as
          | { tool_id?: string; name?: string; context?: string }
          | undefined;
        const toolId = p?.tool_id;

        if (!toolId) {
          return;
        }

        setTools((prev) =>
          [
            ...prev,
            {
              kind: "tool" as const,
              id: `tool-${toolId}-${prev.length}`,
              tool_id: toolId,
              name: p?.name ?? "tool",
              context: p?.context,
              status: "running" as const,
              startedAt: Date.now(),
            },
          ].slice(-TOOL_LIMIT),
        );
      } else if (type === "tool.progress") {
        const p = payload as
          | { name?: string; preview?: string }
          | undefined;

        if (!p?.name || !p.preview) {
          return;
        }

        setTools((prev) =>
          prev.map((t) =>
            t.status === "running" && t.name === p.name
              ? { ...t, preview: p.preview }
              : t,
          ),
        );
      } else if (type === "tool.complete") {
        const p = payload as
          | {
              tool_id?: string;
              summary?: string;
              error?: string;
              inline_diff?: string;
            }
          | undefined;

        if (!p?.tool_id) {
          return;
        }

        setTools((prev) =>
          prev.map((t) =>
            t.tool_id === p.tool_id
              ? {
                  ...t,
                  status: p.error ? "error" : "done",
                  summary: p.summary,
                  error: p.error,
                  inline_diff: p.inline_diff,
                  completedAt: Date.now(),
                }
              : t,
          ),
        );
      }
    });

    return () => {
      unmounting = true;
      ws.close();
    };
  }, [channel, version]);

  const reconnect = useCallback(() => {
    setError(null);
    setTools([]);
    setVersion((v) => v + 1);
  }, []);

  // Picker hands us a fully-formed slash command (e.g. "/model anthropic/...").
  // Fire-and-forget through `slash.exec`; the TUI pane will render the result
  // via PTY, so the sidebar doesn't need to surface output of its own.
  const onModelSubmit = useCallback(
    (slashCommand: string) => {
      if (!sessionId) {
        return;
      }

      void gw.request("slash.exec", {
        session_id: sessionId,
        command: slashCommand,
      });
      setModelOpen(false);
    },
    [gw, sessionId],
  );

  const canPickModel = state === "open" && !!sessionId;
  const modelLabel = (info.model ?? "—").split("/").slice(-1)[0] ?? "—";
  const banner = error ?? info.credential_warning ?? null;

  return (
    <aside
      className={cn(
        "flex h-full w-full min-w-0 shrink-0 flex-col gap-3 overflow-y-auto overflow-x-hidden pr-1 normal-case lg:w-80",
        className,
      )}
    >
      <Card className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            model
          </div>

          <Button
            ghost
            size="sm"
            disabled={!canPickModel}
            onClick={() => setModelOpen(true)}
            suffix={
              canPickModel ? (
                <ChevronDown className="opacity-60" />
              ) : undefined
            }
            className="self-start min-w-0 px-0 py-0 normal-case tracking-normal text-sm font-medium hover:underline disabled:no-underline"
            title={info.model ?? "switch model"}
          >
            <span className="truncate">{modelLabel}</span>
          </Button>
        </div>

        <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>
      </Card>

      <Card className="flex flex-col gap-2.5 px-3 py-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Quick Model Switcher
        </div>

        <div className="grid grid-cols-2 gap-1 rounded bg-muted/40 p-0.5 border border-border/30">
          <Button
            size="sm"
            type="button"
            outlined={selectedProvider !== "ollama"}
            onClick={() => handleProviderChange("ollama")}
            className="text-[10px] py-1 h-auto font-medium px-2"
          >
            Ollama (Local)
          </Button>
          <Button
            size="sm"
            type="button"
            outlined={selectedProvider !== "gemini"}
            onClick={() => handleProviderChange("gemini")}
            className="text-[10px] py-1 h-auto font-medium px-2"
          >
            Google Gemini
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              Select Model
              {loadingModels && (
                <RefreshCw className="h-2.5 w-2.5 animate-spin text-primary" />
              )}
            </label>
            <button
              type="button"
              disabled={loadingModels || state !== "open" || !sessionId}
              onClick={handleRefresh}
              className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="h-2.5 w-2.5" /> Refresh Models
            </button>
          </div>
          <Select
            value={selectedModel}
            onValueChange={(val) => {
              setSelectedModel(val);
              void applyModelChange(selectedProvider, val);
            }}
            className="w-full text-xs h-8"
          >
            {activeProviderOptions.map((m) => (
              <SelectOption key={m} value={m}>
                {m.includes("/") ? m.split("/").slice(-1)[0] : m}
              </SelectOption>
            ))}
          </Select>
        </div>
      </Card>

      {banner && (
        <Card role="alert" aria-live="assertive" className="flex items-start gap-2 border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />

          <div className="min-w-0 flex-1">
            <div className="wrap-break-word text-destructive">{banner}</div>

            {error && (
              <Button
                size="sm"
                outlined
                className="mt-1"
                onClick={reconnect}
                prefix={<RefreshCw />}
              >
                reconnect
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card className="flex min-h-0 flex-none flex-col px-2 py-2">
        <div className="px-1 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
          tools
        </div>

        <div className="flex min-h-0 flex-col gap-1.5">
          {tools.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              no tool calls yet
            </div>
          ) : (
            tools.map((t) => <ToolCall key={t.id} tool={t} />)
          )}
        </div>
      </Card>

      {modelOpen && canPickModel && sessionId && (
        <ModelPickerDialog
          gw={gw}
          sessionId={sessionId}
          onClose={() => setModelOpen(false)}
          onSubmit={onModelSubmit}
        />
      )}
    </aside>
  );
}
