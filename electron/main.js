const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { PosPrinter } = require('electron-pos-printer');

let mainWindow;

function getResourcePath(relativePath) {
  // En desarrollo: busca en el sistema de archivos normal
  // En producción: busca en resources/out/
  if (process.env.NODE_ENV === 'development') {
    return path.join(__dirname, relativePath);
  }
  
  // En producción, los archivos están en resources/out/
  const resourcePath = path.join(process.resourcesPath, relativePath);
  if (fs.existsSync(resourcePath)) {
    return resourcePath;
  }
  
  // Fallback: intentar en el directorio actual
  const fallbackPath = path.join(__dirname, '..', relativePath);
  if (fs.existsSync(fallbackPath)) {
    return fallbackPath;
  }
  
  console.error(`❌ Recurso no encontrado: ${relativePath}`);
  console.error(`   Buscado en: ${resourcePath}`);
  console.error(`   Fallback en: ${fallbackPath}`);
  return resourcePath; // Devuelve el path aunque no exista para que falle con mensaje claro
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../public/posven-logo.png'),
    title: "PosVEN Pro - Punto de Venta",
    show: false,
    backgroundColor: '#E6E1D3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  // === DEBUG INFO ===
  console.log('=== POSVEN PRO STARTUP DEBUG ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('isDev:', isDev);
  console.log('__dirname:', __dirname);
  console.log('process.resourcesPath:', process.resourcesPath);
  console.log('Current working dir:', process.cwd());
  
  if (isDev) {
    console.log('🔧 Modo Desarrollo: Cargando desde http://localhost:9002');
    mainWindow.loadURL('http://localhost:9002').catch((err) => {
      console.error("❌ Error cargando URL de desarrollo:", err);
    });
  } else {
    // Obtener la ruta correcta del index.html
    const indexPath = getResourcePath('out/index.html');
    console.log('📄 Cargando index desde:', indexPath);
    
    // Verificar si el archivo existe
    if (fs.existsSync(indexPath)) {
      console.log('✅ index.html encontrado');
      console.log('📁 Contenido del directorio out:');
      const outDir = path.dirname(indexPath);
      if (fs.existsSync(outDir)) {
        console.log(fs.readdirSync(outDir));
      }
    } else {
      console.error('❌ ERROR CRÍTICO: index.html NO ENCONTRADO en:', indexPath);
      console.log('📁 Buscando en resourcesPath:', process.resourcesPath);
      if (fs.existsSync(process.resourcesPath)) {
        console.log('📁 Contenido de resourcesPath:', fs.readdirSync(process.resourcesPath));
      }
      
      // Último intento: buscar en el directorio actual
      const lastChance = path.join(process.cwd(), 'out/index.html');
      console.log('🔍 Último intento en:', lastChance);
      if (fs.existsSync(lastChance)) {
        console.log('✅ Encontrado en directorio actual!');
        mainWindow.loadFile(lastChance);
        return;
      }
    }
    
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error("❌ Error crítico cargando la app estática:", err);
      // Mostrar pantalla de error
      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#E6E1D3;">
            <div style="text-align:center;padding:40px;background:white;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
              <h1 style="color:#c0392b;">Error al cargar la aplicación</h1>
              <p>No se pudo encontrar el archivo index.html</p>
              <p style="font-size:12px;color:#666;">${indexPath}</p>
            </div>
          </body>
        </html>
      `);
    });
  }

  mainWindow.once('ready-to-show', () => {
    console.log('✅ Ventana lista para mostrar');
    mainWindow.show();
    mainWindow.focus();
  });

  if (!isDev) {
    mainWindow.setMenu(null);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify().catch(err => console.error("Update error:", err));
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

// Lógica de Impresión Térmica
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
      console.log('✅ Impresión completada en Roccia RC-8002');
    })
    .catch((error) => {
      console.error('❌ Error de hardware en Roccia:', error);
    });
});

// Exponer versión de la app
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});