import React, { useState } from "react";
import { Brain, Key, Server, UserCheck, CheckCircle2, ArrowRight, ArrowLeft, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

interface SetupPageProps {
  onSetupSuccess: (user: { id: string; username: string; role: string }) => void;
}

export default function SetupPage({ onSetupSuccess }: SetupPageProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [licenseKey, setLicenseKey] = useState("");
  const [apiKeys, setApiKeys] = useState({
    GEMINI_API_KEY: "",
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    TELEGRAM_BOT_TOKEN: "",
  });
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");

  const handleNextStep = () => {
    setError(null);
    if (step === 1) {
      if (licenseKey.trim().length < 8) {
        setError("Lisans anahtarı en az 8 karakter uzunluğunda olmalıdır.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // API Keys are optional during setup, so we proceed directly
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Step 3 Validation
    if (adminUsername.trim().length < 3) {
      setError("Yönetici kullanıcı adı en az 3 karakter olmalıdır.");
      return;
    }
    if (adminPassword.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (adminPassword !== adminPasswordConfirm) {
      setError("Şifreler uyuşmuyor.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.completeSetup({
        license_key: licenseKey.trim(),
        api_keys: apiKeys,
        admin_username: adminUsername.trim(),
        admin_password: adminPassword,
      });

      if (response.success) {
        localStorage.setItem("hermes_jwt", response.token);
        onSetupSuccess(response.user);
      }
    } catch (err: any) {
      console.error("Setup completion error:", err);
      setError(err.message || "Kurulum tamamlanırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: "LİSANS AKTİVASYONU", icon: Key },
    { num: 2, label: "SİSTEM BAĞLANTILARI", icon: Server },
    { num: 3, label: "YÖNETİCİ HESABI", icon: UserCheck },
  ];

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#041c1c] text-[#ffe6cb] overflow-hidden relative font-mondwest uppercase select-none">
      {/* Background patterns */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: "radial-gradient(#ffe6cb 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}
      />
      <div 
        className="absolute w-[600px] h-[600px] rounded-full blur-[150px] opacity-[0.12] pointer-events-none bg-[#ffe6cb]"
        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
      />

      <div className="relative z-10 w-full max-w-[500px] mx-4">
        <div className="border border-[#ffe6cb]/20 bg-[#041c1c]/90 backdrop-blur-xl p-8 rounded-xl shadow-[0_0_50px_rgba(255,230,203,0.05)]">
          
          {/* Logo & Header */}
          <div className="mb-6 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border border-[#ffe6cb]/30 flex items-center justify-center mb-2 bg-[#041c1c]">
              <Brain className="h-6 w-6 text-[#ffe6cb] animate-pulse" />
            </div>
            <h1 className="text-xl font-bold tracking-[0.1em] text-[#ffe6cb]">
              AccessiMind Setup Wizard
            </h1>
            <p className="text-[0.65rem] tracking-[0.2em] opacity-50 mt-1">
              İlk Kurulum ve Lisans Doğrulama Sihirbazı
            </p>
          </div>

          {/* Steps Progress Bar */}
          <div className="flex items-center justify-between w-full mb-8 border-b border-[#ffe6cb]/10 pb-4">
            {steps.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.num;
              const isCompleted = step > s.num;
              return (
                <div key={s.num} className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                    isActive 
                      ? "border-[#ffe6cb] bg-[#ffe6cb]/10 text-[#ffe6cb] scale-110 shadow-[0_0_10px_rgba(255,230,203,0.2)]" 
                      : isCompleted
                      ? "border-emerald-500 bg-emerald-950/20 text-emerald-400"
                      : "border-[#ffe6cb]/20 text-[#ffe6cb]/30"
                  }`}>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-[0.55rem] tracking-wider mt-1.5 font-semibold ${
                    isActive ? "text-[#ffe6cb]" : "text-[#ffe6cb]/40"
                  }`}>{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* Errors */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 mb-5 rounded bg-red-950/40 border border-red-800/40 text-red-200 text-xs tracking-wider">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Forms per Step */}
          <div className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-xs text-[#ffe6cb]/70 normal-case tracking-wide leading-relaxed">
                    AccessiMind Platformunu aktifleştirmek için lütfen lisans kodunuzu (Envato Purchase Code vb.) aşağıdaki alana giriniz.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[0.7rem] tracking-[0.15em] opacity-70 block">LİSANS ANAHTARI (PURCHASE CODE)</label>
                  <input
                    type="text"
                    required
                    placeholder="örn: f7a20c5d-31bf-437c-9efd-20be448696ab"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#041c1c] border border-[#ffe6cb]/25 rounded text-sm tracking-widest text-[#ffe6cb] placeholder-[#ffe6cb]/20 focus:outline-none focus:border-[#ffe6cb] transition-all font-sans"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <p className="text-xs text-[#ffe6cb]/70 normal-case tracking-wide leading-relaxed">
                    Kullanmak istediğiniz yapay zeka sağlayıcılarının API anahtarlarını girin. Bu ayarları daha sonra Ayarlar panelinden de değiştirebilirsiniz.
                  </p>
                </div>

                <div className="max-h-[220px] overflow-y-auto pr-1 space-y-3 scrollbar-thin">
                  <div className="space-y-1">
                    <label className="text-[0.65rem] tracking-wider opacity-60 block">GEMINI API KEY</label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={apiKeys.GEMINI_API_KEY}
                      onChange={(e) => setApiKeys({ ...apiKeys, GEMINI_API_KEY: e.target.value })}
                      className="w-full px-3 py-1.5 bg-[#041c1c] border border-[#ffe6cb]/20 rounded text-xs tracking-widest text-[#ffe6cb] focus:outline-none focus:border-[#ffe6cb] font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.65rem] tracking-wider opacity-60 block">OPENAI API KEY</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={apiKeys.OPENAI_API_KEY}
                      onChange={(e) => setApiKeys({ ...apiKeys, OPENAI_API_KEY: e.target.value })}
                      className="w-full px-3 py-1.5 bg-[#041c1c] border border-[#ffe6cb]/20 rounded text-xs tracking-widest text-[#ffe6cb] focus:outline-none focus:border-[#ffe6cb] font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.65rem] tracking-wider opacity-60 block">ANTHROPIC API KEY</label>
                    <input
                      type="password"
                      placeholder="sk-ant-..."
                      value={apiKeys.ANTHROPIC_API_KEY}
                      onChange={(e) => setApiKeys({ ...apiKeys, ANTHROPIC_API_KEY: e.target.value })}
                      className="w-full px-3 py-1.5 bg-[#041c1c] border border-[#ffe6cb]/20 rounded text-xs tracking-widest text-[#ffe6cb] focus:outline-none focus:border-[#ffe6cb] font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.65rem] tracking-wider opacity-60 block">TELEGRAM BOT TOKEN (OPSİYONEL)</label>
                    <input
                      type="password"
                      placeholder="123456789:ABC..."
                      value={apiKeys.TELEGRAM_BOT_TOKEN}
                      onChange={(e) => setApiKeys({ ...apiKeys, TELEGRAM_BOT_TOKEN: e.target.value })}
                      className="w-full px-3 py-1.5 bg-[#041c1c] border border-[#ffe6cb]/20 rounded text-xs tracking-widest text-[#ffe6cb] focus:outline-none focus:border-[#ffe6cb] font-sans"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <p className="text-xs text-[#ffe6cb]/70 normal-case tracking-wide leading-relaxed">
                    Sistemi yönetmek için kullanacağınız ana yönetici hesabı bilgilerini belirleyin.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[0.65rem] tracking-wider opacity-60 block">YÖNETİCİ KULLANICI ADI</label>
                    <input
                      type="text"
                      required
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-[#041c1c] border border-[#ffe6cb]/20 rounded text-xs tracking-widest text-[#ffe6cb] focus:outline-none focus:border-[#ffe6cb] font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.65rem] tracking-wider opacity-60 block">YÖNETİCİ ŞİFRESİ</label>
                    <input
                      type="password"
                      required
                      placeholder="En az 6 karakter"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-[#041c1c] border border-[#ffe6cb]/20 rounded text-xs tracking-widest text-[#ffe6cb] focus:outline-none focus:border-[#ffe6cb] font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.65rem] tracking-wider opacity-60 block">ŞİFRE TEKRAR</label>
                    <input
                      type="password"
                      required
                      placeholder="Şifreyi tekrar yazın"
                      value={adminPasswordConfirm}
                      onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                      className="w-full px-3 py-2 bg-[#041c1c] border border-[#ffe6cb]/20 rounded text-xs tracking-widest text-[#ffe6cb] focus:outline-none focus:border-[#ffe6cb] font-sans"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-[#ffe6cb]/10 mt-6">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex items-center gap-1.5 px-4 py-2 border border-[#ffe6cb]/30 text-[#ffe6cb] rounded text-xs font-semibold hover:bg-[#ffe6cb]/5 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>GERİ</span>
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#ffe6cb] text-[#041c1c] rounded text-xs font-bold hover:bg-[#ffe6cb]/90 active:scale-[0.98] transition-all shadow-[0_0_10px_rgba(255,230,203,0.15)] cursor-pointer"
                >
                  <span>DEVAM ET</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-[#ffe6cb] text-[#041c1c] rounded text-xs font-bold hover:bg-[#ffe6cb]/90 active:scale-[0.98] disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,230,203,0.25)] cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-[#041c1c] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>KURULUMU TAMAMLA</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
