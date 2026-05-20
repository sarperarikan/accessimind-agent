#!/bin/bash
# ============================================================================
# AccessiMind Agent - Automated Installation & Setup Script
# ============================================================================
#
# This script performs a complete, one-click automated setup of both the
# AccessiMind Python agent backend and the React/Vite web dashboard frontend.
# It is designed to be easily run and rerun on any server for a smooth
# product deployment.
#
# Usage:
#   ./setup-accessimind.sh [--auto | --unattended]
#
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# Check for auto/unattended mode
AUTO_MODE=false
if [[ "$1" == "--auto" || "$1" == "--unattended" || "$1" == "-y" ]]; then
    AUTO_MODE=true
    echo -e "${CYAN}→ Running in Unattended/Auto mode. All prompts will be answered automatically.${NC}"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load common shell profiles to ensure npm/node/nvm are in PATH
set +e
for profile in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
    if [ -f "$profile" ]; then
        source "$profile" &>/dev/null || true
    fi
done
set -e

export UV_NO_CONFIG=1
PYTHON_VERSION="3.11"

echo ""
echo -e "${CYAN}⚕ AccessiMind Product Setup${NC}"
echo ""

# ============================================================================
# 1. Install / locate uv
# ============================================================================
echo -e "${CYAN}→${NC} Checking for uv (fast package manager)..."
UV_CMD=""
if command -v uv &> /dev/null; then
    UV_CMD="uv"
elif [ -x "$HOME/.local/bin/uv" ]; then
    UV_CMD="$HOME/.local/bin/uv"
elif [ -x "$HOME/.cargo/bin/uv" ]; then
    UV_CMD="$HOME/.cargo/bin/uv"
fi

if [ -n "$UV_CMD" ]; then
    UV_VERSION=$($UV_CMD --version 2>/dev/null)
    echo -e "${GREEN}✓${NC} uv found ($UV_VERSION)"
else
    echo -e "${CYAN}→${NC} Installing uv..."
    _uv_log="$(mktemp 2>/dev/null || echo "/tmp/accessimind-uv-install.$$.log")"
    _uv_installer="$(mktemp 2>/dev/null || echo "/tmp/accessimind-uv-installer.$$.sh")"
    if ! curl -LsSf https://astral.sh/uv/install.sh -o "$_uv_installer" 2>"$_uv_log"; then
        echo -e "${RED}✗${NC} Failed to download uv installer."
        sed 's/^/    /' "$_uv_log" >&2
        rm -f "$_uv_log" "$_uv_installer"
        exit 1
    fi
    if sh "$_uv_installer" >>"$_uv_log" 2>&1; then
        rm -f "$_uv_installer"
        if [ -x "$HOME/.local/bin/uv" ]; then
            UV_CMD="$HOME/.local/bin/uv"
        elif [ -x "$HOME/.cargo/bin/uv" ]; then
            UV_CMD="$HOME/.cargo/bin/uv"
        fi
        if [ -n "$UV_CMD" ]; then
            rm -f "$_uv_log"
            echo -e "${GREEN}✓${NC} uv installed successfully"
        else
            echo -e "${RED}✗${NC} uv installer finished but binary not found."
            rm -f "$_uv_log"
            exit 1
        fi
    else
        echo -e "${RED}✗${NC} Failed to install uv."
        rm -f "$_uv_log" "$_uv_installer"
        exit 1
    fi
fi

# ============================================================================
# 2. Python Check / Install
# ============================================================================
echo -e "${CYAN}→${NC} Checking Python $PYTHON_VERSION..."
if $UV_CMD python find "$PYTHON_VERSION" &> /dev/null; then
    PYTHON_PATH=$($UV_CMD python find "$PYTHON_VERSION")
    PYTHON_FOUND_VERSION=$($PYTHON_PATH --version 2>/dev/null)
    echo -e "${GREEN}✓${NC} $PYTHON_FOUND_VERSION found"
else
    echo -e "${CYAN}→${NC} Python $PYTHON_VERSION not found, provisioning via uv..."
    $UV_CMD python install "$PYTHON_VERSION"
    PYTHON_PATH=$($UV_CMD python find "$PYTHON_VERSION")
    PYTHON_FOUND_VERSION=$($PYTHON_PATH --version 2>/dev/null)
    echo -e "${GREEN}✓${NC} $PYTHON_FOUND_VERSION installed"
fi

# ============================================================================
# 3. Virtual Environment
# ============================================================================
echo -e "${CYAN}→${NC} Preparing Python virtual environment..."
if [ -d "venv" ]; then
    echo -e "${CYAN}→${NC} Old venv directory detected, replacing it..."
    rm -rf venv
fi

$UV_CMD venv venv --python "$PYTHON_VERSION"
echo -e "${GREEN}✓${NC} venv created cleanly at $SCRIPT_DIR/venv"

export VIRTUAL_ENV="$SCRIPT_DIR/venv"
SETUP_PYTHON="$SCRIPT_DIR/venv/bin/python"

