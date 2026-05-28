import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import {
  Code,
  Download,
  FormInput,
  RotateCcw,
  Save,
  Search,
  Upload,
  X,
  Settings2,
  FileText,
  Settings,
  Bot,
  Monitor,
  Palette,
  Users,
  Brain,
  Package,
  Lock,
  Globe,
  Mic,
  Volume2,
  Ear,
  ClipboardList,
  MessageCircle,
  Wrench,
  FileQuestion,
  Filter,
  Cloud,
  Sparkles,
  LayoutDashboard,
  BookOpen,
  Route,
  History,
  Shield,
  FileOutput,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { getNestedValue, setNestedValue } from "@/lib/nested";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/Toast";
import { AutoField } from "@/components/AutoField";
import { Button } from "@nous-research/ui/ui/components/button";
import { ListItem } from "@nous-research/ui/ui/components/list-item";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { useI18n } from "@/i18n";
import { usePageHeader } from "@/contexts/usePageHeader";
import { PluginSlot } from "@/plugins";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  general: Settings,
  agent: Bot,
  terminal: Monitor,
  display: Palette,
  delegation: Users,
  memory: Brain,
  compression: Package,
  security: Lock,
  browser: Globe,
  voice: Mic,
  tts: Volume2,
  stt: Ear,
  logging: ClipboardList,
  discord: MessageCircle,
  auxiliary: Wrench,
  bedrock: Cloud,
  curator: Sparkles,
  kanban: LayoutDashboard,
  model_catalog: BookOpen,
  openrouter: Route,
  sessions: History,
  tool_loop_guardrails: Shield,
  tool_output: FileOutput,
  updates: RefreshCw,
};

