import React, { useState } from "react";
import { Brain, Lock, User, Eye, EyeOff, AlertTriangle, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

interface LoginPageProps {
  onLoginSuccess: (user: { id: string; username: string; role: string }) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      setError("Kullanıcı adı en az 3 karakter olmalıdır.");
      return;
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const response = await api.register({ username: trimmedUsername, password });
        localStorage.setItem("hermes_jwt", response.token);
        onLoginSuccess(response.user);
      } else {
        const response = await api.login({ username: trimmedUsername, password });
        localStorage.setItem("hermes_jwt", response.token);
        onLoginSuccess(response.user);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      // Clean up backend error messages if they are JSON or simple strings
      const errMsg = err.message || "Bir hata oluştu.";
      if (errMsg.includes("400:")) {
        setError(errMsg.replace(/^\d+:\s*/, ""));
      } else if (errMsg.includes("401:")) {
        setError("Geçersiz kullanıcı adı veya şifre.");
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#041c1c] text-[#ffe6cb] overflow-hidden relative font-mondwest uppercase select-none">
      {/* Decorative Cyberpunk Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: "radial-gradient(#ffe6cb 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}
      />

      {/* Decorative Glow */}
      <div 
        className="absolute w-[500px] h-[500px] rounded-full blur-[150px] opacity-[0.15] pointer-events-none bg-[#ffe6cb]"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)"
        }}
      />

      <div className="relative z-10 w-full max-w-[420px] mx-4 transition-all duration-300">
        <div className="border border-[#ffe6cb]/20 bg-[#041c1c]/80 backdrop-blur-xl p-8 rounded-xl shadow-[0_0_50px_rgba(255,230,203,0.05)] flex flex-col items-center">
          
          {/* Logo Section */}
          <div className="mb-6 flex flex-col items-center group">
            <div className="w-16 h-16 rounded-full border border-[#ffe6cb]/30 flex items-center justify-center mb-3 bg-[#041c1c] shadow-[0_0_20px_rgba(255,230,203,0.1)] transition-transform duration-500 group-hover:rotate-12">
              <Brain className="h-8 w-8 text-[#ffe6cb] animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-[0.1em] text-[#ffe6cb] blend-lighter">
              AccessiMind
            </h1>
            <p className="text-[0.7rem] tracking-[0.2em] opacity-50 mt-1">
              Yapay Zeka Arayüzü & Yönetim Paneli
            </p>
          </div>

          <h2 className="text-md font-semibold tracking-[0.15em] mb-6 text-center text-[#ffe6cb]/80 border-b border-[#ffe6cb]/10 pb-2 w-full">
            {isRegister ? "Kullanıcı Kayıt Sistemi" : "Sistem Yetkilendirme Girişi"}
          </h2>

          <form onSubmit={handleSubmit} className="w-full space-y-5">
            {/* Error Message */}
            {error && (
              <div role="alert" aria-live="assertive" className="flex items-start gap-2.5 p-3 rounded bg-red-950/40 border border-red-800/40 text-red-200 text-xs tracking-wider animate-shake">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Username Field */}
            <div className="space-y-1.5">
              <label className="text-[0.75rem] tracking-[0.15em] opacity-70 block">
                Kullanıcı Adı
              </label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#ffe6cb]/40 transition-colors group-focus-within:text-[#ffe6cb]" />
                <input
                  type="text"
                  required
                  placeholder="örn: sarper"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-[#041c1c] border border-[#ffe6cb]/25 rounded text-sm tracking-widest text-[#ffe6cb] placeholder-[#ffe6cb]/30 focus:outline-none focus:border-[#ffe6cb] focus:ring-1 focus:ring-[#ffe6cb]/30 transition-all font-sans"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-[0.75rem] tracking-[0.15em] opacity-70 block">
                Şifre
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#ffe6cb]/40 transition-colors group-focus-within:text-[#ffe6cb]" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="******"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-[#041c1c] border border-[#ffe6cb]/25 rounded text-sm tracking-widest text-[#ffe6cb] placeholder-[#ffe6cb]/30 focus:outline-none focus:border-[#ffe6cb] focus:ring-1 focus:ring-[#ffe6cb]/30 transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ffe6cb]/40 hover:text-[#ffe6cb] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#ffe6cb] text-[#041c1c] font-bold rounded tracking-[0.2em] transition-all hover:bg-[#ffe6cb]/90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none hover:shadow-[0_0_15px_rgba(255,230,203,0.3)] cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#041c1c] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? "KAYIT OL" : "GİRİŞ YAP"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Switch */}
          <div className="mt-6 text-center border-t border-[#ffe6cb]/10 pt-4 w-full">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
                setUsername("");
                setPassword("");
              }}
              className="text-[0.75rem] tracking-[0.15em] text-[#ffe6cb]/60 hover:text-[#ffe6cb] transition-all underline cursor-pointer"
            >
              {isRegister 
                ? "Zaten hesabınız var mı? Giriş Yapın" 
                : "Yeni bir kullanıcı hesabı oluşturun"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
