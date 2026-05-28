import { useState, useEffect, useRef } from "react";
import { Eye, HelpCircle, X } from "lucide-react";

export function A11yWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [contrast, setContrast] = useState<"standard" | "high-contrast">("standard");
  const [textSize, setTextSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [font, setFont] = useState<"standard" | "dyslexic">("standard");
  
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Apply classes to documentElement when state changes
  useEffect(() => {
    const root = document.documentElement;
    
    // Contrast
    root.classList.remove("a11y-high-contrast");
    if (contrast === "high-contrast") {
      root.classList.add("a11y-high-contrast");
    }
    
    // Text size
    root.classList.remove("a11y-text-sm", "a11y-text-md", "a11y-text-lg", "a11y-text-xl");
    root.classList.add(`a11y-text-${textSize}`);
    
    // Font
    root.classList.remove("a11y-font-dyslexic");
    if (font === "dyslexic") {
      root.classList.add("a11y-font-dyslexic");
    }
  }, [contrast, textSize, font]);

  // Close on Escape key press or clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative font-sans uppercase">
      {/* Floating Raindrop/Pebble Styled Icon */}
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Erişilebilirlik ve Görünüm Seçenekleri"
        title="Erişilebilirlik ve Görünüm Seçenekleri"
        className="fixed bottom-6 right-6 z-50 w-12 h-12 flex items-center justify-center bg-[#ffe6cb] text-[#041c1c] hover:bg-[#ffe6cb]/90 active:scale-95 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-[#ffe6cb]/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffe6cb] cursor-pointer"
        style={{
          borderRadius: "50% 50% 0 50%" // Raindrop-inspired shape
        }}
      >
        <Eye className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Erişilebilirlik Seçenekleri Paneli"
          className="fixed bottom-20 right-6 z-50 w-80 bg-[#041c1c] border-2 border-[#ffe6cb] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6)] text-[#ffe6cb] rounded-lg animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#ffe6cb]/20 mb-4">
            <span className="text-xs font-bold tracking-widest flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> ERİŞİLEBİLİRLİK (WCAG 2.2)
            </span>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Kapat"
              className="text-[#ffe6cb]/60 hover:text-[#ffe6cb] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ffe6cb] p-0.5 rounded cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Contrast Mode */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold opacity-60 tracking-wider block">1. KONTRAST SEÇENEKLERİ</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setContrast("standard")}
                  className={`px-3 py-1.5 border text-[10px] font-bold tracking-wider rounded transition-all cursor-pointer ${
                    contrast === "standard"
                      ? "bg-[#ffe6cb] text-[#041c1c] border-[#ffe6cb]"
                      : "border-[#ffe6cb]/20 hover:bg-[#ffe6cb]/5"
                  }`}
                >
                  STANDART
                </button>
                <button
                  onClick={() => setContrast("high-contrast")}
                  className={`px-3 py-1.5 border text-[10px] font-bold tracking-wider rounded transition-all cursor-pointer ${
                    contrast === "high-contrast"
                      ? "bg-[#ffe6cb] text-[#041c1c] border-[#ffe6cb]"
                      : "border-[#ffe6cb]/20 hover:bg-[#ffe6cb]/5"
                  }`}
                >
                  YÜKSEK KONTRAST
                </button>
              </div>
            </div>

            {/* Text Scale */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold opacity-60 tracking-wider block">2. YAZI BOYUTU</span>
              <div className="grid grid-cols-4 gap-1">
                {(["sm", "md", "lg", "xl"] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setTextSize(sz)}
                    className={`py-1.5 border text-[9px] font-bold tracking-wider rounded transition-all uppercase cursor-pointer ${
                      textSize === sz
                        ? "bg-[#ffe6cb] text-[#041c1c] border-[#ffe6cb]"
                        : "border-[#ffe6cb]/20 hover:bg-[#ffe6cb]/5"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Font Selection */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold opacity-60 tracking-wider block">3. YAZI TİPİ</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFont("standard")}
                  className={`px-3 py-1.5 border text-[10px] font-bold tracking-wider rounded transition-all cursor-pointer ${
                    font === "standard"
                      ? "bg-[#ffe6cb] text-[#041c1c] border-[#ffe6cb]"
                      : "border-[#ffe6cb]/20 hover:bg-[#ffe6cb]/5"
                  }`}
                >
                  VARSAYILAN
                </button>
                <button
                  onClick={() => setFont("dyslexic")}
                  className={`px-3 py-1.5 border text-[10px] font-bold tracking-wider rounded transition-all cursor-pointer ${
                    font === "dyslexic"
                      ? "bg-[#ffe6cb] text-[#041c1c] border-[#ffe6cb]"
                      : "border-[#ffe6cb]/20 hover:bg-[#ffe6cb]/5"
                  }`}
                >
                  DYSLEXIC DOSTU
                </button>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-4 pt-3 border-t border-[#ffe6cb]/10 text-[9px] text-[#ffe6cb]/40 tracking-wider flex items-center gap-1.5 justify-center leading-none">
            <HelpCircle className="h-3 w-3" /> EKRAN OKUYUCU (NVDA/JAWS/VO) UYUMLU
          </div>
        </div>
      )}
    </div>
  );
}
