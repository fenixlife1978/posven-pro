"use client";

import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, X, Zap, Share2, Monitor, User } from 'lucide-react';
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
  const terminalIdLabel = data.terminalName || 'SISTEMA GLOBAL';
  
  const getReportTitle = () => {
    if (type === 'REPORT_Z') return `REPORTE FISCAL Z ${String(data.numeroZ || 0).padStart(4, '0')}`;
    if (type === 'REPORT_X') return `REPORTE X - LECTURA PARCIAL`;
    return (data.type || 'RECIBO').toUpperCase();
  };

  const padRight = (label: string, value: string, width = 48) => {
    const dots = width - label.length - value.length;
    return label + (dots > 0 ? '.'.repeat(dots) : ' ') + value;
  };

  const handleNativePrint = async () => {
    if (!window.electronAPI) {
      window.print();
      if (isReport) setTimeout(onClose, 1000);
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
      printData.push({ type: 'text', value: `TERMINAL: ${terminalIdLabel.toUpperCase()}`, style: { textAlign: 'center', fontWeight: "700", fontSize: "12px" } });
      printData.push({ type: 'text', value: `FECHA: ${transactionDate}`, style: { fontSize: "11px", textAlign: 'center' } });
      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
      
      printData.push({ type: 'text', value: 'RESUMEN DE FACTURACIÓN', style: { textAlign: 'center', fontWeight: "800" } });
      printData.push({ type: 'text', value: padRight('VENTA BRUTA', formatBs(data.brUSD * state.tasa)), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('DESCUENTOS', formatBs(data.descUSD * state.tasa)), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('DEVOLUCIONES', '-' + formatBs(data.devUSD * state.tasa)), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('VENTA NETA', formatBs(data.netUSD * state.tasa)), style: { fontSize: "12px", fontWeight: "700" } });
      printData.push({ type: 'text', value: DOTS, style: { fontSize: "11px" } });

      printData.push({ type: 'text', value: 'DESGLOSE FISCAL', style: { textAlign: 'center', fontWeight: "800" } });
      printData.push({ type: 'text', value: padRight('VENTAS EXENTAS (0%)', formatBs((data.exentoUSD || 0) * state.tasa)), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('BASE IMPONIBLE (16%)', formatBs((data.baseImponibleUSD || 0) * state.tasa)), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('IVA RECAUDADO (16%)', formatBs((data.ivaUSD || 0) * state.tasa)), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('IGTF RECAUDADO (3%)', formatBs((data.igtfUSD || 0) * state.tasa)), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: DOTS, style: { fontSize: "11px" } });

      printData.push({ type: 'text', value: 'CONCILIACIÓN DE PAGOS', style: { textAlign: 'center', fontWeight: "800" } });
      Object.entries(data.paymentMethods || {}).forEach(([method, val]) => {
        printData.push({ type: 'text', value: padRight(Utils.metodoLabel(method).toUpperCase(), formatBs((val as number) * state.tasa)), style: { fontSize: "11px" } });
      });
      printData.push({ type: 'text', value: padRight('SALIDAS / GASTOS CAJA', '-' + formatBs((data.manualSalidas || 0) * state.tasa)), style: { fontSize: "11px", color: "#C0392B" } });
      printData.push({ type: 'text', value: DOTS, style: { fontSize: "11px" } });

      printData.push({ type: 'text', value: 'ESTADÍSTICAS', style: { textAlign: 'center', fontWeight: "800" } });
      printData.push({ type: 'text', value: padRight('FACTURAS EMITIDAS', String(data.stats.facturas)), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('DEVOLUCIONES PROCESADAS', String(data.stats.devoluciones)), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: padRight('TICKET PROMEDIO', formatBs(data.stats.ticketPromedio * state.tasa)), style: { fontSize: "11px" } });

    } else {
      printData.push({ type: 'text', value: getReportTitle(), style: { textAlign: 'center', fontWeight: "800", fontSize: "16px" } });
      printData.push({ type: 'text', value: `N° CONTROL: ${data.id}`, style: { fontSize: "11px", fontWeight: "700" } });
      printData.push({ type: 'text', value: `FECHA: ${transactionDate}`, style: { fontSize: "11px" } });
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
          value: `      Subtotal: ${formatBs((item.subtotalUSD || (item.price * item.qty)) * state.tasa)}`, 
          style: { fontSize: "10px", textAlign: 'left' } 
        });
      });

      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
      printData.push({ type: 'text', value: padRight('TOTAL A PAGAR', formatBs(data.totalBS)), style: { textAlign: 'right', fontWeight: "800", fontSize: "18px" } });
      printData.push({ type: 'text', value: padRight('REF. DIVISAS', formatUsd(data.totalUSD)), style: { textAlign: 'right', fontSize: "12px" } });
    }

    printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
    printData.push({ type: 'text', value: 'PosVEN Pro Cloud v2.5 - RC-8002 optimized\n\n\n', style: { textAlign: 'center', fontSize: "8px" } });

    try {
      await window.electronAPI.printTicket(printData);
      if (isReport) setTimeout(onClose, 1000);
    } catch (e) {
      window.print();
    }
  };

  const handlePrint = () => {
    window.print();
    if (isReport) setTimeout(onClose, 1000);
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
              className="bg-white p-6 shadow-sm text-black font-mono select-none"
              style={{ width: '72mm', boxSizing: 'border-box', color: '#000', fontSize: '11px', lineHeight: '1.4' }}
            >
              <div className="text-center pb-3 mb-3 border-b border-dashed border-black">
                <h1 className="text-lg font-black uppercase mb-1 leading-tight">{state.empresa.nombre}</h1>
                <p className="text-[10px] font-bold leading-tight">{state.empresa.direccion}</p>
                <p className="text-[10px]">RIF: {state.empresa.rif} | TEL: {state.empresa.telefono}</p>
              </div>

              <div className="text-center mb-4">
                <div className="bg-black text-white px-4 py-1 text-[11px] font-black uppercase inline-block mb-1">
                  {getReportTitle()}
                </div>
                {isReport && (
                  <div className="text-[9px] font-black uppercase flex items-center justify-center gap-1 mt-1 opacity-70">
                    <Monitor size={10} /> TERMINAL: {terminalIdLabel}
                  </div>
                )}
              </div>

              <div className="space-y-1 mb-4 text-[10px]">
                <div className="flex justify-between items-center"><span className="font-bold">FECHA/HORA:</span><span className="font-bold">{transactionDate}</span></div>
                {!isReport && (
                  <>
                    <div className="flex justify-between"><span>RECIBO N°:</span><span className="font-black">{data.id}</span></div>
                    <div className="flex justify-between uppercase"><span>CLIENTE:</span><span>{customerName}</span></div>
                  </>
                )}
              </div>

              {isReport ? (
                <div className="border-t border-b border-dashed border-black py-3 my-3 space-y-4">
                  <div className="space-y-1">
                    <p className="font-black text-center border-b border-dotted pb-1 mb-1">RESUMEN DE FACTURACIÓN</p>
                    <div className="flex justify-between"><span>VENTA BRUTA:</span><span>{formatBs(data.brUSD * state.tasa)}</span></div>
                    <div className="flex justify-between"><span>DESCUENTOS:</span><span>-{formatBs(data.descUSD * state.tasa)}</span></div>
                    <div className="flex justify-between text-status-danger"><span>DEVOLUCIONES:</span><span>-{formatBs(data.devUSD * state.tasa)}</span></div>
                    <div className="flex justify-between font-black text-sm border-t border-black pt-1"><span>VENTA NETA:</span><span>{formatBs(data.netUSD * state.tasa)}</span></div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-black text-center border-b border-dotted pb-1 mb-1">DESGLOSE FISCAL</p>
                    <div className="flex justify-between"><span>Monto Exento:</span><span>{formatBs((data.exentoUSD || 0) * state.tasa)}</span></div>
                    <div className="flex justify-between"><span>Base Imponible:</span><span>{formatBs((data.baseImponibleUSD || 0) * state.tasa)}</span></div>
                    <div className="flex justify-between"><span>IVA Recaudado:</span><span>{formatBs((data.ivaUSD || 0) * state.tasa)}</span></div>
                    <div className="flex justify-between font-bold"><span>Total IGTF (3%):</span><span>{formatBs((data.igtfUSD || 0) * state.tasa)}</span></div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-black text-center border-b border-dotted pb-1 mb-1">CONCILIACIÓN DE PAGOS</p>
                    {Object.entries(data.paymentMethods || {}).map(([method, val]) => (
                      <div key={method} className="flex justify-between">
                        <span>{Utils.metodoLabel(method).toUpperCase()}:</span>
                        <span>{formatBs((val as number) * state.tasa)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-status-danger"><span>SALIDAS / GASTOS:</span><span>-{formatBs((data.manualSalidas || 0) * state.tasa)}</span></div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-black text-center border-b border-dotted pb-1 mb-1">ESTADÍSTICAS</p>
                    <div className="flex justify-between"><span>Facturas Emitidas:</span><span>{data.stats.facturas}</span></div>
                    <div className="flex justify-between"><span>Devoluciones:</span><span>{data.stats.devoluciones}</span></div>
                    <div className="flex justify-between font-bold"><span>Ticket Promedio:</span><span>{formatBs(data.stats.ticketPromedio * state.tasa)}</span></div>
                  </div>
                </div>
              ) : (
                <table className="w-full border-t border-b border-dashed border-black my-3">
                  <thead>
                    <tr className="text-[10px] font-black uppercase">
                      <th className="text-left py-2">CANT</th>
                      <th className="text-left py-2 pl-2">PRODUCTO</th>
                      <th className="text-right py-2">TOTAL (Bs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item: any, idx: number) => {
                      const subtotal = (item.subtotalUSD || (item.price * item.qty)) * state.tasa;
                      return (
                        <tr key={idx} className="text-[10px]">
                          <td className="py-2 align-top font-black">{item.cantidad || item.qty} x</td>
                          <td className="py-2 pl-2 align-top uppercase">
                            <div className="font-bold">{(item.nombre || item.name).slice(0, 22)}</div>
                            <div className="text-[8px] opacity-70 italic">Ref: {formatBs((item.precioUnitUSD || item.price) * state.tasa)}</div>
                          </td>
                          <td className="py-2 text-right align-top font-black">{formatBs(subtotal).replace('Bs. ', '')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {!isReport && (
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between font-black text-sm py-2 border-t border-black"><span>TOTAL A PAGAR:</span><span>{formatBs(data.totalBS)}</span></div>
                  <div className="flex justify-between text-[11px] font-bold"><span>REF. DIVISAS:</span><span>{formatUsd(data.totalUSD)}</span></div>
                </div>
              )}

              <div className="text-center mt-5 pt-3 text-[8px] border-t border-dotted border-black/30">
                <p className="font-black uppercase mb-1">¡Gracias por su preferencia!</p>
                <p className="opacity-50 uppercase font-bold text-[7px]">PosVEN Pro v2.5 - RC-8002 optimized</p>
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
