import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Brain,
  ChevronDown,
  Cpu,
  DollarSign,
  Eye,
  RefreshCw,
  Settings2,
  Star,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  AuxiliaryModelsResponse,
  AuxiliaryTaskAssignment,
  ModelsAnalyticsModelEntry,
  ModelsAnalyticsResponse,
  ModelOptionProvider,
} from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { formatTokenCount } from "@/lib/format";
import { Button } from "@nous-research/ui/ui/components/button";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { Stats } from "@nous-research/ui/ui/components/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useI18n } from "@/i18n";
import { PluginSlot } from "@/plugins";
import { ModelPickerDialog } from "@/components/ModelPickerDialog";
import { Select, SelectOption } from "@nous-research/ui/ui/components/select";

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

// Must match _AUX_TASK_SLOTS in hermes_cli/web_server.py.
const AUX_TASKS: readonly { key: string; label: string; hint: string }[] = [
  { key: "vision", label: "Vision", hint: "Image analysis" },
  { key: "web_extract", label: "Web Extract", hint: "Page summarization" },
  { key: "compression", label: "Compression", hint: "Context compaction" },
  { key: "session_search", label: "Session Search", hint: "Recall queries" },
  { key: "skills_hub", label: "Skills Hub", hint: "Skill search" },
  { key: "approval", label: "Approval", hint: "Smart auto-approve" },
  { key: "mcp", label: "MCP", hint: "MCP tool routing" },
  { key: "title_generation", label: "Title Gen", hint: "Session titles" },
  { key: "curator", label: "Curator", hint: "Skill-usage review" },
] as const;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  if (n > 0) return `$${n.toFixed(4)}`;
  return "$0";
}

/** Short model name: strip vendor prefix like "openrouter/" or "anthropic/". */
function shortModelName(model: string): string {
  const slashIdx = model.indexOf("/");
  if (slashIdx > 0) return model.slice(slashIdx + 1);
  return model;
}

/** Extract vendor prefix from a model string like "anthropic/claude-opus-4.7" → "anthropic". */
function modelVendor(model: string, fallback?: string): string {
  const slashIdx = model.indexOf("/");
  if (slashIdx > 0) return model.slice(0, slashIdx);
  return fallback || "";
}

