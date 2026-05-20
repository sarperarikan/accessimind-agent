<p align="center">
  <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop" alt="AccessiMind Agent Banner" width="100%" style="border-radius: 12px; margin-bottom: 20px;">
</p>

# AccessiMind Agent 🧠

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge" alt="Status"></a>
  <a href="#"><img src="https://img.shields.io/badge/Version-v1.0.0-blue?style=for-the-badge" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/Aesthetics-Premium-violet?style=for-the-badge" alt="Aesthetics"></a>
  <a href="#"><img src="https://img.shields.io/badge/WCAG-2.2_AA-green?style=for-the-badge" alt="Accessibility"></a>
  <a href="#"><img src="https://img.shields.io/badge/Installer-Automated-orange?style=for-the-badge" alt="Installer"></a>
</p>

**AccessiMind Agent** is a state-of-the-art, portable, and self-improving AI agent designed with high visual excellence, dynamic interactions, and complete accessibility under **WCAG 2.2 guidelines**. It features a closed-loop learning architecture that constructs skills from experiences, improves them autonomously during use, persists knowledge cross-session, and maintains user models dynamically.

AccessiMind is designed to run everywhere—from a cheap cloud VPS or cluster server, to serverless environments that hibernate when idle. You can interact with it via its beautiful web-based React dashboard, a responsive built-in terminal (TUI) with real POSIX PTY shell environments, or bridge it directly to messaging platforms (Telegram, Discord, Slack, WhatsApp, Signal) for multi-channel workflows.

---

## Key Highlights

### 🎨 Visual & Aesthetic Excellence
- **Sleek Modern Palette:** Custom-curated dark mode and glassmorphism interface featuring rich, tailored gradients and professional HSL-based highlights.
- **Micro-Animations & Pulsing Brand:** The UI comes alive with interactive hover states, micro-transitions, and a pulsing `Brain` icon symbolizing the agent's constant active learning state.
- **Dual-Mode Dashboard:** Instantly switch between an advanced xterm POSIX PTY terminal shell (for raw script outputs and CLI tools) and a native, visually stunning React Chat UI.

### ♿ Accessibility & WCAG 2.2 Alignment
- **Dynamic Contrast & Legibility:** Carefully selected font weights and high-contrast styling complying strictly with WCAG 2.2 readability and color ratio parameters.
- **Keyboard Friendly Navigation:** Complete keyboard navigation mapping across elements, input interfaces, and pop-ups.
- **Drop-up Swapping Switcher:** Accessible dynamic language switcher supporting **English, Turkish, and many more languages** without cutting off screen margins.

### 📦 Automated & Portable Server Setup (`setup-accessimind.sh`)
AccessiMind includes a fully self-contained automated installation script (`setup-accessimind.sh`) that sets up a production-ready environment in minutes:
- **Astral `uv` Integration:** Automatically bootstraps or detects `uv` (the blazing-fast Python package manager).
- **Python 3.11 Environment:** Safely provisions a isolated virtual environment (`venv`) using Python 3.11.
- **Fast Backend Sync:** Restores all 100+ backend dependencies cleanly via `uv.lock` with zero manual package mapping.
- **Node.js Compilation:** Detects local Node environment, installs packages, and compiles the React dashboard into the production static bundle.
- **System-Wide CLI Symlink:** Automatically symlinks the executable as `accessimind` in `~/.local/bin` and updates shell paths (`~/.zshrc` / `~/.bashrc`) so you can execute the agent anywhere.
- **Skills Directory Syncing:** Safely provisions custom skills inside the user home directory (`~/.hermes/skills`).

---

## Quick One-Click Installation

To spin up a new instance of AccessiMind Agent on any Linux or macOS server, you can stream the setup script directly using `curl`. 

### 🚀 Static Bootstrapping (One-Liner)

If you have an active AccessiMind server running, the installer is served statically at `http://<host>:9119/setup-accessimind.sh`. Anyone can run the installation with a single command:

```bash
curl -fsSL http://<your-server-ip>:9119/setup-accessimind.sh | bash
```

Alternatively, run the script locally inside the cloned directory:

```bash
chmod +x setup-accessimind.sh
./setup-accessimind.sh
```

To run in non-interactive, unattended mode (e.g. for CI/CD or docker scripts), pass `--auto`:

```bash
./setup-accessimind.sh --auto
```

---

## Post-Install Commands

Once installed, reload your shell profile (`source ~/.zshrc` or `source ~/.bashrc`) and start managing the agent with the custom global command `accessimind`:

```bash
accessimind setup        # Launch the configuration wizard (LLM endpoints, API tokens)
accessimind              # Start the interactive terminal CLI chat session
accessimind dashboard    # Boot up the gorgeous React Web Dashboard
accessimind model        # Change LLM provider and target model instantly
accessimind tools        # Toggle tool configurations & MCP connections
accessimind gateway      # Start the messaging gateway (Telegram, Discord, Slack, etc.)
accessimind doctor       # Check server health, logs, and connection statuses
```

---

## Multi-Server Deployment Dashboard

AccessiMind includes a **Deployment & Installation Management** dashboard card built directly into the **Configuration** page of the SPA:

- **Deployment Logs:** Track installation script status, check versions, and view dependency details in real-time.
- **One-Click Re-run:** Easily trigger a full clean setup re-run right from the visual dashboard if you move servers or add new system packages.
- **Multi-Server Syncing:** Simple configuration controls for deploying copycats, syncing skills, and sharing user memory layers across distinct servers.

---

## Supported LLM Providers

AccessiMind is fully model-agnostic and includes plug-and-play modules for:
* **Nous Portal**
* **OpenRouter** (200+ models)
* **NovitaAI**
* **NVIDIA NIM** (Nemotron)
* **Kimi / Moonshot**
* **MiniMax**
* **Hugging Face**
* **OpenAI / Claude / Gemini** endpoints

---

## License & Credits

Built in partnership with Nous Research. Re-engineered as a portable product with premium design, dynamic interactions, and accessibility compliance. 

Developed and distributed by **Sarper Arıkan** under the MIT License.
