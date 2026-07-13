"use client";

import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, X, Zap, Share2, Monitor } from 'lucide-react';
import { Store } from '@/lib/db-store';
import { formatBs, formatUsd } from '@/lib/currency-formatter';

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

  // Formateador de fecha local para Venezuela (Exacto al solicitado)
  const transactionDate = new Date(data.fecha || Date.now()).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const customerName = (data.cliente || 'CONSUMIDOR FINAL').toUpperCase();
  const terminalIdLabel = data.terminalName || 'SISTEMA GLOBAL';

  const handleNativePrint = async () => {
    if (!window.electronAPI) {
      window.print();
      return;
    }

    const SEPARATOR = '------------------------------------------------';
    
    let printData: any[] = [
      { type: 'text', value: state.empresa.nombre.toUpperCase(), style: { fontWeight: "800", textAlign: 'center', fontSize: "20px" } },
      { type: 'text', value: state.empresa.direccion.toUpperCase(), style: { textAlign: 'center', fontSize: "11px" } },
      { type: 'text', value: `RIF: ${state.empresa.rif}`, style: { textAlign: 'center', fontSize: "11px" } },
      { type: 'text', value: `TEL: ${state.empresa.telefono}`, style: { textAlign: 'center', fontSize: "11px" } },
      { type: 'text', value: SEPARATOR, style: { textAlign: 'center' } }
    ];

    if (isReport) {
      printData.push({ type: 'text', value: `REPORTE ${type === 'REPORT_X' ? 'X' : 'Z'}`, style: { textAlign: 'center', fontWeight: "800", fontSize: "16px" } });
      printData.push({ type: 'text', value: `TERMINAL: ${terminalIdLabel.toUpperCase()}`, style: { textAlign: 'center', fontWeight: "700", fontSize: "12px" } });
      printData.push({ type: 'text', value: `FECHA: ${transactionDate}`, style: { fontSize: "11px", textAlign: 'center' } });
      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
      
      printData.push({ type: 'text', value: `VENTAS BRUTAS: ${formatBs(data.brUSD * state.tasa)}`, style: { fontSize: "12px", fontWeight: "700" } });
      printData.push({ type: 'text', value: `DEVOLUCIONES:  -${formatBs(data.devUSD * state.tasa)}`, style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: `MONTO EXENTO:   ${formatBs((data.exentoUSD || 0) * state.tasa)}`, style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: `BASE IMPONIBLE: ${formatBs((data.baseImponibleUSD || 0) * state.tasa)}`, style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: `IVA RECAUDADO:  ${formatBs((data.ivaUSD || 0) * state.tasa)}`, style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: `TOTAL IGTF 3%:  ${formatBs((data.igtfUSD || 0) * state.tasa)}`, style: { fontSize: "11px", fontWeight: "700" } });
      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
      printData.push({ type: 'text', value: `TOTAL NETO:    ${formatBs(data.netUSD * state.tasa)}`, style: { fontSize: "14px", fontWeight: "800", textAlign: 'right' } });
    } else {
      printData.push({ type: 'text', value: (data.type || 'RECIBO').toUpperCase(), style: { textAlign: 'center', fontWeight: "800", fontSize: "16px" } });
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
      printData.push({ type: 'text', value: `TOTAL A PAGAR: ${formatBs(data.totalBS)}`, style: { textAlign: 'right', fontWeight: "800", fontSize: "18px" } });
      printData.push({ type: 'text', value: `REF. DIVISAS: ${formatUsd(data.totalUSD)}`, style: { textAlign: 'right', fontSize: "12px" } });
    }

    printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
    printData.push({ type: 'text', value: '¡GRACIAS POR SU PREFERENCIA!', style: { textAlign: 'center', fontWeight: "700", fontSize: "12px" } });
    printData.push({ type: 'text', value: 'PosVEN Pro Cloud Sync v2.5\n\n\n', style: { textAlign: 'center', fontSize: "9px" } });

    try {
      await window.electronAPI.printTicket(printData);
    } catch (e) {
      window.print();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] p-0 bg-transparent border-none overflow-hidden shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Vista Previa de Impresión 80mm</DialogTitle>
        </DialogHeader>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200">
          <div className="bg-black p-4 flex justify-between items-center">
            <h3 className="text-white font-black text-xs flex items-center gap-2 tracking-widest uppercase">
              <Printer size={16} className="text-brand-gold" /> ROCCIA RC-8002 (80MM)
            </h3>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 bg-gray-100 flex justify-center max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div 
              ref={printRef}
              className="bg-white p-6 shadow-sm text-black font-mono select-none"
              style={{ width: '72mm', boxSizing: 'border-box', color: '#000', fontSize: '11px', lineHeight: '1.4' }}
            >
              <div className="text-center pb-3 mb-3">
                <h1 className="text-lg font-black uppercase mb-1 leading-tight">{state.empresa.nombre}</h1>
                <p className="text-[10px] font-bold leading-tight">{state.empresa.direccion}</p>
                <p className="text-[10px]">RIF: {state.empresa.rif}</p>
                <p className="text-[10px]">TEL: {state.empresa.telefono}</p>
              </div>

              <div className="text-center mb-4 border-t border-dashed border-black pt-3">
                <div className="bg-black text-white px-4 py-1 text-[11px] font-black uppercase inline-block mb-1">
                  {isReport ? `REPORTE ${type === 'REPORT_X' ? 'X' : 'Z'}` : (data.type || 'RECIBO')}
                </div>
                {isReport && (
                  <div className="text-[10px] font-black uppercase flex items-center justify-center gap-1 mt-1">
                    <Monitor size={10} /> TERMINAL: {terminalIdLabel}
                  </div>
                )}
              </div>

              <div className="space-y-1 mb-4 text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="font-bold">FECHA:</span>
                  <span className="font-bold">{transactionDate}</span>
                </div>
                {!isReport && (
                  <>
                    <div className="flex justify-between"><span>RECIBO N°:</span><span className="font-black">{data.id}</span></div>
                    <div className="flex justify-between uppercase"><span>CLIENTE:</span><span>{customerName}</span></div>
                  </>
                )}
              </div>

              {isReport ? (
                <div className="border-t border-b border-dashed border-black py-3 my-3 space-y-3">
                  <div className="flex justify-between font-black text-sm">
                    <span className="text-sm">VENTAS<br/>BRUTAS:</span>
                    <span className="text-right">Bs.<br/>{formatBs(data.brUSD * state.tasa).replace('Bs. ', '')}</span>
                  </div>
                  <div className="flex justify-between text-status-danger text-[10px] font-bold">
                    <span>DEVOLUCIONES:</span>
                    <span>-Bs. {formatBs(data.devUSD * state.tasa).replace('Bs. ', '')}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>DESCUENTOS:</span>
                    <span>-Bs. {formatBs(data.descUSD * state.tasa).replace('Bs. ', '')}</span>
                  </div>
                  <div className="flex justify-between font-black text-lg border-t border-black pt-2">
                    <span>TOTAL<br/>NETO:</span>
                    <span className="text-right">Bs.<br/>{formatBs(data.netUSD * state.tasa).replace('Bs. ', '')}</span>
                  </div>
                  <div className="pt-3 text-[9px] uppercase space-y-1 border-t border-dotted border-black/20">
                    <p className="font-black border-b border-dotted pb-1 text-center">DESGLOSE FISCAL DEL PERIODO</p>
                    <div className="flex justify-between"><span>Monto Exento:</span><span>{formatBs((data.exentoUSD || 0) * state.tasa)}</span></div>
                    <div className="flex justify-between"><span>Base Imponible:</span><span>{formatBs((data.baseImponibleUSD || 0) * state.tasa)}</span></div>
                    <div className="flex justify-between"><span>IVA Recaudado:</span><span>{formatBs((data.ivaUSD || 0) * state.tasa)}</span></div>
                    <div className="flex justify-between font-bold"><span>Total IGTF (3%):</span><span>{formatBs((data.igtfUSD || 0) * state.tasa)}</span></div>
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
                            <div className="text-[9px] opacity-70 italic">Ref: {formatBs((item.precioUnitUSD || item.price) * state.tasa)}</div>
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
                  <div className="flex justify-between text-[10px]"><span>SUBTOTAL:</span><span>{formatBs(data.totalBS)}</span></div>
                  <div className="flex justify-between font-black text-sm py-2 border-t border-black">
                    <span>TOTAL A PAGAR:</span>
                    <span>{formatBs(data.totalBS)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold">
                    <span>REF. DIVISAS:</span>
                    <span>{formatUsd(data.totalUSD)}</span>
                  </div>
                </div>
              )}

              <div className="text-center mt-5 pt-3 text-[9px] italic border-t border-dotted border-black/30">
                <p className="font-black uppercase mb-1 leading-tight">¡Gracias por su preferencia!</p>
                <p>Conserve este ticket como comprobante</p>
                <p className="mt-3 opacity-40 uppercase font-bold text-[7px]">PosVEN Pro RC-8002 optimized</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onClose} className="py-3 bg-[#E5E7EB] text-[#374151] font-black text-xs rounded-xl hover:bg-gray-300 transition-all uppercase tracking-widest">Cerrar</button>
              <button className="py-3 bg-[#2ECC71] text-white font-black text-xs rounded-xl hover:bg-green-600 flex items-center justify-center gap-2 uppercase tracking-widest shadow-sm"><Share2 size={14} /> Compartir</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => window.print()} className="py-3 bg-black text-white font-black text-xs rounded-xl hover:opacity-90 flex items-center justify-center gap-2 uppercase tracking-widest shadow-md"><Printer size={14} /> Estándar</button>
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