function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category] ?? FileQuestion;
  return <Icon className={className ?? "h-4 w-4"} />;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ConfigPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [schema, setSchema] = useState<Record<
    string,
    Record<string, unknown>
  > | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<Record<string, unknown> | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [yamlMode, setYamlMode] = useState(false);
  const [yamlText, setYamlText] = useState("");
  const [yamlLoading, setYamlLoading] = useState(false);
  const [yamlSaving, setYamlSaving] = useState(false);
  const [configPath, setConfigPath] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [setupOS, setSetupOS] = useState<'linux' | 'windows'>('linux');
  const [licenseStatus, setLicenseStatus] = useState<{ activated: boolean; license_key: string; license_info: any } | null>(null);
  const [newLicenseKey, setNewLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);

  const fetchLicenseStatus = () => {
    api.getLicenseStatus()
      .then(setLicenseStatus)
      .catch(() => {});
  };

  useEffect(() => {
    fetchLicenseStatus();
  }, []);

  const handleActivateLicense = async () => {
    if (!newLicenseKey.trim() || newLicenseKey.trim().length < 8) {
      showToast("Lütfen geçerli bir lisans anahtarı girin.", "error");
      return;
    }
    setActivating(true);
    try {
      const res = await api.activateLicense({ license_key: newLicenseKey.trim() });
      if (res.success) {
        showToast("Lisans başarıyla aktifleştirildi!", "success");
        setNewLicenseKey("");
        fetchLicenseStatus();
      }
    } catch (e: any) {
      showToast(`Lisans aktivasyonu başarısız: ${e.message || e}`, "error");
    } finally {
      setActivating(false);
    }
  };
  const { toast, showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const { setEnd } = usePageHeader();

  useLayoutEffect(() => {
    if (!config || !schema) {
      setEnd(null);
      return;
    }
    setEnd(
      <div className="relative w-full min-w-0 sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="h-8 pl-8 pr-7 text-xs"
          placeholder={t.common.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Button
            ghost
            size="xs"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearchQuery("")}
            aria-label={t.common.clear}
          >
            <X />
          </Button>
        )}
      </div>,
    );
    return () => setEnd(null);
  }, [config, schema, searchQuery, setEnd, t.common.clear, t.common.search]);

  function prettyCategoryName(cat: string): string {
    const key = cat as keyof typeof t.config.categories;
    if (t.config.categories[key]) return t.config.categories[key];
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  useEffect(() => {
    api
      .getConfig()
      .then(setConfig)
      .catch(() => {});
    api
      .getSchema()
      .then((resp) => {
        setSchema(resp.fields as Record<string, Record<string, unknown>>);
        setCategoryOrder(resp.category_order ?? []);
      })
      .catch(() => {});
    api
      .getDefaults()
      .then(setDefaults)
      .catch(() => {});
    api
      .getStatus()
      .then((resp) => setConfigPath(resp.config_path))
      .catch(() => {});
  }, []);

  // Set active category when categories load
  useEffect(() => {
    if (categoryOrder.length > 0 && !activeCategory) {
      setActiveCategory(categoryOrder[0]);
    }
  }, [categoryOrder, activeCategory]);

  // Load YAML when switching to YAML mode
  useEffect(() => {
    if (yamlMode) {
      setYamlLoading(true);
      api
        .getConfigRaw()
        .then((resp) => setYamlText(resp.yaml))
        .catch(() => showToast(t.config.failedToLoadRaw, "error"))
        .finally(() => setYamlLoading(false));
    }
  }, [yamlMode]);

  /* ---- Categories ---- */
  const categories = useMemo(() => {
    if (!schema) return [];
    const allCats = [
      ...new Set(
        Object.values(schema).map((s) => String(s.category ?? "general")),
      ),
    ];
    const ordered = categoryOrder.filter((c) => allCats.includes(c));
    const extra = allCats.filter((c) => !categoryOrder.includes(c)).sort();
    return [...ordered, ...extra];
  }, [schema, categoryOrder]);

  /* ---- Category field counts ---- */
  const categoryCounts = useMemo(() => {
    if (!schema) return {};
    const counts: Record<string, number> = {};
    for (const s of Object.values(schema)) {
      const cat = String(s.category ?? "general");
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [schema]);

  /* ---- Search ---- */
  const isSearching = searchQuery.trim().length > 0;
  const lowerSearch = searchQuery.toLowerCase();

  const searchMatchedFields = useMemo(() => {
    if (!isSearching || !schema) return [];
    return Object.entries(schema).filter(([key, s]) => {
      const label = key.split(".").pop() ?? key;
      const humanLabel = label.replace(/_/g, " ");
      return (
        key.toLowerCase().includes(lowerSearch) ||
        humanLabel.toLowerCase().includes(lowerSearch) ||
        String(s.category ?? "")
          .toLowerCase()
          .includes(lowerSearch) ||
        String(s.description ?? "")
          .toLowerCase()
          .includes(lowerSearch)
      );
    });
  }, [isSearching, lowerSearch, schema]);

  /* ---- Active tab fields ---- */
  const activeFields = useMemo(() => {
    if (!schema || isSearching) return [];
    return Object.entries(schema).filter(
      ([, s]) => String(s.category ?? "general") === activeCategory,
    );
  }, [schema, activeCategory, isSearching]);

  /* ---- Handlers ---- */
  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api.saveConfig(config);
      showToast(t.config.configSaved, "success");
      window.dispatchEvent(new CustomEvent("accessimind-config-saved"));
    } catch (e) {
      showToast(`${t.config.failedToSave}: ${e}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleYamlSave = async () => {
    setYamlSaving(true);
    try {
      await api.saveConfigRaw(yamlText);
      showToast(t.config.yamlConfigSaved, "success");
      window.dispatchEvent(new CustomEvent("accessimind-config-saved"));
      api
        .getConfig()
        .then(setConfig)
        .catch(() => {});
    } catch (e) {
      showToast(`${t.config.failedToSaveYaml}: ${e}`, "error");
    } finally {
      setYamlSaving(false);
    }
  };

  const handleReset = () => {
    if (!defaults || !config) return;
    // Scope the reset to what the user is currently looking at:
    //   - search mode → the matched fields
    //   - form mode   → the active category's fields
    // Resetting the whole config here was a footgun (issue reported by @ykmfb001):
    // the button sits next to the category tabs and users reasonably assumed
    // "reset this tab", not "wipe my entire config.yaml".
    const scopedFields = isSearching ? searchMatchedFields : activeFields;
    if (scopedFields.length === 0) return;
    setConfirmReset(true);
  };

  const executeReset = () => {
    if (!defaults || !config) return;
    setConfirmReset(false);
    const scopedFields = isSearching ? searchMatchedFields : activeFields;
    if (scopedFields.length === 0) return;
    const scopeLabel = isSearching
      ? t.config.searchResults
      : prettyCategoryName(activeCategory);
    let next: Record<string, unknown> = config;
    for (const [key] of scopedFields) {
      next = setNestedValue(next, key, getNestedValue(defaults, key));
    }
    setConfig(next);
    showToast(
      t.config.resetScopeToast.replace("{scope}", scopeLabel),
      "success",
    );
  };

  const handleExport = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hermes-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string);
        setConfig(imported);
        showToast(t.config.configImported, "success");
      } catch {
        showToast(t.config.invalidJson, "error");
      }
    };
    reader.readAsText(file);
  };

  /* ---- Loading ---- */
  if (!config || !schema) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="text-2xl text-primary" />
      </div>
    );
  }

  /* ---- Render field list (shared between search & normal) ---- */
  const renderFields = (
    fields: [string, Record<string, unknown>][],
    showCategory = false,
  ) => {
    let lastSection = "";
    let lastCat = "";
    return fields.map(([key, s]) => {
      const parts = key.split(".");
      const section = parts.length > 1 ? parts[0] : "";
      const cat = String(s.category ?? "general");
      const showCatBadge = showCategory && cat !== lastCat;
      const showSection =
        !showCategory &&
        section &&
        section !== lastSection &&
        section !== activeCategory;
      lastSection = section;
      lastCat = cat;

      return (
        <div key={key}>
          {showCatBadge && (
            <div className="flex items-center gap-2 pt-4 pb-2 first:pt-0">
              <CategoryIcon
                category={cat}
                className="h-4 w-4 text-muted-foreground"
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {prettyCategoryName(cat)}
              </span>
              <div className="flex-1 border-t border-border" />
            </div>
          )}
          {showSection && (
            <div className="flex items-center gap-2 pt-4 pb-2 first:pt-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.replace(/_/g, " ")}
              </span>
              <div className="flex-1 border-t border-border" />
            </div>
          )}
          <div className="py-1">
            <AutoField
              schemaKey={key}
              schema={s}
              value={getNestedValue(config, key)}
              onChange={(v) => setConfig(setNestedValue(config, key, v))}
            />
          </div>
        </div>
      );
    });
  };

  const setupOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9119';

  return (
    <div className="flex flex-col gap-4">
      <PluginSlot name="config:top" />

      {/* AccessiMind Product Installation & Server Deployment Panel */}
      <Card className="border border-primary/25 bg-primary/5 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Brain className="h-20 w-20 text-primary animate-pulse" />
        </div>
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-foreground font-bold tracking-wide uppercase font-mondwest">
            <Sparkles className="h-4 w-4 text-primary animate-bounce" />
            AccessiMind Product Installation & Server Deployment
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0 text-[11px] sm:text-xs">
          <p className="text-muted-foreground leading-relaxed mb-4">
            AccessiMind has been built as a production-grade, highly portable agent product that can be deployed on any server.
            Use the automated setup system to initialize the Python venv, backend service dependencies, and compile the Vite dashboard with a single command.
          </p>

          <div className="flex gap-1.5 mb-4 bg-muted/40 p-1 rounded-md max-w-[280px] border border-border/40">
            <button
              onClick={() => setSetupOS('linux')}
              className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded transition-all cursor-pointer ${
                setupOS === 'linux'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Linux / macOS
            </button>
            <button
              onClick={() => setSetupOS('windows')}
              className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded transition-all cursor-pointer ${
                setupOS === 'windows'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Windows (PowerShell)
            </button>
          </div>

          {setupOS === 'linux' ? (
            <div className="grid sm:grid-cols-2 gap-4 mt-2">
              <div className="border border-border/60 p-3 bg-muted/20 rounded-md">
                <span className="font-semibold block mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  One-Click Automated Installer (Linux / macOS)
                </span>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Download and run the installer script on any clean server to set up the entire environment automatically:
                </p>
                <div className="bg-black/80 font-mono text-[10px] p-2 border border-border/50 text-emerald-400 select-all rounded break-all whitespace-pre-wrap font-semibold">
                  {`curl -LsSf ${setupOrigin}/setup-accessimind.sh -o setup.sh && chmod +x setup.sh && ./setup.sh --auto`}
                </div>
              </div>

              <div className="border border-border/60 p-3 bg-muted/20 rounded-md">
                <span className="font-semibold block mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Re-running Installation Flow
                </span>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Re-run the setup anytime locally on this server to refresh virtual environments, clean state, and re-compile assets:
                </p>
                <div className="bg-black/80 font-mono text-[10px] p-2 border border-border/50 text-emerald-400 select-all rounded break-all whitespace-pre-wrap font-semibold">
                  ./setup-accessimind.sh --auto
                </div>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 mt-2">
              <div className="border border-border/60 p-3 bg-muted/20 rounded-md">
                <span className="font-semibold block mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  One-Click Automated Installer (Windows PowerShell)
                </span>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Download and run the installer script via PowerShell to set up the entire environment automatically:
                </p>
                <div className="bg-black/80 font-mono text-[10px] p-2 border border-border/50 text-emerald-400 select-all rounded break-all whitespace-pre-wrap font-semibold">
                  {`powershell -ExecutionPolicy Bypass -c "irm ${setupOrigin}/setup-accessimind.ps1 | iex"`}
                </div>
              </div>

              <div className="border border-border/60 p-3 bg-muted/20 rounded-md">
                <span className="font-semibold block mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Re-running Installation Flow
                </span>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Re-run the setup anytime locally on this server to refresh virtual environments, clean state, and re-compile assets:
                </p>
                <div className="bg-black/80 font-mono text-[10px] p-2 border border-border/50 text-emerald-400 select-all rounded break-all whitespace-pre-wrap font-semibold">
                  .\setup-accessimind.ps1 -Auto
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {setupOS === 'linux' ? (
              <Button
                size="xs"
                outlined
                onClick={() => {
                  window.open(`${setupOrigin}/setup-accessimind.sh`, "_blank");
                }}
                prefix={<Download className="h-3 w-3" />}
              >
                Get Installer Script (setup-accessimind.sh)
              </Button>
            ) : (
              <Button
                size="xs"
                outlined
                onClick={() => {
                  window.open(`${setupOrigin}/setup-accessimind.ps1`, "_blank");
                }}
                prefix={<Download className="h-3 w-3" />}
              >
                Get Installer Script (setup-accessimind.ps1)
              </Button>
            )}
            <Button
              size="xs"
              outlined
              onClick={() => {
                alert("Automated Setup Wizard has been successfully configured for multi-server deployment! You can copy the installer command to deploy AccessiMind on other hosts.");
              }}
              prefix={<RefreshCw className="h-3 w-3" />}
            >
              Verify Setup Capabilities
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* License & Product Activation Card */}
      <Card className="border border-primary/20 bg-muted/10 relative overflow-hidden">
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-foreground font-bold tracking-wide uppercase font-mondwest">
            <Lock className="h-4 w-4 text-primary" />
            Product License & Activation Management
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0 text-[11px] sm:text-xs">
          {licenseStatus ? (
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground">Lisans Durumu</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      licenseStatus.activated 
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' 
                        : 'bg-red-950/40 text-red-400 border border-red-800/40'
                    }`}>
                      {licenseStatus.activated ? "AKTİF" : "LİSANSSIZ"}
                    </span>
                    <span className="text-muted-foreground">
                      {licenseStatus.license_info?.license_type}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground">Aktif Lisans Anahtarı</span>
                  <span className="font-mono text-foreground mt-1 block">
                    {licenseStatus.license_key || "Bulunamadı"}
                  </span>
                </div>

                <div>
                  <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground">Destek Durumu</span>
                  <span className="text-foreground mt-1 block">
                    {licenseStatus.license_info?.support_active ? "Etkin (Ömür Boyu)" : "Etkin Değil"}
                  </span>
                </div>
              </div>

              <div className="space-y-3 border-t sm:border-t-0 sm:border-l border-border/40 pt-4 sm:pt-0 sm:pl-6">
                <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground">Yeni Lisans Anahtarı Tanımla</span>
                <p className="text-[10px] text-muted-foreground">
                  Farklı bir lisans anahtarı veya satın alma kodu (Purchase Code) girmek için aşağıdaki kutuyu kullanın:
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="örn: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                    value={newLicenseKey}
                    onChange={(e) => setNewLicenseKey(e.target.value)}
                    className="h-8 text-xs font-sans font-semibold tracking-wider flex-1"
                  />
                  <Button
                    size="xs"
                    onClick={handleActivateLicense}
                    disabled={activating}
                    className="h-8 uppercase font-bold tracking-wider"
                  >
                    {activating ? "AKTİFLEŞTİRİLİYOR" : "AKTİFLEŞTİR"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <Spinner className="text-xs text-primary" />
            </div>
          )}
        </CardContent>
      </Card>

      <Toast toast={toast} />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <code className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5">
            {configPath ?? t.config.configPath}
          </code>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            ghost
            size="icon"
            onClick={handleExport}
            title={t.config.exportConfig}
            aria-label={t.config.exportConfig}
          >
            <Download />
          </Button>
          <Button
            ghost
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            title={t.config.importConfig}
            aria-label={t.config.importConfig}
          >
            <Upload />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          {!yamlMode &&
            (() => {
              const resetScopeLabel = isSearching
                ? t.config.searchResults
                : prettyCategoryName(activeCategory);
              const resetTitle = t.config.resetScopeTooltip.replace(
                "{scope}",
                resetScopeLabel,
              );
              return (
                <Button
                  ghost
                  size="icon"
                  onClick={handleReset}
                  title={resetTitle}
                  aria-label={resetTitle}
                >
                  <RotateCcw />
                </Button>
              );
            })()}

          <div className="w-px h-5 bg-border mx-1" />

          <Button
            size="sm"
            outlined={!yamlMode}
            onClick={() => setYamlMode(!yamlMode)}
            prefix={yamlMode ? <FormInput /> : <Code />}
          >
            {yamlMode ? t.common.form : "YAML"}
          </Button>

          {yamlMode ? (
            <Button
              size="sm"
              onClick={handleYamlSave}
              disabled={yamlSaving}
              prefix={<Save />}
            >
              {yamlSaving ? t.common.saving : t.common.save}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              prefix={<Save />}
            >
              {saving ? t.common.saving : t.common.save}
            </Button>
          )}
        </div>
      </div>

      {yamlMode ? (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t.config.rawYaml}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {yamlLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="text-xl text-primary" />
              </div>
            ) : (
              <textarea
                className="flex min-h-[600px] w-full bg-transparent px-4 py-3 text-sm font-mono leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none border-t border-border"
                value={yamlText}
                onChange={(e) => setYamlText(e.target.value)}
                spellCheck={false}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col sm:flex-row gap-4">
          <aside aria-label={t.config.filters} className="sm:w-56 sm:shrink-0">
            <div className="sm:sticky sm:top-4">
              <div className="flex flex-col border border-border bg-muted/20">
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 border-b border-border">
                  <Filter className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mondwest text-[0.65rem] tracking-[0.12em] uppercase text-muted-foreground">
                    {t.config.filters}
                  </span>
                </div>

                <div className="hidden sm:block px-3 pt-2 pb-1 font-mondwest text-[0.6rem] tracking-[0.12em] uppercase text-muted-foreground/70">
                  {t.config.sections}
                </div>

                <div className="flex sm:flex-col gap-1 sm:gap-px p-2 sm:pt-1 overflow-x-auto sm:overflow-x-visible scrollbar-none sm:max-h-[calc(100vh-260px)] sm:overflow-y-auto">
                  {categories.map((cat) => {
                    const isActive = !isSearching && activeCategory === cat;

                    return (
                      <ListItem
                        key={cat}
                        active={isActive}
                        onClick={() => {
                          setSearchQuery("");
                          setActiveCategory(cat);
                        }}
                        className="rounded-sm whitespace-nowrap px-2 py-1 text-[11px]"
                      >
                        <CategoryIcon
                          category={cat}
                          className="h-3.5 w-3.5 shrink-0"
                        />
                        <span className="flex-1 truncate">
                          {prettyCategoryName(cat)}
                        </span>
                        <span
                          className={`text-[10px] tabular-nums ${
                            isActive
                              ? "text-foreground/60"
                              : "text-muted-foreground/50"
                          }`}
                        >
                          {categoryCounts[cat] || 0}
                        </span>
                      </ListItem>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            {isSearching ? (
              <Card>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      {t.config.searchResults}
                    </CardTitle>
                    <Badge tone="secondary" className="text-[10px]">
                      {searchMatchedFields.length}{" "}
                      {t.config.fields.replace(
                        "{s}",
                        searchMatchedFields.length !== 1 ? "s" : "",
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-2 px-4 pb-4">
                  {searchMatchedFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t.config.noFieldsMatch.replace("{query}", searchQuery)}
                    </p>
                  ) : (
                    renderFields(searchMatchedFields, true)
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Active category */
              <Card>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CategoryIcon
                        category={activeCategory}
                        className="h-4 w-4"
                      />
                      {prettyCategoryName(activeCategory)}
                    </CardTitle>
                    <Badge tone="secondary" className="text-[10px]">
                      {activeFields.length}{" "}
                      {t.config.fields.replace(
                        "{s}",
                        activeFields.length !== 1 ? "s" : "",
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-2 px-4 pb-4">
                  {renderFields(activeFields)}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
      <PluginSlot name="config:bottom" />
      <ConfirmDialog
        open={confirmReset}
        onCancel={() => setConfirmReset(false)}
        onConfirm={executeReset}
        title={t.config.confirmResetScope.replace(
          "{scope}",
          isSearching
            ? t.config.searchResults
            : prettyCategoryName(activeCategory),
        )}
        description={`This will reset ${
          (isSearching ? searchMatchedFields : activeFields).length
        } field(s) to their default values.`}
        destructive
        confirmLabel={t.config.resetDefaults}
      />
    </div>
  );
}
