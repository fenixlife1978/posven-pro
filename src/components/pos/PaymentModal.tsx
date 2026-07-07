
"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CartItem, PaymentMethod, Sale } from '@/lib/types';
import { Store } from '@/lib/db-store';
import { toast } from '@/hooks/use-toast';
import { DollarSign, Banknote, CreditCard, Smartphone, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  exchangeRate: number;
  onComplete: (sale: Sale) => void;
}

export function PaymentModal({ isOpen, onClose, cart, exchangeRate, onComplete }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('efectivo_bs');
  const [receivedBS, setReceivedBS] = useState<string>('');
  const [receivedUSD, setReceivedUSD] = useState<string>('');

  const totalBS = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const totalUSD = totalBS / exchangeRate;
  
  const actualReceived = method === 'efectivo_usd' || method === 'zelle' 
    ? (parseFloat(receivedUSD) || 0) * exchangeRate 
    : (parseFloat(receivedBS) || 0);

  const change = Math.max(0, actualReceived - totalBS);
  const isSufficient = actualReceived >= totalBS;

  const handleProcess = () => {
    if (!isSufficient) {
      toast({ title: "Monto insuficiente", variant: "destructive" });
      return;
    }

    const nextSaleNum = Store.get('nextSaleNum', 1);
    const saleId = `V-${String(nextSaleNum).padStart(6, '0')}`;
    Store.set('nextSaleNum', nextSaleNum + 1);

    const sale: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      type: 'CONTADO',
      paymentMethod: method,
      items: [...cart],
      totalBS,
      totalUSD,
      received: actualReceived,
      change,
      paid: totalBS,
      balance: 0
    };

    // Update sales
    const sales = Store.get<Sale[]>('sales', []);
    Store.set('sales', [...sales, sale]);

    // Update stock
    const products = Store.get<any[]>('products', []);
    cart.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) p.stock -= item.qty;
    });
    Store.set('products', products);

    // Update cash session
    const cashData = Store.get<any>('cashData', null);
    if (cashData) {
      cashData.totalSales += totalBS;
      cashData.saleCount += 1;
      Store.set('cashData', cashData);
    }

    toast({ title: "Venta Exitosa", description: `Venta ${saleId} procesada.` });
    onComplete(sale);
    onClose();
    setReceivedBS('');
    setReceivedUSD('');
  };

  const methods: { id: PaymentMethod, label: string, icon: any }[] = [
    { id: 'efectivo_bs', label: 'Efectivo Bs.', icon: Banknote },
    { id: 'punto_venta', label: 'Punto de Venta', icon: CreditCard },
    { id: 'efectivo_usd', label: 'Efectivo USD', icon: DollarSign },
    { id: 'biopago', label: 'Biopago', icon: Smartphone },
    { id: 'pagomovil', label: 'PagoMovil', icon: Smartphone },
    { id: 'zelle', label: 'Zelle', icon: CreditCard },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-none text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-primary">Procesar Pago</DialogTitle>
        </DialogHeader>
        
        <div className="bg-black/40 rounded-2xl p-6 mb-6 text-center border border-primary/20">
          <p className="text-primary font-black text-4xl mb-1">Bs. {totalBS.toFixed(2)}</p>
          <p className="text-emerald-500 font-bold text-lg">≈ $ {totalUSD.toFixed(2)} USD</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {methods.map(m => (
            <Button 
              key={m.id}
              variant={method === m.id ? 'default' : 'secondary'}
              className={`h-auto flex-col py-3 gap-1 ${method === m.id ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-secondary/50'}`}
              onClick={() => setMethod(m.id)}
            >
              <m.icon className="w-5 h-5" />
              <span className="text-[10px] uppercase font-bold">{m.label}</span>
            </Button>
          ))}
        </div>

        <div className="space-y-4">
          { (method === 'efectivo_usd' || method === 'zelle') ? (
            <div className="space-y-2">
              <Label>Monto en USD</Label>
              <Input 
                type="number" 
                placeholder="0.00" 
                className="h-12 text-xl font-bold bg-secondary/50" 
                value={receivedUSD}
                onChange={(e) => {
                  setReceivedUSD(e.target.value);
                  const val = parseFloat(e.target.value) || 0;
                  setReceivedBS((val * exchangeRate).toFixed(2));
                }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Monto Recibido BS</Label>
              <Input 
                type="number" 
                placeholder="0.00" 
                className="h-12 text-xl font-bold bg-secondary/50" 
                value={receivedBS}
                onChange={(e) => setReceivedBS(e.target.value)}
              />
            </div>
          )}

          {actualReceived > 0 && (
            <div className={`p-4 rounded-xl text-center font-bold ${isSufficient ? 'bg-emerald-500/20 text-emerald-500' : 'bg-destructive/20 text-destructive'}`}>
              {isSufficient ? `CAMBIO: Bs. ${change.toFixed(2)}` : `FALTA: Bs. ${(totalBS - actualReceived).toFixed(2)}`}
            </div>
          )}
        </div>

        <Button 
          className="w-full h-14 mt-4 bg-emerald-600 hover:bg-emerald-500 text-lg font-black uppercase tracking-widest"
          disabled={!isSufficient}
          onClick={handleProcess}
        >
          <CheckCircle2 className="w-6 h-6 mr-2" />
          Finalizar Venta
        </Button>
      </DialogContent>
    </Dialog>
  );
}
