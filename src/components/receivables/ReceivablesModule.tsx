"use client";

import React, { useState, useEffect } from 'react';
import { Search, HandCoins, History, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Store } from '@/lib/db-store';
import { Receivable } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from '@/hooks/use-toast';

export function ReceivablesModule() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setReceivables(Store.get('receivables', []));
  }, []);

  const totalOutstanding = receivables.reduce((acc, r) => acc + r.balance, 0);

  const filtered = receivables.filter(r => 
    r.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id.includes(searchTerm)
  );

  const handlePay = (id: string) => {
    // Basic auto-payment for demo, in real life would open a modal for amount/method
    const all = [...receivables];
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;

    const r = all[idx];
    const amount = r.balance;
    r.paid += amount;
    r.balance = 0;
    r.status = 'paid';

    // Update customer debt
    const allCusts = Store.get<any[]>('customers', []);
    const cIdx = allCusts.findIndex(c => c.id === r.customerId);
    if (cIdx >= 0) allCusts[cIdx].debt = Math.max(0, allCusts[cIdx].debt - amount);

    Store.set('receivables', all);
    Store.set('customers', allCusts);
    setReceivables(all);
    toast({ title: "Pago registrado exitosamente" });
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6 overflow-hidden">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-primary">Cuentas por Cobrar</h2>
          <p className="text-sm text-muted-foreground">Seguimiento de ventas a crédito y pagos pendientes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Por Cobrar</p>
            <p className="text-3xl font-black text-destructive">Bs. {totalOutstanding.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por cliente o factura..." 
          className="pl-9 bg-secondary/30"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="flex-1 overflow-hidden bg-card border-none shadow-xl">
        <div className="h-full overflow-y-auto">
          <Table>
            <TableHeader className="bg-secondary/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="font-bold">Factura</TableHead>
                <TableHead className="font-bold">Cliente</TableHead>
                <TableHead className="font-bold">Total BS</TableHead>
                <TableHead className="font-bold">Pendiente BS</TableHead>
                <TableHead className="font-bold">Estado</TableHead>
                <TableHead className="text-right font-bold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="hover:bg-secondary/20">
                  <TableCell className="font-code text-xs font-bold">{r.id}</TableCell>
                  <TableCell>
                    <p className="font-semibold">{r.customerName}</p>
                    <p className="text-[10px] text-muted-foreground">{r.customerCedula}</p>
                  </TableCell>
                  <TableCell>Bs. {r.totalBS.toFixed(2)}</TableCell>
                  <TableCell className="font-bold text-destructive">Bs. {r.balance.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'paid' ? "secondary" : "destructive"} className={r.status === 'paid' ? 'bg-emerald-500/20 text-emerald-500' : ''}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.balance > 0 && (
                      <Button variant="outline" size="sm" className="gap-1 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10" onClick={() => handlePay(r.id)}>
                        <HandCoins className="w-4 h-4" /> Cobrar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
