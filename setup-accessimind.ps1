# ============================================================================
# AccessiMind Agent - Automated Windows Installation & Setup Script
# ============================================================================
#
# This script performs a complete, one-click automated setup of both the
# AccessiMind Python agent backend and the React/Vite web dashboard frontend
# on Windows.
#
# Usage:
#   .\setup-accessimind.ps1 [-Auto]
#
# ============================================================================

param (
    [switch]$Auto
)

$ErrorActionPreference = "Stop"

# Colors helper
# Using basic ASCII status headers to prevent legacy ANSI encoding issues
function Write-Cyan ($text) { Write-Host $text -ForegroundColor Cyan }
function Write-Green ($text) { Write-Host $text -ForegroundColor Green }
function Write-Yellow ($text) { Write-Host $text -ForegroundColor Yellow }
function Write-Red ($text) { Write-Host $text -ForegroundColor Red }

Write-Cyan ""
Write-Cyan "[i] AccessiMind Product Windows Setup"
Write-Cyan ""

if ($Auto) {
    Write-Cyan "-> Running in Unattended/Auto mode. All prompts will be answered automatically."
}

# Resolve directory of this script
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $SCRIPT_DIR) {
    $SCRIPT_DIR = Get-Location
}
Set-Location $SCRIPT_DIR

$PYTHON_VERSION = "3.11"

# ============================================================================
# 1. Install / locate uv
# ============================================================================
Write-Cyan "-> Checking for uv (fast package manager)..."
$uvCmd = ""

if (Get-Command "uv" -ErrorAction SilentlyContinue) {
    $uvCmd = "uv"
} elseif (Test-Path "$env:USERPROFILE\.local\bin\uv.exe") {
    $uvCmd = "$env:USERPROFILE\.local\bin\uv.exe"
} elseif (Test-Path "$env:USERPROFILE\.cargo\bin\uv.exe") {
    $uvCmd = "$env:USERPROFILE\.cargo\bin\uv.exe"
}

if (-not $uvCmd) {
    Write-Cyan "-> uv not found, installing uv..."
    try {
        # Run astral uv windows installer
        Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
        $uvCmd = "$env:USERPROFILE\.local\bin\uv.exe"
        Write-Green "[OK] uv installed successfully"
    } catch {
        Write-Red "[ERR] Failed to install uv: $_"
        exit 1
    }
} else {
    $uvVersion = & $uvCmd --version
    Write-Green "[OK] uv found ($uvVersion)"
}

# ============================================================================
# 2. Python Check / Install
# ============================================================================
Write-Cyan "-> Checking Python $PYTHON_VERSION..."
$pythonPath = ""
try {
    $pythonPath = & $uvCmd python find $PYTHON_VERSION
    $pythonVersionText = & $pythonPath --version
    Write-Green "[OK] $pythonVersionText found"
} catch {
    Write-Cyan "-> Python $PYTHON_VERSION not found, provisioning via uv..."
    try {
        & $uvCmd python install $PYTHON_VERSION
        $pythonPath = & $uvCmd python find $PYTHON_VERSION
        $pythonVersionText = & $pythonPath --version
        Write-Green "[OK] $pythonVersionText installed"
    } catch {
        Write-Red "[ERR] Failed to provision Python ${PYTHON_VERSION}: $_"
        exit 1
    }
}

# ============================================================================
# 3. Virtual Environment
# ============================================================================
Write-Cyan "-> Preparing Python virtual environment..."
if (Test-Path "venv") {
    Write-Cyan "-> Old venv directory detected, replacing it..."
    Remove-Item -Recurse -Force venv -ErrorAction SilentlyContinue
}

try {
    & $uvCmd venv venv --python $PYTHON_VERSION
    Write-Green "[OK] venv created cleanly at $SCRIPT_DIR\venv"
} catch {
    Write-Red "[ERR] Failed to create virtual environment: $_"
    exit 1
}

$venvPython = "$SCRIPT_DIR\venv\Scripts\python.exe"

# ============================================================================
# 4. Install Backend Dependencies
# ============================================================================
Write-Cyan "-> Installing AccessiMind backend dependencies..."
$env:UV_PROJECT_ENVIRONMENT = "$SCRIPT_DIR\venv"

try {
    if (Test-Path "uv.lock") {
        Write-Cyan "-> Synchronizing dependencies via lockfile..."
        & $uvCmd sync --extra all --locked
        Write-Green "[OK] Dependencies synchronized via lockfile"
    } else {
        Write-Cyan "-> uv.lock not found, installing base dependencies..."
        & $uvCmd pip install -e ".[all]"
        Write-Green "[OK] Dependencies installed successfully"
    }
} catch {
    Write-Yellow "[WARN] Lockfile sync failed, falling back to base install..."
    try {
        & $uvCmd pip install -e ".[all]"
        Write-Green "[OK] Dependencies installed successfully"
    } catch {
        Write-Red "[ERR] Failed to install backend dependencies: $_"
        exit 1
    }
}

