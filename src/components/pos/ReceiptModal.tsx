"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sale } from '@/lib/types';
import { Printer, Download, X } from 'lucide-react';
import { Store } from '@/lib/db-store';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
}

export function ReceiptModal({ isOpen, onClose, sale }: Props) {
  const state = Store.get();
  
  const handlePrint = () => {
    // Detectamos si estamos en Electron para impresión directa Roccia
    if (window.electronAPI) {
      const printData = {
        id: sale.id,
        date: new Date(sale.date).toLocaleString('es-VE'),
        customerName: sale.customerName,
        empresa: state.empresa,
        items: sale.items.map((it: any) => ({
          name: it.name || it.nombre,
          qty: it.qty || it.cantidad,
          subtotal: it.subtotalUSD || (it.price * it.qty)
        })),
        totals: [
          { label: 'TOTAL BS', value: sale.totalBS.toFixed(2) },
          { label: 'TOTAL USD', value: sale.totalUSD.toFixed(2) }
        ],
        type: sale.type || 'RECIBO'
      };
      window.electronAPI.printTicket(printData);
    } else {
      window.print();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xs p-0 bg-transparent border-none overflow-visible shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Informe de Venta {sale.id}</DialogTitle>
        </DialogHeader>

        <div className="bg-white text-black p-6 font-mono text-[11px] leading-tight rounded-sm shadow-2xl relative">
          <Button variant="ghost" size="icon" className="absolute -top-4 -right-4 bg-primary text-white hover:bg-primary/90 no-print" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>

          <div className="text-center mb-4">
            <h3 className="font-bold text-sm uppercase">{state.empresa.nombre}</h3>
            <p>RIF: {state.empresa.rif}</p>
            <p>{state.empresa.direccion}</p>
            <p>TEL: {state.empresa.telefono}</p>
          </div>

          <div className="border-t border-dashed border-black/30 my-2"></div>
          
          <div className="space-y-1 mb-4">
            <div className="flex justify-between uppercase"><span>INFORME:</span><span className="font-bold">#{sale.id}</span></div>
            <div className="flex justify-between uppercase"><span>FECHA:</span><span>{new Date(sale.date).toLocaleString('es-VE')}</span></div>
            <div className="flex justify-between uppercase"><span>TIPO:</span><span>{sale.type}</span></div>
            {sale.customerName && <div className="flex justify-between uppercase"><span>CLIENTE:</span><span>{sale.customerName}</span></div>}
          </div>

          <div className="border-t border-dashed border-black/30 my-2"></div>

          <div className="mb-4">
            <div className="flex justify-between font-bold mb-1 uppercase">
              <span>ARTICULO / CANT.</span>
              <span>SUBTOTAL</span>
            </div>
            {sale.items.map((item: any, i) => (
              <div key={i} className="flex justify-between mb-1">
                <span className="flex-1 uppercase">
                  {(item.name || item.nombre)} <span className="font-bold">x{item.qty || item.cantidad}</span>
                </span>
                <span className="w-16 text-right">{(item.subtotalUSD || (item.price * item.qty)).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-black/30 my-2"></div>

          <div className="space-y-1 font-bold">
            <div className="flex justify-between text-sm uppercase">
              <span>TOTAL BS:</span>
              <span>{sale.totalBS.toFixed(2)}</span>
            </div>
            <div className="flex justify-between uppercase">
              <span>TOTAL USD:</span>
              <span>{sale.totalUSD.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-black/30 my-4"></div>

          <div className="text-center italic">
            <p>¡Gracias por su confianza!</p>
            <p className="mt-2 text-[8px] opacity-50 uppercase">PosVEN Pro Cloud Sync · v2.5.0</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4 no-print">
          <Button variant="secondary" className="flex-1 gap-2 uppercase font-black text-[10px]" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> {window.electronAPI ? 'Imprimir Roccia' : 'Imprimir'}
          </Button>
          <Button variant="default" className="flex-1 gap-2 bg-primary uppercase font-black text-[10px]">
            <Download className="w-4 h-4" /> Guardar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}