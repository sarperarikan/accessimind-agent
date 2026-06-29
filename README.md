# AccessiMind Agent

**Hermes Agent tabanlı, WCAG 2.2 AA uyumlu, erişilebilir AI platformu.**

AccessiMind, [Hermes Agent](https://github.com/NousResearch/hermes-agent) altyapısı üzerine inşa edilmiş, çok sağlayıcılı (OpenRouter, Ollama, MoA), Türkçe arayüze sahip, erişilebilirlik odaklı bir AI asistanı platformudur. Dashboard, TUI ve mesajlaşma gateway'i (Telegram, Discord, WhatsApp, Signal) üzerinden erişilebilir.

## Özellikler

### 🎯 Çok Sağlayıcılı AI Altyapısı
- **OpenRouter Free**: 20+ ücretsiz model (Nemotron, Qwen, Hermes, GPT-OSS, Llama, vb.)
- **Ollama Cloud**: Kimi-K2, MiniMax-M3, GLM-5.2 ve daha fazlası
- **Mixture of Agents (MoA)**: Çoklu model füzyon preset'leri
  - `free-fusion` (5 model)
  - `mega-fusion` (7 model)
  - `fast-fusion` (3 model)
  - `code-fusion` (3 model)
- **Fallback zinciri**: Bir sağlayıcı başarısız olursa otomatik yedek sağlayıcıya geçiş

### ♿ WCAG 2.2 AA Erişilebilirlik
- Tam WCAG 2.2 Level AA uyumlu web dashboard
- ARIA etiketleri, klavye navigasyonu, ekran okuyucu desteği
- Türkçe varsayılan dil, çok dilli arayüz (20+ dil)
- Yüksek kontrast tema seçenekleri
- NVDA, JAWS, VoiceOver uyumlu

### 🖥️ Dashboard
- `/chat` override plugin — modern sohbet arayüzü (mesaj balonları, markdown, streaming)
- Prompt Library — kategorize, etiketli, değişken destekli prompt yönetimi
- Skill Learning — kullanım analizine dayalı skill önerileri
- Config, Models, Sessions, Logs, Plugins, Cron, Analytics sayfaları
- Nginx reverse proxy (port 9119 → 443 HTTPS)

### 📱 Mesajlaşma Gateway
- Telegram (topic/çok-oturum desteği)
- Discord (sesli kanal + TTS)
- WhatsApp, Signal, Matrix, Slack, Teams, Feishu, LINE
- Webhook entegrasyonları

### 🔧 Hermes Engine
- Tam Hermes Agent altyapısı (upstream senkronize)
- Skill sistemi (100+ yerleşik skill)
- Cron job zamanlayıcı
- Kanban board (çoklu worker)
- MCP (Model Context Protocol) desteği
- ACP (Agent Communication Protocol) adapter
- Trajectory compression (bağlam optimizasyonu)
- Checkpoint & rollback sistemi
- Profil yönetimi (çoklu profil)

### 🛡️ Güvenlik
- scrypt tabanlı parola hash'leme (dashboard auth)
- İptables + fail2ban VPS hardening
- SSH erişim kısıtlı, public 22 kapalı
- OAuth entegrasyonu (Google, GitHub, Microsoft)

### 🌐 Türkçe Yerelleştirme
- Tam Türkçe arayüz çevirisi (`web/src/i18n/tr.ts`)
- `locales/tr.yaml` statik mesaj katalogu
- Tüm komutlar ve sistem mesajları Türkçe

## Mimari

```
accessimind-agent/
├── agent/              # AI ajan runtime (conversation loop, tool executor, compression)
├── apps/
│   ├── desktop/        # Electron desktop app
│   └── bootstrap-installer/  # Tauri kurulum sihirbazı
├── gateway/            # Mesajlaşma gateway (Telegram, Discord, vb.)
├── hermes_cli/         # CLI + dashboard backend
│   ├── dashboard_auth/  # scrypt parola doğrulama
│   ├── prompt_library.py # Prompt kütüphanesi
│   └── skill_learning.py # Skill öneri sistemi
├── tui_gateway/        # Terminal UI gateway (WebSocket)
├── ui-tui/             # Terminal arayüzü (Ink/React)
├── web/                # Web dashboard (React + Vite)
│   └── src/
│       ├── components/  # ChatView, MessageBubble, ChatInput, vb.
│       ├── i18n/        # 20+ dil çevirisi
│       ├── pages/       # ChatPage, ConfigPage, ModelsPage, vb.
│       └── themes/      # Tema preset'leri
├── tools/              # Araç seti (terminal, browser, web, vision, vb.)
├── skills/             # Yerleşik skill'ler
├── plugins/            # Dashboard plugin'leri
├── acp_adapter/        # ACP protocol adapter
├── cron/               # Cron job altyapısı
├── accessimind-plugins/  # AccessiMind'a özel dashboard plugin'leri
│   └── dashboard/      # /chat override (entry.js, styles.css, manifest.json)
├── accessimind-deploy/   # Dağıtım ve konfigürasyon
│   ├── config.yaml.example  # Örnek config (secret'lar temizlenmiş)
│   ├── hermes-dashboard.service  # systemd service
│   ├── SOUL.md             # Ajan persona tanımı
│   └── cron-jobs.json      # Cron job tanımları
├── accessimind-scripts/  # Bakım script'leri
│   └── accessimind-update.sh  # Upstream sync + rebuild
└── website/            # Dokümantasyon sitesi (Docusaurus)
```

## Kurulum

### Hızlı Kurulum (VPS)

```bash
# Hermes Agent'ı kur
git clone https://github.com/sarperarikan/accessimind-agent.git
cd accessimind-agent
python3 -m venv venv
source venv/bin/activate
pip install -e .

# Web UI build
cd web && npm ci && npm run build && cd ..

# Dashboard başlat
hermes dashboard --port 9119 --host 0.0.0.0
```

### Production Dağıtım

```bash
# systemd service
cp accessimind-deploy/hermes-dashboard.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable hermes-dashboard
systemctl start hermes-dashboard

# Nginx reverse proxy (9119 → 443)
# SSL sertifikası (Let's Encrypt)
```

### Config

```bash
# Config dosyasını kopyala
cp accessimind-deploy/config.yaml.example ~/.hermes/config.yaml

# .env dosyasını oluştur
cp .env.example ~/.hermes/.env
# API key'lerini ekle
```

### AccessiMind Plugin

```bash
# Chat UI override plugin
mkdir -p ~/.hermes/plugins/accessimind-chat/dashboard
cp accessimind-plugins/dashboard/* ~/.hermes/plugins/accessimind-chat/dashboard/
```

## Güncelleme

```bash
# Upstream sync + rebuild
bash accessimind-scripts/accessimind-update.sh
```

## Sağlayıcılar

| Sağlayıcı | Modeller | Ücretsiz |
|-----------|---------|----------|
| OpenRouter Free | 20+ model (Nemotron, Qwen, Hermes, GPT-OSS, Llama, vb.) | ✅ |
| Ollama Cloud | Kimi-K2, MiniMax-M3, GLM-5.2 | Freemin |
| OpenAI | GPT-4o, GPT-4o-mini, o3, vb. | ❌ |
| Anthropic | Claude Sonnet, Opus | ❌ |
| Google | Gemini 2.5 Pro/Flash | ❌ |
| Azure | Foundry modelleri | ❌ |
| AWS | Bedrock modelleri | ❌ |

## Teknoloji Yığını

- **Backend**: Python 3.12, asyncio, SQLite
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **TUI**: Ink (React for CLI), TypeScript
- **Desktop**: Electron, TypeScript
- **Installer**: Tauri (Rust)
- **Docs**: Docusaurus
- **Gateway**: WebSocket, çoklu platform adapter

## Lisans

Bu proje [Hermes Agent](https://github.com/NousResearch/hermes-agent) (MIT) üzerine inşa edilmiştir.

## Katkıda Bulunanlar

- **Sarper Arikan** — AccessiMind özelleştirmesi, Türkçe yerelleştirme, erişilebilirlik
- **Nous Research** — Hermes Agent altyapısı

## Bağlantılar

- 🌐 [erisilebilirai.com](https://erisilebilirai.com) — AccessiMind platformu
- 📖 [Hermes Agent Docs](https://hermes-agent.nousresearch.com/docs)
- 🐛 [Issue Tracker](https://github.com/sarperarikan/accessimind-agent/issues)