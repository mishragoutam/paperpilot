import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'path';
import fs from 'fs/promises';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'PaperPilot',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow local files in dev if needed
    },
  });

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    console.error('Page failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
    if (level >= 2) {
      console.error(`[Renderer Error] ${message} (${sourceId}:${line})`);
    }
  });

  if (isDev) {
    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      console.error('VITE_DEV_SERVER_URL not set');
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Setup
function setupIpc() {
  const userDataPath = app.getPath('userData');
  const dbPath = join(userDataPath, 'paperpilot_db.json');
  console.log('Database path:', dbPath);

  ipcMain.handle('read-db', async () => {
    try {
      const data = await fs.readFile(dbPath, 'utf8');
      return JSON.parse(data);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        const defaultDb = { projects: [], documents: [], sources: [], settings: {} };
        await fs.writeFile(dbPath, JSON.stringify(defaultDb));
        return defaultDb;
      }
      throw e;
    }
  });

  ipcMain.handle('write-db', async (_, data) => {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
    return true;
  });

  ipcMain.handle('minimize-window', () => {
    mainWindow?.minimize();
  });
  ipcMain.handle('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('close-window', () => {
    mainWindow?.close();
  });
}
