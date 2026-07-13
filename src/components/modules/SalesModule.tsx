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
  Menu as MenuIcon
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [pagos, setPagos] = useState<PagoRealizado[]>([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [metodoActual, setMetodoActual] = useState<PaymentMethod>('efectivo_usd');
  const [montoInput, setMontoInput] = useState('');
  
  const [showAbonoModal, setShowAbonoModal] = useState<string | null>(null);
  const [abonoPagos, setAbonoPagos] = useState<PagoRealizado[]>([]);
  const [showAbonoMultiModal, setShowAbonoMultiModal] = useState(false);
  
  const [showDetailsModal, setShowDetailsModal] = useState<any | null>(null);
  const [showClientHistory, setShowClientHistory] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  
  const [lastProcessedSale, setLastProcessedSale] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Estados para Devoluciones
  const [returnView, setReturnView] = useState<'list' | 'create'>('list');
  const [returnSaleSearch, setReturnSaleSearch] = useState('');
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'EFECTIVO' | 'MISMO_METODO' | 'CREDITO_TIENDA'>('EFECTIVO');
  const [returnReason, setReturnReason] = useState('');

  // Estados para Tasa BCV
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [nuevaTasa, setNuevaTasa] = useState(state.tasa.toString());

  // Estado para visualización de info de producto en barra de búsqueda
  const [lastCheckedProduct, setLastCheckedProduct] = useState<Product | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    if (search.trim().length < 1) return [];
    return state.productos
      .filter(p => p.activo && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())))
      .slice(0, 8);
  }, [search, state.productos]);

  useEffect(() => {
    if (matches.length > 0) {
      setLastCheckedProduct(matches[0]);
    }
  }, [matches]);

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

  const totalDeudaAbonoUSD = showAbonoModal ? (groupedCredits[showAbonoModal]?.totalUSD || 0) : 0;
  const totalAbonadoEnModalUSD = abonoPagos.reduce((s, p) => s + p.montoUSD, 0);

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
    setLastCheckedProduct(p);
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
    const currentUserId = auth.currentUser.uid;
    return state.terminales.find(t => t.usuarioId === currentUserId);
  };

  const guardarNuevaTasa = () => {
    const n = parseFloat(nuevaTasa);
    if (isNaN(n) || n <= 0) return alert('Tasa inválida');
    updateState({ tasa: n });
    setEditandoTasa(false);
    setNuevaTasa(n.toString());
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

  const emitirReporteZ = () => {
    if (!confirm('¿Desea realizar el CIERRE FISCAL Z FINAL?')) return;
    const { totalVentasNetasUSD, ventasHoy } = getReportSummary();
    const nuevoZ: ReportZ = { id: `Z-${String(state.ultimoZ + 1).padStart(4, '0')}`, fecha: Utils.hoy(), numeroZ: state.ultimoZ + 1, desdeFactura: ventasHoy[0]?.id || '000000000', hastaFactura: ventasHoy[ventasHoy.length - 1]?.id || '000000000', baseImponibleUSD: totalVentasNetasUSD / 1.16, ivaUSD: totalVentasNetasUSD - (totalVentasNetasUSD / 1.16), exentoUSD: 0, totalBrutoUSD: totalVentasNetasUSD, acumuladoHistoricoUSD: state.acumuladoHistorico };
    updateState({ reportesZ: [...state.reportesZ, nuevoZ], ultimoZ: state.ultimoZ + 1 });
    setShowReport('Z');
  };

  const getReportSummary = () => {
    const hoy = Utils.hoy();
    const ventasHoy = state.ventas.filter(v => v.fecha.startsWith(hoy));
    const devolucionesHoy = (state.devoluciones || []).filter(d => d.fecha.startsWith(hoy));
    const totalVentasBrutasUSD = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
    const totalDevolucionesUSD = devolucionesHoy.reduce((s, d) => s + d.totalUSD, 0);
    const totalDescuentosUSD = ventasHoy.reduce((s, v) => s + (v.descuentoUSD || 0), 0);
    const totalVentasNetasUSD = totalVentasBrutasUSD - totalDevolucionesUSD - totalDescuentosUSD;
    const breakdown: Record<string, { usd: number, bs: number }> = {};
    ventasHoy.forEach(v => {
      const pms = v.payments && v.payments.length > 0 ? v.payments : [{ metodo: v.metodoPago as PaymentMethod, montoUSD: v.totalUSD, montoBS: v.totalBS }];
      pms.forEach((p: PagoRealizado) => {
        if (!breakdown[p.metodo]) breakdown[p.metodo] = { usd: 0, bs: 0 };
        breakdown[p.metodo].usd += p.montoUSD; 
        breakdown[p.metodo].bs += p.montoBS;
      });
    });
    const hourlySales: Record<string, number> = {};
    ventasHoy.forEach(v => { const h = v.fecha.split('T')[1]?.slice(0, 2) + ':00'; if (h) hourlySales[h] = (hourlySales[h] || 0) + v.totalUSD; });
    const prodPerformance: Record<string, { n: string, q: number, t: number }> = {};
    ventasHoy.forEach(v => { v.items.forEach(it => { if (!prodPerformance[it.productoId]) prodPerformance[it.productoId] = { n: it.nombre, q: 0, t: 0 }; prodPerformance[it.productoId].q += it.cantidad; prodPerformance[it.productoId].t += it.subtotalUSD; }); });
    const topProducts = Object.values(prodPerformance).sort((a,b) => b.q - a.q).slice(0, 5);
    const ingresosEfectivoUSD = (breakdown['efectivo_usd']?.usd || 0) + (breakdown['zelle']?.usd || 0);
    const ingresosEfectivoBS_USD = (breakdown['efectivo_bs']?.bs || 0) / state.tasa;
    const totalEsperadoCajaUSD = 100 + ingresosEfectivoUSD + ingresosEfectivoBS_USD;
    return { totalVentasBrutasUSD, totalDevolucionesUSD, totalDescuentosUSD, totalVentasNetasUSD, breakdown, hourlySales, topProducts, totalEsperadoCajaUSD, ticketPromedio: ventasHoy.length > 0 ? totalVentasNetasUSD / ventasHoy.length : 0, maxVenta: ventasHoy.length > 0 ? Math.max(...ventasHoy.map(v => v.totalUSD)) : 0, ventasHoy, devolucionesHoy };
  };

  const summary = getReportSummary();
  const { breakdown: rBreakdown, hourlySales: rHourly, topProducts: rTop, devolucionesHoy: rDevoluciones } = summary;

  const changeView = (newView: any) => {
    setView(newView);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-100px)] max-w-7xl mx-auto w-full overflow-hidden relative">
      
      {/* SIDEBAR NAVEGACIÓN LATERAL */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsSidebarOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col p-6 animate-in slide-in-from-left duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-10 border-b border-line pb-4">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-brand-gold rounded-xl flex items-center justify-center text-black font-black text-xl shadow-lg">P</div>
                 <h3 className="font-display font-black text-black text-sm tracking-widest uppercase">Operaciones</h3>
               </div>
               <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-surface-soft rounded-full transition-colors"><X className="w-5 h-5 text-black" /></button>
            </div>

            <nav className="flex flex-col gap-3">
               <button onClick={() => changeView('pos')} className={`flex items-center gap-4 p-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${view === 'pos' ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20' : 'text-black hover:bg-surface-soft'}`}>
                 <ShoppingCart className="w-5 h-5" /> Punto de Venta
               </button>
               <button onClick={() => changeView('history')} className={`flex items-center gap-4 p-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${view === 'history' ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20' : 'text-black hover:bg-surface-soft'}`}>
                 <History className="w-5 h-5" /> Historial Diario
               </button>
               <button onClick={() => changeView('credits')} className={`flex items-center gap-4 p-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${view === 'credits' ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20' : 'text-black hover:bg-surface-soft'}`}>
                 <ClipboardList className="w-5 h-5" /> Consultar Créditos
               </button>
               <button onClick={() => changeView('returns')} className={`flex items-center gap-4 p-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${view === 'returns' ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20' : 'text-black hover:bg-surface-soft'}`}>
                 <RotateCcw className="w-5 h-5" /> Devoluciones
               </button>
               
               <div className="h-px bg-line my-4" />
               
               <button onClick={() => { setShowReport('Y'); setIsSidebarOpen(false); }} className="flex items-center gap-4 p-4 rounded-xl font-black text-xs uppercase tracking-widest text-status-info hover:bg-status-info-soft transition-all">
                 <FileText className="w-5 h-5" /> Corte Parcial Y
               </button>
               <button onClick={() => { emitirReporteZ(); setIsSidebarOpen(false); }} className="flex items-center gap-4 p-4 rounded-xl font-black text-xs uppercase tracking-widest text-status-danger hover:bg-status-danger-soft transition-all">
                 <Receipt className="w-5 h-5" /> Cierre Fiscal Z
               </button>
            </nav>

            <div className="mt-auto pt-6 border-t border-line text-center">
               <p className="text-[9px] font-black text-black/30 uppercase tracking-[0.3em]">PosVEN Pro v2.5.6</p>
            </div>
          </div>
        </div>
      )}

      {/* ÁREA SUPERIOR: BÚSQUEDA + INFO (Subido de posición) */}
      <div className="flex gap-4 shrink-0 animate-in slide-in-from-top-4 duration-500">
        <div className="relative group flex-[2] flex gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="w-14 h-14 bg-black text-brand-gold rounded-2xl flex items-center justify-center shadow-xl hover:bg-brand-gold hover:text-black transition-all transform active:scale-90">
             <MenuIcon className="w-7 h-7" />
          </button>
          <div className="relative flex-1">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-gold z-10"><Barcode className="w-6 h-6" /></div>
            <input ref={searchInputRef} className="form-input pl-16 h-14 text-xl bg-white border-none text-black placeholder-black/30 font-black uppercase shadow-xl rounded-2xl" placeholder="ESCANEE O BUSQUE PRODUCTO..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && matches.length >= 1 && agregar(matches[0].id)} autoFocus />
            {matches.length > 0 && (<div className="absolute top-full left-0 right-0 bg-white border-2 border-line rounded-2xl shadow-2xl z-[110] mt-2 overflow-hidden">{matches.map(p => (<div key={p.id} onClick={() => agregar(p.id)} className="flex items-center justify-between p-4 hover:bg-brand-gold-soft cursor-pointer border-b border-line last:border-none transition-all"><div className="text-black text-sm font-black uppercase">{p.nombre} <span className="text-black/40 text-[10px] mono ml-3">{p.codigo}</span></div><div className="text-brand-gold-deep font-black text-base">{Utils.fmtUSD(p.precioUSD)}</div></div>))}</div>)}
          </div>
        </div>
        <div className="flex-[1.5] grid grid-cols-3 gap-3">
          <div className="bg-white border-none rounded-2xl flex flex-col items-center justify-center p-2 shadow-xl text-center">
             <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 opacity-50">Stock</label>
             <div className={`text-2xl font-black ${lastCheckedProduct && lastCheckedProduct.stock <= lastCheckedProduct.stockMinimo ? 'text-status-danger animate-pulse' : 'text-black'}`}>{lastCheckedProduct ? lastCheckedProduct.stock : '--'}</div>
          </div>
          <div className="bg-white border-none rounded-2xl flex flex-col items-center justify-center p-2 shadow-xl text-center">
             <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 opacity-50">Precio ($)</label>
             <div className="text-2xl font-black text-brand-gold-deep">{lastCheckedProduct ? Utils.fmtUSD(lastCheckedProduct.precioUSD) : '--'}</div>
          </div>
          <div className="bg-white border-none rounded-2xl flex flex-col items-center justify-center p-2 shadow-xl text-center">
             <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 opacity-50">Precio (Bs)</label>
             <div className="text-xl font-black text-black">{lastCheckedProduct ? Utils.fmtBS(lastCheckedProduct.precioUSD * state.tasa) : '--'}</div>
          </div>
        </div>
      </div>

      {/* ÁREA CENTRAL: CARRITO + PANEL IZQUIERDO (Expandido hacia arriba) */}
      <div className="flex flex-1 gap-4 overflow-hidden mb-2">
        <div className="w-[320px] flex flex-col gap-4">
          <div className="card p-5 space-y-5 bg-white border-none shadow-xl h-full flex flex-col rounded-[24px]">
            <div className="form-group mb-0">
              <label className="text-black text-[11px] font-black uppercase block mb-1.5 tracking-wider">IDENTIFICACIÓN CLIENTE</label>
              <input className="form-input h-10 text-sm bg-surface-soft text-black border-line font-black uppercase rounded-xl" value={cliente} onChange={e => setCliente(e.target.value)} />
            </div>
            
            <div className="bg-brand-gold-soft border border-brand-gold/10 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-black text-[10px] font-black uppercase tracking-widest">TASA BCV</label>
                <div className="flex items-center gap-2">
                  {!editandoTasa ? (<><span className="text-black font-black text-lg">{state.tasa.toFixed(2)}</span><button onClick={() => { setEditandoTasa(true); setNuevaTasa(state.tasa.toString()); }} className="text-black hover:text-brand-gold p-1 bg-white rounded-lg shadow-sm"><RefreshCw className="w-4 h-4" /></button></>) : (<><input type="text" value={nuevaTasa} onChange={e => setNuevaTasa(e.target.value.replace(/[^0-9.]/g, ''))} className="w-20 bg-white border-2 border-brand-gold rounded-xl px-2 py-1 text-black font-black text-base text-right" autoFocus /><button onClick={guardarNuevaTasa} className="text-status-success p-1 bg-white rounded-lg shadow-sm"><Check className="w-4 h-4" /></button><button onClick={() => setEditandoTasa(false)} className="text-status-danger p-1 bg-white rounded-lg shadow-sm"><X className="w-4 h-4" /></button></>)}
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <label className="text-black text-[11px] font-black uppercase block mb-1.5 tracking-wider">MÉTODOS APLICADOS</label>
              <div className="flex-1 p-3 border border-line bg-surface-soft rounded-2xl overflow-y-auto space-y-2">
                {pagos.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20"><Wallet className="w-10 h-10" /><p className="text-[10px] font-black mt-2">SIN PAGOS</p></div>
                ) : pagos.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-line text-xs text-black font-black uppercase shadow-sm">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-brand-gold" />{Utils.metodoLabel(p.metodo)}</div>
                    <span className="text-brand-gold-deep">{Utils.fmtUSD(p.montoUSD)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-status-info-soft rounded-[20px] text-center border-2 border-status-info/20 shadow-inner">
              <label className="text-black text-[10px] font-black uppercase block tracking-widest mb-1">SALDO RESTANTE</label>
              <div className="flex items-center justify-center gap-4">
                <div className={`text-4xl font-black tracking-tighter ${saldoRestanteUSD <= 0.01 ? 'text-status-success' : 'text-black'}`}>{saldoRestanteUSD <= 0.01 ? 'SALDADO' : Utils.fmtUSD(saldoRestanteUSD)}</div>
                <button onClick={() => setShowMultiModal(true)} className="w-12 h-12 bg-black text-brand-gold rounded-2xl shadow-xl flex items-center justify-center hover:bg-brand-gold hover:text-black transition-all transform hover:scale-110 active:scale-90"><Wallet className="w-7 h-7" /></button>
              </div>
              <div className="bg-black py-3 rounded-2xl border-2 border-brand-gold/30 mt-4 shadow-xl">
                <label className="text-white text-[9px] font-black uppercase block mb-1 opacity-50 tracking-[0.2em]">EQUIVALENTE BS</label>
                <div className="text-3xl font-black text-brand-gold tracking-tight">{Utils.fmtBS(saldoRestanteBS)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {view === 'pos' ? (
            <div className="card flex-1 flex flex-col overflow-hidden bg-white border-none shadow-2xl rounded-[32px]">
              <div className="grid grid-cols-[1fr_80px_60px_90px_100px_100px_40px] gap-2 px-6 py-5 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em]">
                <div>Descripción</div><div className="text-center">Cant</div><div className="text-center">U.M.</div><div className="text-right">Precio ($)</div><div className="text-right">Precio (Bs)</div><div className="text-right">Total</div><div />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-surface-soft/30">
                {state.carrito.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-black/10"><ShoppingCart className="w-32 h-32" /><p className="text-xl font-black uppercase tracking-widest">Carrito Vacío</p></div>
                ) : state.carrito.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_60px_90px_100px_100px_40px] gap-2 items-center px-6 py-4 bg-white border border-line rounded-2xl text-black shadow-sm transition-all hover:border-brand-gold/30">
                    <div className="truncate font-black text-[11px] uppercase leading-tight">{item.nombre}</div>
                    <div className="flex items-center justify-center gap-1.5 bg-surface-soft rounded-xl p-1 border border-line shadow-inner">
                      <button onClick={() => updateQty(i, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-lg text-black font-black text-base shadow-sm">-</button>
                      <span className="w-6 text-center text-xs font-black">{item.cantidad}</span>
                      <button onClick={() => updateQty(i, 1)} className="w-6 h-6 flex items-center justify-center bg-brand-gold rounded-lg text-black font-black text-base shadow-sm">+</button>
                    </div>
                    <div className="text-center text-[10px] font-black uppercase text-black/40">{state.productos.find(p => p.id === item.productoId)?.cantidad || '-'}</div>
                    <div className="text-right text-[11px] font-black">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                    <div className="text-right text-[10px] font-black opacity-50">{Utils.fmtBS(item.precioUnitUSD * state.tasa)}</div>
                    <div className="text-right text-base font-black text-brand-gold-deep">{Utils.fmtUSD(item.subtotalUSD)}</div>
                    <div className="flex justify-center"><button onClick={() => updateQty(i, -item.cantidad)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-status-danger-soft text-black/20 hover:text-status-danger transition-colors"><Trash2 className="w-4 h-4"/></button></div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-black border-t border-line/10 flex items-center justify-between">
                <div className="flex items-baseline gap-6">
                  <div className="space-y-0.5">
                    <label className="text-white/40 text-[9px] font-black uppercase tracking-[0.25em]">TOTAL USD</label>
                    <div className="text-5xl font-black text-brand-gold tracking-tighter">{Utils.fmtUSD(subtotalUSD)}</div>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-white/40 text-[9px] font-black uppercase tracking-[0.25em]">TOTAL BOLÍVARES</label>
                    <div className="text-2xl font-black text-white">{Utils.fmtBS(totalBS)}</div>
                  </div>
                </div>
                <button onClick={ejecutarVenta} disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01} className="btn bg-brand-gold text-black h-16 px-12 font-black uppercase text-sm disabled:opacity-20 flex items-center gap-3 tracking-widest shadow-2xl shadow-brand-gold/20 rounded-2xl transform active:scale-95 transition-all">
                  <CheckCircle2 className="w-6 h-6"/> PROCESAR VENTA
                </button>
              </div>
            </div>
          ) : view === 'history' ? (
            <div className="card flex-1 bg-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-500 rounded-[32px] shadow-2xl">
              <div className="card-head px-8 py-5 bg-black border-b border-white/10 flex justify-between items-center">
                <h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-3 text-sm">
                  <History className="w-6 h-6 text-brand-gold" /> AUDITORÍA DE VENTAS - HOY
                </h3>
                <button onClick={() => setView('pos')} className="text-white/40 hover:text-white transition-colors"><X className="w-6 h-6"/></button>
              </div>
              <div className="table-wrap flex-1 overflow-y-auto">
                <table className="w-full">
                  <thead><tr className="bg-surface-soft"><th className="text-black font-black uppercase p-4 text-[10px]">Recibo</th><th className="text-black font-black uppercase p-4 text-[10px]">Hora</th><th className="text-black font-black uppercase p-4 text-[10px]">Terminal</th><th className="text-black font-black uppercase p-4 text-[10px]">Cliente</th><th className="text-black font-black uppercase p-4 text-[10px] text-right">Monto USD</th><th className="text-black font-black uppercase p-4 text-[10px]">Método</th><th className="text-center text-black font-black uppercase p-4 text-[10px]">Estado</th></tr></thead>
                  <tbody>
                    {summary.ventasHoy.sort((a,b) => b.fecha.localeCompare(a.fecha)).map(v => (
                      <tr key={v.id} className="border-b border-line/40 hover:bg-surface-warm/20 transition-all">
                        <td className="text-black font-black text-xs mono p-4">{v.id}</td>
                        <td className="text-black font-black text-xs p-4">{v.fecha.split('T')[1]?.slice(0, 5)}</td>
                        <td className="text-black font-black text-[10px] uppercase p-4">{state.terminales.find(t => t.id === v.terminalId)?.nombre || '-'}</td>
                        <td className="text-black font-black text-xs uppercase p-4 truncate max-w-[200px]">{v.cliente}</td>
                        <td className="text-brand-gold-deep font-black text-sm text-right p-4">{Utils.fmtUSD(v.totalUSD)}</td>
                        <td className="text-black font-black text-[10px] uppercase p-4">{Utils.metodoLabel(v.metodoPago)}</td>
                        <td className="text-center p-4"><span className={`badge ${v.estado === 'pendiente' ? 'badge-warn' : 'badge-ok'} font-black text-[9px] uppercase px-3`}>{v.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : view === 'credits' ? (
            <div className="card flex-1 bg-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-500 rounded-[32px] shadow-2xl">
              <div className="card-head px-8 py-5 bg-black border-b border-white/10 flex justify-between items-center">
                <h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-3 text-sm">
                  <ClipboardList className="w-6 h-6 text-brand-gold" /> CARTERA DE CRÉDITOS ACTIVOS
                </h3>
                <button onClick={() => setView('pos')} className="text-white/40 hover:text-white transition-colors"><X className="w-6 h-6"/></button>
              </div>
              <div className="table-wrap flex-1 overflow-y-auto">
                <table className="w-full">
                  <thead><tr className="bg-surface-soft"><th className="px-6 py-4"></th><th className="text-black font-black text-[10px] uppercase">Cliente / Empresa</th><th className="text-black font-black text-[10px] uppercase text-right">Facturas</th><th className="text-black font-black text-[10px] uppercase text-right">Saldo USD</th><th className="text-black font-black text-[10px] uppercase text-right">Saldo BS</th><th className="text-black font-black text-[10px] uppercase text-center">Auditoría</th></tr></thead>
                  <tbody>
                    {Object.entries(groupedCredits).map(([clientName, group]) => (
                      <React.Fragment key={clientName}>
                        <tr className="border-b border-line hover:bg-surface-warm/20 transition-all">
                          <td className="px-6 py-5"><button onClick={() => setExpandedClient(expandedClient === clientName ? null : clientName)} className="text-brand-gold hover:scale-125 transition-transform">{expandedClient === clientName ? <ChevronUp /> : <ChevronDown />}</button></td>
                          <td className="py-5"><div className="text-black font-black text-sm uppercase">{clientName}</div></td>
                          <td className="text-right py-5 font-black text-black">{group.debts.length}</td>
                          <td className="text-right py-5 font-black text-status-info text-lg">{Utils.fmtUSD(group.totalUSD)}</td>
                          <td className="text-right py-5 font-black text-black opacity-50">{Utils.fmtBS(group.totalUSD * state.tasa)}</td>
                          <td className="text-center py-5">
                             <div className="flex items-center justify-center gap-3">
                               <button onClick={() => setShowClientHistory(clientName)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-status-success border-2 border-status-success/20 shadow-md hover:scale-110 transition-all"><Eye className="w-6 h-6" /></button>
                               <button onClick={() => { setShowAbonoModal(clientName); setAbonoPagos([]); }} className="btn btn-primary h-9 px-6 font-black uppercase text-[10px] shadow-lg">ABONAR</button>
                             </div>
                          </td>
                        </tr>
                        {expandedClient === clientName && (
                          <tr className="bg-surface-soft/40"><td colSpan={6} className="px-12 py-6"><div className="card border-line bg-white shadow-inner rounded-[24px] overflow-hidden"><table><thead className="bg-black text-white"><tr><th className="text-[9px] font-black uppercase p-3 text-left">Emisión</th><th className="text-[9px] font-black uppercase p-3 text-left">Factura</th><th className="text-[9px] font-black uppercase p-3 text-right">Saldo USD</th><th className="text-[9px] font-black uppercase p-3 text-center">Ver</th></tr></thead><tbody>{group.debts.map(d => (<tr key={d.id} className="border-b border-line/20"><td>{Utils.fmtFecha(d.fecha)}</td><td className="mono font-black">{d.id}</td><td className="text-right font-black text-brand-gold-deep">{Utils.fmtUSD(d.saldoUSD)}</td><td className="text-center"><button onClick={() => setShowDetailsModal(d)}><Eye className="w-4 h-4 text-black"/></button></td></tr>))}</tbody></table></div></td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
               {/* VISTA DE DEVOLUCIONES INTEGRADA */}
               <div className="card flex-1 bg-white border-none shadow-2xl rounded-[32px] overflow-hidden flex flex-col">
                  <div className="card-head px-8 py-5 bg-black border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-3 text-sm">
                      <RotateCcw className="w-6 h-6 text-status-danger" /> MÓDULO DE REINTEGROS
                    </h3>
                    <button onClick={() => setView('pos')} className="text-white/40 hover:text-white transition-colors"><X className="w-6 h-6"/></button>
                  </div>
                  <div className="p-10 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="p-8 bg-surface-soft rounded-full text-black/10"><RotateCcw className="w-24 h-24" /></div>
                    <div className="max-w-md space-y-2">
                       <h4 className="text-xl font-black uppercase text-black">Control de Devoluciones</h4>
                       <p className="text-xs font-bold text-black uppercase opacity-40 leading-relaxed">Seleccione "Historial" o "Nueva Devolución" desde el menú lateral para gestionar notas de crédito y reversos de inventario.</p>
                    </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>

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
                   <button key={m.id} onClick={() => setMetodoActual(m.id as any)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 font-black text-[10px] uppercase ${metodoActual === m.id ? 'bg-brand-gold border-brand-gold text-black shadow-lg shadow-brand-gold/20' : 'bg-surface-soft border-line text-black/40 hover:border-black/20'}`}>
                     <m.icon className="w-6 h-6" /> {m.label}
                   </button>
                 ))}
               </div>
               <div className="form-group space-y-2">
                 <label className="text-black text-[11px] font-black uppercase tracking-widest block text-center">MONTO A RECIBIR ({metodoActual.includes('usd') || metodoActual === 'zelle' ? 'USD' : 'BS'})</label>
                 <input className="form-input h-16 text-4xl font-black text-center text-black bg-surface-soft border-line rounded-2xl" value={montoInput} onChange={e => setMontoInput(e.target.value.replace(/[^0-9.]/g, ''))} autoFocus onKeyDown={e => e.key === 'Enter' && addPago()} />
               </div>
               <button onClick={() => addPago()} className="btn btn-primary w-full h-16 font-black uppercase text-sm shadow-xl rounded-2xl">Confirmar Método</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUDITORIA Y/Z */}
      <Dialog open={!!showReport} onOpenChange={() => setShowReport(null)}>
        <DialogContent className="sm:max-w-md p-0 bg-transparent border-none overflow-visible shadow-none no-print">
          <div className="max-h-[85vh] overflow-y-auto scrollbar-hide pr-1">
            <div className="bg-white text-black p-10 font-mono text-[11px] leading-tight rounded-sm shadow-2xl relative border border-gray-200">
              <button className="absolute -top-4 -right-4 bg-brand-gold text-black rounded-full p-2 shadow-lg no-print" onClick={() => setShowReport(null)}><X className="w-4 h-4" /></button>
              <div className="text-center space-y-1 mb-8">
                <p className="font-black text-[22px] tracking-[0.3em] mb-1">POSVEN PRO</p>
                <p className="text-[10px] font-black uppercase border-y border-black py-3 my-4">CORTE DE CAJA {showReport} - {showReport === 'Z' ? 'CIERRE FINAL' : 'PRE-CORTE'}</p>
              </div>
              <div className="grid grid-cols-2 gap-y-2 mb-8 text-[12px]">
                <div className="flex justify-between pr-4"><span>FECHA:</span><span className="font-black">{Utils.fmtFecha(Utils.hoy())}</span></div>
                <div className="flex justify-between pl-4"><span>HORA:</span><span className="font-black">{Utils.ahora().split('T')[1].slice(0, 8)}</span></div>
                <div className="flex justify-between pr-4"><span>TERMINAL:</span><span className="font-black">{getCurrentTerminal()?.nombre || 'S/T'}</span></div>
                <div className="flex justify-between pl-4"><span>NUMERO:</span><span className="font-black">{showReport}-{showReport === 'Z' ? String(state.ultimoZ).padStart(4, '0') : 'TEMP'}</span></div>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between font-black text-base border-b-2 border-black pb-1"><span>VENTAS NETAS</span><span>{Utils.fmtUSD(summary.totalVentasNetasUSD)}</span></div>
                <div className="space-y-1 pt-2">
                  {Object.entries(rBreakdown).map(([m, val]: any) => (
                    <div key={m} className="flex justify-between uppercase"><span>{Utils.metodoLabel(m)}</span><span className="font-black">{Utils.fmtUSD(val.usd)}</span></div>
                  ))}
                </div>
              </div>

              <div className="pt-10 text-center italic opacity-50"><p>FIN DEL DOCUMENTO</p></div>
            </div>
          </div>
          <div className="flex gap-2 mt-4 no-print">
            <button onClick={() => handlePrintRoccia(showReport!)} className="flex-1 bg-black text-white h-14 rounded-2xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3"><Printer className="w-5 h-5 text-brand-gold" /> Imprimir Recibo USB</button>
          </div>
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

  function handlePrintRoccia(reportType: 'Y' | 'Z') {
    if (!window.electronAPI) { window.print(); return; }
    const { totalVentasBrutasUSD, totalVentasNetasUSD, totalDevolucionesUSD, breakdown } = getReportSummary();
    const printData = { 
      id: reportType === 'Z' ? String(state.ultimoZ).padStart(4, '0') : 'Y-REPORT', 
      reportTitle: reportType === 'Z' ? 'CORTE DE CAJA Z - FINAL' : 'CORTE DE CAJA Y - PARCIAL', 
      date: Utils.ahora().replace('T', ' ').slice(0, 19), 
      empresa: state.empresa, 
      totals: [
        { label: 'VENTAS BRUTAS', value: Utils.fmtUSD(totalVentasBrutasUSD) }, 
        { label: '(-) DEVOLUCIONES', value: `-${Utils.fmtUSD(totalDevolucionesUSD)}` }, 
        { label: 'VENTAS NETAS', value: Utils.fmtUSD(totalVentasNetasUSD) }
      ], 
      breakdown: Object.entries(breakdown).map(([m, val]: any) => ({ label: Utils.metodoLabel(m), value: Utils.fmtUSD(val.usd) })) 
    };
    window.electronAPI.printTicket(printData);
  }

  function procesarAbonoCascada() {
    if (abonoPagos.length === 0 || !showAbonoModal) return;
    const terminal = getCurrentTerminal();
    const terminalCounter = terminal?.proximoRecibo || 1;
    const correlativoStr = String(terminalCounter).padStart(9, '0');
    const reciboId = terminal ? `${terminal.id}-${correlativoStr}` : correlativoStr;
    const ahoraStr = Utils.ahora();
    const totalAbonoUSD = abonoPagos.reduce((s, p) => s + p.montoUSD, 0);
    let restante = totalAbonoUSD;
    const nuevasDeudas = [...state.cxc].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const actualizadas: Debt[] = nuevasDeudas.map(d => {
      if (d.cliente === showAbonoModal && d.estado !== 'pagada' && restante > 0) {
        const abonoAplicado = Math.min(restante, d.saldoUSD);
        restante -= abonoAplicado;
        const historialPagos = d.historialPagos || [];
        historialPagos.push({ fecha: ahoraStr, montoUSD: abonoAplicado, montoBS: abonoAplicado * state.tasa, reciboId, metodo: abonoPagos.length > 1 ? 'mixto' : abonoPagos[0].metodo });
        const nuevoSaldo = d.saldoUSD - abonoAplicado;
        return { ...d, abonadoUSD: (d.abonadoUSD || 0) + abonoAplicado, saldoUSD: nuevoSaldo, estado: nuevoSaldo <= 0.01 ? 'pagada' : 'parcial', historialPagos };
      }
      return d;
    });
    const registroAbono: Sale = { id: reciboId, fecha: ahoraStr, cliente: showAbonoModal, items: [{ productoId: 'ABONO', nombre: 'ABONO A CUENTA', precioUnitUSD: totalAbonoUSD, cantidad: 1, subtotalUSD: totalAbonoUSD }], subtotalUSD: totalAbonoUSD, descuentoUSD: 0, totalUSD: totalAbonoUSD, totalBS: totalAbonoUSD * state.tasa, metodoPago: abonoPagos.length > 1 ? 'mixto' : abonoPagos[0].metodo, estado: 'completada', type: 'COBRO DEUDA', received: totalAbonoUSD, change: 0, payments: [...abonoPagos], terminalId: terminal?.id, cajeroId: auth?.currentUser?.uid };
    const nuevasEntradasDiario: LibroDiarioEntry[] = abonoPagos.map(p => ({ id: 'ACC-' + Store.uid().toUpperCase().slice(0, 5), fecha: ahoraStr, tipo: 'ingreso', categoria: 'COBRO_DEUDA', concepto: `COBRO DEUDA - CLIENTE: ${showAbonoModal.toUpperCase()}`, montoUSD: p.montoUSD, montoBS: p.montoBS, metodo: p.metodo, referencia: reciboId }));
    updateState({ cxc: actualizadas, ventas: [...state.ventas, registroAbono], terminales: state.terminales.map(t => t.id === terminal?.id ? { ...t, proximoRecibo: terminalCounter + 1 } : t), libroDiario: [...nuevasEntradasDiario, ...(state.libroDiario || [])], clientes: (state.clientes || []).map(c => c.name === showAbonoModal ? { ...c, debt: Math.max(0, (c.debt || 0) - totalAbonoUSD) } : c) });
    setLastProcessedSale(registroAbono); setShowReceiptModal(true); setShowAbonoModal(null); setAbonoPagos([]);
  }

  function buscarVentaParaDevolucion() {
    const sale = state.ventas.find(v => v.id === returnSaleSearch || v.id.endsWith(returnSaleSearch));
    if (!sale) return alert('Venta no encontrada');
    setSelectedSaleForReturn(sale); setReturnItems([]);
  }

  function handleAddReturnItem(productoId: string, nombre: string, precioUnitUSD: number, maxQty: number) {
    const alreadyReturned = (state.devoluciones || []).filter(d => d.ventaId === selectedSaleForReturn?.id).flatMap(d => d.items).filter(i => i.productoId === productoId).reduce((sum, i) => sum + i.cantidad, 0);
    const available = maxQty - alreadyReturned;
    if (available <= 0) return alert('Ya devuelto');
    const qty = parseInt(prompt(`Cantidad (Máx: ${available}):`, '1') || '0');
    if (isNaN(qty) || qty <= 0 || qty > available) return;
    const cond = confirm('¿Reintegrar al stock?') ? 'REINTEGRADO_STOCK' : 'MERMA_DANADO';
    setReturnItems([...returnItems, { productoId, nombre, cantidad: qty, precioUnitUSD, estadoProducto: cond as any }]);
  }

  function procesarDevolucionPOS() {
    if (!selectedSaleForReturn || returnItems.length === 0 || !returnReason.trim()) return;
    if (prompt('PIN de autorización:') !== state.pinDevolucion) return alert('PIN incorrecto');
    const totalDev = returnItems.reduce((s, i) => s + (i.cantidad * i.precioUnitUSD), 0);
    const idDev = 'DEV-' + String(state.proximaDevolucion).padStart(6, '0');
    const ahoraStr = Utils.ahora();
    const nuevosProds = [...state.productos];
    returnItems.forEach(it => { const p = nuevosProds.find(p => p.id === it.productoId); if (p) { if (it.estadoProducto === 'REINTEGRADO_STOCK') p.stock += it.cantidad; } });
    const entradaDevolucion: LibroDiarioEntry = { id: 'ACC-' + Store.uid().toUpperCase().slice(0, 5), fecha: ahoraStr, tipo: 'egreso', categoria: 'DEVOLUCION', concepto: `DEVOLUCION #${idDev} - REF VENTA: ${selectedSaleForReturn.id}`, montoUSD: totalDev, montoBS: totalDev * state.tasa, metodo: refundMethod === 'EFECTIVO' ? 'efectivo_usd' : (refundMethod === 'CREDITO_TIENDA' ? 'nota_credito' : 'otros'), referencia: idDev };
    updateState({ productos: nuevosProds, devoluciones: [{ id: idDev, ventaId: selectedSaleForReturn.id, fecha: ahoraStr, items: [...returnItems], totalUSD: totalDev, metodoReembolso: refundMethod, motivo: returnReason }, ...(state.devoluciones || [])], libroDiario: [entradaDevolucion, ...(state.libroDiario || [])], proximaDevolucion: state.proximaDevolucion + 1 });
    alert('Procesada'); setReturnView('list'); setSelectedSaleForReturn(null);
  }
}
