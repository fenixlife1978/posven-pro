const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { PosPrinter } = require('electron-pos-printer');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../public/posven-logo.png'),
    title: "PosVEN Pro - Punto de Venta",
    show: false, // No mostrar hasta que esté listo
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:9002');
  } else {
    // Usar path absoluto robusto para la versión empaquetada
    const indexPath = path.join(__dirname, '../out/index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error("Error cargando la app estática:", err);
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (!isDev) {
    mainWindow.setMenu(null);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Lógica de Impresión Térmica Roccia RC-8002 Pro (80mm)
ipcMain.on('print-ticket', (event, printData) => {
  const options = {
    preview: false,               
    width: '80mm',               
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    printerName: 'Roccia RC-8002', 
    timeOutPerLine: 400,
    silent: true,
  };

  PosPrinter.print(printData, options)
    .then(() => {
      console.log('Impresión completada en Roccia RC-8002');
    })
    .catch((error) => {
      console.error('Error de hardware en Roccia:', error);
    });
});
