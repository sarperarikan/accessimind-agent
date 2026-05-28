import { Button } from "@nous-research/ui/ui/components/button";
import { ListItem } from "@nous-research/ui/ui/components/list-item";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { Input } from "@/components/ui/input";
import type { GatewayClient } from "@/lib/gatewayClient";
import { Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Two-stage model picker modal.
 *
 * Mirrors ui-tui/src/components/modelPicker.tsx:
 *   Stage 1: pick provider (authenticated providers only)
 *   Stage 2: pick model within that provider
 *
 * Two invocation modes:
 *
 * 1. Chat-session mode (ChatSidebar) — pass `gw` + `sessionId`. The picker
 *    loads options via `model.options` JSON-RPC and emits the result as a
 *    slash command string (`/model <model> --provider <slug> [--global]`)
 *    through `onSubmit`, which the ChatPage pipes to `slashExec`.
 *
 * 2. Standalone mode (ModelsPage, Config settings) — pass a `loader` and
 *    `onApply`. The picker fetches options via the REST endpoint and calls
 *    `onApply(provider, model, persistGlobal)` instead of emitting a slash
 *    command.  This lets the Models page reuse the same UI without
 *    requiring an open chat PTY.
 */

interface ModelOptionProvider {
  name: string;
  slug: string;
  models?: string[];
  total_models?: number;
  is_current?: boolean;
  warning?: string;
}

interface ModelOptionsResponse {
  model?: string;
  provider?: string;
  providers?: ModelOptionProvider[];
}

interface Props {
  /** Chat-mode: when present, picker emits a slash command via onSubmit. */
  gw?: GatewayClient;
  sessionId?: string;
  onSubmit?(slashCommand: string): void;

  /** Standalone-mode: when present (and onSubmit absent), picker calls onApply. */
  loader?(): Promise<ModelOptionsResponse>;
  onApply?(args: {
    provider: string;
    model: string;
    persistGlobal: boolean;
  }): Promise<void> | void;

  onClose(): void;
  title?: string;
  /** If true, hides "Persist globally" checkbox — always saves to config.yaml. */
  alwaysGlobal?: boolean;
}

export function ModelPickerDialog(props: Props) {
  const {
    gw,
    sessionId,
    onSubmit,
    loader,
    onApply,
    onClose,
    title = "Switch Model",
    alwaysGlobal = false,
  } = props;
  const standalone = !!loader && !!onApply;

  const [providers, setProviders] = useState<ModelOptionProvider[]>([]);
  const [currentModel, setCurrentModel] = useState("");
  const [currentProviderSlug, setCurrentProviderSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [query, setQuery] = useState("");
  const [persistGlobal, setPersistGlobal] = useState(alwaysGlobal);
  const [applying, setApplying] = useState(false);
  const closedRef = useRef(false);

  // WCAG 2.2 states for Roving tabIndex
  const [focusedProviderSlug, setFocusedProviderSlug] = useState("");
  const [focusedModelName, setFocusedModelName] = useState("");

  const previousFocusRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Focus restoration & store previous focus on mount
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    return () => {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // Load providers + models on open.
  useEffect(() => {
    closedRef.current = false;

    const promise = standalone
      ? (loader as () => Promise<ModelOptionsResponse>)()
      : (gw as GatewayClient).request<ModelOptionsResponse>(
          "model.options",
          sessionId ? { session_id: sessionId } : {},
        );

    promise
      .then((r) => {
        if (closedRef.current) return;
        const next = r?.providers ?? [];
        setProviders(next);
        setCurrentModel(String(r?.model ?? ""));
        setCurrentProviderSlug(String(r?.provider ?? ""));
        const initialSlug = (next.find((p) => p.is_current) ?? next[0])?.slug ?? "";
        setSelectedSlug(initialSlug);
        setFocusedProviderSlug(initialSlug);
        setSelectedModel("");
        setLoading(false);
      })
      .catch((e) => {
        if (closedRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });

    return () => {
      closedRef.current = true;
    };
    // Deliberately omit props from deps — stable for the dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.slug === selectedSlug) ?? null,
    [providers, selectedSlug],
  );

  const models = useMemo(
    () => selectedProvider?.models ?? [],
    [selectedProvider],
  );

  // Synchronize focusedProviderSlug when selectedSlug changes
  useEffect(() => {
    if (selectedSlug) {
      setFocusedProviderSlug(selectedSlug);
    }
  }, [selectedSlug]);

  // Synchronize focusedModelName when models list changes
  useEffect(() => {
    if (models.length > 0) {
      setFocusedModelName(selectedModel || models[0]);
    } else {
      setFocusedModelName("");
    }
  }, [models, selectedModel]);

  // Escape closes, Tab/Shift+Tab trapping
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (!containerRef.current) return;
        const focusableSelector =
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]:not([disabled])';
        const focusables = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(focusableSelector)
        ).filter((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== "none" && style.visibility !== "hidden";
        });

        if (focusables.length === 0) return;

        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const needle = query.trim().toLowerCase();

  const filteredProviders = useMemo(
    () =>
      !needle
        ? providers
        : providers.filter(
            (p) =>
              p.name.toLowerCase().includes(needle) ||
              p.slug.toLowerCase().includes(needle) ||
              (p.models ?? []).some((m) => m.toLowerCase().includes(needle)),
          ),
    [providers, needle],
  );

  const filteredModels = useMemo(
    () =>
      !needle ? models : models.filter((m) => m.toLowerCase().includes(needle)),
    [models, needle],
  );

  const canConfirm = !!selectedProvider && !!selectedModel && !applying;

  const confirm = async () => {
    if (!canConfirm || !selectedProvider) return;
    if (standalone && onApply) {
      setApplying(true);
      try {
        await onApply({
          provider: selectedProvider.slug,
          model: selectedModel,
          persistGlobal,
        });
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setApplying(false);
      }
    } else if (onSubmit) {
      const global = persistGlobal ? " --global" : "";
      onSubmit(
        `/model ${selectedModel} --provider ${selectedProvider.slug}${global}`,
      );
      onClose();
    }
  };

  // Keyboard navigation handlers
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const slug = focusedProviderSlug || filteredProviders[0]?.slug;
      if (slug) {
        setFocusedProviderSlug(slug);
        requestAnimationFrame(() => {
          const el = document.getElementById(`provider-opt-${slug}`);
          if (el) el.focus();
        });
      }
    }
  };

  const handleProviderKeyDown = (e: React.KeyboardEvent, slug: string) => {
    const idx = filteredProviders.findIndex((p) => p.slug === slug);
    if (idx === -1) return;

    let nextIdx = idx;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      nextIdx = (idx + 1) % filteredProviders.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nextIdx = (idx - 1 + filteredProviders.length) % filteredProviders.length;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedSlug(slug);
      setSelectedModel("");
      return;
    } else {
      return;
    }

    const nextSlug = filteredProviders[nextIdx].slug;
    setFocusedProviderSlug(nextSlug);
    requestAnimationFrame(() => {
      const el = document.getElementById(`provider-opt-${nextSlug}`);
      if (el) el.focus();
    });
  };

  const handleModelKeyDown = (e: React.KeyboardEvent, model: string) => {
    const idx = filteredModels.findIndex((m) => m === model);
    if (idx === -1) return;

    let nextIdx = idx;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      nextIdx = (idx + 1) % filteredModels.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nextIdx = (idx - 1 + filteredModels.length) % filteredModels.length;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedModel(model);
      if (e.key === "Enter") {
        setSelectedModel(model);
        window.setTimeout(confirm, 0);
      }
      return;
    } else {
      return;
    }

    const nextModel = filteredModels[nextIdx];
    setFocusedModelName(nextModel);
    requestAnimationFrame(() => {
      const el = document.getElementById(`model-opt-${nextModel}`);
      if (el) el.focus();
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-picker-title"
    >
      <div 
        ref={containerRef}
        className="relative w-full max-w-3xl max-h-[80vh] border border-border bg-card shadow-2xl flex flex-col"
      >
        <Button
          ghost
          size="icon"
          onClick={onClose}
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          aria-label="Close dialog"
        >
          <X />
        </Button>

        <header className="p-5 pb-3 border-b border-border">
          <h2
            id="model-picker-title"
            className="font-display text-base tracking-wider uppercase"
          >
            {title}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            current: {currentModel || "(unknown)"}
            {currentProviderSlug && ` · ${currentProviderSlug}`}
          </p>
        </header>

        <div className="px-5 pt-3 pb-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Filter providers and models…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              aria-label="Filter providers and models"
              className="pl-7 h-8 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[200px_1fr] overflow-hidden">
          <ProviderColumn
            loading={loading}
            error={error}
            providers={filteredProviders}
            total={providers.length}
            selectedSlug={selectedSlug}
            query={needle}
            onSelect={(slug) => {
              setSelectedSlug(slug);
              setSelectedModel("");
            }}
            focusedProviderSlug={focusedProviderSlug}
            setFocusedProviderSlug={setFocusedProviderSlug}
            onKeyDown={handleProviderKeyDown}
          />

          <ModelColumn
            provider={selectedProvider}
            models={filteredModels}
            allModels={models}
            selectedModel={selectedModel}
            currentModel={currentModel}
            currentProviderSlug={currentProviderSlug}
            onSelect={setSelectedModel}
            onConfirm={(m) => {
              setSelectedModel(m);
              window.setTimeout(confirm, 0);
            }}
            focusedModelName={focusedModelName}
            setFocusedModelName={setFocusedModelName}
            onKeyDown={handleModelKeyDown}
          />
        </div>

        <footer className="border-t border-border p-3 flex items-center justify-between gap-3 flex-wrap">
          {alwaysGlobal ? (
            <span className="text-xs text-muted-foreground">
              Saves to config.yaml — applies to new sessions.
            </span>
          ) : (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={persistGlobal}
                onChange={(e) => setPersistGlobal(e.target.checked)}
                className="cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              />
              Persist globally (otherwise this session only)
            </label>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button outlined onClick={onClose} disabled={applying} className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
              Cancel
            </Button>
            <Button onClick={confirm} disabled={!canConfirm} className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
              {applying ? <Spinner /> : "Switch"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider column                                                    */
/* ------------------------------------------------------------------ */

function ProviderColumn({
  loading,
  error,
  providers,
  total,
  selectedSlug,
  query,
  onSelect,
  focusedProviderSlug,
  setFocusedProviderSlug,
  onKeyDown,
}: {
  loading: boolean;
  error: string | null;
  providers: ModelOptionProvider[];
  total: number;
  selectedSlug: string;
  query: string;
  onSelect(slug: string): void;
  focusedProviderSlug: string;
  setFocusedProviderSlug(slug: string): void;
  onKeyDown(e: React.KeyboardEvent, slug: string): void;
}) {
  return (
    <div 
      role="listbox"
      aria-label="LLM Providers"
      aria-activedescendant={focusedProviderSlug ? `provider-opt-${focusedProviderSlug}` : undefined}
      className="border-r border-border overflow-y-auto"
    >
      {loading && (
        <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
          <Spinner className="text-xs" /> loading…
        </div>
      )}

      {error && <div role="alert" aria-live="assertive" className="p-4 text-xs text-destructive">{error}</div>}

      {!loading && !error && providers.length === 0 && (
        <div className="p-4 text-xs text-muted-foreground italic">
          {query
            ? "no matches"
            : total === 0
              ? "no authenticated providers"
              : "no matches"}
        </div>
      )}

      {providers.map((p) => {
        const active = p.slug === selectedSlug;
        const isTabbable = p.slug === focusedProviderSlug;
        return (
          <ListItem
            key={p.slug}
            id={`provider-opt-${p.slug}`}
            role="option"
            aria-selected={active}
            tabIndex={isTabbable ? 0 : -1}
            active={active}
            onClick={() => onSelect(p.slug)}
            onFocus={() => setFocusedProviderSlug(p.slug)}
            onKeyDown={(e) => onKeyDown(e, p.slug)}
            className={`items-start text-xs border-l-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none ${
              active ? "border-l-primary" : "border-l-transparent"
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate">{p.name}</span>
                {p.is_current && <CurrentTag />}
              </div>
              <div className="text-[0.65rem] text-muted-foreground/80 font-mono truncate">
                {p.slug} · {p.total_models ?? p.models?.length ?? 0} models
              </div>
            </div>
          </ListItem>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Model column                                                       */
/* ------------------------------------------------------------------ */

function ModelColumn({
  provider,
  models,
  allModels,
  selectedModel,
  currentModel,
  currentProviderSlug,
  onSelect,
  onConfirm,
  focusedModelName,
  setFocusedModelName,
  onKeyDown,
}: {
  provider: ModelOptionProvider | null;
  models: string[];
  allModels: string[];
  selectedModel: string;
  currentModel: string;
  currentProviderSlug: string;
  onSelect(model: string): void;
  onConfirm(model: string): void;
  focusedModelName: string;
  setFocusedModelName(model: string): void;
  onKeyDown(e: React.KeyboardEvent, model: string): void;
}) {
  if (!provider) {
    return (
      <div className="overflow-y-auto">
        <div className="p-4 text-xs text-muted-foreground italic">
          pick a provider →
        </div>
      </div>
    );
  }

  return (
    <div 
      role="listbox"
      aria-label={`Models for ${provider.name}`}
      aria-activedescendant={focusedModelName ? `model-opt-${focusedModelName}` : undefined}
      className="overflow-y-auto"
    >
      {provider.warning && (
        <div className="p-3 text-xs text-destructive border-b border-border">
          {provider.warning}
        </div>
      )}

      {models.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground italic">
          {allModels.length
            ? "no models match your filter"
            : "no models listed for this provider"}
        </div>
      ) : (
        models.map((m) => {
          const active = m === selectedModel;
          const isCurrent =
            m === currentModel && provider.slug === currentProviderSlug;
          const isTabbable = m === focusedModelName;

          return (
            <ListItem
              key={m}
              id={`model-opt-${m}`}
              role="option"
              aria-selected={active}
              tabIndex={isTabbable ? 0 : -1}
              active={active}
              onClick={() => onSelect(m)}
              onFocus={() => setFocusedModelName(m)}
              onKeyDown={(e) => onKeyDown(e, m)}
              onDoubleClick={() => onConfirm(m)}
              className="px-3 py-1.5 text-xs font-mono focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none"
            >
              <Check
                className={`h-3 w-3 shrink-0 ${active ? "text-primary" : "text-transparent"}`}
              />
              <span className="flex-1 truncate">{m}</span>
              {isCurrent && <CurrentTag />}
            </ListItem>
          );
        })
      )}
    </div>
  );
}

function CurrentTag() {
  return (
    <span className="text-[0.6rem] uppercase tracking-wider text-primary/80 shrink-0">
      current
    </span>
  );
}
