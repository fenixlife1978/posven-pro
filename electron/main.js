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
    const indexPath = path.join(__dirname, '../out/index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error("Error cargando la app estática:", err);
      mainWindow.loadURL('http://localhost:9002'); 
    });
  }

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

// Lógica de Impresión Térmica Roccia RC-8002 Pro
ipcMain.on('print-ticket', (event, data) => {
  const options = {
    preview: false,
    width: '80mm',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    printerName: 'Roccia RC-8002', 
    timeOutPerLine: 400,
    silent: true,
  };

  // Si recibimos un array directo lo usamos, si no construimos el reporte
  const printData = Array.isArray(data) ? data : [
    {
      type: 'text',
      value: data.empresa.nombre.toUpperCase(),
      style: { fontWeight: '700', textAlign: 'center', fontSize: '18px' }
    },
    {
      type: 'text',
      value: `RIF: ${data.empresa.rif}\n${data.empresa.direccion}\n${data.empresa.telefono}`,
      style: { textAlign: 'center', fontSize: '11px', fontWeight: '400' }
    },
    { type: 'text', value: '--------------------------------', style: { textAlign: 'center' } },
    {
      type: 'text',
      value: `${data.type || 'RECIBO DE VENTA'}\n#${data.id}`,
      style: { textAlign: 'center', fontWeight: '700', fontSize: '14px' }
    },
    {
      type: 'text',
      value: `FECHA: ${data.date}\nCLIENTE: ${data.customerName || 'CONSUMIDOR FINAL'}`,
      style: { fontSize: '10px', textAlign: 'left' }
    },
    { type: 'text', value: '--------------------------------', style: { textAlign: 'center' } }
  ];

  if (!Array.isArray(data) && data.items) {
    data.items.forEach(item => {
      printData.push({
        type: 'text',
        value: `${item.qty}x ${item.name.toUpperCase().substring(0, 20)}`,
        style: { fontWeight: '700', fontSize: '11px' }
      });
      printData.push({
        type: 'text',
        value: `      Subtotal: Bs. ${item.subtotal.toFixed(2)}`,
        style: { fontSize: '10px', textAlign: 'left' }
      });
    });
    
    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });
    
    if (data.totals) {
      data.totals.forEach(t => {
        printData.push({
          type: 'text',
          value: `${t.label}: ${t.value}`,
          style: { fontWeight: '700', fontSize: '13px', textAlign: 'right' }
        });
      });
    }

    printData.push({
      type: 'text',
      value: '\n¡Gracias por su compra!\nPosVEN Pro Cloud Sync\n',
      style: { textAlign: 'center', fontSize: '9px', fontStyle: 'italic' }
    });
  }

  PosPrinter.print(printData, options)
    .catch((error) => {
      console.error('Error de impresión hardware:', error);
    });
});
