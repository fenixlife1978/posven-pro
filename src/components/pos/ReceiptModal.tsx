"use client";

import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, X, Zap, Share2, Monitor } from 'lucide-react';
import { Store, Utils } from '@/lib/db-store';
import { formatBs, formatUsd } from '@/lib/currency-formatter';
import { auth } from '@/lib/firebase';

declare global {
  interface Window {
    electronAPI?: {
      printTicket: (data: any) => Promise<void>;
    };
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sale?: any; 
  reportData?: any; 
  type?: 'SALE' | 'REPORT_X' | 'REPORT_Z';
}

export function ReceiptModal({ isOpen, onClose, sale, reportData, type = 'SALE' }: Props) {
  const state = Store.get();
  const printRef = useRef<HTMLDivElement>(null);

  const isReport = type === 'REPORT_X' || type === 'REPORT_Z';
  const data = isReport ? reportData : sale;
  
  if (!data) return null;

  const transactionDate = React.useMemo(() => {
    try {
      const rawDate = data.fecha || data.date || Utils.ahora();
      const dateObj = new Date(rawDate);
      return dateObj.toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
    }
  }, [data.fecha, data.date]);

  const customerName = (data.cliente || 'CONSUMIDOR FINAL').toUpperCase();
  const terminalIdLabel = (data.terminalName || 'SISTEMA GLOBAL').toUpperCase();
  
  const getReportTitle = () => {
    if (type === 'REPORT_Z') return `REPORTE Z - CIERRE DIARIO`;
    if (type === 'REPORT_X') return `REPORTE X - LECTURA PARCIAL`;
    return (data.type || 'RECIBO DE VENTA').toUpperCase();
  };

  const padRight = (label: string, value: string, width = 48) => {
    const dots = width - label.length - value.length;
    return label + (dots > 0 ? '.'.repeat(dots) : ' ') + value;
  };

  const handleNativePrint = async () => {
    if (!window.electronAPI) {
      handlePrint();
      return;
    }

    const SEPARATOR = '------------------------------------------------';
    const DOTS = '................................................';
    
    let printData: any[] = [
      { type: 'text', value: state.empresa.nombre.toUpperCase(), style: { fontWeight: "800", textAlign: 'center', fontSize: "20px" } },
      { type: 'text', value: state.empresa.direccion.toUpperCase(), style: { textAlign: 'center', fontSize: "11px" } },
      { type: 'text', value: `RIF: ${state.empresa.rif} | TEL: ${state.empresa.telefono}`, style: { textAlign: 'center', fontSize: "11px" } },
      { type: 'text', value: SEPARATOR, style: { textAlign: 'center' } }
    ];

    if (isReport) {
      printData.push({ type: 'text', value: getReportTitle(), style: { textAlign: 'center', fontWeight: "800", fontSize: "16px" } });
      printData.push({ type: 'text', value: `TERMINAL: ${terminalIdLabel}`, style: { textAlign: 'center', fontWeight: "700", fontSize: "12px" } });
      printData.push({ type: 'text', value: `FECHA/HORA: ${transactionDate}`, style: { fontSize: "11px", textAlign: 'center' } });
      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
      
      if (type === 'REPORT_Z') {
        printData.push({ type: 'text', value: 'DATOS DE CONTROL Y AUDITORÍA', style: { textAlign: 'center', fontWeight: "800" } });
        printData.push({ type: 'text', value: `REPORTE Z N°: ${String(data.numeroZ || 0).padStart(6, '0')}`, style: { fontSize: "11px" } });
        printData.push({ type: 'text', value: padRight('RANGO FACTURAS', `${data.desdeFactura} - ${data.hastaFactura}`), style: { fontSize: "10px" } });
        printData.push({ type: 'text', value: padRight('RANGO NOTAS CRED', `${data.desdeNC} - ${data.hastaNC}`), style: { fontSize: "10px" } });
        printData.push({ type: 'text', value: DOTS, style: { fontSize: "11px" } });
      }

      printData.push({ type: 'text', value: 'RESUMEN DE FACTURACIÓN', style: { textAlign: 'center', fontWeight: "800" } });
      printData.push({ type: 'text', value: padRight('VENTA BRUTA', formatBs(data.brUSD * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('DESCUENTOS', '-' + formatBs(data.descUSD * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('DEVOLUCIONES', '-' + formatBs(data.devUSD * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('VENTA NETA', formatBs(data.netUSD * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "12px", fontWeight: "700" } });
      printData.push({ type: 'text', value: DOTS, style: { fontSize: "11px" } });

      printData.push({ type: 'text', value: 'DESGLOSE FISCAL', style: { textAlign: 'center', fontWeight: "800" } });
      printData.push({ type: 'text', value: padRight('Monto Exento', formatBs((data.exentoUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('Base Imponible', formatBs((data.baseImponibleUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('IVA Recaudado (16%)', formatBs((data.ivaUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('Total IGTF (3%)', formatBs((data.igtfUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: DOTS, style: { fontSize: "11px" } });

      printData.push({ type: 'text', value: 'CONCILIACIÓN DE PAGOS', style: { textAlign: 'center', fontWeight: "800" } });
      Object.entries(data.paymentMethods || {}).forEach(([method, val]) => {
        printData.push({ type: 'text', value: padRight(Utils.metodoLabel(method).toUpperCase(), formatBs((val as number) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      });
      printData.push({ type: 'text', value: padRight('SALIDAS / GASTOS CAJA', '-' + formatBs((data.manualSalidas || 0) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      
      if (type === 'REPORT_Z') {
        printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
        printData.push({ type: 'text', value: 'ACUMULADOS HISTÓRICOS', style: { textAlign: 'center', fontWeight: "800" } });
        printData.push({ type: 'text', value: padRight('GRAN TOTAL (BS)', formatBs(data.acumuladoHistoricoUSD * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "12px", fontWeight: "800" } });
      }

    } else {
      printData.push({ type: 'text', value: getReportTitle(), style: { textAlign: 'center', fontWeight: "800", fontSize: "16px" } });
      printData.push({ type: 'text', value: `N° CONTROL: ${data.id}`, style: { fontSize: "11px", fontWeight: "700" } });
      printData.push({ type: 'text', value: `FECHA/HORA: ${transactionDate}`, style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: `CLIENTE: ${customerName}`, style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });

      data.items.forEach((item: any) => {
        printData.push({ 
          type: 'text', 
          value: `${item.cantidad || item.qty}x ${(item.nombre || item.name).toUpperCase().slice(0, 30)}`, 
          style: { fontWeight: "700", fontSize: "11px" } 
        });
        printData.push({ 
          type: 'text', 
          value: `      Total: ${formatBs((item.subtotalUSD || (item.price * item.qty)) * state.tasa).replace('Bs. ', 'Bs.')}`, 
          style: { fontSize: "10px", textAlign: 'left' } 
        });
      });

      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
      printData.push({ type: 'text', value: padRight('TOTAL A PAGAR', formatBs(data.totalBS).replace('Bs. ', 'Bs.')), style: { textAlign: 'right', fontWeight: "800", fontSize: "18px" } });
    }

    printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
    printData.push({ type: 'text', value: '¡Gracias por su preferencia!', style: { textAlign: 'center', fontSize: "10px" } });
    printData.push({ type: 'text', value: 'PosVEN Pro v2.5 - RC-8002 optimized\n\n\n', style: { textAlign: 'center', fontSize: "8px" } });

    try {
      await window.electronAPI.printTicket(printData);
      setTimeout(onClose, 500);
    } catch (e) {
      handlePrint();
    }
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
              margin: 0;
              padding: 4mm;
              font-size: 11px;
              color: #000;
              background: #fff;
              line-height: 1.2;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .dashed-line { border-top: 1px dashed #000; margin: 5px 0; }
            .solid-line { border-top: 1px solid #000; margin: 5px 0; }
            .title { font-size: 18px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }
            .subtitle { font-size: 10px; margin-bottom: 2px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 2px 0; }
            .flex-row { display: flex; justify-content: space-between; }
            .total-box { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin: 8px 0; font-size: 16px; font-weight: bold; }
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
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(onClose, 1000);
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
              style={{ width: '72mm', boxSizing: 'border-box', color: '#000', fontSize: '11px', lineHeight: '1.3' }}
            >
              {/* ENCABEZADO IDÉNTICO IMAGEN 2 */}
              <div className="text-center pb-3 mb-3">
                <h1 className="text-[20px] font-bold uppercase mb-2 leading-tight" style={{ fontFamily: 'Courier New, Courier, monospace' }}>
                  {state.empresa.nombre}
                </h1>
                <p className="text-[10px] mb-2 leading-snug uppercase">
                  {state.empresa.direccion}
                </p>
                <p className="text-[10px] font-bold uppercase">
                  RIF: {state.empresa.rif} | TEL: {state.empresa.telefono}
                </p>
              </div>

              <div className="text-center mb-4 space-y-1">
                <div className="text-[12px] font-bold uppercase">
                  {getReportTitle()}
                </div>
                {isReport && (
                  <div className="text-[10px] font-bold uppercase flex items-center justify-center gap-1">
                    <Monitor size={10} /> TERMINAL: {terminalIdLabel}
                  </div>
                )}
                <div className="text-[10px] font-bold uppercase">
                  FECHA/HORA: {transactionDate}
                </div>
              </div>

              {isReport && type === 'REPORT_Z' && (
                <div className="border-t border-dashed border-black py-2 mb-2 space-y-1 text-[9px] text-center uppercase">
                  <p className="font-bold">DATOS DE CONTROL Y AUDITORÍA</p>
                  <div className="flex justify-between"><span>REPORTE Z N°:</span><span className="font-bold">{String(data.numeroZ || 0).padStart(6, '0')}</span></div>
                  <div className="flex justify-between"><span>RANGO FACTURAS:</span><span>{data.desdeFactura} - {data.hastaFactura}</span></div>
                  <div className="flex justify-between"><span>RANGO NOTAS CRED:</span><span>{data.desdeNC} - {data.hastaNC}</span></div>
                </div>
              )}

              {isReport ? (
                <div className="border-t border-dashed border-black pt-3 mt-3 space-y-4">
                  <div className="space-y-1">
                    <p className="font-bold text-center mb-2 uppercase">RESUMEN DE FACTURACIÓN</p>
                    <div className="flex justify-between"><span>VENTA BRUTA:</span><span>{formatBs(data.brUSD * state.tasa).replace('Bs. ', 'Bs.')}</span></div>
                    <div className="flex justify-between"><span>DESCUENTOS:</span><span>-{formatBs(data.descUSD * state.tasa).replace('Bs. ', 'Bs.')}</span></div>
                    <div className="flex justify-between"><span>DEVOLUCIONES:</span><span>-{formatBs(data.devUSD * state.tasa).replace('Bs. ', 'Bs.')}</span></div>
                    <div className="flex justify-between font-bold border-t border-black pt-1"><span>VENTA NETA:</span><span>{formatBs(data.netUSD * state.tasa).replace('Bs. ', 'Bs.')}</span></div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-center mb-2 uppercase">DESGLOSE FISCAL</p>
                    <div className="flex justify-between"><span>Monto Exento:</span><span>{formatBs((data.exentoUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')}</span></div>
                    <div className="flex justify-between"><span>Base Imponible:</span><span>{formatBs((data.baseImponibleUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')}</span></div>
                    <div className="flex justify-between"><span>IVA Recaudado (16%):</span><span>{formatBs((data.ivaUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')}</span></div>
                    <div className="flex justify-between"><span>Total IGTF (3%):</span><span>{formatBs((data.igtfUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')}</span></div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-center mb-2 uppercase">CONCILIACIÓN DE PAGOS</p>
                    {Object.entries(data.paymentMethods || {}).map(([method, val]) => (
                      <div key={method} className="flex justify-between">
                        <span className="uppercase">{Utils.metodoLabel(method)}:</span>
                        <span>{formatBs((val as number) * state.tasa).replace('Bs. ', 'Bs.')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between"><span>SALIDAS / GASTOS:</span><span>-{formatBs((data.manualSalidas || 0) * state.tasa).replace('Bs. ', 'Bs.')}</span></div>
                  </div>
                </div>
              ) : (
                <div className="border-t border-dashed border-black pt-3">
                  <div className="flex justify-between text-[10px] mb-2 font-bold">
                    <span>N° CONTROL: {data.id}</span>
                  </div>
                  <div className="text-[10px] mb-4 uppercase font-bold">
                    CLIENTE: {customerName}
                  </div>
                  <table className="w-full mb-3">
                    <thead>
                      <tr className="text-[10px] border-b border-dashed border-black">
                        <th className="text-left py-1">PRODUCTO</th>
                        <th className="text-right py-1">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="uppercase">
                      {data.items.map((item: any, idx: number) => (
                        <tr key={idx} className="text-[10px]">
                          <td className="py-1">
                            {item.cantidad || item.qty}x {(item.nombre || item.name).slice(0, 25)}
                          </td>
                          <td className="text-right py-1 font-bold">
                            {formatBs((item.subtotalUSD || (item.price * item.qty)) * state.tasa).replace('Bs. ', 'Bs.')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-black pt-2 space-y-1">
                    <div className="flex justify-between font-bold text-[14px]">
                      <span>TOTAL A PAGAR:</span>
                      <span>{formatBs(data.totalBS).replace('Bs. ', 'Bs.')}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>REF. USD:</span>
                      <span>{formatUsd(data.totalUSD)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-center mt-6 pt-4 border-t border-dotted border-black/30">
                <p className="font-bold mb-2">¡Gracias por su preferencia!</p>
                <p className="opacity-60 text-[8px]">PosVEN Pro v2.5 - RC-8002 optimized</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onClose} className="py-3 bg-[#E5E7EB] text-[#374151] font-black text-xs rounded-xl hover:bg-gray-300 transition-all uppercase tracking-widest">Cerrar</button>
              <button className="py-3 bg-[#2ECC71] text-white font-black text-xs rounded-xl hover:bg-green-600 flex items-center justify-center gap-2 uppercase tracking-widest shadow-sm"><Share2 size={14} /> Compartir</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handlePrint} className="py-3 bg-black text-white font-black text-xs rounded-xl hover:opacity-90 flex items-center justify-center gap-2 uppercase tracking-widest shadow-md"><Printer size={14} /> Estándar</button>
              <button onClick={handleNativePrint} className="py-3 bg-[#C8952E] text-black font-black text-xs rounded-xl hover:bg-[#D9A540] transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg">
                <Zap size={16} className="fill-current" /> Impresión Roccia
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}