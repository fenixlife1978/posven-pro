"use client";

import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sale, ReportZ } from '@/lib/types';
import { Printer, X, Zap, Share2, Monitor } from 'lucide-react';
import { Store, Utils } from '@/lib/db-store';
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
  sale?: any; // Puede ser Sale o datos de Reporte
  reportData?: any; // Para reportes X/Z
  type?: 'SALE' | 'REPORT_X' | 'REPORT_Z';
}

export function ReceiptModal({ isOpen, onClose, sale, reportData, type = 'SALE' }: Props) {
  const state = Store.get();
  const printRef = useRef<HTMLDivElement>(null);

  const isReport = type === 'REPORT_X' || type === 'REPORT_Z';
  const data = isReport ? reportData : sale;
  
  if (!data) return null;

  const transactionDate = data.fecha ? new Date(data.fecha).toLocaleString('es-VE', { timeZone: 'America/Caracas' }) : new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
  const customerName = (data.cliente || 'CONSUMIDOR FINAL').toUpperCase();
  const terminalIdLabel = data.terminalName || 'SISTEMA GLOBAL';

  // ========== LÓGICA DE IMPRESIÓN NATIVA USB (ELECTRON / ROCCIA) ==========
  const handleNativePrint = async () => {
    if (!window.electronAPI) {
      window.print();
      return;
    }

    let printData: any[] = [
      { type: 'text', value: state.empresa.nombre.toUpperCase(), style: { fontWeight: "700", textAlign: 'center', fontSize: "18px" } },
      { type: 'text', value: state.empresa.direccion.toUpperCase(), style: { textAlign: 'center', fontSize: "10px" } },
      { type: 'text', value: `RIF: ${state.empresa.rif}`, style: { textAlign: 'center', fontSize: "10px" } },
      { type: 'text', value: `TEL: ${state.empresa.telefono}`, style: { textAlign: 'center', fontSize: "10px" } },
      { type: 'text', value: '--------------------------------', style: { textAlign: 'center' } }
    ];

    if (isReport) {
      printData.push({ type: 'text', value: `REPORTE ${type === 'REPORT_X' ? 'X' : 'Z'}`, style: { textAlign: 'center', fontWeight: "700", fontSize: "14px" } });
      printData.push({ type: 'text', value: `TERMINAL: ${terminalIdLabel.toUpperCase()}`, style: { textAlign: 'center', fontWeight: "700", fontSize: "11px" } });
      printData.push({ type: 'text', value: `FECHA: ${transactionDate}`, style: { fontSize: "10px" } });
      printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });
      printData.push({ type: 'text', value: `VENTAS BRUTAS: ${formatBs(data.brUSD * state.tasa)}`, style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: `TOTAL NETO: ${formatBs(data.netUSD * state.tasa)}`, style: { fontSize: "12px", fontWeight: "700" } });
    } else {
      printData.push({ type: 'text', value: (data.type || 'RECIBO').toUpperCase(), style: { textAlign: 'center', fontWeight: "700", fontSize: "14px" } });
      printData.push({ type: 'text', value: `N° CONTROL: ${data.id}`, style: { fontSize: "10px" } });
      printData.push({ type: 'text', value: `FECHA: ${transactionDate}`, style: { fontSize: "10px" } });
      printData.push({ type: 'text', value: `CLIENTE: ${customerName}`, style: { fontSize: "10px" } });
      printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });

      data.items.forEach((item: any) => {
        printData.push({ type: 'text', value: `${item.cantidad}x ${item.nombre.toUpperCase().slice(0, 20)}`, style: { fontWeight: "700", fontSize: "10px" } });
        printData.push({ type: 'text', value: `    Total: ${formatBs(item.subtotalUSD * state.tasa)}`, style: { fontSize: "10px" } });
      });

      printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });
      printData.push({ type: 'text', value: `TOTAL A PAGAR: ${formatBs(data.totalBS)}`, style: { textAlign: 'right', fontWeight: "700", fontSize: "15px" } });
      printData.push({ type: 'text', value: `REF. DIVISAS: ${formatUsd(data.totalUSD)}`, style: { textAlign: 'right', fontSize: "11px" } });
    }

    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });
    printData.push({ type: 'text', value: '¡GRACIAS POR SU PREFERENCIA!', style: { textAlign: 'center', fontWeight: "700", fontSize: "11px" } });
    printData.push({ type: 'text', value: 'PosVEN Pro Cloud Sync v2.5', style: { textAlign: 'center', fontSize: "8px" } });

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
          <DialogTitle>Vista Previa de Impresión</DialogTitle>
        </DialogHeader>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200">
          {/* Header Modal - Navy Blue */}
          <div className="bg-[#1A2C4E] p-4 flex justify-between items-center">
            <h3 className="text-white font-black text-xs flex items-center gap-2 tracking-widest uppercase">
              <Printer size={16} className="text-brand-gold" /> Vista Previa del Recibo
            </h3>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Area del Recibo con Scroll Vertical */}
          <div className="p-6 bg-gray-100 flex justify-center max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div 
              ref={printRef}
              className="bg-white p-6 shadow-sm text-black font-mono select-none"
              style={{ width: '72mm', boxSizing: 'border-box', color: '#000', fontSize: '11px', lineHeight: '1.2' }}
            >
              <div className="text-center border-b border-dashed border-black pb-3 mb-3">
                <h1 className="text-lg font-black uppercase mb-1">{state.empresa.nombre}</h1>
                <p className="text-[10px] font-bold leading-tight">{state.empresa.direccion}</p>
                <p className="text-[10px]">RIF: {state.empresa.rif}</p>
                <p className="text-[10px]">TEL: {state.empresa.telefono}</p>
              </div>

              <div className="text-center mb-3">
                <div className="bg-black text-white px-3 py-1 text-[11px] font-black uppercase inline-block mb-1">
                  {isReport ? `REPORTE ${type === 'REPORT_X' ? 'X' : 'Z'}` : (data.type || 'RECIBO')}
                </div>
                {isReport && (
                  <div className="text-[10px] font-black uppercase flex items-center justify-center gap-1">
                    <Monitor size={10} /> TERMINAL: {terminalIdLabel}
                  </div>
                )}
              </div>

              <div className="space-y-1 mb-3 text-[10px]">
                {!isReport && <div className="flex justify-between"><span>RECIBO N°:</span><span className="font-black">{data.id}</span></div>}
                <div className="flex justify-between"><span>FECHA:</span><span>{transactionDate}</span></div>
                {!isReport && <div className="flex justify-between uppercase"><span>CLIENTE:</span><span>{customerName}</span></div>}
              </div>

              {isReport ? (
                <div className="border-t border-b border-dashed border-black py-3 my-3 space-y-2">
                  <div className="flex justify-between font-black text-sm"><span>VENTAS BRUTAS:</span><span>{formatBs(data.brUSD * state.tasa)}</span></div>
                  <div className="flex justify-between text-status-danger"><span>DEVOLUCIONES:</span><span>-{formatBs(data.devUSD * state.tasa)}</span></div>
                  <div className="flex justify-between"><span>DESCUENTOS:</span><span>-{formatBs(data.descUSD * state.tasa)}</span></div>
                  <div className="flex justify-between font-black text-base border-t border-black pt-2"><span>TOTAL NETO:</span><span>{formatBs(data.netUSD * state.tasa)}</span></div>
                  <div className="pt-2 text-[9px] uppercase space-y-1">
                    <p className="font-black border-b border-dotted pb-1">Desglose de Impuestos</p>
                    <div className="flex justify-between"><span>Base Imponible (16%):</span><span>{formatBs(data.baseImponibleUSD * state.tasa)}</span></div>
                    <div className="flex justify-between"><span>IVA Recaudado:</span><span>{formatBs(data.ivaUSD * state.tasa)}</span></div>
                    <div className="flex justify-between font-bold"><span>Total IGTF (3%):</span><span>{formatBs(data.igtfUSD * state.tasa)}</span></div>
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
                          <td className="py-2 text-right align-top font-black">{formatBs(subtotal)}</td>
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
                  <div className="flex justify-between text-[10px] pt-1"><span>MONTO RECIBIDO:</span><span>{formatBs(data.totalBS)}</span></div>
                </div>
              )}

              <div className="text-center mt-5 pt-3 text-[9px] italic border-t border-dotted border-black/30">
                <p className="font-black uppercase mb-1">¡Gracias por su preferencia!</p>
                <p>Conserve este ticket como comprobante</p>
                <p className="mt-3 opacity-50 uppercase font-bold">PosVEN Pro Cloud Sync</p>
              </div>
            </div>
          </div>

          {/* Footer Botones - Estilo imagen */}
          <div className="p-4 bg-white border-t border-gray-100 grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 bg-[#E5E7EB] text-[#374151] font-black text-xs rounded-xl hover:bg-gray-300 transition-all uppercase tracking-widest">Cerrar</button>
            <button className="py-3 bg-[#2ECC71] text-white font-black text-xs rounded-xl hover:bg-green-600 flex items-center justify-center gap-2 uppercase tracking-widest shadow-sm"><Share2 size={14} /> Compartir</button>
            <button onClick={() => window.print()} className="py-3 bg-[#1A2C4E] text-white font-black text-xs rounded-xl hover:bg-black flex items-center justify-center gap-2 uppercase tracking-widest shadow-md"><Printer size={14} /> Estándar</button>
            <button onClick={handleNativePrint} className="py-3 bg-[#C8952E] text-black font-black text-xs rounded-xl hover:bg-[#D9A540] transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg">
              <Zap size={16} className="fill-current" /> Impresión USB
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
