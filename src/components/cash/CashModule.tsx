"use client";

import React, { useState, useEffect } from 'react';
import { Vault, Lock, Unlock, History, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Store } from '@/lib/db-store';
import { CashSession } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function CashModule({ onStatusChange }: { onStatusChange: (s: boolean) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  
  const [openAmount, setOpenAmount] = useState('0');
  const [openNotes, setOpenNotes] = useState('');
  
  const [closeAmount, setCloseAmount] = useState('0');
  const [closeNotes, setCloseNotes] = useState('');

  useEffect(() => {
    setIsOpen(Store.get('isCashOpen', false));
    setCurrentSession(Store.get('cashData', null));
    setHistory(Store.get('cashHistory', []));
  }, []);

  const handleOpen = () => {
    const amount = parseFloat(openAmount) || 0;
    const session: CashSession = {
      openDate: new Date().toISOString(),
      openAmount: amount,
      openNotes,
      closeDate: null,
      closeAmount: null,
      closeNotes: null,
      totalSales: 0,
      totalCollections: 0,
      saleCount: 0
    };
    Store.set('cashData', session);
    Store.set('isCashOpen', true);
    setIsOpen(true);
    setCurrentSession(session);
    onStatusChange(true);
    toast({ title: "Caja Abierta", description: `Iniciada con Bs. ${amount}` });
  };

  const handleClose = () => {
    if (!currentSession) return;
    const amount = parseFloat(closeAmount) || 0;
    const closed: CashSession = {
      ...currentSession,
      closeDate: new Date().toISOString(),
      closeAmount: amount,
      closeNotes,
      difference: amount - (currentSession.openAmount + currentSession.totalSales + currentSession.totalCollections)
    };

    const newHistory = [closed, ...history];
    Store.set('cashHistory', newHistory);
    Store.set('cashData', null);
    Store.set('isCashOpen', false);
    
    setIsOpen(false);
    setCurrentSession(null);
    setHistory(newHistory);
    onStatusChange(false);
    
    toast({ 
      title: "Caja Cerrada", 
      variant: closed.difference === 0 ? "default" : "destructive",
      description: closed.difference === 0 ? "Sin descuadres." : `Descuadre de Bs. ${closed.difference?.toFixed(2)}`
    });
  };

  const expectedTotal = currentSession ? (currentSession.openAmount + currentSession.totalSales + currentSession.totalCollections) : 0;

  return (
    <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-primary">Control de Caja</h2>
          <p className="text-sm text-muted-foreground">Sesiones diarias y arqueo de efectivo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {!isOpen ? (
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-500">
                <Unlock className="w-6 h-6" /> Abrir Nueva Sesión
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Monto Inicial en Caja (BS)</Label>
                <Input 
                  type="number" 
                  className="text-2xl h-14 font-black bg-emerald-500/5 border-emerald-500/30" 
                  value={openAmount} 
                  onChange={(e) => setOpenAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea placeholder="Notas de apertura..." value={openNotes} onChange={(e) => setOpenNotes(e.target.value)} />
              </div>
              <Button className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 font-bold uppercase" onClick={handleOpen}>
                Confirmar Apertura
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-destructive/5 border-destructive/20 relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Lock className="w-6 h-6" /> Cerrar Sesión Actual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-black/40 rounded-xl p-4 space-y-2 mb-4">
                <div className="flex justify-between text-sm"><span>Apertura:</span><span className="font-bold">Bs. {currentSession?.openAmount.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span>Ventas (+) :</span><span className="font-bold text-emerald-500">Bs. {currentSession?.totalSales.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span>Cobranzas (+) :</span><span className="font-bold text-emerald-500">Bs. {currentSession?.totalCollections.toFixed(2)}</span></div>
                <div className="border-t border-white/10 pt-2 flex justify-between font-black text-primary">
                  <span>ESPERADO EN CAJA:</span>
                  <span>Bs. {expectedTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Monto Físico Contado (BS)</Label>
                <Input 
                  type="number" 
                  className="text-2xl h-14 font-black bg-destructive/5 border-destructive/30" 
                  value={closeAmount} 
                  onChange={(e) => setCloseAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Observaciones de Cierre</Label>
                <Textarea placeholder="Descuadres o notas..." value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
              </div>
              <Button className="w-full h-14 bg-destructive hover:bg-destructive/90 font-bold uppercase" onClick={handleClose}>
                Confirmar Cierre de Caja
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="bg-secondary/20 border-border h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <History className="w-5 h-5" /> Historial de Sesiones
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <div className="h-full overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Inicial</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead>Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[10px]">{new Date(h.openDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs font-bold">Bs. {h.openAmount}</TableCell>
                      <TableCell className="text-xs font-bold">Bs. {h.closeAmount}</TableCell>
                      <TableCell>
                        <Badge variant={(h.difference || 0) < 0 ? "destructive" : "secondary"}>
                          {h.difference?.toFixed(2)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
