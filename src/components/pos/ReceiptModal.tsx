import React, { useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, X, Zap, Share2, Monitor } from 'lucide-react';
import { Store, Utils } from '@/lib/db-store';
import { formatBs, formatUsd } from '@/lib/currency-formatter';
import { auth } from '@/lib/firebase';

// ✅ CORRECCIÓN: Agregar getAppVersion para que coincida con SalesModule
declare global {
  interface Window {
    electronAPI?: {
      printTicket: (data: any) => Promise<void>;
      getAppVersion: () => Promise<string>;
    };
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  saleData?: any;
  reportData?: any;
  type?: 'SALE' | 'REPORT_X' | 'REPORT_Z';
  storeInfo?: any;
}

export function ReceiptModal({ isOpen, onClose, saleData, reportData, type = 'SALE', storeInfo }: Props) {
  const state = Store.get();
  const printRef = useRef<HTMLDivElement>(null);

  const isReport = type === 'REPORT_X' || type === 'REPORT_Z';
  const data = isReport ? reportData : saleData;
  
  if (!data) {
    return null;
  }

  const transactionDate = React.useMemo(() => {
    try {
      const rawDate = data.fecha || data.date || data.createdAt || Utils.ahora();
      const dateObj = new Date(rawDate);
      
      if (isNaN(dateObj.getTime())) {
        return new Date().toLocaleString('es-VE', { 
          timeZone: 'America/Caracas',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true 
        });
      }
      
      return dateObj.toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
    }
  }, [data.fecha, data.date, data.createdAt]);

  const customerName = React.useMemo(() => {
    if (data.cliente) return data.cliente.toUpperCase();
    if (data.customer?.name) return data.customer.name.toUpperCase();
    if (data.customerName) return data.customerName.toUpperCase();
    return 'CONSUMIDOR FINAL';
  }, [data.cliente, data.customer, data.customerName]);

  const getReportTitle = () => {
    if (type === 'REPORT_Z') return '*** REPORTE Z ***';
    if (type === 'REPORT_X') return '*** REPORTE X - ARQUEO ***';
    return data.type || 'RECIBO DE VENTA';
  };

  const getReportSubtitle = () => {
    if (type === 'REPORT_Z') return '(CIERRE DIARIO)';
    if (type === 'REPORT_X') return '(LECTURA PARCIAL)';
    return '';
  };

  const getItems = () => {
    if (data.items) return data.items;
    if (data.products) return data.products;
    if (data.detalles) return data.detalles;
    return [];
  };

  const receiptNumber = React.useMemo(() => {
    if (isReport) {
      if (type === 'REPORT_Z') return `Z-${String(data.numeroZ || 0).padStart(6, '0')}`;
      return String(data.numeroX || data.numeroZ || 0).padStart(6, '0');
    }
    if (data.id) return String(data.id);
    if (data.numero) return String(data.numero);
    if (data.controlNumber) return String(data.controlNumber);
    return 'N/A';
  }, [data.id, data.numero, data.controlNumber, data.numeroZ, data.numeroX, isReport, type]);

  const terminalId = React.useMemo(() => {
    if (data.terminalName) return String(data.terminalName);
    if (data.caja) return String(data.caja);
    if (data.terminal) return String(data.terminal);
    if (data.terminalId) return String(data.terminalId);
    return 'CAJA-01';
  }, [data.terminalName, data.caja, data.terminal, data.terminalId]);

  const cajeroNombre = React.useMemo(() => {
    if (data.cajeroNombre) return data.cajeroNombre;
    if (data.cajero) return data.cajero;
    if (data.cashier) return data.cashier;
    if (state.user) {
      return state.user.nombre || state.user.email || 'Administrador';
    }
    const currentUser = auth.currentUser;
    if (currentUser) {
      return currentUser.displayName || currentUser.email || 'Administrador';
    }
    return 'Administrador';
  }, [data.cajeroNombre, data.cajero, data.cashier, state.user]);

  const totalBs = React.useMemo(() => {
    if (data.totalBS) return data.totalBS;
    if (data.totalBs) return data.totalBs;
    if (data.total) return data.total;
    if (data.ventaNetaUSD) return data.ventaNetaUSD * state.tasa;
    return 0;
  }, [data.totalBS, data.totalBs, data.total, data.ventaNetaUSD, state.tasa]);

  const totalUsd = React.useMemo(() => {
    if (data.totalUSD) return data.totalUSD;
    if (data.totalUsd) return data.totalUsd;
    if (data.total) return data.total / (state.tasa || 1);
    if (data.ventaNetaUSD) return data.ventaNetaUSD;
    return 0;
  }, [data.totalUSD, data.totalUsd, data.total, data.ventaNetaUSD, state.tasa]);

  const montoExento = React.useMemo(() => {
    if (data.exentoUSD) return data.exentoUSD;
    if (data.exento) return data.exento;
    return 0;
  }, [data.exentoUSD, data.exento]);

  const baseImponible = React.useMemo(() => {
    if (data.baseImponibleUSD) return data.baseImponibleUSD;
    if (data.baseImponible) return data.baseImponible;
    if (data.baseGeneral) return data.baseGeneral;
    return 0;
  }, [data.baseImponibleUSD, data.baseImponible, data.baseGeneral]);

  const iva = React.useMemo(() => {
    if (data.ivaUSD) return data.ivaUSD;
    if (data.iva) return data.iva;
    if (data.ivaGeneral) return data.ivaGeneral;
    return 0;
  }, [data.ivaUSD, data.iva, data.ivaGeneral]);

  const igtf = React.useMemo(() => {
    if (data.igtfUSD) return data.igtfUSD;
    if (data.igtf) return data.igtf;
    return 0;
  }, [data.igtfUSD, data.igtf]);

  const getPaymentMethods = () => {
    if (data.payments && Array.isArray(data.payments) && data.payments.length > 0) {
      return data.payments;
    }
    if (data.paymentMethods && typeof data.paymentMethods === 'object') {
      return data.paymentMethods;
    }
    if (data.formasPago && typeof data.formasPago === 'object') {
      return data.formasPago;
    }
    if (data.metodosPago && typeof data.metodosPago === 'object') {
      return data.metodosPago;
    }
    if (data.metodoPago) {
      return { [data.metodoPago]: data.totalUSD || totalUsd };
    }
    return {};
  };

  const formatPaymentMethod = (method: string) => {
    const methods: {[key: string]: string} = {
      'efectivo': 'EFECTIVO',
      'efectivo_bs': 'EFECTIVO (Bs.)',
      'efectivo_usd': 'EFECTIVO (USD)',
      'pago_movil': 'PAGO MÓVIL',
      'pagomovil': 'PAGO MÓVIL',
      'punto_venta': 'PUNTO DE VENTA',
      'punto_de_venta': 'PUNTO DE VENTA',
      'tarjeta': 'TARJETA',
      'tarjeta_credito': 'TARJETA CRÉDITO',
      'tarjeta_debito': 'TARJETA DÉBITO',
      'credito': 'CRÉDITO',
      'zelle': 'ZELLE',
      'mixto': 'MIXTO',
      'biopago': 'BIOPAGO',
    };
    return methods[method.toLowerCase()] || method.toUpperCase();
  };

  const isUsdPayment = (method: string) => {
    const usdMethods = ['efectivo_usd', 'efectivo usd', 'usd', 'dolar', 'zelle'];
    return usdMethods.some(m => method.toLowerCase().includes(m));
  };

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Impresion_PosVEN_Pro</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 4mm;
              font-size: 11px;
              color: #000;
              background: #fff;
              line-height: 1.5;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .bold { font-weight: bold; }
            .section-title { font-weight: bold; text-align: center; font-size: 12px; margin: 8px 0 4px 0; }
            .separator-dashed { border-top: 1px dashed #000; margin: 6px 0; }
            .separator-solid { border-top: 1px solid #000; margin: 6px 0; }
            .value { font-weight: bold; text-align: right; }
            .label { text-align: left; }
            .spacer { height: 4px; }
            .line-item { display: flex; justify-content: space-between; width: 100%; padding: 1px 0; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
              setTimeout(function() { window.close(); }, 1500);
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(onClose, 1000);
  };

  const handleNativePrint = async () => {
    if (!window.electronAPI) {
      handlePrint();
      return;
    }

    try {
      const printContent = printRef.current?.innerHTML;
      if (!printContent) {
        handlePrint();
        return;
      }

      const fullHtml = `
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Impresion_PosVEN_Pro</title>
            <style>
              @page { size: 80mm auto; margin: 0; }
              body {
                font-family: 'Courier New', Courier, monospace;
                width: 72mm;
                margin: 0 auto;
                padding: 4mm;
                font-size: 11px;
                color: #000;
                background: #fff;
                line-height: 1.5;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .text-left { text-align: left; }
              .bold { font-weight: bold; }
              .section-title { font-weight: bold; text-align: center; font-size: 12px; margin: 8px 0 4px 0; }
              .separator-dashed { border-top: 1px dashed #000; margin: 6px 0; }
              .separator-solid { border-top: 1px solid #000; margin: 6px 0; }
              .value { font-weight: bold; text-align: right; }
              .label { text-align: left; }
              .spacer { height: 4px; }
              .line-item { display: flex; justify-content: space-between; width: 100%; padding: 1px 0; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `;

      await window.electronAPI.printTicket([
        { type: 'html', value: fullHtml }
      ]);
      setTimeout(onClose, 500);
    } catch (e) {
      console.error('Error en impresión nativa:', e);
      handlePrint();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px] p-0 bg-transparent border-none overflow-hidden shadow-none">
        <DialogHeader className="sr-only"><DialogTitle>Impresión Térmica 80mm</DialogTitle></DialogHeader>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200">
          <div className="bg-black p-4 flex justify-between items-center">
            <h3 className="text-white font-black text-xs flex items-center gap-2 tracking-widest uppercase">
              <Printer size={16} className="text-brand-gold" /> VISTA PREVIA FISCAL
            </h3>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
          </div>

          <div className="p-6 bg-gray-100 flex justify-center max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div 
              ref={printRef}
              className="thermal-80mm bg-white p-6 shadow-sm text-black font-mono select-none"
              style={{ width: '72mm', boxSizing: 'border-box', color: '#000', fontSize: '11px', lineHeight: '1.5' }}
            >
              {/* ========================================== */}
              {/* ENCABEZADO */}
              {/* ========================================== */}
              <div className="text-center pb-1">
                <div className="text-[20px] font-bold uppercase leading-tight" style={{ fontFamily: 'Courier New, Courier, monospace' }}>
                  {state.empresa.nombre || 'EFAS SOLUCIONES DIGITALES C.A.'}
                </div>
                {state.empresa.rif && (
                  <div className="text-[11px] font-bold uppercase">RIF: {state.empresa.rif}</div>
                )}
                {state.empresa.direccion && (
                  <div className="text-[10px] leading-snug uppercase">{state.empresa.direccion}</div>
                )}
                {state.empresa.telefono && (
                  <div className="text-[10px]">Tel: {state.empresa.telefono}</div>
                )}
              </div>

              <div className="spacer"></div>

              {/* ========================================== */}
              {/* TÍTULO */}
              {/* ========================================== */}
              <div className="text-center">
                <div className="text-[16px] font-bold uppercase">{getReportTitle()}</div>
                {isReport && <div className="text-[12px] font-bold">{getReportSubtitle()}</div>}
              </div>

              <div className="spacer"></div>
              <div className="separator-dashed"></div>
              <div className="spacer"></div>

              {/* ========================================== */}
              {/* INFORMACIÓN DEL DOCUMENTO */}
              {/* ========================================== */}
              <div className="text-[10px] font-bold space-y-1">
                {isReport ? (
                  <>
                    <div className="line-item">
                      <span className="label">FECHA: {transactionDate.split(',')[0] || '19/07/2026'}</span>
                      <span className="value">HORA: {transactionDate.split(',')[1]?.trim() || '08:52 AM'}</span>
                    </div>
                    <div className="line-item">
                      <span className="label">Nº REPORTE {type === 'REPORT_Z' ? 'Z' : 'X'}: {receiptNumber}</span>
                      <span className="value">CAJA: {terminalId}</span>
                    </div>
                    <div className="line-item">
                      <span className="label">CAJERO: {cajeroNombre}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="line-item">
                      <span className="label">RECIBO DE VENTA: {receiptNumber}</span>
                    </div>
                    <div className="line-item">
                      <span className="label">FECHA: {transactionDate.split(',')[0] || '19/07/2026'}</span>
                      <span className="value">HORA: {transactionDate.split(',')[1]?.trim() || '10:30 AM'}</span>
                    </div>
                    <div className="line-item">
                      <span className="label">CAJA: {terminalId}</span>
                      <span className="value">CAJERO: {cajeroNombre}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="spacer"></div>
              <div className="separator-dashed"></div>
              <div className="spacer"></div>

              {/* ========================================== */}
              {/* CONTENIDO DEL REPORTE */}
              {/* ========================================== */}
              {isReport && (
                <div>
                  {/* CONTROL DE DOCUMENTOS - Solo REPORTE Z */}
                  {type === 'REPORT_Z' && (
                    <>
                      <div className="section-title">CONTROL DE DOCUMENTOS</div>
                      <div className="separator-dashed"></div>
                      <div className="font-bold">FACTURAS EMITIDAS:</div>
                      <div className="line-item">
                        <span className="label">DESDE: {data.desdeFactura || 'N/A'}</span>
                        <span className="value">HASTA: {data.hastaFactura || 'N/A'}</span>
                      </div>
                      <div className="line-item">
                        <span className="label">TOTAL FACTURAS:</span>
                        <span className="value">{String(data.stats?.facturas || 0).padStart(6, ' ')}</span>
                      </div>
                      <div className="mt-2 font-bold">NOTAS DE CRÉDITO EMITIDAS:</div>
                      <div className="line-item">
                        <span className="label">DESDE: {data.desdeNC || 'N/A'}</span>
                        <span className="value">HASTA: {data.hastaNC || 'N/A'}</span>
                      </div>
                      <div className="line-item">
                        <span className="label">TOTAL NOTAS CRÉDITO:</span>
                        <span className="value">{String(data.stats?.devoluciones || 0).padStart(6, ' ')}</span>
                      </div>
                      <div className="line-item mt-1">
                        <span className="label">CANT. DOCUMENTOS ANULADOS:</span>
                        <span className="value">{String(data.stats?.anulaciones || 0).padStart(6, ' ')}</span>
                      </div>
                      <div className="separator-dashed"></div>
                    </>
                  )}

                  {/* RESUMEN DE OPERACIONES */}
                  <div className="section-title">RESUMEN DE OPERACIONES</div>
                  <div className="separator-dashed"></div>
                  <div className="line-item">
                    <span className="label">VENTAS BRUTAS:</span>
                    <span className="value">{formatBs(((data.ventaBrutaUSD || data.brUSD || 0) * state.tasa))}</span>
                  </div>
                  <div className="line-item">
                    <span className="label">DESCUENTOS APLICADOS:</span>
                    <span className="value">{formatBs(((data.descuentoUSD || data.descUSD || 0) * state.tasa))}</span>
                  </div>
                  <div className="line-item">
                    <span className="label">DEVOLUCIONES (N. CRÉDITO):</span>
                    <span className="value">{formatBs(((data.devolucionesUSD || data.devUSD || 0) * state.tasa))}</span>
                  </div>
                  <div className="separator-dashed"></div>
                  <div className="line-item font-bold">
                    <span className="label">VENTAS NETAS:</span>
                    <span className="value">{formatBs(((data.ventaNetaUSD || data.netUSD || 0) * state.tasa))}</span>
                  </div>
                  <div className="separator-dashed"></div>

                  {/* DESGLOSE DE IMPUESTOS */}
                  <div className="section-title">DESGLOSE DE IMPUESTOS</div>
                  <div className="separator-dashed"></div>
                  <div className="line-item">
                    <span className="label">VENTAS EXENTAS (E):</span>
                    <span className="value">{formatBs(((data.exentoUSD || 0) * state.tasa))}</span>
                  </div>
                  <div className="line-item">
                    <span className="label">BASE IMPONIBLE (G 16%):</span>
                    <span className="value">{formatBs(((data.baseImponibleUSD || 0) * state.tasa))}</span>
                  </div>
                  <div className="line-item">
                    <span className="label">IVA RECAUDADO (16%):</span>
                    <span className="value">{formatBs(((data.ivaUSD || 0) * state.tasa))}</span>
                  </div>
                  <div className="line-item">
                    <span className="label">RECAUDACIÓN IGTF (3%):</span>
                    <span className="value">{formatBs(((data.igtfUSD || 0) * state.tasa))}</span>
                  </div>
                  <div className="separator-dashed"></div>

                  {/* FORMAS DE PAGO */}
                  <div className="section-title">FORMAS DE PAGO</div>
                  <div className="separator-dashed"></div>
                  {(() => {
                    const paymentMethods = getPaymentMethods();
                    if (Object.keys(paymentMethods).length > 0) {
                      if (Array.isArray(paymentMethods)) {
                        return paymentMethods.map((p: any, idx: number) => {
                          const method = p.metodo || p.method || 'efectivo';
                          const amount = p.montoUSD || p.amountUSD || p.monto || p.amount || 0;
                          const isUsd = isUsdPayment(method);
                          return (
                            <div key={idx} className="line-item">
                              <span className="label">{formatPaymentMethod(method)}:</span>
                              <span className="value">{isUsd ? `$ ${formatUsd(amount)}` : formatBs(amount * state.tasa)}</span>
                            </div>
                          );
                        });
                      } else {
                        return Object.entries(paymentMethods).map(([method, amount], idx) => {
                          const amountNum = typeof amount === 'number' ? amount : 0;
                          const isUsd = isUsdPayment(method);
                          return (
                            <div key={idx} className="line-item">
                              <span className="label">{formatPaymentMethod(method)}:</span>
                              <span className="value">{isUsd ? `$ ${formatUsd(amountNum)}` : formatBs(amountNum * state.tasa)}</span>
                            </div>
                          );
                        });
                      }
                    }
                    return null;
                  })()}
                  <div className="separator-dashed"></div>

                  {/* MOVIMIENTO DE CAJA - CORREGIDO */}
                  <div className="section-title">MOVIMIENTO DE CAJA</div>
                  <div className="separator-dashed"></div>
                  
                  {(() => {
                    const fondoAperturaUSD = data.fondoAperturaUSD || 0;
                    
                    // Calcular el total de efectivo en USD de los pagos
                    let efectivoUsdPaymentAmount = 0;
                    const paymentData = getPaymentMethods();
                    if (paymentData && Object.keys(paymentData).length > 0) {
                      if (Array.isArray(paymentData)) {
                        paymentData.forEach((p: any) => {
                          const method = p.metodo || p.method || 'efectivo';
                          if (method === 'efectivo_usd') {
                            efectivoUsdPaymentAmount += p.montoUSD || p.amountUSD || p.monto || p.amount || 0;
                          }
                        });
                      } else {
                        Object.entries(paymentData).forEach(([method, amount]) => {
                          if (method === 'efectivo_usd') {
                            efectivoUsdPaymentAmount += typeof amount === 'number' ? amount : 0;
                          }
                        });
                      }
                    } else if (data.metodoPago === 'efectivo_usd') {
                      efectivoUsdPaymentAmount = data.totalUSD || totalUsd;
                    }
                    
                    const efectivoEstimadoEnCajaUSD = fondoAperturaUSD + efectivoUsdPaymentAmount;
                    const efectivoCajaBs = (data.efectivoRealCaja || data.efectivoEstimadoCaja || data.ventaNetaUSD || data.netUSD || 0) * state.tasa;
                    
                    return (
                      <>
                        <div className="line-item">
                          <span className="label">FONDO DE APERTURA Bs.:</span>
                          <span className="value">{formatBs(fondoAperturaUSD * state.tasa)}</span>
                        </div>
                        <div className="line-item">
                          <span className="label">FONDO DE APERTURA USD:</span>
                          <span className="value">${formatUsd(fondoAperturaUSD)}</span>
                        </div>
                        <div className="line-item">
                          <span className="label">ENTRADAS DE EFECTIVO:</span>
                          <span className="value">{formatBs(((data.entradasCajaUSD || data.manualEntradas || 0) * state.tasa))}</span>
                        </div>
                        <div className="line-item">
                          <span className="label">SALIDAS DE EFECTIVO:</span>
                          <span className="value">{formatBs(((data.salidasCajaUSD || data.manualSalidas || 0) * state.tasa))}</span>
                        </div>
                        <div className="separator-dashed"></div>
                        <div className="line-item font-bold">
                          <span className="label">{type === 'REPORT_Z' ? 'EFECTIVO REAL EN CAJA:' : 'EFECTIVO ESTIMADO EN CAJA:'}</span>
                          <span className="value">{formatBs(efectivoCajaBs)}</span>
                        </div>
                        <div className="line-item font-bold">
                          <span className="label">EFECTIVO ESTIMADO EN CAJA USD:</span>
                          <span className="value">${formatUsd(efectivoEstimadoEnCajaUSD)}</span>
                        </div>
                      </>
                    );
                  })()}
                  
                  <div className="separator-dashed"></div>

                  {/* ESTADÍSTICAS - Solo REPORTE X */}
                  {type === 'REPORT_X' && (
                    <>
                      <div className="section-title">ESTADÍSTICAS DE VENTA</div>
                      <div className="separator-dashed"></div>
                      <div className="line-item">
                        <span className="label">CANT. FACTURAS EMITIDAS:</span>
                        <span className="value">{String(data.stats?.facturas || 0).padStart(6, ' ')}</span>
                      </div>
                      <div className="line-item">
                        <span className="label">CANT. TRANSACCIONES ANULADAS:</span>
                        <span className="value">{String(data.stats?.anulaciones || 0).padStart(6, ' ')}</span>
                      </div>
                      <div className="line-item">
                        <span className="label">TICKET PROMEDIO:</span>
                        <span className="value">{formatBs((data.stats?.ticketPromedio || 0) * state.tasa)}</span>
                      </div>
                      <div className="separator-dashed"></div>
                    </>
                  )}

                  {/* TOTALES HISTÓRICOS - Solo REPORTE Z */}
                  {type === 'REPORT_Z' && (
                    <>
                      <div className="section-title">TOTALES HISTÓRICOS</div>
                      <div className="text-center text-[9px]">(ACUMULADO NO REINICIABLE)</div>
                      <div className="separator-dashed"></div>
                      <div className="line-item">
                        <span className="label">GRAN TOTAL VENTAS:</span>
                        <span className="value">{formatBs(((data.acumuladoHistoricoUSD || 0) * state.tasa))}</span>
                      </div>
                      <div className="line-item">
                        <span className="label">GRAN TOTAL IVA:</span>
                        <span className="value">{formatBs(((data.acumuladoIvaUSD || 0) * state.tasa))}</span>
                      </div>
                      <div className="separator-solid"></div>
                      <div className="text-center font-bold text-[11px]">CIERRE DE JORNADA EXITOSO</div>
                      <div className="separator-solid"></div>
                    </>
                  )}

                  {/* PIE DE PÁGINA REPORTE X */}
                  {type === 'REPORT_X' && (
                    <>
                      <div className="separator-solid"></div>
                      <div className="text-center text-[10px]">DOCUMENTO NO VÁLIDO COMO</div>
                      <div className="text-center text-[10px]">CIERRE FISCAL</div>
                      <div className="separator-solid"></div>
                    </>
                  )}
                </div>
              )}

              {/* ========================================== */}
              {/* RECIBO DE VENTA */}
              {/* ========================================== */}
              {!isReport && (
                <>
                  <div className="mb-3">
                    <div className="text-[10px] font-bold mb-2">
                      <div className="flex justify-between">
                        <span className="w-8 text-left">CANT</span>
                        <span className="flex-1 px-2 text-left">DESCRIPCIÓN</span>
                        <span className="w-12 text-right">P.UNIT</span>
                        <span className="w-12 text-right">TOTAL</span>
                      </div>
                    </div>
                    <div className="separator-dashed"></div>

                    {getItems().map((item: any, idx: number) => {
                      const cantidad = item.cantidad || item.qty || 1;
                      const nombre = (item.nombre || item.name || 'Producto').toUpperCase();
                      const precioUnit = item.precioUnitUSD || item.precioUSD || item.price || 0;
                      const subtotal = item.subtotalUSD || (precioUnit * cantidad);
                      const alicuota = item.alicuota || item.ivaType || 'G';
                      
                      return (
                        <div key={idx} className="text-[9px] mb-1">
                          <div className="flex justify-between font-mono">
                            <span className="w-8 text-left">{String(cantidad).padStart(2)}</span>
                            <span className="flex-1 px-2 text-left">{nombre.substring(0, 30)}</span>
                            <span className="w-12 text-right">${formatUsd(precioUnit)}</span>
                            <span className="w-12 text-right font-bold">${formatUsd(subtotal)}</span>
                          </div>
                          <div className="text-right text-[8px] text-gray-600">({alicuota})</div>
                        </div>
                      );
                    })}

                    <div className="separator-solid"></div>
                    <div className="line-item font-bold text-[11px]">
                      <span className="label">SUBTOTAL:</span>
                      <span className="value">${formatUsd(totalUsd)}</span>
                    </div>
                    {montoExento > 0 && (
                      <div className="line-item text-[10px]">
                        <span className="label">EXENTO:</span>
                        <span className="value">${formatUsd(montoExento)}</span>
                      </div>
                    )}
                    {baseImponible > 0 && (
                      <>
                        <div className="line-item text-[10px]">
                          <span className="label">BASE IMPONIBLE (16%):</span>
                          <span className="value">${formatUsd(baseImponible)}</span>
                        </div>
                        <div className="line-item text-[10px]">
                          <span className="label">IVA (16%):</span>
                          <span className="value">${formatUsd(iva)}</span>
                        </div>
                      </>
                    )}
                    {igtf > 0 && (
                      <div className="line-item text-[10px]">
                        <span className="label">IGTF (3%):</span>
                        <span className="value">${formatUsd(igtf)}</span>
                      </div>
                    )}

                    <div className="separator-solid"></div>
                    <div className="line-item font-bold text-[14px]">
                      <span className="label">TOTAL A PAGAR:</span>
                      <span className="value">${formatUsd(totalUsd)}</span>
                    </div>
                    <div className="line-item text-[11px]">
                      <span className="label">Total Bs:</span>
                      <span className="value">{formatBs(totalBs)}</span>
                    </div>

                    <div className="separator-dashed"></div>
                    <div className="font-bold text-[10px] mb-2">FORMA DE PAGO:</div>
                    
                    {(() => {
                      const paymentData = getPaymentMethods();
                      const hasPayments = paymentData && Object.keys(paymentData).length > 0;
                      
                      if (hasPayments) {
                        if (Array.isArray(paymentData)) {
                          return paymentData.map((p: any, idx: number) => {
                            const method = p.metodo || p.method || 'efectivo';
                            const amount = p.montoUSD || p.amountUSD || p.monto || p.amount || 0;
                            const isUsd = isUsdPayment(method);
                            return (
                              <div key={idx} className="line-item text-[10px]">
                                <span className="label">{formatPaymentMethod(method)}:</span>
                                <span className="value">{isUsd ? `$${formatUsd(amount)}` : formatBs(amount * state.tasa)}</span>
                              </div>
                            );
                          });
                        } else {
                          return Object.entries(paymentData).map(([method, amount], idx) => {
                            const amountNum = typeof amount === 'number' ? amount : 0;
                            const isUsd = isUsdPayment(method);
                            return (
                              <div key={idx} className="line-item text-[10px]">
                                <span className="label">{formatPaymentMethod(method)}:</span>
                                <span className="value">{isUsd ? `$${formatUsd(amountNum)}` : formatBs(amountNum * state.tasa)}</span>
                              </div>
                            );
                          });
                        }
                      } else if (data.metodoPago) {
                        const method = data.metodoPago;
                        const amount = data.totalUSD || totalUsd;
                        const isUsd = isUsdPayment(method);
                        return (
                          <div className="line-item text-[10px]">
                            <span className="label">{formatPaymentMethod(method)}:</span>
                            <span className="value">{isUsd ? `$${formatUsd(amount)}` : formatBs(amount * state.tasa)}</span>
                          </div>
                        );
                      } else {
                        return (
                          <div className="line-item text-[10px]">
                            <span className="label">EFECTIVO:</span>
                            <span className="value">${formatUsd(totalUsd)}</span>
                          </div>
                        );
                      }
                    })()}

                    {state.tasa && (
                      <div className="text-[8px] text-gray-600 mt-1 text-center">
                        (Tasa de cambio ref: 1 USD = Bs. {state.tasa.toFixed(2)})
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ========================================== */}
              {/* PIE DE PÁGINA */}
              {/* ========================================== */}
              <div className="text-center mt-4 pt-4 border-t border-dashed border-black/30">
                {!isReport && (
                  <div className="font-bold text-[11px] mb-1">¡Gracias por su preferencia!</div>
                )}
                <div className="opacity-60 text-[8px]">Generado por PosVEN pro v2.5.7</div>
              </div>
            </div>
          </div>

          {/* ========================================== */}
          {/* BOTONES DE ACCIÓN */}
          {/* ========================================== */}
          <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onClose} className="py-3 bg-[#E5E7EB] text-[#374151] font-black text-xs rounded-xl hover:bg-gray-300 transition-all uppercase tracking-widest">Cerrar</button>
              <button className="py-3 bg-[#2ECC71] text-white font-black text-xs rounded-xl hover:bg-green-600 flex items-center justify-center gap-2 uppercase tracking-widest shadow-sm"><Share2 size={14} /> Compartir</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handlePrint} className="py-3 bg-black text-white font-black text-xs rounded-xl hover:opacity-90 flex items-center justify-center gap-2 uppercase tracking-widest shadow-md"><Printer size={14} /> Estándar</button>
              <button onClick={handleNativePrint} className="py-3 bg-[#C8952E] text-black font-black text-xs rounded-xl hover:bg-[#D9A540] transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg">
                <Zap size={16} className="fill-current" /> Impresión Térmica
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}