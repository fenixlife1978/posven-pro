"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, UserPlus, CheckCircle2 } from 'lucide-react';
import { CartItem, Customer, Sale, Receivable } from '@/lib/types';
import { Store } from '@/lib/db-store';
import { toast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  exchangeRate: number;
  onComplete: (sale: Sale) => void;
}

export function CreditSaleModal({ isOpen, onClose, cart, exchangeRate, onComplete }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', cedula: '', phone: '', address: '' });

  useEffect(() => {
    if (isOpen) setCustomers(Store.get('customers', []));
  }, [isOpen]);

  const totalBS = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cedula.includes(searchTerm)
  );

  const handleProcess = () => {
    let customer = selectedCustomer;

    if (isNewCustomer) {
      if (!newCust.name || !newCust.cedula) {
        toast({ title: "Datos incompletos", variant: "destructive" });
        return;
      }
      const nextCustId = Store.get('nextCustomerId', 10);
      const id = `C-${String(nextCustId).padStart(3, '0')}`;
      customer = { ...newCust, id, debt: 0 };
      const allCusts = Store.get<Customer[]>('customers', []);
      Store.set('customers', [...allCusts, customer]);
      Store.set('nextCustomerId', nextCustId + 1);
    }

    if (!customer) {
      toast({ title: "Seleccione un cliente", variant: "destructive" });
      return;
    }

    const nextSaleNum = Store.get('nextSaleNum', 1);
    const saleId = `V-${String(nextSaleNum).padStart(6, '0')}`;
    Store.set('nextSaleNum', nextSaleNum + 1);

    const sale: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      type: 'CRÉDITO',
      paymentMethod: 'CRÉDITO',
      items: [...cart],
      totalBS,
      totalUSD: totalBS / exchangeRate,
      received: 0,
      change: 0,
      customerId: customer.id,
      customerName: customer.name,
      paid: 0,
      balance: totalBS
    };

    // Store Sale
    const sales = Store.get<Sale[]>('sales', []);
    Store.set('sales', [...sales, sale]);

    // Update Customer Debt
    const allCusts = Store.get<Customer[]>('customers', []);
    const cIdx = allCusts.findIndex(c => c.id === customer!.id);
    if (cIdx >= 0) {
      allCusts[cIdx].debt += totalBS;
      Store.set('customers', allCusts);
    }

    // Create Receivable record
    const receivables = Store.get<Receivable[]>('receivables', []);
    const newRec: Receivable = {
      ...sale,
      customerCedula: customer.cedula,
      status: 'pending',
      payments: []
    };
    Store.set('receivables', [...receivables, newRec]);

    // Update stock
    const products = Store.get<any[]>('products', []);
    cart.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) p.stock -= item.qty;
    });
    Store.set('products', products);

    toast({ title: "Crédito Registrado" });
    onComplete(sale);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl bg-card border-none text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-primary">Venta a Crédito</DialogTitle>
        </DialogHeader>

        <div className="bg-black/40 rounded-xl p-4 mb-4 flex justify-between items-center">
          <span className="text-muted-foreground">Total a Deber:</span>
          <span className="text-2xl font-black text-primary">Bs. {totalBS.toFixed(2)}</span>
        </div>

        {!isNewCustomer ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar cliente por nombre o cédula..." 
                className="pl-9 bg-secondary/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredCustomers.map(c => (
                <div 
                  key={c.id}
                  className={`p-3 rounded-lg cursor-pointer border transition-all ${selectedCustomer?.id === c.id ? 'bg-primary border-primary' : 'bg-secondary/30 border-border hover:bg-secondary'}`}
                  onClick={() => { setSelectedCustomer(c); setIsNewCustomer(false); }}
                >
                  <p className="font-bold">{c.name}</p>
                  <p className="text-xs opacity-70">{c.cedula} | Deuda Actual: Bs. {c.debt.toFixed(2)}</p>
                </div>
              ))}
              {searchTerm && filteredCustomers.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No se encontraron clientes.</p>
              )}
            </div>

            <Button variant="secondary" className="w-full gap-2" onClick={() => setIsNewCustomer(true)}>
              <UserPlus className="w-4 h-4" /> Registrar Nuevo Cliente
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nombre Completo</Label>
                <Input value={newCust.name} onChange={(e) => setNewCust({...newCust, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Cédula</Label>
                <Input value={newCust.cedula} onChange={(e) => setNewCust({...newCust, cedula: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input value={newCust.phone} onChange={(e) => setNewCust({...newCust, phone: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Dirección</Label>
                <Input value={newCust.address} onChange={(e) => setNewCust({...newCust, address: e.target.value})} />
              </div>
            </div>
            <Button variant="link" className="text-xs text-primary p-0 h-auto" onClick={() => setIsNewCustomer(false)}>
              Volver a la búsqueda
            </Button>
          </div>
        )}

        <Button 
          className="w-full h-14 mt-6 bg-primary hover:bg-primary/90 text-lg font-black uppercase tracking-widest"
          onClick={handleProcess}
        >
          <CheckCircle2 className="w-6 h-6 mr-2" />
          Confirmar Crédito
        </Button>
      </DialogContent>
    </Dialog>
  );
}
