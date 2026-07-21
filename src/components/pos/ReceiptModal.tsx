import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, X, Zap, Share2 } from 'lucide-react';
import { Store, Utils } from '@/lib/db-store';
import { formatBs, formatUsd } from '@/lib/currency-formatter';
import { auth } from '@/lib/firebase';

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

export function ReceiptModal({ isOpen, onClose, saleData, reportData, type = 'SALE' }: Props) {
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
    return 'CONSUMIDOR FINAL';
  }, [data.cliente]);

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

  const getItems = () => data.items || data.products || [];

  const receiptNumber = React.useMemo(() => {
    if (isReport) {
      if (type === 'REPORT_Z') return `Z-${String(data.numeroZ || 0).padStart(6, '0')}`;
      return String(data.numeroX || data.numeroZ || 0).padStart(6, '0');
    }
    return String(data.id || 'N/A');
  }, [data.id, data.numeroZ, data.numeroX, isReport, type]);

  const terminalId = React.useMemo(() => data.terminalName || data.terminal || 'CAJA-01', [data]);

  const cajeroNombre = React.useMemo(() => {
    if (data.cajeroNombre) return data.cajeroNombre;
    return state.user?.nombre || auth.currentUser?.displayName || 'Administrador';
  }, [data, state.user]);

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: monospace; width: 72mm; margin: 0 auto; padding: 4mm; font-size: 12px; color: #000; line-height: 1.4; }
            table { width: 100%; border-collapse: collapse; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .separator { border-top: 1px dashed #000; margin: 5px 0; }
            .line-item { font-size: 11px; }
          </style>
        </head>
        <body>${printContent}<script>window.onload=function(){window.print();window.close();};</script></body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleNativePrint = async () => {
    if (!window.electronAPI) return handlePrint();
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;
    const fullHtml = `<html><head><meta charset="UTF-8"><style>@page { size: 80mm auto; margin: 0; } body { font-family: monospace; width: 72mm; margin: 0 auto; padding: 4mm; font-size: 12px; line-height: 1.4; }</style></head><body>${printContent}</body></html>`;
    await window.electronAPI.printTicket([{ type: 'html', value: fullHtml }]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px] p-0 bg-transparent border-none overflow-hidden shadow-none">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200">
          <div className="bg-black p-4 flex justify-between items-center">
            <h3 className="text-white font-black text-xs tracking-widest uppercase">VISTA PREVIA DE IMPRESIÓN</h3>
            <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
          </div>

          <div className="p-6 bg-gray-100 flex justify-center max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div ref={printRef} className="bg-white p-6 shadow-sm text-black font-mono" style={{ width: '72mm' }}>
              <div className="text-center">
                <div className="text-[16px] font-bold uppercase">{state.empresa.nombre}</div>
                <div className="text-[11px]">RIF: {state.empresa.rif}</div>
                <div className="text-[10px] uppercase">{state.empresa.direccion}</div>
                <div className="text-[10px]">Tel: {state.empresa.telefono}</div>
              </div>

              <div className="separator" style={{ marginTop: '10px' }}></div>
              <div className="text-center font-bold">{getReportTitle()}</div>
              <div className="text-center text-[10px]">{getReportSubtitle()}</div>
              <div className="separator"></div>

              <table className="text-[10px]">
                <tbody>
                  <tr><td>FECHA: {transactionDate.split(',')[0]}</td><td className="text-right">HORA: {transactionDate.split(',')[1]}</td></tr>
                  <tr><td>CAJA: {terminalId}</td><td className="text-right">Nº: {receiptNumber}</td></tr>
                  <tr><td colSpan={2}>CAJERO: {cajeroNombre}</td></tr>
                </tbody>
              </table>

              {!isReport && (
                <>
                  <div className="separator"></div>
                  <div className="text-[10px] uppercase">CLIENTE: {customerName}</div>
                  <div className="separator"></div>
                  <table className="text-[10px]">
                    <thead>
                      <tr className="bold"><td style={{ width: '15%' }}>CANT</td><td>DESC</td><td className="text-right">TOTAL</td></tr>
                    </thead>
                    <tbody>
                      {getItems().map((item: any, i: number) => (
                        <tr key={i} className="line-item">
                          <td>{item.cantidad}</td>
                          <td>{item.nombre.toUpperCase().substring(0, 22)}</td>
                          <td className="text-right">{formatUsd(item.subtotalUSD)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <div className="separator"></div>
              
              {isReport && (
                <>
                  <div className="text-center bold" style={{ fontSize: '11px', margin: '5px 0' }}>RESUMEN DE OPERACIONES</div>
                  <table className="text-[11px]">
                    <tbody>
                      <tr><td>VENTAS BRUTAS:</td><td className="text-right">{formatBs((data.ventaBrutaUSD || data.brUSD || 0) * state.tasa)}</td></tr>
                      <tr><td>DESCUENTOS:</td><td className="text-right">-{formatBs((data.descuentoUSD || data.descUSD || 0) * state.tasa)}</td></tr>
                      <tr><td>DEVOLUCIONES:</td><td className="text-right">-{formatBs((data.devolucionesUSD || data.devUSD || 0) * state.tasa)}</td></tr>
                      <tr className="bold"><td>VENTAS NETAS:</td><td className="text-right">{formatBs((data.ventaNetaUSD || data.netUSD || 0) * state.tasa)}</td></tr>
                    </tbody>
                  </table>
                  <div className="separator"></div>
                </>
              )}

              <div className="text-center bold" style={{ fontSize: '11px', margin: '5px 0' }}>MOVIMIENTO DE CAJA</div>
              <table className="text-[11px]">
                <tbody>
                  {/* SECCIÓN BOLÍVARES (BS) */}
                  <tr className="bold"><td colSpan={2}>EFECTIVO BOLÍVARES (BS)</td></tr>
                  <tr><td>FONDO APERTURA:</td><td className="text-right">{formatBs(data.fondoAperturaBS || 0)}</td></tr>
                  <tr><td>VENTAS EFECTIVO:</td><td className="text-right">{formatBs(data.ventasEfectivoBsBS || 0)}</td></tr>
                  <tr className="bold"><td>TOTAL ESTIMADO BS:</td><td className="text-right">{formatBs((data.fondoAperturaBS || 0) + (data.ventasEfectivoBsBS || 0))}</td></tr>
                  
                  <tr><td colSpan={2} style={{ height: '5px' }}></td></tr>

                  {/* SECCIÓN DÓLARES (USD) */}
                  <tr className="bold"><td colSpan={2}>EFECTIVO DÓLARES (USD)</td></tr>
                  <tr><td>FONDO APERTURA:</td><td className="text-right">${(data.fondoAperturaUSD || 0).toFixed(2)}</td></tr>
                  <tr><td>VENTAS EFECTIVO:</td><td className="text-right">${(data.ventasEfectivoUsdUSD || 0).toFixed(2)}</td></tr>
                  <tr className="bold"><td>TOTAL ESTIMADO USD:</td><td className="text-right">${((data.fondoAperturaUSD || 0) + (data.ventasEfectivoUsdUSD || 0)).toFixed(2)}</td></tr>
                </tbody>
              </table>

              <div className="separator"></div>
              <div className="text-center" style={{ fontSize: '9px' }}>
                {!isReport ? '¡GRACIAS POR SU PREFERENCIA!' : 'CIERRE DE JORNADA EXITOSO'}
                <div style={{ marginTop: '3px' }}>PosVEN Pro v2.5.7</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose} className="py-2 bg-gray-200 text-gray-800 font-black text-xs rounded-xl uppercase tracking-widest">Cerrar</button>
              <button className="py-2 bg-green-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest"><Share2 size={14} /> WhatsApp</button>
            </div>
            <button onClick={handleNativePrint} className="py-3 bg-[#C8952E] text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg">
              <Zap size={16} /> IMPRESIÓN TÉRMICA
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}