# ============================================================================
# 4. Install Backend Dependencies
# ============================================================================
echo -e "${CYAN}→${NC} Installing AccessiMind backend dependencies..."
if [ -f "uv.lock" ]; then
    if UV_PROJECT_ENVIRONMENT="$SCRIPT_DIR/venv" $UV_CMD sync --extra all --locked; then
        echo -e "${GREEN}✓${NC} Dependencies synchronized via lockfile"
    else
        echo -e "${YELLOW}⚠${NC} Lockfile sync failed, falling back to base install..."
        UV_PROJECT_ENVIRONMENT="$SCRIPT_DIR/venv" $UV_CMD pip install -e ".[all]"
        echo -e "${GREEN}✓${NC} Dependencies installed successfully"
    fi
else
    UV_PROJECT_ENVIRONMENT="$SCRIPT_DIR/venv" $UV_CMD pip install -e ".[all]"
    echo -e "${GREEN}✓${NC} Dependencies installed successfully"
fi

# ============================================================================
# 5. Build Web Dashboard Frontend
# ============================================================================
echo -e "${CYAN}→${NC} Setting up Web Dashboard Frontend..."
if [ -d "web" ]; then
    echo -e "${CYAN}→${NC} Installing npm packages and building production bundle..."
    cd web
    
    # Check for npm
    if command -v npm &> /dev/null; then
        echo -e "${CYAN}→${NC} Running npm install..."
        npm install
        echo -e "${CYAN}→${NC} Running Vite production build..."
        npm run build
        echo -e "${GREEN}✓${NC} Dashboard compiled successfully!"
    else
        echo -e "${RED}✗${NC} npm is not installed. Frontend build skipped."
        echo -e "${YELLOW}⚠${NC} Please install Node.js/npm and run 'npm run build' inside the web/ folder."
    fi
    cd "$SCRIPT_DIR"
else
    echo -e "${YELLOW}⚠${NC} Web directory not found, skipping frontend build."
fi

# ============================================================================
# 6. Ripgrep (Optional)
# ============================================================================
echo -e "${CYAN}→${NC} Checking for ripgrep..."
if command -v rg &> /dev/null; then
    echo -e "${GREEN}✓${NC} ripgrep found"
else
    if [ "$AUTO_MODE" = true ]; then
        echo -e "${CYAN}→${NC} Unattended mode: Skipping ripgrep install"
    else
        read -p "Install ripgrep for faster file search? [Y/n] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            # Attempt to install ripgrep
            if command -v apt-get &> /dev/null; then
                sudo apt-get update && sudo apt-get install -y ripgrep || true
            elif command -v brew &> /dev/null; then
                brew install ripgrep || true
            fi
        fi
    fi
fi

# ============================================================================
# 7. Environment File Setup
# ============================================================================
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓${NC} Created .env configuration file from template"
    fi
else
    echo -e "${GREEN}✓${NC} .env exists"
fi

# ============================================================================
# 8. Command Setup & Symlinking (accessimind)
# ============================================================================
echo -e "${CYAN}→${NC} Setting up accessimind command..."

ACCESSIMIND_BIN="$SCRIPT_DIR/venv/bin/accessimind"
COMMAND_LINK_DIR="$HOME/.local/bin"
mkdir -p "$COMMAND_LINK_DIR"

# Symlink the rebranded command
ln -sf "$ACCESSIMIND_BIN" "$COMMAND_LINK_DIR/accessimind"
echo -e "${GREEN}✓${NC} Symlinked accessimind → ~/.local/bin/accessimind"

# Setup shell PATH
SHELL_CONFIG=""
if [[ "$SHELL" == *"zsh"* ]]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [[ "$SHELL" == *"bash"* ]]; then
    SHELL_CONFIG="$HOME/.bashrc"
    [ ! -f "$SHELL_CONFIG" ] && SHELL_CONFIG="$HOME/.bash_profile"
fi

if [ -n "$SHELL_CONFIG" ]; then
    touch "$SHELL_CONFIG" 2>/dev/null || true
    if ! echo "$PATH" | tr ':' '\n' | grep -q "^$HOME/.local/bin$"; then
        if ! grep -q '\.local/bin' "$SHELL_CONFIG" 2>/dev/null; then
            echo "" >> "$SHELL_CONFIG"
            echo "# AccessiMind Agent — PATH configuration" >> "$SHELL_CONFIG"
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_CONFIG"
            echo -e "${GREEN}✓${NC} Added ~/.local/bin to PATH in $SHELL_CONFIG"
        fi
    fi
fi

# ============================================================================
# 9. Sync Skills
# ============================================================================
HERMES_SKILLS_DIR="$HOME/.hermes/skills"
mkdir -p "$HERMES_SKILLS_DIR"
echo "Syncing skills..."
if [ -d "$SCRIPT_DIR/skills" ]; then
    cp -rn "$SCRIPT_DIR/skills/"* "$HERMES_SKILLS_DIR/" 2>/dev/null || true
fi
echo -e "${GREEN}✓${NC} Skills synced"

# ============================================================================
# 10. Completed!
# ============================================================================
echo ""
echo -e "${GREEN}✓ AccessiMind Installation Complete!${NC}"
echo ""
echo "You can reload your shell or run:"
echo "  source $SHELL_CONFIG"
echo ""
echo "To get started:"
echo "  accessimind setup      # Run the configuration wizard"
echo "  accessimind            # Start chatting"
echo ""
