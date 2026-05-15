"use client";

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sale } from '@/lib/types';
import { Printer, Download, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
}

export function ReceiptModal({ isOpen, onClose, sale }: Props) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xs p-0 bg-transparent border-none overflow-visible shadow-none">
        <div className="bg-white text-black p-6 font-mono text-[11px] leading-tight rounded-sm shadow-2xl relative">
          <Button variant="ghost" size="icon" className="absolute -top-4 -right-4 bg-primary text-white hover:bg-primary/90 no-print" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>

          <div className="text-center mb-4">
            <h3 className="font-bold text-sm uppercase">LicorPOS Elite</h3>
            <p>RIF: J-12345678-9</p>
            <p>Av. Principal, Edif Licor, PB</p>
            <p>Caracas, Venezuela</p>
          </div>

          <div className="border-t border-dashed border-black/30 my-2"></div>
          
          <div className="space-y-1 mb-4">
            <div className="flex justify-between"><span>FACTURA:</span><span className="font-bold">{sale.id}</span></div>
            <div className="flex justify-between"><span>FECHA:</span><span>{new Date(sale.date).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>TIPO:</span><span>{sale.type}</span></div>
            {sale.customerName && <div className="flex justify-between"><span>CLIENTE:</span><span>{sale.customerName}</span></div>}
          </div>

          <div className="border-t border-dashed border-black/30 my-2"></div>

          <div className="mb-4">
            <div className="flex justify-between font-bold mb-1">
              <span>ARTICULO</span>
              <span>SUBTOTAL</span>
            </div>
            {sale.items.map((item, i) => (
              <div key={i} className="flex justify-between mb-1">
                <span className="flex-1">{item.name} x{item.qty}</span>
                <span className="w-16 text-right">{(item.price * item.qty).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-black/30 my-2"></div>

          <div className="space-y-1 font-bold">
            <div className="flex justify-between text-sm">
              <span>TOTAL BS:</span>
              <span>{sale.totalBS.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>TOTAL USD:</span>
              <span>{sale.totalUSD.toFixed(2)}</span>
            </div>
          </div>

          {sale.type === 'CONTADO' && (
            <div className="mt-4 space-y-1">
              <div className="flex justify-between italic"><span>METODO:</span><span>{sale.paymentMethod}</span></div>
              <div className="flex justify-between italic"><span>RECIBIDO:</span><span>{sale.received.toFixed(2)}</span></div>
              <div className="flex justify-between italic"><span>CAMBIO:</span><span>{sale.change.toFixed(2)}</span></div>
            </div>
          )}

          <div className="border-t border-dashed border-black/30 my-4"></div>

          <div className="text-center italic">
            <p>¡Gracias por su compra!</p>
            <p className="mt-2 text-[8px] opacity-50">Generado por LicorPOS Elite</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4 no-print">
          <Button variant="secondary" className="flex-1 gap-2" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button variant="default" className="flex-1 gap-2 bg-primary">
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
