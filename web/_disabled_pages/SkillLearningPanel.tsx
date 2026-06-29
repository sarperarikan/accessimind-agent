import { useEffect } from "react";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useI18n } from "@/i18n";
import { Sparkles } from "lucide-react";

export default function SkillLearningPanel() {
  const { t } = useI18n();
  const { setTitle } = usePageHeader();
  useEffect(() => {
    setTitle(t.app.nav.skillLearning ?? "Skill Learning");
  }, [setTitle, t.app.nav.skillLearning]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
      <Sparkles className="h-12 w-12 text-teal-500" />
      <h2 className="text-xl font-semibold text-foreground">Skill Learning</h2>
      <p className="max-w-md text-center text-sm">
        Yetenek keşfi ve öneri paneli yakında aktif olacak. Şu anda mevcut yetenekler sayfasını kullanabilirsiniz.
      </p>
    </div>
  );
}
