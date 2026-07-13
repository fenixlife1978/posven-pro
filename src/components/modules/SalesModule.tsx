"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppState, SaleItem, Sale, PaymentMethod, ReportZ, PagoRealizado, Customer, Return, ReturnItem, Product, Debt, Movimiento, LibroDiarioEntry, Terminal } from '@/lib/types';
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
  History,
  ClipboardList,
  ArrowLeft,
  Eye,
  Clock,
  Printer,
  Zap,
  Share2,
  UserPlus,
  User,
  AlertTriangle,
  Undo2,
  Lock,
  RefreshCw,
  Check,
  RotateCcw,
  HandCoins,
  Calculator,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Contact,
  BookOpen,
  DollarSign,
  Smartphone,
  CreditCard,
  Banknote,
  Monitor
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Soporte para impresión nativa
declare global {
  interface Window {
    electronAPI?: {
      printTicket: (data: any) => Promise<void>;
      getAppVersion: () => Promise<string>;
    };
  }
}

export default function SalesModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'pos' | 'history' | 'credits' | 'returns'>('pos');
  const [showReport, setShowReport] = useState<'Y' | 'Z' | null>(null);
  const [cliente, setCliente] = useState('CONSUMIDOR FINAL');
  
  const [pagos, setPagos] = useState<PagoRealizado[]>([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [metodoActual, setMetodoActual] = useState<PaymentMethod>('efectivo_usd');
  const [montoInput, setMontoInput] = useState('');
  
  const [showAbonoModal, setShowAbonoModal] = useState<string | null>(null);
  const [abonoPagos, setAbonoPagos] = useState<PagoRealizado[]>([]);
  
  const [showDetailsModal, setShowDetailsModal] = useState<any | null>(null);
  const [showClientHistory, setShowClientHistory] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  
  const [lastProcessedSale, setLastProcessedSale] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Estados para Devoluciones
  const [returnSaleSearch, setReturnSaleSearch] = useState('');
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'EFECTIVO' | 'MISMO_METODO' | 'CREDITO_TIENDA'>('EFECTIVO');
  const [returnReason, setReturnReason] = useState('');

  // Estados para Tasa BCV
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [nuevaTasa, setNuevaTasa] = useState(state.tasa.toString());

  const searchInputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    if (search.trim().length < 1) return [];
    return state.productos
      .filter(p => p.activo && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())))
      .slice(0, 8);
  }, [search, state.productos]);

  const groupedCredits = useMemo(() => {
    const groups: Record<string, { totalUSD: number; debts: Debt[] }> = {};
    state.cxc.filter(c => c.estado !== 'pagada').forEach(debt => {
      const name = debt.cliente || 'DESCONOCIDO';
      if (!groups[name]) {
        groups[name] = { totalUSD: 0, debts: [] };
      }
      groups[name].totalUSD += debt.saldoUSD;
      groups[name].debts.push(debt);
    });
    
    Object.keys(groups).forEach(name => {
      groups[name].debts.sort((a, b) => a.fecha.localeCompare(b.fecha));
    });
    return groups;
  }, [state.cxc]);

  const getStockDisponible = (p: Product) => {
    let avail = p.stock || 0;
    if (p.isKit && p.kitType === 'stock_componentes' && p.kitItems) {
      let compPossible = Infinity;
      p.kitItems.forEach(ki => {
        const cp = state.productos.find(c => c.id === ki.productoId);
        if (cp) {
          const possible = Math.floor((cp.stock || 0) / ki.cantidad);
          compPossible = Math.min(compPossible, possible);
        } else {
          compPossible = 0;
        }
      });
      if (compPossible !== Infinity) avail = compPossible;
    }
    return avail;
  };

  const agregar = (pid: string) => {
    const p = state.productos.find(x => x.id === pid);
    if (!p) return;
    
    const stockAvail = getStockDisponible(p);
    if (stockAvail <= 0) return;

    const nuevoCarrito = [...state.carrito];
    const idx = nuevoCarrito.findIndex(i => i.productoId === pid);
    if (idx >= 0) {
      if (nuevoCarrito[idx].cantidad >= stockAvail) return;
      nuevoCarrito[idx].cantidad++;
      nuevoCarrito[idx].subtotalUSD = nuevoCarrito[idx].cantidad * nuevoCarrito[idx].precioUnitUSD;
    } else {
      nuevoCarrito.push({ productoId: pid, nombre: p.nombre, precioUnitUSD: p.precioUSD, cantidad: 1, subtotalUSD: p.precioUSD });
    }
    updateState({ carrito: nuevoCarrito });
    setSearch('');
    setPagos([]);
    searchInputRef.current?.focus();
  };

  const updateQty = (idx: number, delta: number) => {
    const nuevo = [...state.carrito];
    const item = nuevo[idx];
    const p = state.productos.find(x => x.id === item.productoId);
    if (!p) return;

    const stockAvail = getStockDisponible(p);
    const n = item.cantidad + delta;
    
    if (n <= 0) nuevo.splice(idx, 1);
    else if (n <= stockAvail) {
      item.cantidad = n;
      item.subtotalUSD = n * item.precioUnitUSD;
    }
    updateState({ carrito: nuevo });
    setPagos([]);
  };

  const subtotalUSD = state.carrito.reduce((s, i) => s + i.subtotalUSD, 0);
  const totalBS = subtotalUSD * state.tasa;
  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  const saldoRestanteUSD = Math.max(0, subtotalUSD - totalPagadoUSD);
  const saldoRestanteBS = saldoRestanteUSD * state.tasa;

  const getCurrentTerminal = () => {
    if (!auth || !auth.currentUser) return null;
    return state.terminales.find(t => t.usuarioId === auth.currentUser?.uid);
  };

  const guardarNuevaTasa = () => {
    const n = parseFloat(nuevaTasa);
    if (isNaN(n) || n <= 0) return alert('Tasa inválida');
    updateState({ tasa: n });
    setEditandoTasa(false);
  };

  const ejecutarVenta = () => {
    if (state.carrito.length === 0 || saldoRestanteUSD > 0.01) return;
    
    const terminal = getCurrentTerminal();
    const terminalCounter = terminal?.proximoRecibo || 1;
    const correlativoStr = String(terminalCounter).padStart(9, '0');
    const reciboId = terminal ? `${terminal.id}-${correlativoStr}` : correlativoStr;
    const ahoraStr = Utils.ahora();
    
    let prodsActualizados = [...state.productos];
    let nuevosMovimientos: Movimiento[] = [];

    state.carrito.forEach(item => {
      const pIdx = prodsActualizados.findIndex(x => x.id === item.productoId);
      if (pIdx === -1) return;
      const p = { ...prodsActualizados[pIdx] };
      if (p.isKit && p.kitType === 'stock_componentes' && p.kitItems) {
        p.kitItems.forEach(ki => {
          const cpIdx = prodsActualizados.findIndex(cp => cp.id === ki.productoId);
          if (cpIdx !== -1) {
            const cp = { ...prodsActualizados[cpIdx] };
            const cantidadADescontar = item.cantidad * ki.cantidad;
            const stockAntes = cp.stock;
            cp.stock -= cantidadADescontar;
            nuevosMovimientos.push({ id: Store.uid(), productoId: cp.id, tipo: 'venta', cantidad: -Math.abs(cantidadADescontar), stockAntes, stockDespues: cp.stock, fecha: ahoraStr, referencia: `COMPONENTE KIT: ${p.nombre} - VENTA ${reciboId}` });
            prodsActualizados[cpIdx] = cp;
          }
        });
      } else {
        const stockAntes = p.stock;
        p.stock -= item.cantidad;
        nuevosMovimientos.push({ id: Store.uid(), productoId: p.id, tipo: 'venta', cantidad: -Math.abs(item.cantidad), stockAntes, stockDespues: p.stock, fecha: ahoraStr, referencia: `VENTA ${reciboId}` });
        prodsActualizados[pIdx] = p;
      }
    });

    const nuevaVenta: Sale = { id: reciboId, fecha: ahoraStr, cliente, items: [...state.carrito], subtotalUSD, descuentoUSD: 0, totalUSD: subtotalUSD, totalBS, metodoPago: pagos.length > 1 ? 'mixto' : (pagos[0]?.metodo || 'efectivo_usd'), estado: 'completada', type: 'VENTA', received: totalPagadoUSD, change: Math.max(0, totalPagadoUSD - subtotalUSD), payments: [...pagos], terminalId: terminal?.id, cajeroId: auth?.currentUser?.uid };
    const nuevasEntradasDiario: LibroDiarioEntry[] = pagos.map(p => ({ id: 'ACC-' + Store.uid().toUpperCase().slice(0, 5), fecha: ahoraStr, tipo: 'ingreso', categoria: 'VENTA', concepto: `VENTA RECIBO #${reciboId} - CLIENTE: ${cliente.toUpperCase()}`, montoUSD: p.montoUSD, montoBS: p.montoBS, metodo: p.metodo, referencia: reciboId }));
    const nuevasTerminales = state.terminales.map(t => t.id === terminal?.id ? { ...t, proximoRecibo: terminalCounter + 1 } : t);

    updateState({ productos: prodsActualizados, ventas: [...state.ventas, nuevaVenta], movimientos: [...state.movimientos, ...nuevosMovimientos], libroDiario: [...nuevasEntradasDiario, ...(state.libroDiario || [])], terminales: nuevasTerminales, carrito: [], proximoRecibo: state.proximoRecibo + 1, acumuladoHistorico: state.acumuladoHistorico + subtotalUSD });
    
    setLastProcessedSale(nuevaVenta);
    setShowReceiptModal(true);
    setPagos([]);
    setCliente('CONSUMIDOR FINAL');
  };

  const summary = (() => {
    const hoy = Utils.hoy();
    const ventasHoy = state.ventas.filter(v => v.fecha.startsWith(hoy));
    const totalUSD = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
    const breakdown: Record<string, { usd: number, bs: number }> = {};
    ventasHoy.forEach(v => {
      const pms = v.payments && v.payments.length > 0 ? v.payments : [{ metodo: v.metodoPago as PaymentMethod, montoUSD: v.totalUSD, montoBS: v.totalBS }];
      pms.forEach((p: PagoRealizado) => {
        if (!breakdown[p.metodo]) breakdown[p.metodo] = { usd: 0, bs: 0 };
        breakdown[p.metodo].usd += p.montoUSD; 
        breakdown[p.metodo].bs += p.montoBS;
      });
    });
    return { totalUSD, breakdown, ventasHoy };
  })();

  const emitirReporteZ = () => {
    if (!confirm('¿Desea realizar el CIERRE FISCAL Z FINAL?')) return;
    const nuevoZ: ReportZ = { id: `Z-${String(state.ultimoZ + 1).padStart(4, '0')}`, fecha: Utils.hoy(), numeroZ: state.ultimoZ + 1, desdeFactura: summary.ventasHoy[0]?.id || '000000000', hastaFactura: summary.ventasHoy[summary.ventasHoy.length - 1]?.id || '000000000', baseImponibleUSD: summary.totalUSD / 1.16, ivaUSD: summary.totalUSD - (summary.totalUSD / 1.16), exentoUSD: 0, totalBrutoUSD: summary.totalUSD, acumuladoHistoricoUSD: state.acumuladoHistorico };
    updateState({ reportesZ: [...state.reportesZ, nuevoZ], ultimoZ: state.ultimoZ + 1 });
    setShowReport('Z');
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
      
      {/* 1. PESTAÑAS DE NAVEGACIÓN (Originales) */}
      <div className="flex flex-wrap gap-2 mb-2 no-print">
         {[
           { id: 'pos', label: 'PUNTO DE VENTA', icon: ShoppingCart },
           { id: 'history', label: 'HISTORIAL', icon: History },
           { id: 'credits', label: 'CONSULTAR CRÉDITOS', icon: ClipboardList },
           { id: 'reportY', label: 'REPORTE Y', icon: FileText },
           { id: 'reportZ', label: 'REPORTE Z', icon: Receipt },
           { id: 'returns', label: 'DEVOLUCIONES', icon: RotateCcw }
         ].map((t) => (
           <button 
             key={t.id} 
             onClick={() => {
                if (t.id === 'reportY') setShowReport('Y');
                else if (t.id === 'reportZ') emitirReporteZ();
                else setView(t.id as any);
             }}
             className={`flex flex-col items-center justify-center p-3 rounded-xl min-w-[120px] transition-all border shadow-sm ${view === t.id ? 'bg-[#C8952E] text-black border-[#C8952E]' : 'bg-white text-black border-line hover:bg-surface-soft'}`}
           >
             <t.icon className={`w-5 h-5 mb-1 ${view === t.id ? 'text-black' : 'text-black/60'}`} />
             <span className="text-[10px] font-black uppercase tracking-widest text-center">{t.label}</span>
           </button>
         ))}
      </div>

      {/* 2. BARRA DE BÚSQUEDA (Original) */}
      <div className="relative mb-2 no-print">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold"><Barcode className="w-6 h-6" /></div>
        <input 
          ref={searchInputRef} 
          className="form-input pl-14 h-12 text-lg bg-white border-line text-black font-black uppercase shadow-sm rounded-2xl" 
          placeholder="Escanee o busque producto..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && matches.length >= 1 && agregar(matches[0].id)} 
          autoFocus 
        />
        {matches.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-line rounded-xl shadow-2xl z-[110] mt-2 overflow-hidden">
            {matches.map(p => (
              <div key={p.id} onClick={() => agregar(p.id)} className="flex items-center justify-between p-4 hover:bg-brand-gold-soft cursor-pointer border-b border-line last:border-none transition-all">
                <div className="text-black text-xs font-black uppercase">{p.nombre} <span className="text-black/40 ml-2">[{p.codigo}]</span></div>
                <div className="text-brand-gold-deep font-black text-sm">{Utils.fmtUSD(p.precioUSD)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. ÁREA DE TRABAJO DIVIDIDA */}
      {view === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 flex-1 min-h-[500px]">
          
          {/* PANEL IZQUIERDO: CONTROL */}
          <div className="space-y-4 flex flex-col no-print">
            <div className="card p-5 bg-white border-line shadow-sm rounded-2xl space-y-4 flex-1">
              <div className="form-group">
                <label className="text-black text-[10px] font-black uppercase block mb-1.5 tracking-widest">IDENTIFICACIÓN CLIENTE</label>
                <input className="form-input h-10 font-black uppercase bg-surface-soft border-line" value={cliente} onChange={e => setCliente(e.target.value)} />
              </div>

              <div className="p-3 bg-surface-soft border border-line rounded-xl flex items-center justify-between">
                <label className="text-black text-[10px] font-black uppercase">TASA BCV</label>
                <div className="flex items-center gap-2">
                  {!editandoTasa ? (
                    <><span className="text-black font-black text-base">{state.tasa.toFixed(2)}</span><button onClick={() => setEditandoTasa(true)} className="text-black hover:text-brand-gold"><RefreshCw className="w-3.5 h-3.5" /></button></>
                  ) : (
                    <><input type="text" className="w-16 h-7 bg-white border border-brand-gold rounded text-right font-black px-1" value={nuevaTasa} onChange={e => setNuevaTasa(e.target.value)} /><button onClick={guardarNuevaTasa} className="text-status-success"><Check className="w-4 h-4" /></button></>
                  )}
                </div>
              </div>

              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                 <label className="text-black text-[10px] font-black uppercase block mb-1.5 tracking-widest">MÉTODOS APLICADOS</label>
                 <div className="flex-1 bg-surface-soft border border-line rounded-xl p-2 overflow-y-auto space-y-1.5 min-h-[100px]">
                    {pagos.length === 0 ? (
                       <div className="h-full flex items-center justify-center opacity-20 text-[9px] font-black uppercase">SIN PAGOS</div>
                    ) : pagos.map((p, idx) => (
                       <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-line text-[10px] font-black uppercase">
                         <span>{Utils.metodoLabel(p.metodo)}</span>
                         <span className="text-brand-gold-deep">{Utils.fmtUSD(p.montoUSD)}</span>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="p-4 bg-status-info-soft rounded-2xl border-2 border-status-info/10 text-center relative">
                 <label className="text-black text-[10px] font-black uppercase block mb-1 tracking-widest">SALDO RESTANTE</label>
                 <div className="flex items-center justify-center gap-3">
                   <div className="text-3xl font-black text-black">{Utils.fmtUSD(saldoRestanteUSD)}</div>
                   <button onClick={() => setShowMultiModal(true)} className="w-10 h-10 bg-brand-gold text-black rounded-xl shadow-lg flex items-center justify-center hover:scale-110 transition-transform"><Wallet className="w-5 h-5" /></button>
                 </div>
              </div>

              <div className="p-4 bg-black rounded-2xl border-2 border-brand-gold/30 text-center shadow-xl">
                 <label className="text-white/40 text-[9px] font-black uppercase block mb-1 tracking-[0.2em]">EQUIVALENTE A PAGAR</label>
                 <div className="text-2xl font-black text-brand-gold">{Utils.fmtBS(saldoRestanteBS)}</div>
              </div>
            </div>
          </div>

          {/* PANEL DERECHO: CARRITO */}
          <div className="flex flex-col flex-1 card bg-white border-line shadow-lg rounded-3xl overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_60px_90px_100px_90px_40px] gap-2 px-6 py-4 bg-black text-white text-[9px] font-black uppercase tracking-[0.15em] items-center">
              <div>DESCRIPCIÓN</div><div className="text-center">CANT</div><div className="text-center">U.M.</div><div className="text-right">PRECIO ($)</div><div className="text-right">PRECIO (BS)</div><div className="text-right">TOTAL</div><div />
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-surface-soft/30">
               {state.carrito.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-black/10"><ShoppingCart className="w-24 h-24 mb-4" /><p className="font-black uppercase tracking-[0.3em] text-lg">CARRITO VACÍO</p></div>
               ) : state.carrito.map((item, i) => (
                 <div key={i} className="grid grid-cols-[1fr_80px_60px_90px_100px_90px_40px] gap-2 items-center px-4 py-3 bg-white border border-line rounded-xl text-black shadow-sm transition-all hover:border-brand-gold/30">
                   <div className="truncate font-black text-[10px] uppercase">{item.nombre}</div>
                   <div className="flex items-center justify-center gap-1 bg-surface-soft rounded-lg p-1">
                      <button onClick={() => updateQty(i, -1)} className="w-5 h-5 flex items-center justify-center bg-white rounded text-black font-black">-</button>
                      <span className="w-6 text-center text-xs font-black">{item.cantidad}</span>
                      <button onClick={() => updateQty(i, 1)} className="w-5 h-5 flex items-center justify-center bg-white rounded text-black font-black">+</button>
                   </div>
                   <div className="text-center text-[9px] font-black uppercase text-black/40">{state.productos.find(p => p.id === item.productoId)?.cantidad || '-'}</div>
                   <div className="text-right text-[10px] font-black">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                   <div className="text-right text-[9px] font-black text-black/40">{Utils.fmtBS(item.precioUnitUSD * state.tasa)}</div>
                   <div className="text-right text-xs font-black text-brand-gold-deep">{Utils.fmtUSD(item.subtotalUSD)}</div>
                   <div className="flex justify-center"><button onClick={() => updateQty(i, -item.cantidad)} className="text-black/20 hover:text-status-danger"><Trash2 className="w-3.5 h-3.5"/></button></div>
                 </div>
               ))}
            </div>

            <div className="p-6 bg-black border-t border-white/10 flex items-center justify-between no-print">
               <div className="flex flex-col">
                  <span className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em] mb-1">TOTAL FACTURA</span>
                  <div className="flex items-baseline gap-4">
                     <div className="text-4xl font-black text-brand-gold tracking-tighter">{Utils.fmtUSD(subtotalUSD)}</div>
                     <div className="text-sm font-black text-white/60 italic">{Utils.fmtBS(totalBS)}</div>
                  </div>
               </div>
               <button onClick={ejecutarVenta} disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01} className="btn bg-[#C8952E] hover:bg-[#D9A540] text-black h-14 px-12 rounded-2xl font-black uppercase text-sm disabled:opacity-20 transition-all flex items-center gap-3 shadow-xl">
                 <CheckCircle2 className="w-5 h-5" /> PROCESAR VENTA
               </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white border border-line rounded-3xl overflow-hidden shadow-xl min-h-[500px] flex flex-col">
           {/* SECCIÓN HISTORIAL / CRÉDITOS / DEVOLUCIONES INTEGRADA */}
           <div className="card-head px-8 py-4 bg-black border-b border-white/10 flex justify-between items-center text-white">
              <h3 className="font-black uppercase italic tracking-tighter text-sm flex items-center gap-3">
                {view === 'history' && <><History className="text-brand-gold" /> AUDITORÍA DE FACTURACIÓN DIARIA</>}
                {view === 'credits' && <><ClipboardList className="text-brand-gold" /> GESTIÓN DE CARTERA DE CLIENTES</>}
                {view === 'returns' && <><RotateCcw className="text-status-danger" /> MÓDULO DE DEVOLUCIONES Y NOTAS DE CRÉDITO</>}
              </h3>
              <button onClick={() => setView('pos')} className="text-white/40 hover:text-white"><X className="w-5 h-5"/></button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4">
              {view === 'history' && (
                <div className="table-wrap">
                  <table>
                    <thead><tr className="bg-surface-soft"><th className="text-black font-black uppercase p-4 text-[10px]">Recibo</th><th className="text-black font-black uppercase p-4 text-[10px]">Hora</th><th className="text-black font-black uppercase p-4 text-[10px]">Cliente</th><th className="text-black font-black uppercase p-4 text-[10px] text-right">Monto USD</th><th className="text-black font-black uppercase p-4 text-[10px]">Método</th><th className="text-center text-black font-black uppercase p-4 text-[10px]">Estado</th></tr></thead>
                    <tbody>
                      {summary.ventasHoy.sort((a,b) => b.fecha.localeCompare(a.fecha)).map(v => (
                        <tr key={v.id} className="border-b border-line/40">
                          <td className="text-black font-black text-xs mono p-4">{v.id}</td>
                          <td className="text-black font-black text-xs p-4">{v.fecha.split('T')[1]?.slice(0, 5)}</td>
                          <td className="text-black font-black text-xs uppercase p-4 truncate max-w-[200px]">{v.cliente}</td>
                          <td className="text-brand-gold-deep font-black text-sm text-right p-4">{Utils.fmtUSD(v.totalUSD)}</td>
                          <td className="text-black font-black text-[10px] uppercase p-4">{Utils.metodoLabel(v.metodoPago)}</td>
                          <td className="text-center p-4"><span className={`badge ${v.estado === 'completada' ? 'badge-ok' : 'badge-warn'} font-black text-[9px] uppercase px-3`}>{v.estado}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {view === 'credits' && (
                <div className="space-y-6">
                  <div className="table-wrap">
                    <table className="w-full">
                      <thead><tr className="bg-surface-soft"><th className="px-6 py-4"></th><th className="text-black font-black text-[10px] uppercase">Cliente / Identificación</th><th className="text-black font-black text-[10px] uppercase text-right">Facturas</th><th className="text-black font-black text-[10px] uppercase text-right">Saldo USD</th><th className="text-black font-black text-[10px] uppercase text-center">Auditoría</th></tr></thead>
                      <tbody>
                        {Object.entries(groupedCredits).map(([clientName, group]) => (
                          <React.Fragment key={clientName}>
                            <tr className="border-b border-line hover:bg-surface-warm/20 transition-all">
                              <td className="px-6 py-5"><button onClick={() => setExpandedClient(expandedClient === clientName ? null : clientName)} className="text-brand-gold">{expandedClient === clientName ? <ChevronUp /> : <ChevronDown />}</button></td>
                              <td className="py-5"><div className="text-black font-black text-sm uppercase">{clientName}</div></td>
                              <td className="text-right py-5 font-black text-black">{group.debts.length}</td>
                              <td className="text-right py-5 font-black text-status-info text-lg">{Utils.fmtUSD(group.totalUSD)}</td>
                              <td className="text-center py-5">
                                <div className="flex items-center justify-center gap-3">
                                  <button onClick={() => setShowClientHistory(clientName)} className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-[#2F8F3F] border border-line hover:scale-110 transition-transform"><Eye className="w-7 h-7" /></button>
                                  <button onClick={() => { setShowAbonoModal(clientName); setAbonoPagos([]); }} className="btn bg-[#C8952E] text-black h-10 px-6 font-black uppercase text-[10px] shadow-lg">ABONAR</button>
                                </div>
                              </td>
                            </tr>
                            {expandedClient === clientName && (
                              <tr className="bg-surface-soft/40"><td colSpan={5} className="px-12 py-6"><div className="card border-line bg-white shadow-inner rounded-2xl overflow-hidden"><table><thead className="bg-black text-white"><tr><th className="text-[9px] font-black uppercase p-3 text-left">Emisión</th><th className="text-[9px] font-black uppercase p-3 text-left">Factura</th><th className="text-[9px] font-black uppercase p-3 text-right">Saldo USD</th><th className="text-[9px] font-black uppercase p-3 text-center">Ver</th></tr></thead><tbody>{group.debts.map(d => (<tr key={d.id} className="border-b border-line/20"><td>{Utils.fmtFecha(d.fecha)}</td><td className="mono font-black">{d.id}</td><td className="text-right font-black text-brand-gold-deep">{Utils.fmtUSD(d.saldoUSD)}</td><td className="text-center"><button onClick={() => setShowDetailsModal(d)}><Eye className="w-4 h-4 text-black"/></button></td></tr>))}</tbody></table></div></td></tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {view === 'returns' && (
                <div className="p-10 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="p-10 bg-surface-soft rounded-full text-black/10"><RotateCcw className="w-20 h-24" /></div>
                  <h4 className="text-xl font-black uppercase text-black">Módulo de Devoluciones en Terminal</h4>
                  <p className="text-xs font-bold text-black uppercase opacity-40 max-w-sm">Ingrese el ID de factura para iniciar un proceso de reverso de inventario y emisión de vale.</p>
                  <div className="flex gap-2 w-full max-w-sm">
                    <input className="form-input h-12 font-black uppercase" placeholder="RECIBO #" value={returnSaleSearch} onChange={e => setReturnSaleSearch(e.target.value)} />
                    <button onClick={() => {
                      const s = state.ventas.find(v => v.id === returnSaleSearch || v.id.endsWith(returnSaleSearch));
                      if (s) { setSelectedSaleForReturn(s); setReturnItems([]); }
                      else alert('Venta no encontrada');
                    }} className="btn bg-[#C8952E] text-black h-12 px-6 font-black uppercase text-xs">BUSCAR</button>
                  </div>
                </div>
              )}
           </div>
        </div>
      )}

      {/* MODAL MULTIPAGO */}
      {showMultiModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowMultiModal(false)}></div>
          <div className="modal-box bg-white max-w-lg border-none rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="modal-head py-6 px-10 bg-black border-b border-white/10 flex justify-between items-center text-white">
              <h3 className="font-black uppercase tracking-widest text-xs">REGISTRAR MÉTODO DE PAGO</h3>
              <button onClick={() => setShowMultiModal(false)}><X className="w-6 h-6 text-white/40 hover:text-white"/></button>
            </div>
            <div className="modal-body p-10 space-y-6">
               <div className="grid grid-cols-2 gap-3">
                 {[
                   {id:'efectivo_usd', label:'Dólares ($)', icon: DollarSign},
                   {id:'zelle', label:'Zelle', icon: Share2},
                   {id:'efectivo_bs', label:'Bolívares (Cash)', icon: Banknote},
                   {id:'pagomovil', label:'Pago Móvil', icon: Smartphone},
                   {id:'punto_venta', label:'Punto Venta', icon: CreditCard},
                   {id:'biopago', label:'Biopago', icon: Monitor}
                 ].map(m => (
                   <button key={m.id} onClick={() => setMetodoActual(m.id as any)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 font-black text-[10px] uppercase ${metodoActual === m.id ? 'bg-[#C8952E] border-[#C8952E] text-black shadow-lg shadow-[#C8952E]/20' : 'bg-surface-soft border-line text-black/40 hover:border-black/20'}`}>
                     <m.icon className="w-6 h-6" /> {m.label}
                   </button>
                 ))}
               </div>
               <div className="form-group space-y-2">
                 <label className="text-black text-[11px] font-black uppercase tracking-widest block text-center">MONTO A RECIBIR ({metodoActual.includes('usd') || metodoActual === 'zelle' ? 'USD' : 'BS'})</label>
                 <input className="form-input h-16 text-4xl font-black text-center text-black bg-surface-soft border-line rounded-2xl" value={montoInput} onChange={e => setMontoInput(e.target.value.replace(/[^0-9.]/g, ''))} autoFocus onKeyDown={e => e.key === 'Enter' && addPago()} />
               </div>
               <button onClick={() => addPago()} className="btn bg-[#C8952E] text-black w-full h-16 font-black uppercase text-sm shadow-xl rounded-2xl">Confirmar Método</button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG DE REPORTES Y/Z */}
      <Dialog open={!!showReport} onOpenChange={() => setShowReport(null)}>
        <DialogContent className="sm:max-w-md p-0 bg-transparent border-none overflow-visible shadow-none no-print">
          <div className="bg-white text-black p-10 font-mono text-[11px] leading-tight rounded-sm shadow-2xl relative border border-gray-200">
             <div className="text-center space-y-1 mb-8">
                <p className="font-black text-[22px] tracking-[0.3em] mb-1">POSVEN PRO</p>
                <p className="text-[10px] font-black uppercase border-y border-black py-3 my-4">CORTE DE CAJA {showReport} - {showReport === 'Z' ? 'CIERRE FINAL' : 'PRE-CORTE'}</p>
             </div>
             <div className="space-y-4 mb-8">
                <div className="flex justify-between font-black text-base border-b-2 border-black pb-1"><span>VENTAS NETAS</span><span>{Utils.fmtUSD(summary.totalUSD)}</span></div>
                <div className="space-y-1 pt-2">
                  {Object.entries(summary.breakdown).map(([m, val]: any) => (
                    <div key={m} className="flex justify-between uppercase"><span>{Utils.metodoLabel(m)}</span><span className="font-black">{Utils.fmtUSD(val.usd)}</span></div>
                  ))}
                </div>
             </div>
             <div className="text-center italic opacity-50"><p>FIN DEL DOCUMENTO</p></div>
          </div>
          <button onClick={() => setShowReport(null)} className="w-full bg-black text-white h-14 rounded-2xl font-black uppercase text-xs mt-4 shadow-xl">Cerrar Reporte</button>
        </DialogContent>
      </Dialog>

      {/* RECEIPT MODAL */}
      {showReceiptModal && lastProcessedSale && (
        <ReceiptModal 
          isOpen={showReceiptModal} 
          onClose={() => setShowReceiptModal(false)} 
          sale={{
            ...lastProcessedSale,
            date: lastProcessedSale.fecha,
            customerName: lastProcessedSale.cliente,
            paymentMethod: Utils.metodoLabel(lastProcessedSale.metodoPago),
            items: lastProcessedSale.items.map((it: any) => ({...it, name: it.nombre, qty: it.cantidad, price: it.precioUnitUSD}))
          }} 
        />
      )}

    </div>
  );

  function addPago() {
    let monto = parseFloat(montoInput);
    if (isNaN(monto) || monto <= 0) return;
    let montoUSD = (metodoActual.includes('usd') || metodoActual === 'zelle') ? monto : monto / state.tasa;
    let montoBS = (metodoActual.includes('usd') || metodoActual === 'zelle') ? monto * state.tasa : monto;
    const nuevosPagos = [...pagos, { metodo: metodoActual, montoUSD, montoBS }];
    setPagos(nuevosPagos);
    if (nuevosPagos.reduce((s, p) => s + p.montoUSD, 0) >= (subtotalUSD - 0.01)) setShowMultiModal(false);
    setMontoInput('');
  }

  function addAbonoPago() {
    let monto = parseFloat(montoInput);
    if (isNaN(monto) || monto <= 0) return;
    let montoUSD = (metodoActual.includes('usd') || metodoActual === 'zelle') ? monto : monto / state.tasa;
    let montoBS = (metodoActual.includes('usd') || metodoActual === 'zelle') ? monto * state.tasa : monto;
    setAbonoPagos([...abonoPagos, { metodo: metodoActual, montoUSD, montoBS }]);
    setMontoInput('');
  }
}
