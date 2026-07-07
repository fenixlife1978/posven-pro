"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AppState, SaleItem, Sale, PaymentMethod, ReportZ, Movimiento } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Receipt, 
  Barcode, 
  Wallet, 
  X, 
  CheckCircle2, 
  FileText,
  RotateCcw,
  History,
  ClipboardList,
  User,
  ArrowLeft,
  Eye,
  HandCoins,
  Clock
} from 'lucide-react';

interface PagoRealizado {
  metodo: PaymentMethod;
  montoUSD: number;
  montoBS: number;
}

export default function SalesModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'pos' | 'history' | 'credits' | 'returns'>('pos');
  const [showReport, setShowReport] = useState<'Y' | 'Z' | null>(null);
  const [cliente, setCliente] = useState('Consumidor final');
  
  const [pagos, setPagos] = useState<PagoRealizado[]>([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [metodoActual, setMetodoActual] = useState<PaymentMethod>('efectivo_usd');
  const [montoInput, setMontoInput] = useState('');
  
  const [showAbonoModal, setShowAbonoModal] = useState<string | null>(null);
  const [abonoPagos, setAbonoPagos] = useState<PagoRealizado[]>([]);
  const [showAbonoMultiModal, setShowAbonoMultiModal] = useState(false);
  
  const [showDetailsModal, setShowDetailsModal] = useState<any | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<any | null>(null);
  const [montoAbono, setMontoAbono] = useState('');
  
  const [lastProcessedSale, setLastProcessedSale] = useState<Sale | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const subtotalUSD = state.carrito.reduce((s, i) => s + i.subtotalUSD, 0);
  const totalBS = subtotalUSD * state.tasa;
  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  const saldoRestanteUSD = Math.max(0, subtotalUSD - totalPagadoUSD);
  const saldoRestanteBS = saldoRestanteUSD * state.tasa;

  const matches = search.trim().length > 0 
    ? state.productos
        .filter(p => p.activo && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())))
        .sort((a, b) => {
          const s = search.toLowerCase();
          if (a.codigo.toLowerCase() === s) return -1;
          if (a.codigo.toLowerCase().startsWith(s)) return -1;
          return 0;
        }).slice(0, 8)
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
    searchInputRef.current?.focus();
  };

  const updateQty = (idx: number, delta: number) => {
    const nuevo = [...state.carrito];
    const item = nuevo[idx];
    const p = state.productos.find(x => x.id === item.productoId);
    const n = item.cantidad + delta;
    if (n <= 0) nuevo.splice(idx, 1);
    else if (p && n <= p.stock) {
      item.cantidad = n;
      item.subtotalUSD = n * item.precioUnitUSD;
    }
    updateState({ carrito: nuevo });
    setPagos([]);
  };

  const addPago = (isAbono: boolean = false) => {
    let monto = parseFloat(montoInput);
    if (isNaN(monto) || monto <= 0) {
      if (isAbono) {
        const totalAbonoInput = parseFloat(montoAbono) || 0;
        const yaPagadoAbono = abonoPagos.reduce((s,p) => s + p.montoUSD, 0);
        const restanteAbono = Math.max(0, totalAbonoInput - yaPagadoAbono);
        monto = metodoActual === 'efectivo_usd' ? restanteAbono : restanteAbono * state.tasa;
      } else {
        monto = metodoActual === 'efectivo_usd' ? saldoRestanteUSD : saldoRestanteBS;
      }
    }
    
    let montoUSD = metodoActual === 'efectivo_usd' ? monto : monto / state.tasa;
    let montoBS = metodoActual === 'efectivo_usd' ? monto * state.tasa : monto;
    
    if (isAbono) {
      setAbonoPagos([...abonoPagos, { metodo: metodoActual, montoUSD, montoBS }]);
      setShowAbonoMultiModal(false);
    } else {
      if (montoUSD > (saldoRestanteUSD + 0.01)) return alert("Excede el saldo");
      setPagos([...pagos, { metodo: metodoActual, montoUSD, montoBS }]);
      setShowMultiModal(false);
    }
    setMontoInput('');
  };

  const ejecutarVenta = () => {
    if (state.carrito.length === 0 || saldoRestanteUSD > 0.01) return;
    
    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahora = Utils.ahora();
    
    const nuevosProductos = state.productos.map(p => {
      const item = state.carrito.find(i => i.productoId === p.id);
      return item ? { ...p, stock: p.stock - item.cantidad } : p;
    });

    const nuevosMovimientos: Movimiento[] = state.carrito.map(item => {
      const p = state.productos.find(prod => prod.id === item.productoId);
      return {
        id: Store.uid(),
        productoId: item.productoId,
        tipo: 'venta',
        cantidad: -Math.abs(item.cantidad),
        stockAntes: p?.stock || 0,
        stockDespues: (p?.stock || 0) - item.cantidad,
        fecha: ahora,
        referencia: `VENTA ${reciboId}`
      };
    });

    const nuevaVenta: Sale = {
      id: reciboId,
      fecha: ahora,
      cliente,
      items: [...state.carrito],
      subtotalUSD,
      descuentoUSD: 0,
      totalUSD: subtotalUSD,
      totalBS,
      metodoPago: pagos.length > 1 ? 'mixto' : (pagos[0]?.metodo || 'efectivo_usd'),
      estado: 'completada',
      type: 'VENTA',
      received: totalPagadoUSD,
      change: Math.max(0, totalPagadoUSD - subtotalUSD)
    };

    updateState({
      productos: nuevosProductos,
      ventas: [...state.ventas, nuevaVenta],
      movimientos: [...state.movimientos, ...nuevosMovimientos],
      carrito: [],
      proximoRecibo: state.proximoRecibo + 1,
      acumuladoHistorico: state.acumuladoHistorico + subtotalUSD
    });
    
    setLastProcessedSale(nuevaVenta);
    setShowReceiptModal(true);
    setPagos([]);
    setCliente('Consumidor final');
  };

  const procesarAbonoCascada = () => {
    const totalAbono = parseFloat(montoAbono);
    const pagadoUSD = abonoPagos.reduce((s,p) => s + p.montoUSD, 0);
    
    if (isNaN(totalAbono) || totalAbono <= 0 || !showAbonoModal) return;
    if (Math.abs(pagadoUSD - totalAbono) > 0.01) return alert("Los métodos de pago no cubren el monto del abono.");

    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahora = Utils.ahora();
    let restante = totalAbono;
    const nuevasDeudas = [...state.cxc].sort((a, b) => a.fecha.localeCompare(b.fecha));
    
    const actualizadas = nuevasDeudas.map(d => {
      if (d.cliente === showAbonoModal && d.estado !== 'pagada' && restante > 0) {
        const abonoAplicado = Math.min(restante, d.saldoUSD);
        restante -= abonoAplicado;
        
        const historialPagos = d.historialPagos || [];
        historialPagos.push({
          fecha: ahora,
          montoUSD: abonoAplicado,
          montoBS: abonoAplicado * state.tasa,
          reciboId
        });

        const nuevoSaldo = d.saldoUSD - abonoAplicado;
        return { 
          ...d, 
          abonadoUSD: d.abonadoUSD + abonoAplicado, 
          saldoUSD: nuevoSaldo, 
          estado: nuevoSaldo <= 0 ? 'pagada' : 'parcial',
          historialPagos
        };
      }
      return d;
    });

    const registroAbono: Sale = {
      id: reciboId,
      fecha: ahora,
      cliente: showAbonoModal,
      items: [{ productoId: 'ABONO', nombre: 'ABONO A CUENTA', precioUnitUSD: totalAbono, cantidad: 1, subtotalUSD: totalAbono }],
      subtotalUSD: totalAbono,
      descuentoUSD: 0,
      totalUSD: totalAbono,
      totalBS: totalAbono * state.tasa,
      metodoPago: abonoPagos.length > 1 ? 'mixto' : abonoPagos[0].metodo,
      estado: 'completada',
      type: 'COBRO DEUDA',
      received: totalAbono,
      change: 0
    };

    updateState({ 
      cxc: actualizadas, 
      ventas: [...state.ventas, registroAbono],
      proximoRecibo: state.proximoRecibo + 1
    });

    setLastProcessedSale(registroAbono);
    setShowReceiptModal(true);
    setShowAbonoModal(null);
    setMontoAbono('');
    setAbonoPagos([]);
  };

  const emitirReporteZ = () => {
    if (!confirm('¿Desea realizar el CIERRE FISCAL Z? Esto bloqueará las ventas de hoy.')) return;
    const hoy = Utils.hoy();
    const ventasHoy = state.ventas.filter(v => v.fecha.startsWith(hoy));
    const totalHoy = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
    const nuevoZ: ReportZ = {
      id: `Z-${String(state.ultimoZ + 1).padStart(4, '0')}`,
      fecha: hoy,
      numeroZ: state.ultimoZ + 1,
      desdeFactura: ventasHoy[0]?.id || 'N/A',
      hastaFactura: ventasHoy[ventasHoy.length - 1]?.id || 'N/A',
      baseImponibleUSD: totalHoy / 1.16,
      ivaUSD: totalHoy - (totalHoy / 1.16),
      exentoUSD: 0,
      totalBrutoUSD: totalHoy,
      acumuladoHistoricoUSD: state.acumuladoHistorico
    };
    updateState({ reportesZ: [...state.reportesZ, nuevoZ], ultimoZ: state.ultimoZ + 1 });
    setShowReport('Z');
  };

  const handlePrint = () => {
    window.print();
  };

  const hoy = Utils.hoy();
  const ventasHoy = state.ventas.filter(v => v.fecha.startsWith(hoy)).sort((a,b) => b.fecha.localeCompare(a.fecha));
  const creditosActivos = state.cxc.filter(c => c.estado !== 'pagada');

  return (
    <div className="flex flex-col gap-2 h-[calc(100vh-100px)] max-w-7xl mx-auto w-full overflow-hidden">
      <div className="flex gap-2 no-print shrink-0 overflow-x-auto pb-1">
        <button onClick={() => setView('pos')} className={`btn btn-sm ${view === 'pos' ? 'btn-primary' : 'btn-secondary text-white font-bold'}`}><ShoppingCart className="w-3.5 h-3.5"/> Punto de Venta</button>
        <button onClick={() => setView('history')} className={`btn btn-sm ${view === 'history' ? 'btn-primary' : 'btn-secondary text-white font-bold'}`}><History className="w-3.5 h-3.5"/> Historial</button>
        <button onClick={() => setView('credits')} className={`btn btn-sm ${view === 'credits' ? 'btn-primary' : 'btn-secondary text-white font-bold'}`}><ClipboardList className="w-3.5 h-3.5"/> Consultar Créditos</button>
        <button onClick={() => setShowReport('Y')} className="btn btn-sm btn-secondary text-white font-bold"><FileText className="w-3.5 h-3.5"/> Reporte Y</button>
        <button onClick={emitirReporteZ} className="btn btn-sm btn-secondary text-white font-bold"><Receipt className="w-3.5 h-3.5"/> Reporte Z</button>
        <button onClick={() => setView('returns')} className="btn btn-sm btn-secondary text-white font-bold"><RotateCcw className="w-3.5 h-3.5"/> Devoluciones</button>
      </div>

      {view === 'pos' ? (
        <div className="flex flex-col gap-2 flex-1 overflow-hidden animate-in fade-in duration-300">
          <div className="relative group shrink-0">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8952e] z-10"><Barcode className="w-5 h-5" /></div>
            <input 
              ref={searchInputRef}
              className="form-input pl-14 py-2 text-base bg-[#131313] border-[#c8952e]/30 text-white placeholder-white/40" 
              placeholder="Escanee o busque producto..." value={search} onChange={e => setSearch(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && matches.length >= 1 && agregar(matches[0].id)} autoFocus
            />
            {matches.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-[#1e1e1e] border border-[#2a2a2a] rounded-b-lg shadow-2xl z-[100] mt-1 overflow-hidden">
                {matches.map(p => (
                  <div key={p.id} onClick={() => agregar(p.id)} className="flex items-center justify-between p-2 hover:bg-[#c8952e]/20 cursor-pointer border-b border-[#2a2a2a]">
                    <div className="text-white text-xs font-bold uppercase">{p.nombre} <span className="text-white/40 text-[9px] mono ml-2">{p.codigo}</span></div>
                    <div className="text-[#c8952e] font-black text-sm">{Utils.fmtUSD(p.precioUSD)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-1 gap-3 overflow-hidden">
            <div className="w-1/3 flex flex-col gap-2">
              <div className="card p-3 space-y-3 bg-[#131313] border-[#2a2a2a] h-full flex flex-col">
                <div className="form-group mb-0">
                  <label className="text-white text-[10px] font-black uppercase block mb-1">IDENTIFICACIÓN CLIENTE</label>
                  <input className="form-input h-8 text-xs bg-[#0b0b0b] text-white border-[#2a2a2a] font-black uppercase" value={cliente} onChange={e => setCliente(e.target.value)} />
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-white text-[10px] font-black uppercase block mb-1">MÉTODOS APLICADOS</label>
                  <div className="flex-1 p-2 border border-white/10 bg-[#181818] rounded-lg overflow-y-auto">
                    {pagos.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-[10px] border-b border-white/5 py-1 text-white font-black uppercase">
                        <span>{Utils.metodoLabel(p.metodo)}</span>
                        <span className="text-[#c8952e]">{Utils.fmtUSD(p.montoUSD)}</span>
                      </div>
                    ))}
                    {pagos.length === 0 && <div className="text-[10px] text-white/20 italic py-2 text-center uppercase font-black">Sin abonos</div>}
                  </div>
                </div>
                <div className="p-3 border border-[#3a9bdc]/30 bg-[#3a9bdc]/5 rounded-lg text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <label className="text-white text-[10px] font-black uppercase">SALDO RESTANTE</label>
                    <button onClick={() => setShowMultiModal(true)} className="btn-icon h-6 w-6 bg-[#c8952e] text-black"><Wallet className="w-3.5 h-3.5"/></button>
                  </div>
                  <div className={`text-2xl font-black ${saldoRestanteUSD <= 0.01 ? 'text-[#27ae60]' : 'text-[#3a9bdc]'}`}>
                    {saldoRestanteUSD <= 0.01 ? 'SALDADO' : Utils.fmtUSD(saldoRestanteUSD)}
                  </div>
                  <div className="bg-black py-2 rounded-lg border-2 border-white/20">
                    <label className="text-white text-[9px] font-black uppercase block mb-1">EQUIVALENTE A PAGAR</label>
                    <div className="text-2xl font-black text-white">{Utils.fmtBS(saldoRestanteBS)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-2/3 flex flex-col gap-2 overflow-hidden">
              <div className="card flex-1 flex flex-col overflow-hidden bg-white border-none shadow-xl">
                <div className="grid grid-cols-[1fr_80px_60px_70px_80px_80px_40px] gap-2 px-3 py-2 bg-[#131313] text-white text-[9px] font-black uppercase tracking-widest">
                  <div>Descripción</div><div className="text-center">Cant</div><div className="text-center">U.M.</div><div className="text-right">Precio ($)</div><div className="text-right">Precio (Bs)</div><div className="text-right">Total</div><div className="text-center"></div>
                </div>
                <div className="flex-1 overflow-y-auto p-1 space-y-1">
                  {state.carrito.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-black/10"><ShoppingCart className="w-16 h-16 mb-2"/><p className="font-black uppercase text-[10px] tracking-tighter">Esperando Productos...</p></div>
                  ) : (
                    state.carrito.map((item, i) => {
                      const product = state.productos.find(p => p.id === item.productoId);
                      return (
                        <div key={i} className="grid grid-cols-[1fr_80px_60px_70px_80px_80px_40px] gap-2 items-center px-2 py-1 bg-white border-b border-black/5 text-black">
                          <div className="flex flex-col min-w-0">
                            <div className="truncate font-black text-[10px] uppercase">{item.nombre}</div>
                            <div className="text-[8px] font-black text-black mono uppercase">{item.productoId}</div>
                          </div>
                          <div className="flex items-center justify-center gap-1 bg-black/5 rounded p-0.5"><button onClick={() => updateQty(i, -1)} className="text-black font-black text-xs px-1 hover:bg-black/10">-</button><span className="w-5 text-center text-[10px] font-black">{item.cantidad}</span><button onClick={() => updateQty(i, 1)} className="text-black font-black text-xs px-1 hover:bg-black/10">+</button></div>
                          <div className="text-center text-[9px] font-black uppercase">{product?.cantidad || '-'}</div>
                          <div className="text-right text-[10px] font-black">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                          <div className="text-right text-[10px] font-black">{Utils.fmtBS(item.precioUnitUSD * state.tasa)}</div>
                          <div className="text-right text-[11px] font-black">{Utils.fmtUSD(item.subtotalUSD)}</div>
                          <div className="flex justify-center"><button onClick={() => updateQty(i, -item.cantidad)} className="text-black/20 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button></div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="p-3 bg-[#131313] border-t border-[#2a2a2a] flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-white text-[10px] font-black uppercase block">TOTAL FACTURA</label>
                    <div className="flex items-baseline gap-2">
                      <div className="text-3xl font-black text-[#c8952e]">{Utils.fmtUSD(subtotalUSD)}</div>
                      <div className="text-sm font-black text-white">{Utils.fmtBS(totalBS)}</div>
                    </div>
                  </div>
                  <button onClick={ejecutarVenta} disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01} className="btn btn-primary h-12 px-8 font-black uppercase text-xs disabled:opacity-20 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5"/> PROCESAR VENTA
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : view === 'history' ? (
        <div className="card flex-1 bg-[#131313] text-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          <div className="card-head px-5 py-4 border-b border-[#2a2a2a] bg-[#181818] flex justify-between items-center">
            <h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2">
              <History className="w-5 h-5 text-[#c8952e]" /> Historial de Transacciones Diarias
            </h3>
            <button onClick={() => setView('pos')} className="btn btn-sm btn-secondary flex items-center gap-2 font-black uppercase text-[10px]">
              <ArrowLeft className="w-3 h-3"/> Volver al POS
            </button>
          </div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table>
              <thead className="sticky top-0 bg-[#0b0b0b] z-10">
                <tr>
                  <th className="text-white font-black text-[10px] uppercase">Recibo</th>
                  <th className="text-white font-black text-[10px] uppercase">Hora</th>
                  <th className="text-white font-black text-[10px] uppercase">Cliente</th>
                  <th className="text-white font-black text-[10px] uppercase">Tipo</th>
                  <th className="text-white font-black text-[10px] uppercase text-right">Monto USD</th>
                  <th className="text-white font-black text-[10px] uppercase">Método Pago</th>
                  <th className="text-white font-black text-[10px] uppercase text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ventasHoy.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-24 text-white font-black uppercase italic opacity-30">No se registran transacciones para el día de hoy</td></tr>
                ) : (
                  ventasHoy.map(v => (
                    <tr key={v.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="text-white font-black text-xs mono">{v.id}</td>
                      <td className="text-white font-bold text-xs">{v.fecha.includes('T') ? v.fecha.split('T')[1].slice(0, 5) : '-'}</td>
                      <td className="text-white font-black text-xs uppercase truncate max-w-[150px]">{v.cliente}</td>
                      <td className="text-white font-black text-[9px] uppercase"><span className={`badge ${v.type === 'COBRO DEUDA' ? 'badge-info' : 'badge-neutral'}`}>{v.type || 'VENTA'}</span></td>
                      <td className="text-[#c8952e] font-black text-xs text-right">{Utils.fmtUSD(v.totalUSD)}</td>
                      <td className="text-white font-bold text-[10px] uppercase">{Utils.metodoLabel(v.metodoPago)}</td>
                      <td className="text-center"><span className="badge badge-ok font-black text-[9px] uppercase">{v.estado}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === 'credits' ? (
        <div className="card flex-1 bg-[#131313] text-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          <div className="card-head px-5 py-4 border-b border-[#2a2a2a] bg-[#181818] flex justify-between items-center">
            <h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#3a9bdc]" /> Consulta de Créditos Activos
            </h3>
            <button onClick={() => setView('pos')} className="btn btn-sm btn-secondary flex items-center gap-2 font-black uppercase text-[10px]">
              <ArrowLeft className="w-3 h-3"/> Volver al POS
            </button>
          </div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table>
              <thead className="sticky top-0 bg-[#0b0b0b] z-10">
                <tr>
                  <th className="text-white font-black text-[10px] uppercase">Emisión</th>
                  <th className="text-white font-black text-[10px] uppercase">Vencimiento</th>
                  <th className="text-white font-black text-[10px] uppercase">Cliente</th>
                  <th className="text-white font-black text-[10px] uppercase text-right">Monto Orig. USD</th>
                  <th className="text-white font-black text-[10px] uppercase text-right">Saldo Pend. USD</th>
                  <th className="text-white font-black text-[10px] uppercase text-right">Saldo en Bs.</th>
                  <th className="text-white font-black text-[10px] uppercase text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {creditosActivos.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-24 text-white font-black uppercase italic opacity-30">No hay cuentas por cobrar activas</td></tr>
                ) : (
                  creditosActivos.map(c => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="text-white font-bold text-xs">{Utils.fmtFecha(c.fecha)}</td>
                      <td className={`text-xs font-bold ${c.fechaVencimiento < Utils.hoy() && c.estado !== 'pagada' ? 'text-[#e04848]' : 'text-white'}`}>
                        {c.fechaVencimiento === '2099-12-31' ? 'ABIERTA' : Utils.fmtFecha(c.fechaVencimiento)}
                      </td>
                      <td className="text-white font-black text-xs uppercase">{c.cliente}</td>
                      <td className="text-white font-bold text-xs text-right">{Utils.fmtUSD(c.montoUSD)}</td>
                      <td className="text-[#3a9bdc] font-black text-xs text-right">{Utils.fmtUSD(c.saldoUSD)}</td>
                      <td className="text-white font-bold text-xs text-right">{Utils.fmtBS(c.saldoUSD * state.tasa)}</td>
                      <td className="text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => setShowDetailsModal(c)} className="btn-icon h-8 w-8 text-white hover:text-[#c8952e]" title="Ver Detalles"><Eye className="w-4 h-4"/></button>
                          <button onClick={() => setShowHistoryModal(c)} className="btn-icon h-8 w-8 text-white hover:text-[#3a9bdc]" title="Historial de Abonos"><Clock className="w-4 h-4"/></button>
                          <button onClick={() => { setShowAbonoModal(c.cliente); setMontoAbono(''); setAbonoPagos([]); }} className="btn btn-sm btn-primary font-black text-[9px] uppercase px-4">Abonar</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card flex-1 bg-[#131313] text-white p-4 flex flex-col items-center justify-center space-y-4">
          <RotateCcw className="w-12 h-12 text-[#e04848] opacity-50" />
          <h3 className="text-white font-black uppercase italic text-xl">Módulo de Devoluciones</h3>
          <p className="text-white/40 font-black uppercase text-xs">Gestión de retornos de mercancía próximamente integrada.</p>
          <button onClick={() => setView('pos')} className="btn btn-secondary uppercase font-black text-xs h-10 px-8">Regresar al POS</button>
        </div>
      )}

      {/* MODAL DETALLES CREDITO */}
      {showDetailsModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowDetailsModal(null)}></div>
          <div className="modal-box bg-[#1e1e1e] border-2 border-white/20 max-w-lg">
            <div className="modal-head py-3 px-4 border-b border-white/10"><h3 className="text-white text-xs font-black uppercase">DETALLE DE CRÉDITO - {showDetailsModal.id}</h3><button onClick={() => setShowDetailsModal(null)}><X className="text-white"/></button></div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-black/40 p-3 rounded border border-white/5 space-y-1">
                <div className="flex justify-between text-[10px] text-white/60"><span>CLIENTE:</span><span className="text-white font-black uppercase">{showDetailsModal.cliente}</span></div>
                <div className="flex justify-between text-[10px] text-white/60"><span>EMISIÓN:</span><span className="text-white font-black">{Utils.fmtFecha(showDetailsModal.fecha)}</span></div>
                <div className="flex justify-between text-sm font-black text-[#c8952e]"><span>TOTAL DEUDA:</span><span>{Utils.fmtUSD(showDetailsModal.montoUSD)}</span></div>
              </div>
              <div className="table-wrap max-h-48 overflow-y-auto">
                <table className="text-[10px]">
                  <thead>
                    <tr className="border-b border-white/10"><th className="text-white/40">Item</th><th className="text-white/40 text-center">Cant</th><th className="text-white/40 text-right">Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {state.ventas.find(v => v.id === showDetailsModal.id || v.id === showDetailsModal.ventaId)?.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-white/5">
                        <td className="text-white font-bold uppercase py-2">{it.nombre}</td>
                        <td className="text-white text-center">{it.cantidad}</td>
                        <td className="text-[#c8952e] text-right font-black">{Utils.fmtUSD(it.subtotalUSD)}</td>
                      </tr>
                    )) || (
                      <tr><td colSpan={3} className="text-center py-4 text-white/20 italic uppercase">Detalle de items no disponible (Deuda Directa)</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE ABONOS */}
      {showHistoryModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowHistoryModal(null)}></div>
          <div className="modal-box bg-[#1e1e1e] border-2 border-white/20 max-w-lg">
            <div className="modal-head py-3 px-4 border-b border-white/10"><h3 className="text-white text-xs font-black uppercase">HISTORIAL DE PAGOS - {showHistoryModal.id}</h3><button onClick={() => setShowHistoryModal(null)}><X className="text-white"/></button></div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-black/40 p-3 rounded border border-white/5 space-y-1">
                <div className="flex justify-between text-[10px] text-white/60"><span>CLIENTE:</span><span className="text-white font-black uppercase">{showHistoryModal.cliente}</span></div>
                <div className="flex justify-between text-[10px] text-white/60"><span>SALDO PENDIENTE:</span><span className="text-[#3a9bdc] font-black">{Utils.fmtUSD(showHistoryModal.saldoUSD)}</span></div>
              </div>
              <div className="table-wrap max-h-60 overflow-y-auto">
                <table className="text-[10px]">
                  <thead>
                    <tr className="border-b border-white/10"><th className="text-white/40">Recibo</th><th className="text-white/40">Fecha / Hora</th><th className="text-white/40 text-right">Abono (USD)</th><th className="text-white/40 text-right">Abono (BS)</th></tr>
                  </thead>
                  <tbody>
                    {showHistoryModal.historialPagos && showHistoryModal.historialPagos.length > 0 ? (
                      showHistoryModal.historialPagos.map((p: any, idx: number) => (
                        <tr key={idx} className="border-b border-white/5">
                          <td className="text-white font-black mono py-2">{p.reciboId || '-'}</td>
                          <td className="text-white font-bold py-2">{p.fecha.replace('T', ' ').slice(0, 16)}</td>
                          <td className="text-[#27ae60] text-right font-black">{Utils.fmtUSD(p.montoUSD)}</td>
                          <td className="text-white text-right font-black">{Utils.fmtBS(p.montoBS)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="text-center py-8 text-white/20 italic uppercase font-black">No se registran abonos aún</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ABONO GENERAL */}
      {showAbonoModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowAbonoModal(null)}></div>
          <div className="modal-box max-w-[380px] bg-[#1e1e1e] border-2 border-white/20">
            <div className="modal-head py-3 px-4 border-b border-white/10"><h3 className="text-white text-xs font-black uppercase">REGISTRAR ABONO - {showAbonoModal}</h3><button onClick={() => setShowAbonoModal(null)}><X className="text-white"/></button></div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-black p-3 rounded-lg text-center border border-white/10">
                <p className="text-white/40 text-[9px] font-bold uppercase mb-1">DEUDA TOTAL CLIENTE</p>
                <p className="text-2xl font-black text-[#3a9bdc]">{Utils.fmtUSD(state.cxc.filter(d => d.cliente === showAbonoModal && d.estado !== 'pagada').reduce((s, d) => s + d.saldoUSD, 0))}</p>
              </div>
              
              <div className="space-y-1"><label className="text-white text-[10px] font-bold uppercase">MONTO ABONO (USD)</label>
                <input type="number" className="form-input h-10 text-lg font-black bg-[#0b0b0b] text-white border-white/20" placeholder="0.00" value={montoAbono} onChange={e => setMontoAbono(e.target.value)} />
              </div>

              <div className="bg-[#181818] p-2 rounded border border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white text-[9px] font-black uppercase">MÉTODOS DE PAGO</label>
                  <button onClick={() => setShowAbonoMultiModal(true)} className="btn-icon h-5 w-5 bg-[#c8952e] text-black"><Plus className="w-3 h-3"/></button>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {abonoPagos.map((p, idx) => (
                    <div key={idx} className="flex justify-between text-[9px] text-white font-bold border-b border-white/5 py-1">
                      <span>{Utils.metodoLabel(p.metodo)}</span>
                      <span className="text-[#c8952e]">{Utils.fmtUSD(p.montoUSD)}</span>
                    </div>
                  ))}
                  {abonoPagos.length === 0 && <p className="text-[9px] text-white/20 italic text-center py-1 uppercase">Añada métodos de pago</p>}
                </div>
              </div>

              <p className="text-[9px] text-white/40 italic uppercase text-center leading-tight">Nota: El abono liquidará facturas automáticamente desde la más antigua.</p>
              <button className="btn btn-primary w-full h-12 font-black uppercase text-xs" onClick={procesarAbonoCascada}>CONFIRMAR COBRO DE DEUDA</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Multi-pago POS */}
      {showMultiModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowMultiModal(false)}></div>
          <div className="modal-box max-w-[350px] bg-[#1e1e1e] border-2 border-white/20">
            <div className="modal-head py-3 px-4 border-b border-white/10"><h3 className="text-white text-xs font-black uppercase">REGISTRAR PAGO</h3><button onClick={() => setShowMultiModal(false)}><X className="text-white"/></button></div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-black p-3 rounded-lg text-center border border-white/10"><p className="text-white/40 text-[9px] font-bold uppercase mb-1">Pendiente</p><p className="text-2xl font-black text-[#3a9bdc]">{Utils.fmtUSD(saldoRestanteUSD)}</p><p className="text-xs text-white/60 font-bold">{Utils.fmtBS(saldoRestanteBS)}</p></div>
              <div className="space-y-1"><label className="text-white text-[10px] font-bold uppercase">MÉTODO</label>
                <select className="form-select h-10 bg-[#0b0b0b] text-white border-white/20 font-black uppercase text-xs" value={metodoActual} onChange={e => setMetodoActual(e.target.value as any)}>
                  <option value="efectivo_usd">Efectivo USD</option><option value="efectivo_bs">Efectivo BS</option><option value="punto_venta">Punto de Venta</option><option value="pagomovil">Pago Movil</option><option value="biopago">Biopago</option><option value="zelle">Zelle</option>
                </select>
              </div>
              <div className="space-y-1"><label className="text-white text-[10px] font-bold uppercase">MONTO ({metodoActual.includes('usd') ? 'USD' : 'BS'})</label>
                <input type="number" className="form-input h-12 text-lg font-black bg-[#0b0b0b] text-white border-white/20" placeholder={metodoActual.includes('usd') ? saldoRestanteUSD.toFixed(2) : saldoRestanteBS.toFixed(2)} value={montoInput} onChange={e => setMontoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPago(false)} autoFocus />
              </div>
              <button className="btn btn-primary w-full h-12 font-black uppercase text-xs" onClick={() => addPago(false)}>CONFIRMAR ABONO</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Multi-pago Abono */}
      {showAbonoMultiModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowAbonoMultiModal(false)}></div>
          <div className="modal-box max-w-[350px] bg-[#1e1e1e] border-2 border-white/20">
            <div className="modal-head py-3 px-4 border-b border-white/10"><h3 className="text-white text-xs font-black uppercase">AÑADIR MÉTODO DE PAGO</h3><button onClick={() => setShowAbonoMultiModal(false)}><X className="text-white"/></button></div>
            <div className="modal-body p-4 space-y-4">
              <div className="space-y-1"><label className="text-white text-[10px] font-bold uppercase">MÉTODO</label>
                <select className="form-select h-10 bg-[#0b0b0b] text-white border-white/20 font-black uppercase text-xs" value={metodoActual} onChange={e => setMetodoActual(e.target.value as any)}>
                  <option value="efectivo_usd">Efectivo USD</option><option value="efectivo_bs">Efectivo BS</option><option value="punto_venta">Punto de Venta</option><option value="pagomovil">Pago Movil</option><option value="biopago">Biopago</option><option value="zelle">Zelle</option>
                </select>
              </div>
              <div className="space-y-1"><label className="text-white text-[10px] font-bold uppercase">MONTO ({metodoActual.includes('usd') ? 'USD' : 'BS'})</label>
                <input type="number" className="form-input h-12 text-lg font-black bg-[#0b0b0b] text-white border-white/20" placeholder="0.00" value={montoInput} onChange={e => setMontoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPago(true)} autoFocus />
              </div>
              <button className="btn btn-primary w-full h-12 font-black uppercase text-xs" onClick={() => addPago(true)}>AÑADIR AL COBRO</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reportes Y/Z (Optimized for 80mm Print) */}
      {showReport && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowReport(null)}></div>
          <div className="modal-box bg-white text-black max-w-[80mm] font-mono p-4 text-[11px] leading-tight rounded shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="text-center space-y-1 mb-4">
              <h3 className="font-black text-sm uppercase tracking-tighter">{state.empresa.nombre}</h3>
              <p className="font-bold">RIF: {state.empresa.rif}</p>
              <p className="text-[10px]">{state.empresa.direccion}</p>
              <h4 className="font-black border-y border-black py-1 mt-2 text-xs uppercase tracking-widest">REPORTE "{showReport}"</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between font-bold"><span>FECHA:</span><span>{Utils.fmtFecha(Utils.hoy())}</span></div>
              <div className="flex justify-between font-bold"><span>HORA:</span><span>{Utils.ahora().split('T')[1].slice(0, 8)}</span></div>
              <div className="border-t border-dashed border-black my-2"></div>
              {showReport === 'Y' ? (
                <>
                  <div className="font-black uppercase text-xs mb-1">RESUMEN POR PAGO:</div>
                  <div className="flex justify-between"><span>VENTAS DIRECTAS:</span><span>{Utils.fmtUSD(state.ventas.filter(v => v.fecha.startsWith(Utils.hoy()) && v.type === 'VENTA').reduce((s, v) => s + v.totalUSD, 0))}</span></div>
                  <div className="flex justify-between"><span>COBROS DEUDA:</span><span>{Utils.fmtUSD(state.ventas.filter(v => v.fecha.startsWith(Utils.hoy()) && v.type === 'COBRO DEUDA').reduce((s, v) => s + v.totalUSD, 0))}</span></div>
                  <div className="border-t border-dashed border-black my-2"></div>
                  <div className="flex justify-between font-black text-sm"><span>TOTAL CAJA:</span><span>{Utils.fmtUSD(state.ventas.filter(v => v.fecha.startsWith(Utils.hoy())).reduce((s, v) => s + v.totalUSD, 0))}</span></div>
                </>
              ) : (
                <>
                  <div className="flex justify-between font-black text-xs"><span>REPORTE Z #:</span><span>{String(state.ultimoZ).padStart(4, '0')}</span></div>
                  <div className="flex justify-between"><span>DESDE FACT:</span><span>{state.reportesZ[state.reportesZ.length-1]?.desdeFactura || 'N/A'}</span></div>
                  <div className="flex justify-between"><span>HASTA FACT:</span><span>{state.reportesZ[state.reportesZ.length-1]?.hastaFactura || 'N/A'}</span></div>
                  <div className="border-t border-dashed border-black my-2"></div>
                  <div className="flex justify-between font-black text-sm"><span>TOTAL BRUTO:</span><span>{Utils.fmtUSD(state.reportesZ[state.reportesZ.length-1]?.totalBrutoUSD || 0)}</span></div>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-6 no-print">
              <button onClick={() => setShowReport(null)} className="btn btn-sm btn-secondary flex-1 font-black uppercase text-[10px]">Cerrar</button>
              <button onClick={handlePrint} className="btn btn-sm btn-primary flex-1 font-black uppercase text-[10px]">Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECIBO DE PAGO (Optimized for 80mm Print) */}
      {showReceiptModal && lastProcessedSale && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowReceiptModal(false)}></div>
          <div className="modal-box bg-white text-black max-w-[80mm] font-mono p-4 text-[10px] leading-tight rounded shadow-2xl no-print">
            <div className="text-center mb-4"><h3 className="font-black text-xs uppercase">{state.empresa.nombre}</h3><p>RIF: {state.empresa.rif}</p><p>{state.empresa.direccion}</p></div>
            <div className="border-t border-dashed border-black my-2"></div>
            <div className="space-y-1">
              <div className="flex justify-between font-bold"><span>RECIBO NRO:</span><span>{lastProcessedSale.id}</span></div>
              <div className="flex justify-between"><span>FECHA:</span><span>{Utils.fmtFecha(lastProcessedSale.fecha)}</span></div>
              <div className="flex justify-between"><span>HORA:</span><span>{lastProcessedSale.fecha.split('T')[1].slice(0, 5)}</span></div>
              <div className="flex justify-between"><span>CLIENTE:</span><span className="font-bold uppercase">{lastProcessedSale.cliente}</span></div>
              <div className="flex justify-between"><span>OPERACIÓN:</span><span className="font-bold">{lastProcessedSale.type}</span></div>
            </div>
            <div className="border-t border-dashed border-black my-2"></div>
            <div className="mb-4">
              <div className="flex justify-between font-bold mb-1"><span>DESCRIPCIÓN</span><span className="text-right">TOTAL</span></div>
              {lastProcessedSale.items.map((it, idx) => (
                <div key={idx} className="flex justify-between italic"><span>{it.nombre} x{it.cantidad}</span><span>{Utils.fmtUSD(it.subtotalUSD)}</span></div>
              ))}
            </div>
            <div className="border-t border-dashed border-black my-2"></div>
            <div className="space-y-1 font-black">
              <div className="flex justify-between text-xs"><span>TOTAL USD:</span><span>{Utils.fmtUSD(lastProcessedSale.totalUSD)}</span></div>
              <div className="flex justify-between text-xs"><span>TOTAL BS:</span><span>{Utils.fmtBS(lastProcessedSale.totalBS)}</span></div>
            </div>
            <div className="border-t border-dashed border-black my-2"></div>
            <div className="text-center italic mt-4"><p>Gracias por su preferencia.</p><p className="text-[8px] mt-2 opacity-60">LicoreriaPOS Correlativo: {lastProcessedSale.id}</p></div>
            <div className="flex gap-2 mt-6 no-print">
              <button onClick={() => setShowReceiptModal(false)} className="btn btn-sm btn-secondary flex-1 font-black uppercase text-[9px]">Cerrar</button>
              <button onClick={handlePrint} className="btn btn-sm btn-primary flex-1 font-black uppercase text-[9px]">Imprimir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}