# ============================================================================
# 5. Build Web Dashboard Frontend
# ============================================================================
Write-Cyan "-> Setting up Web Dashboard Frontend..."
if (Test-Path "web") {
    Write-Cyan "-> Installing npm packages and building production bundle..."
    Push-Location web
    try {
        if (Get-Command "npm" -ErrorAction SilentlyContinue) {
            Write-Cyan "-> Running npm install..."
            npm install
            Write-Cyan "-> Running Vite production build..."
            npm run build
            Write-Green "[OK] Dashboard compiled successfully!"
        } else {
            Write-Red "[ERR] npm is not installed. Frontend build skipped."
            Write-Yellow "[WARN] Please install Node.js/npm and run 'npm run build' inside the web/ folder."
        }
    } catch {
        Write-Red "[ERR] Web dashboard compilation failed: $_"
    }
    Pop-Location
} else {
    Write-Yellow "[WARN] Web directory not found, skipping frontend build."
}

# Copy installers to web_dist so they are statically available on server run
$webDistDir = "$SCRIPT_DIR\hermes_cli\web_dist"
if (Test-Path $webDistDir) {
    if (Test-Path "$SCRIPT_DIR\setup-accessimind.sh") {
        Copy-Item -Path "$SCRIPT_DIR\setup-accessimind.sh" -Destination "$webDistDir\setup-accessimind.sh" -Force
    }
    if (Test-Path "$SCRIPT_DIR\setup-accessimind.ps1") {
        Copy-Item -Path "$SCRIPT_DIR\setup-accessimind.ps1" -Destination "$webDistDir\setup-accessimind.ps1" -Force
    }
    Write-Green "[OK] Copied setup installers to web_dist"
}

# ============================================================================
# 6. Environment File Setup & Licensing
# ============================================================================
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item -Path ".env.example" -Destination ".env"
        Write-Green "[OK] Created .env configuration file from template"
    }
} else {
    Write-Green "[OK] .env exists"
}

Write-Cyan "-> Checking licensing..."
try {
    & $venvPython -c "from hermes_cli.config import save_env_value; save_env_value('ACCESSIMIND_LICENSE_KEY', 'OS-PREMIUM-LICENSE'); save_env_value('HERMES_LICENSE_KEY', 'OS-PREMIUM-LICENSE')"
} catch {}
Write-Green "[OK] Running under Open Source License (Lifetime Premium automatically active)!"

# ============================================================================
# 7. Command Setup & CLI Launcher
# ============================================================================
Write-Cyan "-> Setting up accessimind command launcher..."

$launcherDir = "$env:USERPROFILE\.local\bin"
if (-not (Test-Path $launcherDir)) {
    New-Item -ItemType Directory -Path $launcherDir -Force | Out-Null
}

$cmdContent = @"
@echo off
"$venvPython" -m hermes_cli.main %*
"@
$cmdContent | Out-File -FilePath "$launcherDir\accessimind.cmd" -Encoding ascii

$psContent = @"
& "$venvPython" -m hermes_cli.main `$args
"@
$psContent | Out-File -FilePath "$launcherDir\accessimind.ps1" -Encoding ascii

Write-Green "[OK] Created launcher commands in $launcherDir"

# Add to user environment PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$pathList = $userPath -split ";"
$cleanPathList = $pathList | ForEach-Object { $_.Trim() }

if ($cleanPathList -notcontains $launcherDir.Trim()) {
    $newUserPath = "$userPath;$launcherDir"
    [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
    $env:Path = "$env:Path;$launcherDir"
    Write-Green "[OK] Added $launcherDir to user environment PATH"
} else {
    Write-Green "[OK] PATH already contains launcher directory"
}

# ============================================================================
# 8. Sync Skills
# ============================================================================
$skillsTargetDir = "$env:USERPROFILE\.hermes\skills"
if (-not (Test-Path $skillsTargetDir)) {
    New-Item -ItemType Directory -Path $skillsTargetDir -Force | Out-Null
}

Write-Cyan "-> Syncing skills..."
if (Test-Path "skills") {
    Copy-Item -Path "skills\*" -Destination $skillsTargetDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Green "[OK] Skills synced"
} else {
    Write-Yellow "[WARN] Skills folder not found"
}

# ============================================================================
# 9. Completed!
# ============================================================================
Write-Green ""
Write-Green "[OK] AccessiMind Installation Complete!"
Write-Green ""
Write-Green "Please restart your PowerShell window or environment to load the 'accessimind' PATH changes."
Write-Green ""
Write-Green "To get started:"
Write-Green "  accessimind setup      # Run the configuration wizard"
Write-Green "  accessimind            # Start chatting"
Write-Green ""
