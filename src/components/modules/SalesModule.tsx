"use client";

import React, { useState } from 'react';
import { ShoppingCart, Search, Trash2, Plus, Minus, User, Printer, Trash, Package, History, FileText, CheckCircle2, ArrowLeft, Clock, AlertCircle, Eye, X, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppState, Product, SaleItem, Sale, PaymentMethod } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { exportarPDFVentasDetallado } from '@/lib/pdf-generator';
import { toast } from '@/hooks/use-toast';

interface SalesModuleProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
}

const SalesModule: React.FC<SalesModuleProps> = ({ state, updateState }) => {
  const [view, setView] = useState<'ventas' | 'historial'>('ventas');
  const [search, setSearch] = useState('');
  const [customerName, setCliente] = useState('Consumidor final');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo_usd');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const filteredProducts = (state.productos || []).filter(p =>
    p.activo && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8);

  const cartTotalUSD = state.carrito.reduce((sum, item) => sum + item.subtotalUSD, 0);
  const cartTotalBS = cartTotalUSD * state.tasa;

  const addToCart = (product: Product) => {
    const existing = state.carrito.find(i => i.productoId === product.id);
    if (existing) {
      if (existing.cantidad >= (product.stock || 0)) {
        toast({ title: "Stock insuficiente", variant: "destructive" });
        return;
      }
      const updated = state.carrito.map(i => i.productoId === product.id ? 
        { ...i, cantidad: i.cantidad + 1, subtotalUSD: (i.cantidad + 1) * i.precioUnitUSD } : i
      );
      updateState({ carrito: updated });
    } else {
      if ((product.stock || 0) <= 0) {
        toast({ title: "Sin stock", variant: "destructive" });
        return;
      }
      const newItem: SaleItem = {
        productoId: product.id,
        nombre: product.nombre,
        cantidad: 1,
        precioUnitUSD: product.precioUSD,
        subtotalUSD: product.precioUSD
      };
      updateState({ carrito: [...state.carrito, newItem] });
    }
    setSearch('');
  };

  const removeFromCart = (id: string) => {
    const updated = state.carrito.filter(i => i.productoId !== id);
    updateState({ carrito: updated });
  };

  const updateQuantity = (id: string, delta: number) => {
    const product = state.productos.find(p => p.id === id);
    const item = state.carrito.find(i => i.productoId === id);
    if (!product || !item) return;

    const newQty = item.cantidad + delta;
    if (newQty <= 0) {
      removeFromCart(id);
    } else if (newQty <= (product.stock || 0)) {
      const updated = state.carrito.map(i => i.productoId === id ? 
        { ...i, cantidad: newQty, subtotalUSD: newQty * i.precioUnitUSD } : i
      );
      updateState({ carrito: updated });
    } else {
      toast({ title: "Máximo disponible alcanzado", variant: "destructive" });
    }
  };

  const processSale = (isCredit = false) => {
    if (state.carrito.length === 0) return;
    
    const saleId = String(state.proximoRecibo).padStart(9, '0');
    const ahoraStr = Utils.ahora();

    const newSale: Sale = {
      id: saleId,
      fecha: ahoraStr,
      cliente: customerName || 'Consumidor final',
      items: [...state.carrito],
      subtotalUSD: cartTotalUSD,
      descuentoUSD: 0,
      totalUSD: cartTotalUSD,
      totalBS: cartTotalBS,
      metodoPago: isCredit ? 'credito' : paymentMethod,
      estado: isCredit ? 'pendiente' : 'pagada'
    };

    const nuevosProductos = state.productos.map(p => {
      const item = state.carrito.find(i => i.productoId === p.id);
      return item ? { ...p, stock: p.stock - item.cantidad } : p;
    });

    const nuevosMovimientos = state.carrito.map(item => ({
      id: Store.uid(),
      productoId: item.productoId,
      tipo: 'venta' as const,
      cantidad: -item.cantidad,
      stockAntes: state.productos.find(p => p.id === item.productoId)?.stock || 0,
      stockDespues: (state.productos.find(p => p.id === item.productoId)?.stock || 0) - item.cantidad,
      fecha: ahoraStr,
      referencia: `Venta #${saleId}`
    }));

    const nuevasCxC = isCredit ? [...state.cxc, {
      id: saleId,
      fecha: ahoraStr,
      fechaVencimiento: '2099-12-31',
      cliente: customerName,
      montoUSD: cartTotalUSD,
      abonadoUSD: 0,
      saldoUSD: cartTotalUSD,
      estado: 'pendiente' as const,
      historialPagos: [],
      ventaId: saleId
    }] : state.cxc;

    const nuevosAsientos = !isCredit ? [{
      id: 'ACC-' + Store.uid().toUpperCase().slice(0, 5),
      fecha: ahoraStr,
      tipo: 'ingreso' as const,
      categoria: 'VENTA',
      concepto: `VENTA #${saleId} - ${customerName}`,
      montoUSD: cartTotalUSD,
      montoBS: cartTotalBS,
      metodo: paymentMethod,
      referencia: saleId
    }] : [];

    updateState({
      productos: nuevosProductos,
      ventas: [newSale, ...state.ventas],
      movimientos: [...state.movimientos, ...nuevosMovimientos],
      cxc: nuevasCxC,
      libroDiario: [...nuevosAsientos, ...state.libroDiario],
      carrito: [],
      proximoRecibo: state.proximoRecibo + 1
    });

    setLastSale(newSale);
    setShowReceipt(true);
    setCliente('Consumidor final');
    toast({ title: isCredit ? "Venta a crédito registrada" : "Venta procesada con éxito" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-brand-gold" />
          <h2 className="text-2xl font-bold uppercase italic tracking-tighter">Punto de Venta</h2>
        </div>
        <div className="flex gap-2">
          <Button variant={view === 'ventas' ? 'default' : 'outline'} onClick={() => setView('ventas')} className={view === 'ventas' ? 'bg-brand-gold text-black' : ''}>Terminal Venta</Button>
          <Button variant={view === 'historial' ? 'default' : 'outline'} onClick={() => setView('historial')} className={view === 'historial' ? 'bg-brand-gold text-black' : ''}>Historial</Button>
        </div>
      </div>

      {view === 'ventas' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input placeholder="Buscar producto..." className="pl-9 h-11" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {filteredProducts.map(p => (
                    <div key={p.id} onClick={() => addToCart(p)} className="p-3 border rounded-xl cursor-pointer hover:bg-surface-soft transition-all shadow-sm group">
                      <p className="font-bold text-xs truncate uppercase">{p.nombre}</p>
                      <p className="text-[10px] font-black text-brand-gold-deep">{Utils.fmtUSD(p.precioUSD)}</p>
                      <p className="text-[9px] text-gray-500 font-bold">STOCK: {p.stock}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md overflow-hidden">
              <Table>
                <TableHeader className="bg-surface-soft">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase">Producto</TableHead>
                    <TableHead className="text-center text-[10px] font-black uppercase">Cant.</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Precio</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.carrito.map(item => (
                    <TableRow key={item.productoId}>
                      <TableCell className="text-xs font-bold uppercase">{item.nombre}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => updateQuantity(item.productoId, -1)} className="btn-icon h-6 w-6"><Minus className="w-3 h-3"/></button>
                          <span className="font-mono font-bold text-xs">{item.cantidad}</span>
                          <button onClick={() => updateQuantity(item.productoId, 1)} className="btn-icon h-6 w-6"><Plus className="w-3 h-3"/></button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{Utils.fmtUSD(item.precioUnitUSD)}</TableCell>
                      <TableCell className="text-right font-black text-brand-gold-deep">{Utils.fmtUSD(item.subtotalUSD)}</TableCell>
                      <TableCell className="text-center">
                        <button onClick={() => removeFromCart(item.productoId)} className="text-status-danger"><Trash2 className="w-4 h-4"/></button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {state.carrito.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-ink/20 font-black italic uppercase">El carrito está vacío</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="shadow-lg border-brand-gold/20">
              <CardHeader className="bg-ink text-white py-4 rounded-t-xl">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-center">Resumen de Venta</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase opacity-50">Cliente</label>
                  <Input value={customerName} onChange={(e) => setCliente(e.target.value)} placeholder="Consumidor final" className="font-bold h-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase opacity-50">Método de Pago</label>
                  <select className="form-select font-black text-xs h-10" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                    <option value="efectivo_usd">Efectivo USD</option>
                    <option value="efectivo_bs">Efectivo BS</option>
                    <option value="pagomovil">Pago Movil</option>
                    <option value="zelle">Zelle</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="punto_venta">Punto de Venta</option>
                  </select>
                </div>
                <div className="p-5 bg-surface-soft rounded-2xl border border-line space-y-3 shadow-inner">
                  <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase opacity-50">TOTAL USD:</span><span className="text-2xl font-black text-brand-gold-deep">{Utils.fmtUSD(cartTotalUSD)}</span></div>
                  <div className="flex justify-between items-center border-t border-line/50 pt-2"><span className="text-[10px] font-black uppercase opacity-50">TOTAL BS:</span><span className="text-lg font-black">{Utils.fmtBS(cartTotalBS)}</span></div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 p-6 pt-0">
                <Button className="w-full bg-status-success hover:bg-status-success/90 text-white font-black h-14 text-sm uppercase shadow-xl" onClick={() => processSale(false)} disabled={state.carrito.length === 0}><CheckCircle2 className="w-5 h-5 mr-2" /> Completar Venta</Button>
                <Button variant="outline" className="w-full border-brand-gold text-brand-gold-deep font-black h-12 text-xs uppercase" onClick={() => processSale(true)} disabled={state.carrito.length === 0}><HandCoins className="w-5 h-5 mr-2" /> Vender a Crédito</Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="shadow-md overflow-hidden">
          <CardHeader className="bg-ink text-white flex flex-row justify-between items-center py-4">
            <CardTitle className="text-xs font-black uppercase">Histórico de Facturación</CardTitle>
            <button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px]" onClick={() => exportarPDFVentasDetallado(state.ventas, state.empresa, 'Historial', { totalVendidos: state.ventas.length })}>PDF Histórico</button>
          </CardHeader>
          <Table>
            <TableHeader className="bg-surface-soft">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase">Fecha</TableHead>
                <TableHead className="text-[10px] font-black uppercase">ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Cliente</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase">Total USD</TableHead>
                <TableHead className="text-center text-[10px] font-black uppercase">Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.ventas.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="text-xs font-bold">{v.fecha.slice(0, 16).replace('T', ' ')}</TableCell>
                  <TableCell className="text-xs font-mono opacity-50">{v.id}</TableCell>
                  <TableCell className="text-xs font-black uppercase">{v.cliente}</TableCell>
                  <TableCell className="text-right font-black text-brand-gold-deep">{Utils.fmtUSD(v.totalUSD)}</TableCell>
                  <TableCell className="text-center"><Badge variant={v.estado === 'pagada' ? 'secondary' : 'destructive'} className="text-[8px] font-black">{v.estado.toUpperCase()}</Badge></TableCell>
                  <TableCell className="text-center">
                    <button className="btn-icon text-brand-gold" onClick={() => { setLastSale(v); setShowReceipt(true); }}><Eye className="w-4 h-4"/></button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {showReceipt && lastSale && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowReceipt(false)}></div>
          <div className="modal-box bg-white max-w-xs p-6 rounded-none shadow-2xl font-mono text-[10px]">
             <div className="text-center mb-4">
                <p className="font-black text-xs uppercase">{state.empresa.nombre}</p>
                <p className="text-[8px]">RIF: {state.empresa.rif}</p>
                <p className="text-[8px]">{state.empresa.direccion}</p>
             </div>
             <div className="border-t border-dashed border-black mb-2" />
             <div className="flex justify-between font-bold mb-3"><span>RECIBO: #{lastSale.id}</span><span>{lastSale.fecha.slice(0,10)}</span></div>
             <div className="space-y-1 mb-4">
               {lastSale.items.map((it: any, idx: number) => (
                 <div key={idx} className="flex justify-between">
                   <span className="flex-1 uppercase">{it.cantidad} x {it.nombre}</span>
                   <span className="font-bold">{Utils.fmtUSD(it.subtotalUSD)}</span>
                 </div>
               ))}
             </div>
             <div className="border-t border-dashed border-black my-2" />
             <div className="flex justify-between font-black text-xs"><span>TOTAL USD:</span><span>{Utils.fmtUSD(lastSale.totalUSD)}</span></div>
             <div className="flex justify-between font-bold opacity-70"><span>TOTAL BS:</span><span>{Utils.fmtBS(lastSale.totalBS)}</span></div>
             <div className="border-t border-dashed border-black mt-4 mb-2" />
             <p className="text-center italic text-[8px] uppercase">Gracias por su compra</p>
             <button className="btn btn-primary w-full mt-6 h-10 no-print" onClick={() => window.print()}>Imprimir Ticket</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesModule;
