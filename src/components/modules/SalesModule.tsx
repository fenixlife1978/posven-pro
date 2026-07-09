"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AppState, SaleItem, Sale, PaymentMethod, ReportZ, Movimiento, PagoRealizado, Customer } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Receipt, 
  Barcode, 
  Wallet, 
  X, 
  CheckCircle2, 
  FileText,
  RotateCcw,
  History,
  ClipboardList,
  ArrowLeft,
  Eye,
  Clock,
  Printer,
  Zap,
  Share2,
  UserPlus,
  HandCoins
} from 'lucide-react';
import ReturnsModule from './ReturnsModule';

export default function SalesModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'pos' | 'history' | 'credits' | 'returns'>('pos');
  const [cliente, setCliente] = useState('Consumidor final');
  const [pagos, setPagos] = useState<PagoRealizado[]>([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [metodoActual, setMetodoActual] = useState<PaymentMethod>('efectivo_usd');
  const [montoInput, setMontoInput] = useState('');
  const [lastProcessedSale, setLastProcessedSale] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Cálculos financieros
  const subtotalUSD = state.carrito.reduce((s, i) => s + i.subtotalUSD, 0);
  const totalBS = subtotalUSD * state.tasa;
  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  const saldoRestanteUSD = Math.max(0, subtotalUSD - totalPagadoUSD);

  const matches = search.trim().length > 0 
    ? state.productos.filter(p => p.activo && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase()))).slice(0, 6)
    : [];

  const agregar = (pid: string) => {
    const p = state.productos.find(x => x.id === pid);
    if (!p || p.stock <= 0) return;
    const nuevoCarrito = [...state.carrito];
    const idx = nuevoCarrito.findIndex(i => i.productoId === pid);
    if (idx >= 0) {
      if (nuevoCarrito[idx].cantidad >= p.stock) return;
      nuevoCarrito[idx].cantidad++;
      nuevoCarrito[idx].subtotalUSD = nuevoCarrito[idx].cantidad * nuevoCarrito[idx].precioUnitUSD;
    } else {
      nuevoCarrito.push({ productoId: pid, nombre: p.nombre, precioUnitUSD: p.precioUSD, cantidad: 1, subtotalUSD: p.precioUSD });
    }
    updateState({ carrito: nuevoCarrito });
    setSearch('');
    setPagos([]);
  };

  const ejecutarVenta = () => {
    if (state.carrito.length === 0 || saldoRestanteUSD > 0.01) return;
    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahoraStr = Utils.ahora();
    
    const nuevaVenta: Sale & { payments?: PagoRealizado[] } = {
      id: reciboId, fecha: ahoraStr, cliente, items: [...state.carrito],
      subtotalUSD, descuentoUSD: 0, totalUSD: subtotalUSD, totalBS,
      metodoPago: pagos.length > 1 ? 'mixto' : (pagos[0]?.metodo || 'efectivo_usd'),
      estado: 'completada', type: 'VENTA', received: totalPagadoUSD,
      change: Math.max(0, totalPagadoUSD - subtotalUSD), payments: [...pagos]
    };

    updateState({
      ventas: [...state.ventas, nuevaVenta],
      carrito: [],
      proximoRecibo: state.proximoRecibo + 1,
      acumuladoHistorico: state.acumuladoHistorico + subtotalUSD
    });
    
    setLastProcessedSale(nuevaVenta);
    setShowReceiptModal(true);
    setPagos([]);
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Navigation */}
      <div className="flex flex-wrap gap-2 no-print">
        <button onClick={() => setView('pos')} className={`btn ${view === 'pos' ? 'btn-primary' : 'btn-secondary text-white'} h-10 px-6 font-black uppercase text-xs flex items-center gap-2`}>
          <ShoppingCart className="w-4 h-4" /> Punto de Venta
        </button>
        <button onClick={() => setView('history')} className={`btn ${view === 'history' ? 'btn-primary' : 'btn-secondary text-white'} h-10 px-6 font-black uppercase text-xs flex items-center gap-2`}>
          <History className="w-4 h-4" /> Historial Diario
        </button>
        <button onClick={() => setView('credits')} className={`btn ${view === 'credits' ? 'btn-primary' : 'btn-secondary text-white'} h-10 px-6 font-black uppercase text-xs flex items-center gap-2`}>
          <HandCoins className="w-4 h-4" /> Créditos (CxC)
        </button>
        <button onClick={() => setView('returns')} className={`btn ${view === 'returns' ? 'btn-primary' : 'btn-secondary text-white'} h-10 px-6 font-black uppercase text-xs flex items-center gap-2`}>
          <RotateCcw className="w-4 h-4" /> Devoluciones
        </button>
      </div>

      {view === 'pos' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col gap-4">
            <div className="card relative">
              <div className="flex items-center gap-3 p-4 bg-black/40">
                <Barcode className="w-6 h-6 text-[#c8952e]" />
                <input 
                  className="bg-transparent border-none outline-none flex-1 text-white font-black uppercase placeholder:text-white/20" 
                  placeholder="Escanee o busque producto..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {matches.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-[#1e1e1e] border-x border-b border-[#2a2a2a] z-[100] shadow-2xl rounded-b-xl overflow-hidden">
                  {matches.map(p => (
                    <div key={p.id} onClick={() => agregar(p.id)} className="p-3 hover:bg-[#c8952e]/20 cursor-pointer flex justify-between border-b border-white/5 transition-colors">
                      <div className="flex flex-col"><span className="text-white font-black uppercase text-xs">{p.nombre}</span><span className="text-[9px] text-white/40 mono">{p.codigo}</span></div>
                      <div className="text-right font-black text-[#c8952e] text-sm">{Utils.fmtUSD(p.precioUSD)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card flex-1 flex flex-col overflow-hidden">
              <div className="card-head bg-[#181818]"><h3 className="text-[10px] font-black uppercase tracking-widest">Items en Carrito</h3><span className="badge badge-neutral">{state.carrito.length} Items</span></div>
              <div className="table-wrap flex-1 overflow-y-auto">
                <table>
                  <thead className="sticky top-0 z-10 bg-[#0b0b0b]">
                    <tr><th className="w-1/2">Producto</th><th className="text-center">Cant</th><th className="text-right">Precio</th><th className="text-right">Subtotal</th><th className="w-10"></th></tr>
                  </thead>
                  <tbody>
                    {state.carrito.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/5 border-b border-white/5">
                        <td className="font-bold text-xs uppercase">{item.nombre}</td>
                        <td className="text-center font-black text-xs">{item.cantidad}</td>
                        <td className="text-right mono text-xs">{Utils.fmtUSD(item.precioUnitUSD)}</td>
                        <td className="text-right font-black text-[#c8952e] text-xs">{Utils.fmtUSD(item.subtotalUSD)}</td>
                        <td className="text-center"><button onClick={() => updateState({ carrito: state.carrito.filter((_, i) => i !== idx) })} className="text-white/20 hover:text-[#e04848]"><Trash2 className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    ))}
                    {state.carrito.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-white/20 font-black uppercase italic tracking-widest">Esperando productos...</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-96 flex flex-col gap-6">
            <div className="card border-[#c8952e]/30 shadow-2xl shadow-[#c8952e]/5">
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-black/60 rounded-xl border border-white/5 text-center">
                    <p className="text-[10px] font-black text-white/40 uppercase mb-1">Total a Pagar</p>
                    <h2 className="text-5xl font-black text-[#c8952e] tracking-tighter">{Utils.fmtUSD(subtotalUSD)}</h2>
                    <p className="text-sm font-bold text-white/40 mt-1">{Utils.fmtBS(totalBS)}</p>
                  </div>
                  
                  <div className="form-group mb-0">
                    <label className="text-[10px] font-black uppercase text-white/40 block mb-1">Cliente / Identificación</label>
                    <div className="flex gap-2">
                      <input className="form-input flex-1 bg-black font-black uppercase text-xs" value={cliente} onChange={e => setCliente(e.target.value)} />
                      <button className="btn-icon bg-white/5"><UserPlus className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[#c8952e]/5 rounded-xl border border-[#c8952e]/20 space-y-3">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-white/60">Pagos Registrados</span>
                      <button onClick={() => setShowMultiModal(true)} className="btn-icon h-7 w-7 bg-[#c8952e] text-black"><Wallet className="w-3.5 h-3.5" /></button>
                   </div>
                   <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                      {pagos.map((p, i) => (
                        <div key={i} className="flex justify-between text-[10px] font-bold py-1 border-b border-white/5">
                          <span className="uppercase">{Utils.metodoLabel(p.metodo)}</span>
                          <span className="text-[#c8952e]">{Utils.fmtUSD(p.montoUSD)}</span>
                        </div>
                      ))}
                      {pagos.length === 0 && <p className="text-[10px] italic text-white/20 text-center py-2">Sin abonos cargados</p>}
                   </div>
                   <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-white/80">Saldo Pendiente:</span>
                      <span className={`text-sm font-black ${saldoRestanteUSD > 0.01 ? 'text-[#e04848]' : 'text-[#27ae60]'}`}>
                        {saldoRestanteUSD > 0.01 ? Utils.fmtUSD(saldoRestanteUSD) : 'SALDADO'}
                      </span>
                   </div>
                </div>

                <button 
                  onClick={ejecutarVenta}
                  disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01}
                  className="btn btn-primary w-full h-14 font-black uppercase tracking-widest text-base shadow-xl shadow-[#c8952e]/10 disabled:opacity-20"
                >
                  <CheckCircle2 className="w-5 h-5" /> Procesar Venta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'returns' && <ReturnsModule state={state} updateState={updateState} />}
      {(view === 'history' || view === 'credits') && (
        <div className="card p-20 flex flex-col items-center justify-center opacity-30 italic">
          <History className="w-12 h-12 mb-4" />
          <p className="font-black uppercase tracking-widest">Módulos en mantenimiento</p>
        </div>
      )}
    </div>
  );
}