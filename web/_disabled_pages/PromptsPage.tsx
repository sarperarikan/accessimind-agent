import { useEffect } from "react";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useI18n } from "@/i18n";
import { Sparkles } from "lucide-react";

export default function PromptsPage() {
  const { t } = useI18n();
  const { setTitle } = usePageHeader();
  useEffect(() => {
    setTitle(t.app.nav.prompts ?? "Prompt Library");
  }, [setTitle, t.app.nav.prompts]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
      <Sparkles className="h-12 w-12 text-teal-500" />
      <h2 className="text-xl font-semibold text-foreground">Prompt Library</h2>
      <p className="max-w-md text-center text-sm">
        Bu bölüm yakında erişilebilir olacak. Şu anda sohbet ve yönetim sayfalarını kullanabilirsiniz.
      </p>
    </div>
  );
}
