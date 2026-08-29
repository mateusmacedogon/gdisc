import { app, BrowserWindow, ipcMain, session, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable Hardware Acceleration for WebRTC audio/video
app.commandLine.appendSwitch('enable-features', 'WebRTCPeerConnectionWithContext,HardwareMediaKeyHandling');
app.commandLine.appendSwitch('ignore-certificate-errors');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === 'development' && Boolean(process.env.DEV_SERVER_URL);
const devServerUrl = process.env.DEV_SERVER_URL || 'http://localhost:5173';

function tryLoadLocalFiles(win: BrowserWindow) {
  const appDir = app.getAppPath();
  const candidatePaths = [
    path.join(appDir, 'client/dist/index.html'),
    path.join(appDir, 'dist/index.html'),
    path.resolve(__dirname, '../../client/dist/index.html'),
    path.resolve(__dirname, '../../../dist/index.html'),
    path.resolve(__dirname, '../client/dist/index.html'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      console.log('Loading local UI from:', candidate);
      win.loadFile(candidate).catch((err) => {
        console.error('Failed to load file candidate:', candidate, err);
      });
      return;
    }
  }

  console.error('Could not find index.html in candidates:', candidatePaths);
}

function createMainWindow(): BrowserWindow {
  const preloadPath = path.resolve(__dirname, 'preload.js');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Frameless custom titlebar
    backgroundColor: '#0B0D12',
    show: false, // Show gracefully once ready-to-show
    title: 'GDisC',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // Allows seamless local file loading & WebRTC mesh P2P
    },
  });

  // Automatically grant permissions for WebRTC (Mic, Camera, Screen share)
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'camera', 'microphone', 'display-capture', 'notifications', 'pointerLock'];
    if (allowed.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Window state notification handlers
  win.on('maximize', () => {
    win.webContents.send('window-maximized-state', true);
  });

  win.on('unmaximize', () => {
    win.webContents.send('window-maximized-state', false);
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // Load URL in dev mode or local production files with auto-fallback
  if (isDev) {
    win.loadURL(devServerUrl).catch(() => {
      console.warn('Dev server not responding at', devServerUrl, '- falling back to local files');
      tryLoadLocalFiles(win);
    });
  } else {
    tryLoadLocalFiles(win);
  }

  return win;
}

function createTray() {
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVR42mNk+M9QzwAFjAwM/1EwE24FjEh8kJr/aJgYjE2cEcX5j1OckYFhAIsCknE+yA5ihjGQ7kEWBzGIYgU4fYZiB5I4E37FhHwJMg+nQnwWIxNihg9jU8yIVYExmK0gAABHshf5WzN33AAAAABJRU5ErkJggg==',
      'base64'
    )
  );

  tray = new Tray(icon);
  tray.setToolTip('GDisC - Comunicação em Tempo Real');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir GDisC',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Minimizar',
      click: () => {
        if (mainWindow) mainWindow.minimize();
      },
    },
    {
      label: 'Sair do GDisC',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function setupIpcHandlers() {
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });
}

// App lifecycle
app.whenReady().then(() => {
  setupIpcHandlers();
  mainWindow = createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