function TokenBar({
  input,
  output,
  cacheRead,
  reasoning,
}: {
  input: number;
  output: number;
  cacheRead: number;
  reasoning: number;
}) {
  const total = input + output + cacheRead + reasoning;
  if (total === 0) return null;

  const segments = [
    { value: cacheRead, color: "bg-blue-400/60", dotColor: "bg-blue-400", label: "Cache Read" },
    { value: reasoning, color: "bg-purple-400/60", dotColor: "bg-purple-400", label: "Reasoning" },
    { value: input, color: "bg-[#ffe6cb]/70", dotColor: "bg-[#ffe6cb]", label: "Input" },
    { value: output, color: "bg-emerald-500/70", dotColor: "bg-emerald-500", label: "Output" },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-1.5">
      {/* Stacked bar — segments fill proportionally to their share of total */}
      <div className="relative flex min-h-[1.5rem] w-full items-stretch overflow-hidden">
        {segments.map((s, i) => (
          <div
            key={i}
            className={`${s.color} relative flex items-center transition-all duration-300`}
            style={{ width: `${(s.value / total) * 100}%` }}
          >
            {/* Stepped fill pattern overlay */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, transparent 0 0.4rem, currentColor 0.4rem calc(0.4rem + 1px))",
              }}
            />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        {segments.map((s, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dotColor}`} />
            {s.label} {formatTokens(s.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function CapabilityBadges({
  capabilities,
}: {
  capabilities: ModelsAnalyticsModelEntry["capabilities"];
}) {
  const hasAny =
    capabilities.supports_tools ||
    capabilities.supports_vision ||
    capabilities.supports_reasoning ||
    capabilities.model_family;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Model capabilities">
      {capabilities.supports_tools && (
        <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
          <Wrench className="h-2.5 w-2.5" aria-hidden="true" /> Tools
        </span>
      )}
      {capabilities.supports_vision && (
        <span className="inline-flex items-center gap-1 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
          <Eye className="h-2.5 w-2.5" aria-hidden="true" /> Vision
        </span>
      )}
      {capabilities.supports_reasoning && (
        <span className="inline-flex items-center gap-1 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
          <Brain className="h-2.5 w-2.5" aria-hidden="true" /> Reasoning
        </span>
      )}
      {capabilities.model_family && (
        <span className="inline-flex items-center bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {capabilities.model_family}
        </span>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Per-card "Use as" menu                                              */
/* ──────────────────────────────────────────────────────────────────── */

function UseAsMenu({
  provider,
  model,
  isMain,
  mainAuxTask,
  onAssigned,
}: {
  provider: string;
  model: string;
  /** True when this card's model+provider match config.yaml's main slot. */
  isMain: boolean;
  /** If this model is assigned to a specific aux task, that task's key. */
  mainAuxTask: string | null;
  onAssigned(): void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assign = async (
    scope: "main" | "auxiliary",
    task: string,
  ) => {
    if (!provider || !model) {
      setError("Missing provider/model");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.setModelAssignment({ scope, provider, model, task });
      onAssigned();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest?.("[data-use-as-menu]")) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" data-use-as-menu>
      <Button
        size="sm"
        outlined
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-label={`Use ${shortModelName(model)} as...`}
        aria-haspopup="true"
        aria-expanded={open}
        className="text-[10px] h-6 px-2"
        prefix={busy ? <Spinner /> : null}
      >
        Use as <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </Button>
      {open && (
        <div 
          role="menu"
          aria-label={`Use ${shortModelName(model)} as options`}
          className="absolute right-0 top-full mt-1 z-50 min-w-[220px] border border-border bg-card shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => assign("main", "")}
            disabled={busy}
            className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-muted/50 disabled:opacity-40"
          >
            <span className="flex items-center gap-2">
              <Star className="h-3 w-3" aria-hidden="true" />
              Main model
            </span>
            {isMain && (
              <span className="text-[9px] uppercase tracking-wider text-primary/80">
                current
              </span>
            )}
          </button>

          <div className="border-t border-border/50 px-3 py-1.5 text-[9px] uppercase tracking-wider text-muted-foreground" role="presentation">
            Auxiliary task
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => assign("auxiliary", "")}
            disabled={busy}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50 disabled:opacity-40"
          >
            <span>All auxiliary tasks</span>
          </button>

          {AUX_TASKS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="menuitem"
              onClick={() => assign("auxiliary", t.key)}
              disabled={busy}
              className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50 disabled:opacity-40"
            >
              <span>{t.label}</span>
              {mainAuxTask === t.key && (
                <span className="text-[9px] uppercase tracking-wider text-primary/80">
                  current
                </span>
              )}
            </button>
          ))}

          {error && (
            <div role="alert" aria-live="assertive" className="px-3 py-2 text-[10px] text-destructive border-t border-border/50">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  ModelCard                                                           */
/* ──────────────────────────────────────────────────────────────────── */

function ModelCard({
  entry,
  rank,
  main,
  aux,
  onAssigned,
  showTokens,
}: {
  entry: ModelsAnalyticsModelEntry;
  rank: number;
  main: { provider: string; model: string } | null;
  aux: AuxiliaryTaskAssignment[];
  onAssigned(): void;
  showTokens: boolean;
}) {
  const { t } = useI18n();
  const provider = entry.provider || modelVendor(entry.model);
  const totalTokens = entry.input_tokens + entry.output_tokens;
  const caps = entry.capabilities;

  const isMain =
    !!main &&
    main.provider === provider &&
    main.model === entry.model;

  // First aux task currently using this model (if any).
  const mainAuxTask =
    aux.find(
      (a) => a.provider === provider && a.model === entry.model,
    )?.task ?? null;

  return (
    <Card className={isMain ? "ring-1 ring-primary/40" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground/50 text-xs font-mono">
                #{rank}
              </span>
              <CardTitle className="text-sm font-mono-ui truncate">
                {shortModelName(entry.model)}
              </CardTitle>
              {isMain && (
                <span 
                  aria-label="Main Model"
                  className="inline-flex items-center gap-0.5 bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary"
                >
                  <Star className="h-2.5 w-2.5" aria-hidden="true" /> main
                </span>
              )}
              {mainAuxTask && (
                <span 
                  aria-label={`Auxiliary task model for ${mainAuxTask}`}
                  className="inline-flex items-center bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-purple-600 dark:text-purple-400"
                >
                  aux · {mainAuxTask}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {provider && (
                <Badge tone="secondary" className="text-[9px]">
                  {provider}
                </Badge>
              )}
              {caps.context_window && caps.context_window > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {formatTokenCount(caps.context_window)} ctx
                </span>
              )}
              {caps.max_output_tokens && caps.max_output_tokens > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {formatTokenCount(caps.max_output_tokens)} out
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {showTokens ? (
              <div className="text-right">
                <div className="text-xs font-mono font-semibold">
                  {formatTokens(totalTokens)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t.models.tokens}
                </div>
              </div>
            ) : (
              entry.sessions > 0 && (
                <div className="text-right">
                  <div className="text-xs font-mono font-semibold">
                    {entry.sessions}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {t.models.sessions}
                  </div>
                </div>
              )
            )}
            <UseAsMenu
              provider={provider}
              model={entry.model}
              isMain={isMain}
              mainAuxTask={mainAuxTask}
              onAssigned={onAssigned}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        {showTokens && (
          <>
            <TokenBar
              input={entry.input_tokens}
              output={entry.output_tokens}
              cacheRead={entry.cache_read_tokens}
              reasoning={entry.reasoning_tokens}
            />

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="font-mono font-semibold">{entry.sessions}</div>
                <div className="text-[10px] text-muted-foreground">
                  {t.models.sessions}
                </div>
              </div>
              <div className="text-center">
                <div className="font-mono font-semibold">
                  {formatTokens(entry.avg_tokens_per_session)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t.models.avgPerSession}
                </div>
              </div>
              <div className="text-center">
                <div className="font-mono font-semibold">
                  {entry.api_calls > 0 ? formatTokens(entry.api_calls) : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t.models.apiCalls}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30 pt-2">
          <div className="flex items-center gap-3">
            {showTokens && entry.estimated_cost > 0 && (
              <span className="flex items-center gap-0.5">
                <DollarSign className="h-2.5 w-2.5" />
                {formatCost(entry.estimated_cost)}
              </span>
            )}
            {showTokens && entry.tool_calls > 0 && (
              <span className="flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5" />
                {entry.tool_calls} {t.models.toolCalls}
              </span>
            )}
          </div>
          {entry.last_used_at > 0 && (
            <span>{timeAgo(entry.last_used_at)}</span>
          )}
        </div>

        <CapabilityBadges capabilities={entry.capabilities} />
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Model Settings panel (top of page)                                  */
/* ──────────────────────────────────────────────────────────────────── */

type PickerTarget =
  | { kind: "main" }
  | { kind: "aux"; task: string };

function AuxiliaryTasksModal({
  aux,
  refreshKey,
  onSaved,
  onClose,
}: {
  aux: AuxiliaryModelsResponse | null;
  refreshKey: number;
  onSaved(): void;
  onClose(): void;
}) {
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const modalRef = useModalBehavior({ open: true, onClose });

  const resetAllAux = async () => {
    setConfirmReset(false);
    setResetBusy(true);
    try {
      await api.setModelAssignment({
        scope: "auxiliary",
        task: "__reset__",
        provider: "",
        model: "",
      });
      onSaved();
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="aux-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[80vh] border border-border bg-card shadow-2xl flex flex-col">
        <Button
          ghost
          size="icon"
          onClick={onClose}
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X aria-hidden="true" />
        </Button>

        <header className="p-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-3 pr-8">
            <h2
              id="aux-modal-title"
              className="font-display text-base tracking-wider uppercase"
            >
              Auxiliary Tasks
            </h2>
            <Button
              size="sm"
              outlined
              onClick={() => setConfirmReset(true)}
              disabled={resetBusy}
              className="text-[10px] h-6"
              prefix={resetBusy ? <Spinner /> : null}
              aria-label="Reset all auxiliary tasks to auto"
            >
              Reset all to auto
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/80 mt-2">
            Auxiliary tasks handle side-jobs like vision, session search, and
            compression. <span className="font-mono">auto</span> means
            &quot;use the main model&quot;. Override per-task when you want a
            cheap/fast model for a specific job.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-1">
          {AUX_TASKS.map((t) => {
            const cur = aux?.tasks.find((a) => a.task === t.key);
            const isAuto =
              !cur || cur.provider === "auto" || !cur.provider;
            return (
              <div
                key={t.key}
                className="flex items-center justify-between gap-3 px-3 py-2 border border-border/30 bg-card/50 hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {t.hint}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">
                    {isAuto
                      ? "auto (use main model)"
                      : `${cur?.provider} · ${cur?.model || "(provider default)"}`}
                  </div>
                </div>
                <Button
                  size="sm"
                  outlined
                  onClick={() => setPicker({ kind: "aux", task: t.key })}
                  className="text-[10px] h-6"
                  aria-label={`Change auxiliary model for ${t.label}`}
                >
                  Change
                </Button>
              </div>
            );
          })}
        </div>

        {picker && picker.kind === "aux" && (
          <ModelPickerDialog
            key={`picker-${refreshKey}`}
            loader={api.getModelOptions}
            alwaysGlobal
            title={`Set Auxiliary: ${
              AUX_TASKS.find((t) => t.key === picker.task)?.label ??
              picker.task
            }`}
            onApply={async ({ provider, model }) => {
              await api.setModelAssignment({
                scope: "auxiliary",
                task: picker.task,
                provider,
                model,
              });
              onSaved();
            }}
            onClose={() => setPicker(null)}
          />
        )}
        <ConfirmDialog
          open={confirmReset}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => void resetAllAux()}
          title="Reset auxiliary models"
          description="Reset every auxiliary task to 'auto'? This overrides any per-task overrides you've set."
          destructive
          confirmLabel="Reset all"
          loading={resetBusy}
        />
      </div>
    </div>
  );
}

function ModelSettingsPanel({
  aux,
  refreshKey,
  onSaved,
}: {
  aux: AuxiliaryModelsResponse | null;
  refreshKey: number;
  onSaved(): void;
}) {
  const [auxModalOpen, setAuxModalOpen] = useState(false);
  const [picker, setPicker] = useState<PickerTarget | null>(null);

  const mainProv = aux?.main.provider ?? "";
  const mainModel = aux?.main.model ?? "";

  const [providers, setProviders] = useState<ModelOptionProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("ollama");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [srAnnouncement, setSrAnnouncement] = useState<string>("");

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const r = await api.getModelOptions();
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
  }, []);

  useEffect(() => {
    void fetchModels();
  }, [refreshKey, fetchModels]);

  useEffect(() => {
    if (mainProv) {
      const p = mainProv === "google" || mainProv === "gemini" ? "gemini" : mainProv;
      setSelectedProvider(p);
    }
  }, [mainProv]);

  useEffect(() => {
    if (mainModel) {
      setSelectedModel(mainModel);
    }
  }, [mainModel]);

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
    if (mainModel && !list.includes(mainModel)) {
      const isOllamaModel = selectedProvider === "ollama" && !mainModel.includes("gemini");
      const isGeminiModel = selectedProvider === "gemini" && (mainModel.includes("gemini") || mainModel.includes("google"));
      if (isOllamaModel || isGeminiModel) {
        list = [mainModel, ...list];
      }
    }
    return list;
  }, [providers, selectedProvider, mainModel]);

  const applyModelChange = useCallback(async (prov: string, modelName: string) => {
    try {
      setError(null);
      await api.setModelAssignment({
        scope: "main",
        provider: prov,
        model: modelName,
      });
      onSaved();
      setSrAnnouncement(`Main model successfully updated to ${modelName} (${prov}).`);
    } catch (e) {
      console.error("Failed to switch model:", e);
      const errMsg = e instanceof Error ? e.message : String(e);
      setError(errMsg);
      setSrAnnouncement(`Error switching model: ${errMsg}`);
    }
  }, [onSaved]);

  const handleProviderChange = useCallback(async (prov: string) => {
    setSelectedProvider(prov);
    setLoadingModels(true);
    setSrAnnouncement(`Switching LLM provider to ${prov === "ollama" ? "Ollama (Local)" : "Google Gemini"} and loading models...`);
    let currentProviders = providers;
    try {
      const r = await api.getModelOptions();
      if (r?.providers) {
        setProviders(r.providers);
        currentProviders = r.providers;
      }
    } catch (e) {
      console.error("Failed to fetch model options on provider switch", e);
      setSrAnnouncement(`Failed to load models for ${prov === "ollama" ? "Ollama" : "Gemini"}`);
    } finally {
      setLoadingModels(false);
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
      setSrAnnouncement((prev) => `${prev} Default model ${defaultModel} selected.`);
      await applyModelChange(prov, defaultModel);
    } else {
      setSrAnnouncement("No models found for this provider.");
    }
  }, [providers, applyModelChange]);

  const handleRefresh = useCallback(async () => {
    setSrAnnouncement("Refreshing models list...");
    const updatedProviders = await fetchModels();
    if (updatedProviders) {
      setSrAnnouncement("Models list refreshed successfully.");
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
          setSrAnnouncement((prev) => `${prev} Model ${selectedModel} is not available anymore. Switched to ${defaultModel}.`);
          await applyModelChange(selectedProvider, defaultModel);
        }
      }
    } else {
      setSrAnnouncement("Failed to refresh models list.");
    }
  }, [selectedProvider, selectedModel, fetchModels, applyModelChange]);

  const applyAssignment = async ({
    scope,
    task,
    provider,
    model,
  }: {
    scope: "main" | "auxiliary";
    task: string;
    provider: string;
    model: string;
  }) => {
    await api.setModelAssignment({ scope, task, provider, model });
    onSaved();
  };

  // Count how many aux tasks have overrides
  const auxOverrideCount = aux?.tasks.filter(
    (a) => a.provider && a.provider !== "auto",
  ).length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <CardTitle className="text-sm">Model Settings</CardTitle>
            <span className="text-[10px] text-muted-foreground">
              applies to new sessions
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-3">
        {/* Quick model selector right on the page */}
        <div className="flex flex-col gap-2.5 bg-muted/20 border border-border/50 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider">
              Quick Switch Main Model
            </span>
          </div>

          <div 
            className="grid grid-cols-2 gap-1 rounded bg-muted/40 p-0.5 border border-border/30"
            role="radiogroup"
            aria-label="Select LLM Provider"
          >
            <Button
              size="sm"
              type="button"
              role="radio"
              aria-checked={selectedProvider === "ollama"}
              outlined={selectedProvider !== "ollama"}
              onClick={() => handleProviderChange("ollama")}
              className="text-[10px] py-1 h-auto font-medium px-2"
            >
              Ollama (Local)
            </Button>
            <Button
              size="sm"
              type="button"
              role="radio"
              aria-checked={selectedProvider === "gemini"}
              outlined={selectedProvider !== "gemini"}
              onClick={() => handleProviderChange("gemini")}
              className="text-[10px] py-1 h-auto font-medium px-2"
            >
              Google Gemini
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label 
                id="quick-switch-model-select-label"
                className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"
              >
                Select Model
                {loadingModels && (
                  <RefreshCw className="h-2.5 w-2.5 animate-spin text-primary" aria-hidden="true" />
                )}
              </label>
              <button
                type="button"
                disabled={loadingModels}
                onClick={handleRefresh}
                className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors disabled:opacity-50"
                aria-label="Refresh Models"
              >
                <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" /> Refresh Models
              </button>
            </div>
            <div
              ref={(el) => {
                if (el) {
                  const btn = el.querySelector('button[role="combobox"]');
                  if (btn) {
                    btn.setAttribute('aria-labelledby', 'quick-switch-model-select-label');
                  }
                }
              }}
            >
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
          </div>

          {error && (
            <div role="alert" aria-live="assertive" className="text-[10px] text-destructive mt-1">
              {error}
            </div>
          )}

          <div className="sr-only" role="status" aria-live="polite">
            {srAnnouncement}
          </div>
        </div>

        {/* Main row */}
        <div className="flex items-center justify-between gap-3 bg-muted/20 border border-border/50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <Star className="h-3 w-3 text-primary" aria-hidden="true" />
              <span className="text-xs font-medium uppercase tracking-wider">
                Main model (Advanced)
              </span>
            </div>
            <div className="text-xs font-mono text-muted-foreground truncate">
              {mainProv || "(unset)"}
              {mainProv && mainModel && " · "}
              {mainModel || "(unset)"}
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setPicker({ kind: "main" })}
            className="text-xs"
            aria-label={`Change Main Model (currently ${mainProv || "unset"} · ${mainModel || "unset"})`}
          >
            Change
          </Button>
        </div>

        {/* Auxiliary tasks summary + open modal */}
        <div className="flex items-center justify-between gap-3 bg-muted/20 border border-border/50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <Cpu className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-medium uppercase tracking-wider">
                Auxiliary tasks
              </span>
            </div>
            <div className="text-xs font-mono text-muted-foreground truncate">
              {auxOverrideCount > 0
                ? `${auxOverrideCount} override${auxOverrideCount > 1 ? "s" : ""} · ${AUX_TASKS.length - auxOverrideCount} auto`
                : `${AUX_TASKS.length} tasks · all auto`}
            </div>
          </div>
          <Button
            size="sm"
            outlined
            onClick={() => setAuxModalOpen(true)}
            className="text-xs"
            aria-label={`Configure Auxiliary Tasks (currently ${auxOverrideCount} overrides)`}
          >
            Configure
          </Button>
        </div>

        {picker && (
          <ModelPickerDialog
            key={`picker-${refreshKey}`}
            loader={api.getModelOptions}
            alwaysGlobal
            title="Set Main Model"
            onApply={async ({ provider, model }) => {
              await applyAssignment({
                scope: "main",
                task: "",
                provider,
                model,
              });
            }}
            onClose={() => setPicker(null)}
          />
        )}

        {auxModalOpen && (
          <AuxiliaryTasksModal
            aux={aux}
            refreshKey={refreshKey}
            onSaved={onSaved}
            onClose={() => setAuxModalOpen(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Page                                                                */
/* ──────────────────────────────────────────────────────────────────── */

export default function ModelsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ModelsAnalyticsResponse | null>(null);
  const [aux, setAux] = useState<AuxiliaryModelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveKey, setSaveKey] = useState(0);
  // Gate the token/cost UI on `dashboard.show_token_analytics`.  See
  // hermes_cli/config.py for the rationale: the numbers exclude auxiliary
  // calls and retries, so they're misleading next to provider billing.
  const [showTokens, setShowTokens] = useState(false);
  const { t } = useI18n();
  const { setAfterTitle, setEnd } = usePageHeader();

  useEffect(() => {
    api
      .getConfig()
      .then((cfg) => {
        const dash = (cfg?.dashboard ?? {}) as { show_token_analytics?: unknown };
        setShowTokens(dash.show_token_analytics === true);
      })
      .catch(() => {
        // Default to hidden on any failure — safer than showing wrong numbers.
        setShowTokens(false);
      });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getModelsAnalytics(days),
      api.getAuxiliaryModels().catch(() => null),
    ])
      .then(([models, auxData]) => {
        setData(models);
        setAux(auxData);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [days]);

  const onAssigned = useCallback(() => {
    // Reload aux state after any assignment change.
    api
      .getAuxiliaryModels()
      .then(setAux)
      .catch(() => {});
    setSaveKey((k) => k + 1);
  }, []);

  useLayoutEffect(() => {
    const periodLabel =
      PERIODS.find((p) => p.days === days)?.label ?? `${days}d`;
    setAfterTitle(
      <span className="flex items-center gap-2">
        {loading && <Spinner className="shrink-0 text-base text-primary" />}
        <Badge tone="secondary" className="text-[10px]">
          {periodLabel}
        </Badge>
      </span>,
    );
    setEnd(
      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              outlined={days !== p.days}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          outlined
          onClick={load}
          disabled={loading}
          prefix={loading ? <Spinner /> : <RefreshCw />}
        >
          {t.common.refresh}
        </Button>
      </div>,
    );
    return () => {
      setAfterTitle(null);
      setEnd(null);
    };
  }, [days, loading, load, setAfterTitle, setEnd, t.common.refresh]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PluginSlot name="models:top" />

      <div className="grid gap-6 lg:grid-cols-2">
        <ModelSettingsPanel
          aux={aux}
          refreshKey={saveKey}
          onSaved={onAssigned}
        />

        {data && (
          <Card>
            <CardContent className="py-6">
              <Stats
                items={
                  showTokens
                    ? [
                        {
                          label: t.models.modelsUsed,
                          value: String(data.totals.distinct_models),
                        },
                        {
                          label: t.analytics.totalTokens,
                          value: formatTokens(
                            data.totals.total_input + data.totals.total_output,
                          ),
                        },
                        {
                          label: t.analytics.input,
                          value: formatTokens(data.totals.total_input),
                        },
                        {
                          label: t.analytics.output,
                          value: formatTokens(data.totals.total_output),
                        },
                        {
                          label: t.models.estimatedCost,
                          value: formatCost(data.totals.total_estimated_cost),
                        },
                        {
                          label: t.analytics.totalSessions,
                          value: String(data.totals.total_sessions),
                        },
                      ]
                    : [
                        {
                          label: t.models.modelsUsed,
                          value: String(data.totals.distinct_models),
                        },
                        {
                          label: t.analytics.totalSessions,
                          value: String(data.totals.total_sessions),
                        },
                      ]
                }
              />
              {!showTokens && (
                <p className="mt-4 text-[10px] text-muted-foreground/70 leading-relaxed">
                  Token & cost analytics are hidden because the local counts
                  exclude auxiliary calls (compression, vision, web extract,
                  …) and provider retries, so they diverge from your provider
                  bill. Enable{" "}
                  <span className="font-mono">dashboard.show_token_analytics</span>{" "}
                  in <a href="/config" className="underline">Config</a> to
                  show the local debug estimate anyway.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-24">
          <Spinner className="text-2xl text-primary" />
        </div>
      )}

      {error && (
        <Card role="alert" aria-live="assertive">
          <CardContent className="py-6">
            <p className="text-sm text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {data.models.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.models.map((m, i) => (
                <ModelCard
                  key={`${m.model}:${m.provider}`}
                  entry={m}
                  rank={i + 1}
                  main={aux?.main ?? null}
                  aux={aux?.tasks ?? []}
                  onAssigned={onAssigned}
                  showTokens={showTokens}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-muted-foreground">
                  <Cpu className="h-8 w-8 mb-3 opacity-40" />
                  <p className="text-sm font-medium">{t.models.noModelsData}</p>
                  <p className="text-xs mt-1 text-muted-foreground/60">
                    {t.models.startSession}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <PluginSlot name="models:bottom" />
    </div>
  );
}
