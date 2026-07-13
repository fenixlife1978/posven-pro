
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppState, SaleItem, Sale, PaymentMethod, ReportZ, PagoRealizado, Customer, Return, ReturnItem, Product, Debt, Movimiento, LibroDiarioEntry } from '@/lib/types';
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
  Contact
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import FloatingPaymentModal from '@/components/pos/FloatingPaymentModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  const [cliente, setCliente] = useState('Consumidor final');
  
  const [pagos, setPagos] = useState<PagoRealizado[]>([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  
  const [showAbonoModal, setShowAbonoModal] = useState<string | null>(null);
  const [abonoPagos, setAbonoPagos] = useState<PagoRealizado[]>([]);
  
  const [showDetailsModal, setShowDetailsModal] = useState<any | null>(null);
  const [lastProcessedSale, setLastProcessedSale] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedProductDisplay, setSelectedProductDisplay] = useState<Product | null>(null);

  const [isCreditView, setIsCreditView] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', cedula: 'V-', phone: '', address: '' });

  // Estados de Devolución
  const [returnView, setReturnView] = useState<'list' | 'create'>('list');
  const [returnSaleSearch, setReturnSaleSearch] = useState('');
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'EFECTIVO' | 'MISMO_METODO' | 'CREDITO_TIENDA'>('EFECTIVO');
  const [returnReason, setReturnReason] = useState('');

  // Estados de Créditos Avanzados
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [showClientHistory, setShowClientHistory] = useState<string | null>(null);

  const [editandoTasa, setEditandoTasa] = useState(false);
  const [nuevaTasa, setNuevaTasa] = useState(state.tasa.toString());

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Lógica de agrupación de deudas
  const groupedCredits = useMemo(() => {
    const groups: Record<string, { totalUSD: number; debts: Debt[] }> = {};
    state.cxc.filter(x => x.estado !== 'pagada').forEach(debt => {
      const name = debt.cliente || 'DESCONOCIDO';
      if (!groups[name]) {
        groups[name] = { totalUSD: 0, debts: [] };
      }
      groups[name].totalUSD += debt.saldoUSD;
      groups[name].debts.push(debt);
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
    setSelectedProductDisplay(p);
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
    if (p) setSelectedProductDisplay(p);
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

  const matches = search.trim().length > 0 
    ? state.productos
        .filter(p => p.activo && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())))
        .slice(0, 8)
    : [];

  const filteredClients = clientSearch.trim().length > 0
    ? (state.clientes || []).filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.cedula.includes(clientSearch))
    : [];

  const getCurrentTerminal = () => {
    if (!auth || !auth.currentUser) return null;
    return state.terminales.find(t => t.usuarioId === auth.currentUser!.uid);
  };

  const guardarNuevaTasa = () => {
    const n = parseFloat(nuevaTasa);
    if (isNaN(n) || n <= 0) return alert('Tasa inválida');
    updateState({ tasa: n });
    setEditandoTasa(false);
  };

  const buscarVentaParaDevolucion = () => {
    const sale = state.ventas.find(v => v.id === returnSaleSearch || v.id.endsWith(returnSaleSearch));
    if (!sale) return alert('Venta no encontrada');
    setSelectedSaleForReturn(sale);
    setReturnItems([]);
  };

  const handleAddReturnItem = (productoId: string, nombre: string, precioUnitUSD: number, maxQty: number) => {
    const qtyStr = prompt(`Cantidad a devolver (Máx: ${maxQty}):`, '1');
    if (qtyStr === null) return;
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0 || qty > maxQty) return alert('Cantidad no válida');
    setReturnItems([...returnItems, {
      productoId,
      nombre,
      cantidad: qty,
      precioUnitUSD,
      estadoProducto: 'REINTEGRADO_STOCK'
    }]);
  };

  const procesarDevolucionPOS = () => {
    if (!selectedSaleForReturn || returnItems.length === 0) return;
    if (!returnReason.trim()) return alert('Indique motivo');
    const totalDevuelto = returnItems.reduce((s, i) => s + (i.cantidad * i.precioUnitUSD), 0);
    const idDev = 'DEV-' + String(state.proximaDevolucion).padStart(6, '0');
    const ahoraStr = Utils.ahora();
    const nuevaDevolucion: Return = {
      id: idDev,
      ventaId: selectedSaleForReturn.id,
      fecha: ahoraStr,
      items: [...returnItems],
      totalUSD: totalDevuelto,
      metodoReembolso: refundMethod,
      motivo: returnReason
    };
    updateState({
      devoluciones: [nuevaDevolucion, ...state.devoluciones],
      proximaDevolucion: state.proximaDevolucion + 1
    });
    alert(`Devolución ${idDev} procesada`);
    setReturnView('list');
    setSelectedSaleForReturn(null);
    setReturnItems([]);
  };

  const ejecutarVenta = (pagosFinales?: PagoRealizado[]) => {
    const listadoPagos = pagosFinales || pagos;
    const totalPagadoRecibido = listadoPagos.reduce((s, p) => s + p.montoUSD, 0);

    if (state.carrito.length === 0) return;

    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahoraStr = Utils.ahora();
    const terminal = getCurrentTerminal();
    
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
            const qty = item.cantidad * ki.cantidad;
            const stockAntes = cp.stock;
            cp.stock -= qty;
            nuevosMovimientos.push({ id: Store.uid(), productoId: cp.id, tipo: 'venta', cantidad: -qty, stockAntes, stockDespues: cp.stock, fecha: ahoraStr, referencia: `KIT: ${p.nombre} - VENTA ${reciboId}` });
            prodsActualizados[cpIdx] = cp;
          }
        });
      } else {
        const stockAntes = p.stock;
        p.stock -= item.cantidad;
        nuevosMovimientos.push({ id: Store.uid(), productoId: p.id, tipo: 'venta', cantidad: -item.cantidad, stockAntes, stockDespues: p.stock, fecha: ahoraStr, referencia: `VENTA ${reciboId}` });
        prodsActualizados[pIdx] = p;
      }
    });

    const nuevaVenta: Sale = { 
      id: reciboId, 
      fecha: ahoraStr, 
      cliente, 
      items: [...state.carrito], 
      subtotalUSD, 
      descuentoUSD: 0, 
      totalUSD: subtotalUSD, 
      totalBS, 
      metodoPago: listadoPagos.length > 1 ? 'mixto' : (listadoPagos[0]?.metodo || 'efectivo_usd'), 
      estado: 'completada', 
      type: 'VENTA', 
      received: totalPagadoRecibido, 
      change: Math.max(0, totalPagadoRecibido - subtotalUSD), 
      payments: [...listadoPagos], 
      terminalId: terminal?.id, 
      cajeroId: auth?.currentUser?.uid 
    };

    const nuevasEntradasDiario: LibroDiarioEntry[] = listadoPagos.map(p => ({ 
      id: 'ACC-' + Store.uid().toUpperCase().slice(0, 5), 
      fecha: ahoraStr, 
      tipo: 'ingreso', 
      categoria: 'VENTA', 
      concepto: `VENTA #${reciboId} - CLIENTE: ${cliente.toUpperCase()}`, 
      montoUSD: p.montoUSD, 
      montoBS: p.montoBS, 
      metodo: p.metodo, 
      referencia: reciboId 
    }));

    updateState({ 
      productos: prodsActualizados, 
      ventas: [...state.ventas, nuevaVenta], 
      movimientos: [...state.movimientos, ...nuevosMovimientos], 
      libroDiario: [...nuevasEntradasDiario, ...(state.libroDiario || [])], 
      carrito: [], 
      proximoRecibo: state.proximoRecibo + 1, 
      acumuladoHistorico: state.acumuladoHistorico + subtotalUSD 
    });

    setLastProcessedSale(nuevaVenta);
    setShowReceiptModal(true);
    setPagos([]);
    setCliente('Consumidor final');
    setSelectedProductDisplay(null);
  };

  const ejecutarVentaACredito = () => {
    if (state.carrito.length === 0) return;
    let targetClient: Customer | null = selectedClient;
    if (showNewClientForm) {
      if (!newClient.name || !newClient.cedula) return alert("Datos incompletos.");
      targetClient = { id: Store.uid(), name: newClient.name.toUpperCase(), cedula: newClient.cedula.toUpperCase(), phone: newClient.phone, address: newClient.address, debt: 0 };
    }
    if (!targetClient) return alert("Seleccione un cliente.");
    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahoraStr = Utils.ahora();
    const terminal = getCurrentTerminal();
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
            const qty = item.cantidad * ki.cantidad;
            const stockAntes = cp.stock;
            cp.stock -= qty;
            nuevosMovimientos.push({ id: Store.uid(), productoId: cp.id, tipo: 'venta', cantidad: -qty, stockAntes, stockDespues: cp.stock, fecha: ahoraStr, referencia: `KIT: ${p.nombre} - CRÉDITO ${reciboId}` });
            prodsActualizados[cpIdx] = cp;
          }
        });
      } else {
        const stockAntes = p.stock;
        p.stock -= item.cantidad;
        nuevosMovimientos.push({ id: Store.uid(), productoId: item.productoId, tipo: 'venta', cantidad: -item.cantidad, stockAntes, stockDespues: p.stock, fecha: ahoraStr, referencia: `CRÉDITO ${reciboId}` });
        prodsActualizados[pIdx] = p;
      }
    });
    const nuevaVenta: Sale = { id: reciboId, fecha: ahoraStr, cliente: targetClient.name, items: [...state.carrito], subtotalUSD, descuentoUSD: 0, totalUSD: subtotalUSD, totalBS, metodoPago: 'credito', estado: 'completada', type: 'VENTA CRÉDITO', received: 0, change: 0, terminalId: terminal?.id, cajeroId: auth?.currentUser?.uid };
    const nuevaDeuda: Debt = { id: 'CRD-' + reciboId.slice(-6), fecha: ahoraStr.slice(0, 10), fechaVencimiento: '2099-12-31', cliente: targetClient.name, montoUSD: subtotalUSD, abonadoUSD: 0, saldoUSD: subtotalUSD, estado: 'pendiente', historialPagos: [], ventaId: reciboId };
    const asientoCredito: LibroDiarioEntry = { id: 'ACC-' + Store.uid().toUpperCase().slice(0, 5), fecha: ahoraStr, tipo: 'ingreso', categoria: 'VENTA_CREDITO', concepto: `CRÉDITO #${reciboId} - CLIENTE: ${targetClient.name}`, montoUSD: subtotalUSD, montoBS: totalBS, metodo: 'credito', referencia: reciboId };
    let nuevosClientes = showNewClientForm ? [...(state.clientes || []), { ...targetClient, debt: subtotalUSD }] : (state.clientes || []).map(c => c.id === targetClient!.id ? { ...c, debt: (c.debt || 0) + subtotalUSD } : c);
    updateState({ productos: prodsActualizados, ventas: [...state.ventas, nuevaVenta], movimientos: [...state.movimientos, ...nuevosMovimientos], cxc: [...state.cxc, nuevaDeuda], clientes: nuevosClientes, libroDiario: [asientoCredito, ...(state.libroDiario || [])], carrito: [], proximoRecibo: state.proximoRecibo + 1 });
    setLastProcessedSale(nuevaVenta);
    setShowReceiptModal(true);
    setIsCreditView(false);
    setSelectedClient(null);
  };

  const summary = useMemo(() => {
    const hoy = Utils.hoy();
    const vHoy = state.ventas.filter(v => v.fecha.startsWith(hoy));
    const dHoy = (state.devoluciones || []).filter(d => d.fecha.startsWith(hoy));
    const brUSD = vHoy.reduce((s, v) => s + v.totalUSD, 0);
    const devUSD = dHoy.reduce((s, d) => s + d.totalUSD, 0);
    const descUSD = vHoy.reduce((s, v) => s + (v.descuentoUSD || 0), 0);
    const netUSD = brUSD - devUSD - descUSD;
    const b: Record<string, { usd: number, bs: number }> = {};
    vHoy.forEach(v => {
      const ps = v.payments && v.payments.length > 0 ? v.payments : [{ metodo: v.metodoPago as PaymentMethod, montoUSD: v.totalUSD, montoBS: v.totalBS }];
      ps.forEach(p => {
        if (!b[p.metodo]) b[p.metodo] = { usd: 0, bs: 0 };
        b[p.metodo].usd += p.montoUSD; b[p.metodo].bs += p.montoBS;
      });
    });
    const hS: Record<string, number> = {};
    vHoy.forEach(v => {
      const h = v.fecha.split('T')[1]?.slice(0, 2) + ':00';
      if (h) hS[h] = (hS[h] || 0) + v.totalUSD;
    });
    return { brUSD, devUSD, descUSD, netUSD, breakdown: b, hourly: hS, ventasHoy: vHoy, devolucionesHoy: dHoy };
  }, [state.ventas, state.devoluciones, state.tasa]);

  return (
    <div className="flex flex-col gap-2 h-[calc(100vh-100px)] max-w-7xl mx-auto w-full overflow-hidden">
      <div className="flex gap-2 no-print shrink-0 overflow-x-auto pb-1">
        <button onClick={() => setView('pos')} className={`btn btn-sm ${view === 'pos' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><ShoppingCart className="w-3.5 h-3.5"/> Punto de Venta</button>
        <button onClick={() => setView('history')} className={`btn btn-sm ${view === 'history' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><History className="w-3.5 h-3.5"/> Historial</button>
        <button onClick={() => setView('credits')} className={`btn btn-sm ${view === 'credits' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><ClipboardList className="w-3.5 h-3.5"/> Consultar Créditos</button>
        <button onClick={() => setShowReport('Y')} className="btn btn-sm bg-white text-ink font-bold border-line border"><FileText className="w-3.5 h-3.5"/> Reporte Y</button>
        <button onClick={() => setShowReport('Z')} className="btn btn-sm bg-white text-ink font-bold border-line border"><Receipt className="w-3.5 h-3.5"/> Reporte Z</button>
        <button onClick={() => setView('returns')} className={`btn btn-sm ${view === 'returns' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><RotateCcw className="w-3.5 h-3.5"/> Devoluciones</button>
      </div>

      {view === 'pos' ? (
        <div className="flex flex-col gap-2 flex-1 overflow-hidden animate-in fade-in duration-300">
          <div className="relative group shrink-0">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8952e] z-10"><Barcode className="w-5 h-5" /></div>
            <input ref={searchInputRef} className="form-input pl-14 py-2 text-base bg-white border-brand-gold/30 text-ink font-black placeholder-ink/40" placeholder="Escanee o busque producto..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && matches.length >= 1 && agregar(matches[0].id)} autoFocus />
            {matches.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-line rounded-b-lg shadow-2xl z-[100] mt-1 overflow-hidden">
                {matches.map(p => (
                  <div key={p.id} onClick={() => agregar(p.id)} className="flex items-center justify-between p-3 hover:bg-brand-gold/10 cursor-pointer border-b border-line group">
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-ink text-sm font-black uppercase truncate group-hover:text-brand-gold-deep transition-colors">{p.nombre}</span>
                      <span className="text-ink/60 text-[10px] mono font-bold">{p.codigo}</span>
                    </div>

                    <div className="flex items-center gap-10 shrink-0 ml-4">
                       <div className="flex flex-col items-end min-w-[70px]">
                          <span className="text-[9px] font-black uppercase text-ink/40 mb-0.5">Stock</span>
                          <span className={`text-lg font-black leading-none ${
                            p.stock <= (p.stockMinimo || 3) ? 'text-red-600' : 
                            p.stock <= (p.stockMinimo || 3) * 2 ? 'text-amber-500' : 
                            'text-green-600'
                          }`}>
                            {p.stock} <span className="text-[10px] opacity-60">Und.</span>
                          </span>
                       </div>
                       <div className="flex flex-col items-end min-w-[90px]">
                          <span className="text-[9px] font-black uppercase text-ink/40 mb-0.5">Precio USD</span>
                          <span className="text-lg font-black leading-none text-ink">{Utils.fmtUSD(p.precioUSD)}</span>
                       </div>
                       <div className="flex flex-col items-end min-w-[110px]">
                          <span className="text-[9px] font-black uppercase text-ink/40 mb-0.5">Equiv. BS</span>
                          <span className="text-lg font-black leading-none text-brand-gold-deep">{Utils.fmtBS(p.precioUSD * state.tasa)}</span>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-1 gap-3 overflow-hidden">
            <div className="w-1/3 flex flex-col gap-2">
              <div className="card p-3 space-y-3 bg-white border-line h-full flex flex-col">
                <div className="form-group mb-0">
                  <label className="text-ink text-[10px] font-black uppercase block mb-1">IDENTIFICACIÓN CLIENTE</label>
                  <input className="form-input h-8 text-xs bg-surface-soft text-ink border-line font-black uppercase" value={cliente} onChange={e => setCliente(e.target.value)} />
                </div>
                <div className="bg-brand-gold-soft/30 border border-brand-gold-soft/30 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-ink text-[9px] font-black uppercase tracking-wider">TASA BCV</label>
                    <div className="flex items-center gap-1">
                      {!editandoTasa ? (
                        <><span className="text-ink font-black text-sm">{state.tasa.toFixed(2)}</span><button onClick={() => { setEditandoTasa(true); setNuevaTasa(state.tasa.toString()); }} className="text-ink hover:text-brand-gold p-0.5"><RefreshCw className="w-3.5 h-3.5" /></button></>
                      ) : (
                        <><input type="text" value={nuevaTasa} onChange={e => setNuevaTasa(e.target.value.replace(/[^0-9.]/g, ''))} className="w-16 bg-white border border-brand-gold rounded px-1 py-0.5 text-ink font-black text-sm text-right" autoFocus /><button onClick={guardarNuevaTasa} className="text-green-600 p-0.5"><Check className="w-3.5 h-3.5" /></button><button onClick={() => setEditandoTasa(false)} className="text-red-500 p-0.5"><X className="w-3.5 h-3.5" /></button></>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pt-2 border-t border-line/10">
                  {selectedProductDisplay && (
                    <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                       <div className="p-3 bg-surface-soft border border-line rounded-xl text-center">
                          <span className="text-[9px] font-black uppercase text-ink opacity-40 block mb-1">STOCK DISPONIBLE</span>
                          <span className={`text-2xl font-black ${
                             selectedProductDisplay.stock <= (selectedProductDisplay.stockMinimo || 3) ? 'text-status-danger' : 
                             selectedProductDisplay.stock <= (selectedProductDisplay.stockMinimo || 3) * 2 ? 'text-status-warn' : 
                             'text-status-success'
                          }`}>
                            {selectedProductDisplay.stock} <span className="text-xs">UND</span>
                          </span>
                       </div>
                       <div className="p-3 bg-surface-soft border border-line rounded-xl text-center">
                          <span className="text-[9px] font-black uppercase text-ink opacity-40 block mb-1">PRECIO UNITARIO USD</span>
                          <span className="text-2xl font-black text-ink">{Utils.fmtUSD(selectedProductDisplay.precioUSD)}</span>
                       </div>
                       <div className="p-3 bg-brand-gold-soft/30 border border-brand-gold-soft/30 rounded-xl text-center">
                          <span className="text-[9px] font-black uppercase text-brand-gold-deep block mb-1">EQUIVALENTE EN BOLÍVARES</span>
                          <span className="text-2xl font-black text-brand-gold-deep">{Utils.fmtBS(selectedProductDisplay.precioUSD * state.tasa)}</span>
                       </div>
                    </div>
                  )}
                  {state.carrito.length > 0 && (
                    <button onClick={() => setIsCreditView(true)} className="w-full h-10 border-2 border-status-info text-status-info hover:bg-status-info-soft font-black uppercase text-[10px] rounded-xl transition-all mt-4">Cargar a Crédito</button>
                  )}
                </div>
              </div>
            </div>

            <div className="w-2/3 flex flex-col gap-2 overflow-hidden">
              <div className="card flex-1 flex flex-col overflow-hidden bg-white border-none shadow-xl">
                <div className="grid grid-cols-[1fr_80px_60px_70px_80px_80px_40px] gap-2 px-3 py-3 bg-ink text-white text-[9px] font-black uppercase tracking-[0.15em] rounded-t-lg">
                  <div>Descripción</div><div className="text-center">Cant</div><div className="text-center">U.M.</div><div className="text-right">Precio ($)</div><div className="text-right">Precio (Bs)</div><div className="text-right">Total</div><div className="text-center"></div>
                </div>
                <div className="flex-1 overflow-y-auto p-1 space-y-1">
                  {state.carrito.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_60px_70px_80px_80px_40px] gap-2 items-center px-3 py-3 bg-white border-b border-black/5 text-ink">
                      <div className="truncate font-black text-[10px] uppercase leading-tight">{item.nombre}</div>
                      <div className="flex items-center justify-center gap-1 bg-surface-soft rounded p-0.5 border border-line/30">
                        <button onClick={() => updateQty(i, -1)} className="text-ink font-black text-xs px-1">-</button>
                        <span className="w-5 text-center text-[10px] font-black">{item.cantidad}</span>
                        <button onClick={() => updateQty(i, 1)} className="text-ink font-black text-xs px-1">+</button>
                      </div>
                      <div className="text-center text-[9px] font-black uppercase">{state.productos.find(p => p.id === item.productoId)?.cantidad || '-'}</div>
                      <div className="text-right text-[10px] font-black">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                      <div className="text-right text-[10px] font-black">{Utils.fmtBS(item.precioUnitUSD * state.tasa)}</div>
                      <div className="text-right text-[11px] font-black">{Utils.fmtUSD(item.subtotalUSD)}</div>
                      <div className="flex justify-center"><button onClick={() => updateQty(i, -item.cantidad)} className="text-ink/20 hover:text-red-600"><Trash2 className="w-3.5 h-3.5"/></button></div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-ink border-t border-line/10 flex items-center justify-between rounded-b-lg">
                  <div className="space-y-0">
                    <label className="text-white/60 text-[8px] font-black uppercase block tracking-widest mb-1">TOTAL FACTURA</label>
                    <div className="flex items-baseline gap-3"><div className="text-4xl font-black text-brand-gold">{Utils.fmtUSD(subtotalUSD)}</div><div className="text-base font-black text-white">{Utils.fmtBS(totalBS)}</div></div>
                  </div>
                  <button 
                    onClick={() => saldoRestanteUSD <= 0.01 && state.carrito.length > 0 ? ejecutarVenta() : setShowMultiModal(true)} 
                    disabled={state.carrito.length === 0}
                    className="w-14 h-14 bg-[#c8952e] text-black rounded-full shadow-lg flex items-center justify-center hover:bg-[#d9a540] transition-all transform hover:scale-105 active:scale-95 disabled:opacity-20"
                  >
                    {saldoRestanteUSD <= 0.01 && state.carrito.length > 0 ? <Check className="w-8 h-8" /> : <Wallet className="w-8 h-8" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : view === 'history' ? (
        <div className="card flex-1 bg-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300 rounded-xl">
          <div className="card-head px-6 py-4 bg-ink border-b border-white/10 flex justify-between items-center"><h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2 text-xs"><History className="w-5 h-5 text-brand-gold" /> HISTORIAL TRANSACCIONES</h3><button onClick={() => setView('pos')} className="btn btn-sm bg-white text-ink hover:bg-surface-soft flex items-center gap-2 font-black uppercase text-[10px] rounded-lg border-none px-4"><ArrowLeft className="w-3.5 h-3.5"/> Volver al POS</button></div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table>
              <thead><tr><th>Recibo</th><th>Hora</th><th>Terminal</th><th>Cliente</th><th>Tipo</th><th className="text-right">Monto USD</th><th>Método</th><th className="text-center">Estado</th></tr></thead>
              <tbody>
                {summary.ventasHoy.sort((a,b) => b.fecha.localeCompare(a.fecha)).map(v => (
                  <tr key={v.id} className="border-b border-line/40 hover:bg-surface-warm/20"><td className="text-ink font-black text-xs mono">{v.id}</td><td className="text-ink font-bold text-xs">{v.fecha.split('T')[1]?.slice(0, 5)}</td><td className="text-ink font-black text-[10px] uppercase">{state.terminales.find(t => t.id === v.terminalId)?.nombre || '-'}</td><td className="text-ink font-black text-xs uppercase truncate max-w-[150px]">{v.cliente}</td><td className="text-ink font-black text-[9px] uppercase"><span className={`badge ${v.type === 'COBRO DEUDA' ? 'badge-info' : 'badge-neutral'}`}>{v.type || 'VENTA'}</span></td><td className="text-brand-gold-deep font-black text-xs text-right">{Utils.fmtUSD(v.totalUSD)}</td><td className="text-ink font-bold text-[10px] uppercase">{Utils.metodoLabel(v.metodoPago)}</td><td className="text-center"><span className={`badge ${v.estado === 'pendiente' ? 'badge-warn' : 'badge-ok'} font-black text-[9px] uppercase`}>{v.estado}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === 'credits' ? (
        <div className="card flex-1 bg-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300 rounded-xl">
          <div className="card-head px-6 py-4 bg-ink border-b border-white/10 flex justify-between items-center"><h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2 text-xs"><ClipboardList className="w-5 h-5 text-brand-gold" /> CONSULTA CRÉDITOS Y COBRANZA</h3><button onClick={() => setView('pos')} className="btn btn-sm bg-white text-ink hover:bg-surface-soft flex items-center gap-2 font-black uppercase text-[10px] rounded-lg border-none px-4"><ArrowLeft className="w-3.5 h-3.5"/> Volver al POS</button></div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-soft">
                  <th className="px-6 py-3"></th>
                  <th className="text-ink font-black text-[10px] uppercase">Cliente / Identificación</th>
                  <th className="text-ink font-black text-[10px] uppercase text-right">Documentos</th>
                  <th className="text-ink font-black text-[10px] uppercase text-right">Saldo USD</th>
                  <th className="text-ink font-black text-[10px] uppercase text-right">Saldo BS</th>
                  <th className="text-ink font-black text-[10px] uppercase text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedCredits).length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-20 text-ink font-black uppercase italic">No hay deudas registradas</td></tr>
                ) : (
                  Object.entries(groupedCredits).map(([clientName, group]) => (
                    <React.Fragment key={clientName}>
                      <tr className="border-b border-line hover:bg-surface-warm/20 transition-colors">
                        <td className="px-6 py-4">
                           <button onClick={() => setExpandedClient(expandedClient === clientName ? null : clientName)} className="text-brand-gold hover:scale-110 transition-transform">
                              {expandedClient === clientName ? <ChevronUp /> : <ChevronDown />}
                           </button>
                        </td>
                        <td className="py-4">
                           <div className="text-ink font-black text-sm uppercase">{clientName}</div>
                        </td>
                        <td className="text-right py-4 font-black text-ink">{group.debts.length} Facturas</td>
                        <td className="text-right py-4 font-black text-status-info text-base">{Utils.fmtUSD(group.totalUSD)}</td>
                        <td className="text-right py-4 font-black text-ink">{Utils.fmtBS(group.totalUSD * state.tasa)}</td>
                        <td className="text-center py-4">
                           <button onClick={() => setShowClientHistory(clientName)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-status-success border-2 border-status-success/20 hover:bg-status-success hover:text-white transition-all shadow-md"><Eye className="w-5 h-5" /></button>
                        </td>
                      </tr>
                      {expandedClient === clientName && (
                        <tr className="bg-surface-soft/40 animate-in slide-in-from-top-1 duration-200">
                           <td colSpan={6} className="px-12 py-4">
                              <div className="card border-line bg-white shadow-inner rounded-xl overflow-hidden">
                                 <table className="w-full">
                                    <thead className="bg-ink/5">
                                       <tr>
                                          <th className="text-[9px] font-black uppercase p-2 text-left">Emisión</th>
                                          <th className="text-[9px] font-black uppercase p-2 text-left">Vencimiento</th>
                                          <th className="text-[9px] font-black uppercase p-2 text-right">Saldo USD</th>
                                          <th className="text-[9px] font-black uppercase p-2 text-center">Acciones</th>
                                       </tr>
                                    </thead>
                                    <tbody>
                                       {group.debts.map(d => (
                                          <tr key={d.id} className="border-b border-line/20">
                                             <td className="text-[10px] font-black p-2">{Utils.fmtFecha(d.fecha)}</td>
                                             <td className={`text-[10px] font-black p-2 ${d.fechaVencimiento < Utils.hoy() ? 'text-status-danger' : 'text-ink'}`}>
                                                {d.fechaVencimiento === '2099-12-31' ? 'ABIERTA' : Utils.fmtFecha(d.fechaVencimiento)}
                                             </td>
                                             <td className="text-[10px] font-black p-2 text-right text-brand-gold-deep">{Utils.fmtUSD(d.saldoUSD)}</td>
                                             <td className="p-2 text-center">
                                                <div className="flex justify-center gap-2">
                                                   <button onClick={() => setShowDetailsModal(d)} className="w-8 h-8 rounded-full flex items-center justify-center text-status-success hover:bg-status-success/10"><Eye className="w-4 h-4"/></button>
                                                   <button onClick={() => { setShowAbonoModal(clientName); }} className="btn btn-sm btn-primary h-7 px-3 text-[8px] uppercase">Abonar</button>
                                                </div>
                                             </td>
                                          </tr>
                                       ))}
                                    </tbody>
                                 </table>
                              </div>
                           </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-2 duration-300 flex-1 overflow-y-auto">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-line shadow-sm shrink-0">
            <div><h2 className="text-ink font-black uppercase italic tracking-tighter text-lg flex items-center gap-2"><RotateCcw className="text-status-danger w-5 h-5" /> GESTIÓN DE DEVOLUCIONES</h2></div>
            <div className="flex gap-2"><button onClick={() => setReturnView('list')} className={`btn ${returnView === 'list' ? 'btn-primary' : 'btn-secondary'} h-9 px-6 font-black uppercase text-[10px]`}>Historial</button><button onClick={() => { setReturnView('create'); setSelectedSaleForReturn(null); }} className={`btn ${returnView === 'create' ? 'btn-primary' : 'btn-secondary'} h-9 px-6 font-black uppercase text-[10px]`}>Nueva Devolución</button></div>
          </div>
          {returnView === 'list' ? (
            <div className="card bg-white border-line shadow-lg overflow-hidden flex flex-col rounded-xl flex-1">
              <div className="card-head bg-ink border-b border-white/10 px-6 py-4"><h3 className="text-white font-black text-xs uppercase italic tracking-tighter">DEVOLUCIONES DE HOY</h3></div>
              <div className="table-wrap flex-1 overflow-y-auto">
                <table>
                  <thead><tr><th>ID</th><th>Hora</th><th>Venta</th><th>Items</th><th className="text-right">Total</th><th>Reembolso</th></tr></thead>
                  <tbody>
                    {summary.devolucionesHoy.map(d => (
                      <tr key={d.id} className="border-b border-line/40"><td className="text-status-danger font-black text-xs mono">{d.id}</td><td className="text-ink font-bold text-xs">{d.fecha.split('T')[1].slice(0, 8)}</td><td className="text-ink font-black text-xs mono opacity-60">{d.ventaId}</td><td className="text-ink font-bold text-[10px] uppercase">{d.items.length} productos</td><td className="text-brand-gold-deep font-black text-xs text-right">{Utils.fmtUSD(d.totalUSD)}</td><td><span className="badge badge-neutral font-black text-[9px] uppercase">{d.metodoReembolso}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {!selectedSaleForReturn ? (
                <div className="card p-12 flex-1 flex flex-col items-center justify-center text-center space-y-6 bg-white border-dashed border-2 border-line"><div className="p-5 bg-surface-soft rounded-full"><Search className="w-10 h-10 text-ink/20" /></div><h3 className="text-ink font-black uppercase text-sm">Localizar Venta Original</h3><div className="flex gap-2 w-full sm:max-w-sm"><input className="form-input flex-1 h-11 bg-white border-line text-ink font-black uppercase" placeholder="Ej: 000000024" value={returnSaleSearch} onChange={e => setReturnSaleSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarVentaParaDevolucion()} /><button onClick={buscarVentaParaDevolucion} className="btn btn-primary h-11 px-6 font-black uppercase text-xs">Buscar</button></div></div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-y-auto pr-1">
                  <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="card bg-white border-status-info/30 rounded-xl overflow-hidden shadow-sm"><div className="card-head py-3 px-6 bg-ink border-b border-white/10 flex justify-between"><h3 className="text-white font-black uppercase italic text-[10px]">VENTA: {selectedSaleForReturn.id}</h3><button onClick={() => setSelectedSaleForReturn(null)}><X className="w-4 h-4 text-white"/></button></div><div className="table-wrap"><table><thead><tr className="bg-surface-soft"><th>Producto</th><th className="text-center">Cant</th><th className="text-right">Precio</th><th className="text-center">Acción</th></tr></thead><tbody>{selectedSaleForReturn.items.map((it, idx) => (<tr key={idx} className="border-b border-line/30"><td className="text-ink font-bold text-[11px] uppercase">{it.nombre}</td><td className="text-center text-ink font-black">{it.cantidad}</td><td className="text-right text-ink font-black">{Utils.fmtUSD(it.precioUnitUSD)}</td><td className="text-center"><button onClick={() => handleAddReturnItem(it.productoId, it.nombre, it.precioUnitUSD, it.cantidad)} className="btn btn-sm btn-secondary h-7 px-3 text-[9px] font-black uppercase">Seleccionar</button></td></tr>))}</tbody></table></div></div>
                    <div className="card bg-white border-line shadow-md rounded-xl overflow-hidden"><div className="card-head py-3 px-6 bg-ink border-b border-white/10"><h3 className="text-white font-black uppercase italic text-[10px]">REINTEGRO</h3></div><div className="table-wrap"><table><thead><tr className="bg-surface-soft"><th>Producto</th><th className="text-center">Cant</th><th>Estado</th><th className="text-right">Total</th><th></th></tr></thead><tbody>{returnItems.map((it, idx) => (<tr key={idx} className="border-b border-line/30"><td className="text-ink font-bold text-[11px] uppercase">{it.nombre}</td><td className="text-status-danger font-black text-center">{it.cantidad}</td><td><span className="badge badge-neutral text-[8px] font-black">{it.estadoProducto}</span></td><td className="text-brand-gold-deep font-black text-right">{Utils.fmtUSD(it.cantidad * it.precioUnitUSD)}</td><td className="text-center"><button onClick={() => setReturnItems(returnItems.filter((_,i)=>i!==idx))}><Trash2 className="w-4 h-4 text-ink/20"/></button></td></tr>))}</tbody></table></div></div>
                  </div>
                  <div className="space-y-4">
                    <div className="card bg-white border-line shadow-lg rounded-xl overflow-hidden p-5 space-y-5"><div className="bg-surface-soft p-4 rounded-lg text-center border border-line shadow-inner"><p className="text-ink text-[9px] font-black uppercase mb-1">TOTAL REEMBOLSO</p><p className="text-3xl font-black text-status-danger">{Utils.fmtUSD(returnItems.reduce((s, i) => s + (i.cantidad * i.precioUnitUSD), 0))}</p></div><div className="form-group"><label className="text-[10px] font-black uppercase block mb-1">Método</label><select className="form-select h-10 text-xs font-black uppercase" value={refundMethod} onChange={e=>setRefundMethod(e.target.value as any)}><option value="EFECTIVO">Efectivo</option><option value="MISMO_METODO">Reverso</option><option value="CREDITO_TIENDA">Nota Crédito</option></select></div><div className="form-group"><label className="text-[10px] font-black uppercase block mb-1">Motivo</label><textarea className="form-input text-xs min-h-[80px]" value={returnReason} onChange={e=>setReturnReason(e.target.value)}></textarea></div><button disabled={returnItems.length === 0 || !returnReason.trim()} onClick={procesarDevolucionPOS} className="btn btn-primary w-full h-14 font-black uppercase text-xs shadow-xl"><CheckCircle2 className="w-5 h-5 mr-2" /> Finalizar</button></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL DETALLES AVANZADOS (AUDITORÍA DE DEUDA) */}
      {showDetailsModal && (
        <div className="modal show" style={{ zIndex: 300 }}>
          <div className="modal-bg" onClick={() => setShowDetailsModal(null)}></div>
          <div className="modal-box max-w-[600px] bg-white border-2 border-line rounded-xl overflow-hidden shadow-2xl">
            <div className="modal-head py-4 px-6 border-b border-line bg-ink flex justify-between items-center text-white">
              <h3 className="font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
                <Receipt className="w-5 h-5 text-brand-gold" /> AUDITORÍA DE DEUDA: {showDetailsModal.id}
              </h3>
              <button onClick={() => setShowDetailsModal(null)} className="text-white hover:text-brand-gold"><X className="w-5 h-5"/></button>
            </div>
            <div className="modal-body p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-white">
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-3 bg-surface-soft rounded-lg border border-line">
                    <label className="text-[8px] font-black uppercase text-ink block mb-1">Monto Original</label>
                    <p className="text-lg font-black text-ink">{Utils.fmtUSD(showDetailsModal.montoUSD)}</p>
                 </div>
                 <div className="p-3 bg-brand-gold-soft border border-brand-gold/20 rounded-lg">
                    <label className="text-[8px] font-black uppercase text-brand-gold-deep block mb-1">Saldo Actual</label>
                    <p className="text-lg font-black text-brand-gold-deep">{Utils.fmtUSD(showDetailsModal.saldoUSD)}</p>
                 </div>
              </div>

              {(() => {
                const sale = state.ventas.find(v => v.id === showDetailsModal.ventaId || v.id === showDetailsModal.id);
                if (!sale) return null;
                return (
                  <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <h4 className="text-[10px] font-black uppercase text-ink tracking-[0.2em] border-b border-line pb-2">DETALLE DE COMPRA ORIGINAL</h4>
                    <div className="bg-surface-soft/50 rounded-lg overflow-hidden border border-line/30">
                       <table className="w-full">
                          <thead>
                            <tr className="bg-ink/5">
                               <th className="text-[8px] font-black uppercase p-2 text-left">Cant</th>
                               <th className="text-[8px] font-black uppercase p-2 text-left">Descripción</th>
                               <th className="text-[8px] font-black uppercase p-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sale.items.map((it: any, idx: number) => (
                              <tr key={idx} className="border-b border-line/20">
                                 <td className="text-[9px] font-black p-2">{it.cantidad}</td>
                                 <td className="text-[9px] font-black uppercase p-2 truncate max-w-[180px]">{it.nombre}</td>
                                 <td className="text-[9px] font-black p-2 text-right">{Utils.fmtUSD(it.subtotalUSD)}</td>
                              </tr>
                            ))}
                          </tbody>
                       </table>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3">
                 <h4 className="text-[10px] font-black uppercase text-ink tracking-[0.2em] border-b border-line pb-2">HISTORIAL DE ABONOS</h4>
                 <div className="space-y-2">
                    {(!showDetailsModal.historialPagos || showDetailsModal.historialPagos.length === 0) ? (
                      <div className="py-4 text-center text-ink/30 text-[10px] font-black uppercase">Sin abonos registrados</div>
                    ) : (
                      showDetailsModal.historialPagos.map((p: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-surface-soft border border-line rounded-lg">
                           <div>
                              <p className="text-[10px] font-black text-ink">{Utils.fmtFecha(p.fecha)}</p>
                              <p className="text-[8px] font-black text-ink/40 mono">{p.reciboId}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-xs font-black text-status-success">+{Utils.fmtUSD(p.montoUSD)}</p>
                              <p className="text-[8px] font-black text-ink/40 uppercase">{Utils.metodoLabel(p.metodo)}</p>
                           </div>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL COMPLETO DE CLIENTE */}
      {showClientHistory && (
        <div className="modal show" style={{ zIndex: 300 }}>
          <div className="modal-bg" onClick={() => setShowClientHistory(null)}></div>
          <div className="modal-box max-w-4xl bg-white border-2 border-line rounded-xl overflow-hidden shadow-2xl">
            <div className="modal-head py-4 px-6 border-b border-line bg-ink flex justify-between items-center text-white">
              <h3 className="font-black uppercase italic tracking-tighter text-xs flex items-center gap-2">
                <Contact className="w-5 h-5 text-brand-gold" /> ESTADO DE CUENTA: {showClientHistory}
              </h3>
              <button onClick={() => setShowClientHistory(null)} className="text-white hover:text-brand-gold"><X className="w-5 h-5"/></button>
            </div>
            <div className="modal-body p-0 max-h-[70vh] overflow-y-auto bg-white">
               <div className="table-wrap">
                  <table className="w-full">
                    <thead className="bg-surface-soft sticky top-0 z-10">
                      <tr>
                        <th className="text-[9px] font-black uppercase p-4 text-left">Fecha</th>
                        <th className="text-[9px] font-black uppercase p-4 text-left">Referencia</th>
                        <th className="text-[9px] font-black uppercase p-4 text-right">Total</th>
                        <th className="text-[9px] font-black uppercase p-4 text-right">Abonado</th>
                        <th className="text-[9px] font-black uppercase p-4 text-right">Saldo</th>
                        <th className="text-[9px] font-black uppercase p-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.cxc.filter(d => d.cliente === showClientHistory).sort((a,b) => b.fecha.localeCompare(a.fecha)).map(d => (
                        <tr key={d.id} className="border-b border-line/30 hover:bg-surface-warm/20 transition-colors">
                          <td className="p-4 text-xs font-black">{Utils.fmtFecha(d.fecha)}</td>
                          <td className="p-4 text-xs font-black mono text-ink/40">{d.id}</td>
                          <td className="p-4 text-right text-xs font-black">{Utils.fmtUSD(d.montoUSD)}</td>
                          <td className="p-4 text-right text-xs font-black text-status-success">{Utils.fmtUSD(d.abonadoUSD)}</td>
                          <td className="p-4 text-right text-sm font-black text-brand-gold-deep">{Utils.fmtUSD(d.saldoUSD)}</td>
                          <td className="p-4 text-center">
                            <span className={`badge ${d.estado === 'pagada' ? 'badge-ok' : (d.estado === 'parcial' ? 'badge-info' : 'badge-warn')} font-black text-[8px] uppercase`}>
                              {d.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALES DE PAGOS Y CRÉDITOS */}
      {showMultiModal && (
        <FloatingPaymentModal
          total={totalBS}
          totalCents={Math.round(totalBS * 100)}
          exchangeRate={state.tasa}
          onClose={() => setShowMultiModal(false)}
          onConfirm={(data) => {
            const mapped = data.payments.map(p => ({
              metodo: p.method as PaymentMethod,
              montoUSD: p.usdAmount || (p.amount / state.tasa),
              montoBS: p.amount
            }));
            ejecutarVenta(mapped);
            setShowMultiModal(false);
          }}
        />
      )}

      {isCreditView && (
        <div className="modal show"><div className="modal-bg" onClick={() => setIsCreditView(false)}></div>
          <div className="modal-box max-w-[380px] bg-white border-2 border-line">
            <div className="modal-head py-3 px-4 border-b border-line bg-surface-soft flex justify-between">
              <h3 className="text-ink text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-brand-gold" /> CARGAR CRÉDITO
              </h3>
              <button onClick={() => setIsCreditView(false)}><X size={18} /></button>
            </div>
            <div className="modal-body p-4 space-y-4">
              {!showNewClientForm ? (
                <div className="space-y-3">
                   <div className="bg-ink p-3 rounded-lg text-center mb-2">
                      <p className="text-white/40 text-[8px] font-black uppercase mb-1">Monto a Deber</p>
                      <p className="text-2xl font-black text-brand-gold">{Utils.fmtUSD(subtotalUSD)}</p>
                   </div>
                   <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-ink opacity-30" /><input className="form-input pl-10 h-10 text-xs font-bold" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} /></div>
                   <div className="max-h-[160px] overflow-y-auto border border-line rounded-xl bg-gray-50 shadow-inner">
                     {filteredClients.map(c => (<div key={c.id} onClick={() => setSelectedClient(c)} className={`p-3 border-b border-line/40 cursor-pointer hover:bg-brand-gold/10 transition-all ${selectedClient?.id === c.id ? 'bg-brand-gold-soft border-l-4 border-l-brand-gold' : ''}`}><div className="text-xs font-black text-ink uppercase">{c.name}</div><div className="text-[10px] text-ink/40 mono">{c.cedula}</div></div>))}
                     {filteredClients.length === 0 && <div className="p-10 text-center text-[10px] font-black text-ink/20 uppercase">No hay resultados</div>}
                   </div>
                   <div className="flex flex-col gap-2">
                     <button className="btn bg-status-info-soft text-status-info border border-status-info/40 font-black uppercase text-[10px] h-10 flex items-center justify-center gap-2" onClick={() => setShowNewClientForm(true)}><UserPlus className="w-4 h-4" /> Registrar Nuevo</button>
                     <button className="btn btn-primary w-full h-12 font-black uppercase text-xs shadow-md" disabled={!selectedClient} onClick={ejecutarVentaACredito}>Cargar a Cartera</button>
                   </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
                   <div className="space-y-2">
                     <div className="space-y-1"><label className="text-[9px] font-black uppercase text-ink">Nombre Completo</label><input className="form-input h-9 text-xs font-black uppercase" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} /></div>
                     <div className="space-y-1"><label className="text-[9px] font-black uppercase text-ink">Cédula / RIF</label><input className="form-input h-9 text-xs font-black uppercase" value={newClient.cedula} onChange={e => setNewClient({...newClient, cedula: e.target.value})} /></div>
                   </div>
                   <button className="btn btn-primary w-full h-12 font-black uppercase text-xs shadow-md" onClick={ejecutarVentaACredito}>Guardar y Cargar</button>
                   <button className="text-[10px] text-ink font-black uppercase text-center w-full" onClick={() => setShowNewClientForm(false)}>Volver a la lista</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && lastProcessedSale && (
        <ReceiptModal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} sale={{ ...lastProcessedSale, date: lastProcessedSale.fecha || lastProcessedSale.date, customerName: lastProcessedSale.cliente || lastProcessedSale.customerName, paymentMethod: Utils.metodoLabel(lastProcessedSale.metodoPago || lastProcessedSale.paymentMethod), items: (lastProcessedSale.items || []).map((it: any) => ({ ...it, name: it.nombre, qty: it.cantidad || it.qty, price: it.precioUnitUSD || it.price })), type: lastProcessedSale.type || (lastProcessedSale.metodoPago !== 'credito' ? 'CONTADO' : 'CRÉDITO') }} />
      )}
    </div>
  );
}
