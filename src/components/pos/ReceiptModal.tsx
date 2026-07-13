"use client";

import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sale } from '@/lib/types';
import { Printer, Download, X, Zap, Share2 } from 'lucide-react';
import { Store, Utils } from '@/lib/db-store';
import { formatBs, formatUsd } from '@/lib/currency-formatter';

// ✅ Declarar el tipo de electronAPI en Window
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
  sale: Sale;
}

export function ReceiptModal({ isOpen, onClose, sale }: Props) {
  const state = Store.get();
  const printRef = useRef<HTMLDivElement>(null);

  const isCredito = sale.type === 'VENTA CRÉDITO' || sale.metodoPago === 'credito';
  const isCobroDeuda = sale.type === 'COBRO DEUDA';

  const transactionDate = sale.fecha ? new Date(sale.fecha).toLocaleString('es-VE', { timeZone: 'America/Caracas' }) : '';
  const customerName = (sale.cliente || sale.customerName || 'CONSUMIDOR FINAL').toUpperCase();

  // ========== LÓGICA DE IMPRESIÓN NATIVA USB (ELECTRON / ROCCIA) ==========
  const handleNativePrint = async () => {
    if (!window.electronAPI) {
      handleBrowserPrint();
      return;
    }

    const printData = [
      { type: 'text', value: state.empresa.nombre.toUpperCase(), style: { fontWeight: "700", textAlign: 'center', fontSize: "18px" } },
      { type: 'text', value: state.empresa.direccion.toUpperCase(), style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } },
      { type: 'text', value: `RIF: ${state.empresa.rif}`, style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } },
      { type: 'text', value: `TEL: ${state.empresa.telefono}`, style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } },
      { type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } },
      { type: 'text', value: (sale.type || 'RECIBO').toUpperCase(), style: { textAlign: 'center', fontWeight: "700", fontSize: "14px" } },
      { type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } },
      { type: 'text', value: `N° CONTROL: ${sale.id}`, style: { textAlign: 'left', fontSize: "10px", fontWeight: "400" } },
      { type: 'text', value: `FECHA: ${transactionDate}`, style: { textAlign: 'left', fontSize: "10px", fontWeight: "400" } },
      { type: 'text', value: `CLIENTE: ${customerName}`, style: { textAlign: 'left', fontSize: "10px", fontWeight: "400" } },
      { type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } }
    ];

    // Items de venta
    sale.items.forEach(item => {
      printData.push({
        type: 'text',
        value: `${item.cantidad || item.qty}x ${ (item.nombre || item.name).toUpperCase().slice(0, 20) }`,
        style: { fontWeight: "700", textAlign: 'left', fontSize: "10px" }
      });
      const price = item.precioUnitUSD || item.price;
      printData.push({
        type: 'text',
        value: `    Ref: ${formatBs(price * state.tasa)} | Total: ${formatBs((price * (item.cantidad || item.qty)) * state.tasa)}`,
        style: { fontSize: "10px", textAlign: 'left', fontWeight: "400" }
      });
    });

    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });

    // Totales
    printData.push({ 
      type: 'text', 
      value: `TOTAL A PAGAR: ${formatBs(sale.totalBS)}`, 
      style: { textAlign: 'right', fontWeight: "700", fontSize: "15px" } 
    });
    printData.push({ 
      type: 'text', 
      value: `REF. DIVISAS: ${formatUsd(sale.totalUSD)}`, 
      style: { textAlign: 'right', fontSize: "11px", fontWeight: "400" } 
    });

    if (!isCredito && !isCobroDeuda) {
      const receivedBs = (sale.received || 0) * (sale.metodoPago === 'efectivo_usd' ? 1 : state.tasa); // Simplificado
      printData.push({ type: 'text', value: `PAGADO: ${formatBs(sale.totalBS)}`, style: { textAlign: 'right', fontSize: "10px" } });
      printData.push({ type: 'text', value: `CAMBIO: ${formatBs(sale.change || 0)}`, style: { textAlign: 'right', fontSize: "10px" } });
    }

    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });
    printData.push({ type: 'text', value: '¡GRACIAS POR SU PREFERENCIA!', style: { textAlign: 'center', fontWeight: "700", fontSize: "11px" } });
    printData.push({ type: 'text', value: 'PosVEN Pro Cloud Sync v2.5', style: { textAlign: 'center', fontSize: "8px", fontWeight: "400" } });

    try {
      await window.electronAPI.printTicket(printData);
    } catch (e) {
      console.error('Error de hardware:', e);
      handleBrowserPrint();
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 bg-transparent border-none overflow-visible shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Recibo Profesional {sale.id}</DialogTitle>
        </DialogHeader>

        <div className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border border-gray-200">
          {/* Header Modal */}
          <div className="bg-black p-3.5 flex justify-between items-center border-b border-gray-800">
            <h3 className="text-white font-black text-xs flex items-center gap-2 tracking-widest uppercase">
              <Printer size={14} className="text-brand-gold" /> Vista Previa del Ticket
            </h3>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Area del Recibo (Simulación 80mm) */}
          <div className="p-4 max-h-[60vh] overflow-y-auto bg-gray-100 flex justify-center">
            <div 
              ref={printRef}
              className="bg-white p-5 shadow-sm text-black font-mono select-none"
              style={{ width: '72mm', boxSizing: 'border-box', color: '#000', fontSize: '10px', lineHeight: '1.2' }}
            >
              <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                <h1 className="text-sm font-black uppercase mb-0.5">{state.empresa.nombre}</h1>
                <p className="text-[9px] font-bold leading-tight">{state.empresa.direccion}</p>
                <p className="text-[9px]">RIF: {state.empresa.rif}</p>
                <p className="text-[9px]">TEL: {state.empresa.telefono}</p>
              </div>

              <div className="text-center mb-2">
                <span className={`px-2 py-0.5 text-[10px] font-black text-white ${isCredito ? 'bg-red-600' : 'bg-black'} inline-block uppercase`}>
                  {sale.type || 'RECIBO DE VENTA'}
                </span>
              </div>

              <div className="space-y-0.5 mb-2 text-[9px]">
                <div className="flex justify-between"><span>N° CONTROL:</span><span className="font-black">#{sale.id}</span></div>
                <div className="flex justify-between"><span>FECHA:</span><span>{transactionDate}</span></div>
                <div className="flex justify-between uppercase"><span>CLIENTE:</span><span>{customerName}</span></div>
              </div>

              <table className="w-full border-t border-b border-dashed border-black my-2">
                <thead>
                  <tr className="text-[9px] font-black uppercase">
                    <th className="text-left py-1">CANT</th>
                    <th className="text-left py-1 pl-1">DESCRIPCIÓN</th>
                    <th className="text-right py-1">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item, idx) => {
                    const price = item.precioUnitUSD || item.price;
                    const subtotal = (item.subtotalUSD || (item.price * item.qty)) * state.tasa;
                    return (
                      <tr key={idx} className="text-[9px]">
                        <td className="py-1 align-top font-black">{item.cantidad || item.qty}x</td>
                        <td className="py-1 pl-1 align-top">
                          <div className="font-bold uppercase">{(item.nombre || item.name).slice(0, 22)}</div>
                          <div className="text-[8px] opacity-70 italic">Ref: {formatBs(price * state.tasa)}</div>
                        </td>
                        <td className="py-1 text-right align-top font-black">{formatBs(subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="space-y-0.5 border-b border-dashed border-black pb-2 mb-2">
                <div className="flex justify-between font-black text-xs py-1 border-t border-black">
                  <span>TOTAL BS:</span>
                  <span>{formatBs(sale.totalBS)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>REF. DIVISAS:</span>
                  <span>{formatUsd(sale.totalUSD)}</span>
                </div>
              </div>

              {isCredito && (
                <div className="text-center py-1 border-2 border-dashed border-red-600 mb-2">
                   <p className="font-black text-[9px] text-red-600 uppercase">Documento de Crédito</p>
                </div>
              )}

              <div className="text-center mt-3 pt-2 text-[8px] italic border-t border-dotted border-black/30">
                <p className="font-black uppercase mb-0.5">¡Gracias por su preferencia!</p>
                <p>Conserve este ticket como comprobante</p>
                <p className="mt-2 opacity-50 uppercase">PosVEN Pro Cloud Sync</p>
              </div>
            </div>
          </div>

          {/* Footer Botones */}
          <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 bg-gray-200 text-slate-800 font-black text-[10px] rounded-lg hover:bg-gray-300 transition-all uppercase tracking-widest">Cerrar</button>
              <button className="flex-1 py-2 bg-green-600 text-white font-black text-[10px] rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 uppercase tracking-widest shadow-sm"><Share2 size={12} /> Compartir</button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleBrowserPrint} className="flex-1 py-2 bg-slate-800 text-white font-black text-[10px] rounded-lg hover:bg-black flex items-center justify-center gap-2 uppercase tracking-widest shadow-sm"><Printer size={12} /> Estándar</button>
              <button onClick={handleNativePrint} className="flex-1 py-2 bg-brand-gold text-black font-black text-[10px] rounded-lg hover:bg-brand-gold-deep transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg border-b-4 border-brand-gold-deep active:border-b-0 active:translate-y-1">
                <Zap size={14} className="fill-current" /> Impresión USB
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
