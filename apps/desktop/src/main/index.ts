import { app, BrowserWindow, ipcMain, session, shell, Tray, Menu, nativeImage, desktopCapturer, type NativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable Hardware Acceleration for WebRTC audio/video and screen capture
app.commandLine.appendSwitch('enable-features', 'WebRTCPeerConnectionWithContext,HardwareMediaKeyHandling');
// Voice calls must keep playing even when Chromium's web autoplay heuristic
// has not yet observed a click in the current renderer session.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let selectedSourceId: string | null = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' && Boolean(process.env.DEV_SERVER_URL);
const devServerUrl = process.env.DEV_SERVER_URL || 'http://localhost:5173';

function resolveIconPath(): string | undefined {
  const appDir = app.getAppPath();
  const candidates = [
    path.join(appDir, 'assets/icon.ico'),
    path.join(appDir, 'assets/icon.png'),
    path.resolve(__dirname, '../assets/icon.ico'),
    path.resolve(__dirname, '../../assets/icon.ico'),
    path.resolve(__dirname, '../../../apps/desktop/assets/icon.ico'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

function resolvePreloadPath(): string {
  const appDir = app.getAppPath();
  const candidates = [
    path.join(appDir, 'dist/main/preload.cjs'),
    path.join(appDir, 'dist/main/preload.js'),
    path.resolve(__dirname, 'preload.cjs'),
    path.resolve(__dirname, 'preload.js'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(__dirname, 'preload.cjs');
}

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

function setupMediaHandlers() {
  const isTrustedRenderer = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'file:' ||
        (isDev && ['localhost', '127.0.0.1'].includes(parsed.hostname));
    } catch {
      return false;
    }
  };

  const isAllowedPermission = (permission: string): boolean => [
    'media',
    'camera',
    'microphone',
    'display-capture',
    'screen',
  ].includes(permission);

  // Grant media only to the bundled UI (or the local Vite server in dev).
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = [
      isTrustedRenderer(webContents.getURL()),
      isAllowedPermission(permission),
    ];
    callback(allowed.every(Boolean));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) =>
    isAllowedPermission(permission) &&
    isTrustedRenderer(webContents?.getURL() || requestingOrigin),
  );

  // Enable native screen sharing / display media requests via desktopCapturer
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (!isTrustedRenderer(request.frame?.url ?? '')) {
      callback({});
      return;
    }
    desktopCapturer
      .getSources({ types: ['screen', 'window'] })
      .then((sources) => {
        if (sources.length > 0) {
          const match = selectedSourceId
            ? sources.find((s) => s.id === selectedSourceId) || sources[0]
            : sources[0];
          callback({
            video: match,
            ...(request.audioRequested ? { audio: 'loopback' as const } : {}),
          });
        } else {
          callback({});
        }
      })
      .catch((err) => {
        console.error('Failed to get desktop capture sources for screen sharing:', err);
        callback({});
      });
  });
}

function createMainWindow(): BrowserWindow {
  const preloadPath = resolvePreloadPath();
  const iconPath = resolveIconPath();

  console.log('Preload path resolved to:', preloadPath);
  console.log('Icon path resolved to:', iconPath);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 520,
    frame: false, // Frameless modern titlebar
    backgroundColor: '#0B0D12',
    show: false,
    title: 'GDisC',
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Keep WebRTC timers, audio and ICE recovery active while the desktop
      // window is minimized to the tray or covered by another application.
      backgroundThrottling: false,
    },
  });

  // Set desktop userAgent tag
  win.webContents.setUserAgent(win.webContents.getUserAgent() + ' GDisC-Desktop/1.0.3');

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
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const currentUrl = win.webContents.getURL();
    if (url === currentUrl || url.startsWith(`${currentUrl}#`)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
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
  const iconPath = resolveIconPath();
  let icon: NativeImage;

  if (iconPath && fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createFromBuffer(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVR42mNk+M9QzwAFjAwM/1EwE24FjEh8kJr/aJgYjE2cEcX5j1OckYFhAIsCknE+yA5ihjGQ7kEWBzGIYgU4fYZiB5I4E37FhHwJMg+nQnwWIxNihg9jU8yIVYExmK0gAABHshf5WzN33AAAAABJRU5ErkJggg==',
        'base64'
      )
    );
  }

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
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });

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

  ipcMain.handle('get-screen-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 480, height: 270 },
      fetchWindowIcons: true,
    });

    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      isScreen: s.id.startsWith('screen:'),
    }));
  });

  ipcMain.handle('select-screen-source', (_event, sourceId: string) => {
    selectedSourceId = sourceId;
  });
}

// App lifecycle
app.whenReady().then(() => {
  setupMediaHandlers();
  setupIpcHandlers();
  mainWindow = createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});
