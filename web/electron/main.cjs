import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep a global reference of the window object to prevent GC
let mainWindow = null;
let pythonProcess = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const VITE_DEV_URL = 'http://localhost:5173';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#000000',
    title: 'AccessiMind Desktop',
    icon: path.join(__dirname, '../public/favicon.ico'),
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Allow local file loads for packaged app
      webSecurity: false,
    },
  });

  // Remove default menu bar
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    // Dev mode: point to Vite dev server
    mainWindow.loadURL(VITE_DEV_URL);
    // Open DevTools to see console errors
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load the built index.html
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in the OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Optionally launch the Python backend on Windows
function startPythonBackend() {
  const isWin = process.platform === 'win32';
  const pythonRelPath = isWin ? path.join('venv', 'Scripts', 'python.exe') : path.join('venv', 'bin', 'python');
  
  // Default to backend path relative to development (main.js is in web/dist-electron)
  let backendPath = path.resolve(__dirname, '..', '..');
  let pythonExe = path.join(backendPath, pythonRelPath);

  if (!fs.existsSync(pythonExe)) {
    const possiblePaths = [
      // Sibling folder relative to packaged executable (dist/win-unpacked/resources -> dist/win-unpacked -> dist -> web -> workspace)
      path.resolve(path.dirname(process.execPath), '..', '..', '..', 'accessimind-agent-temp'),
      // User's default absolute workspace path on Windows
      'c:\\Users\\sarper\\workspace\\accessimind-agent-temp',
      // Sibling to the executables dir
      path.resolve(path.dirname(process.execPath), '..', 'accessimind-agent-temp'),
      // Relative to App Path
      path.resolve(app.getAppPath(), '..', '..', 'accessimind-agent-temp'),
      // Home directory workspace folder
      path.join(app.getPath('home'), 'workspace', 'accessimind-agent-temp')
    ];

    for (const p of possiblePaths) {
      const testExe = path.join(p, pythonRelPath);
      if (fs.existsSync(testExe)) {
        backendPath = p;
        pythonExe = testExe;
        break;
      }
    }
  }

  if (!fs.existsSync(pythonExe)) {
    console.warn('[backend] Python executable not found at paths. Will try default python cmd.');
    pythonExe = isWin ? 'python' : 'python3';
  }

  console.log('[backend] Spawning local backend server at path:', pythonExe);

  try {
    pythonProcess = spawn(
      pythonExe,
      ['-m', 'hermes_cli.main', 'dashboard', '--skip-build', '--port', '9119', '--host', '127.0.0.1'],
      {
        cwd: backendPath,
        stdio: 'pipe',
        shell: true,
        env: {
          ...process.env,
          HERMES_WEB_DIST: path.join(backendPath, 'hermes_cli', 'web_dist')
        }
      }
    );
    pythonProcess.stdout?.on('data', (d) => console.log('[backend]', d.toString()));
    pythonProcess.stderr?.on('data', (d) => console.error('[backend-err]', d.toString()));
    pythonProcess.on('close', (code) => {
      console.log('[backend] exited with code', code);
      pythonProcess = null;
    });
  } catch (err) {
    console.warn('[backend] Failed to start Python backend:', err.message);
  }
}

app.whenReady().then(() => {
  startPythonBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: get app version
ipcMain.handle('get-version', () => app.getVersion());

// IPC: open external URL in browser
ipcMain.handle('open-external', (_, url) => {
  shell.openExternal(url);
});
