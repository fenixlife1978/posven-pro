
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { AppState, SaleItem, Sale, PaymentMethod, Product, Movimiento } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Receipt, 
  Barcode, 
  Wallet, 
  X, 
  CheckCircle2, 
  FileText,
  RotateCcw,
  History,
  ClipboardList,
  Plus,
  Minus,
  UserPlus
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
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [metodoActual, setMetodoActual] = useState<PaymentMethod>('efectivo_usd');
  const [montoInput, setMontoInput] = useState('');
  const [clienteCredito, setClienteCredito] = useState({ nombre: '', rif: '', telefono: '' });
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  const subtotalUSD = state.carrito.reduce((s, i) => s + i.subtotalUSD, 0);
  const totalBS = subtotalUSD * state.tasa;
  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  const saldoRestanteUSD = Math.max(0, subtotalUSD - totalPagadoUSD);
  const saldoRestanteBS = saldoRestanteUSD * state.tasa;

  const matches = search.trim().length > 0 
    ? state.productos
        .filter(p => p.activo && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())))
        .slice(0, 8)
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
      nuevoCarrito.push({ 
        productoId: pid, 
        nombre: p.nombre, 
        precioUnitUSD: p.precioUSD, 
        cantidad: 1, 
        subtotalUSD: p.precioUSD 
      });
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

  const addPago = () => {
    let monto = parseFloat(montoInput);
    if (isNaN(monto) || monto <= 0) {
      monto = metodoActual === 'efectivo_usd' ? saldoRestanteUSD : saldoRestanteBS;
    }
    let montoUSD = (metodoActual === 'efectivo_usd' || metodoActual === 'zelle') ? monto : monto / state.tasa;
    let montoBS = (metodoActual === 'efectivo_usd' || metodoActual === 'zelle') ? monto * state.tasa : monto;
    
    if (montoUSD > (saldoRestanteUSD + 0.01)) return alert("El monto excede el saldo pendiente.");
    
    setPagos([...pagos, { metodo: metodoActual, montoUSD, montoBS }]);
    setMontoInput('');
    setShowMultiModal(false);
  };

  const ejecutarVenta = () => {
    if (state.carrito.length === 0) return;
    if (saldoRestanteUSD > 0.01) {
      setShowCreditModal(true);
      return;
    }
    procesarVentaFinal('completada');
  };

  const procesarVentaFinal = (estado: any, cxcId: string | null = null, nombreClienteOverride: string | null = null) => {
    const ventaId = 'FAC-' + Store.uid().toUpperCase().slice(0, 6);
    
    const nuevosProductos = state.productos.map(p => {
      const item = state.carrito.find(i => i.productoId === p.id);
      return item ? { ...p, stock: p.stock - item.cantidad } : p;
    });

    const nuevaVenta: Sale = {
      id: ventaId, 
      fecha: Utils.ahora(), 
      cliente: nombreClienteOverride || cliente, 
      items: [...state.carrito],
      subtotalUSD, 
      descuentoUSD: 0, 
      totalUSD: subtotalUSD, 
      totalBS,
      metodoPago: pagos.length > 1 ? 'mixto' : (pagos[0]?.metodo || (cxcId ? 'credito' : 'efectivo_usd')), 
      estado: estado,
      cuentaCobrarId: cxcId
    };

    updateState({
      productos: nuevosProductos,
      ventas: [...state.ventas, nuevaVenta],
      carrito: [],
      acumuladoHistorico: state.acumuladoHistorico + subtotalUSD
    });

    setPagos([]);
    setCliente('Consumidor final');
    setShowCreditModal(false);
    alert('Venta procesada con éxito');
    setView('history');
  };

  return (
    <div className="flex flex-col gap-3 h-full max-w-7xl mx-auto w-full overflow-hidden">
      {/* Navegación Superior - Idéntica a la imagen */}
      <div className="flex gap-2 no-print shrink-0 overflow-x-auto pb-1">
        <button onClick={() => setView('pos')} className={`flex items-center gap-2 px-4 py-2 rounded font-black uppercase text-[11px] tracking-wider transition-all ${view === 'pos' ? 'bg-[#c8952e] text-[#0b0b0b]' : 'bg-[#1e1e1e] text-white border border-[#2a2a2a]'}`}>
          <ShoppingCart className="w-4 h-4"/> Punto de Venta
        </button>
        <button onClick={() => setView('history')} className={`flex items-center gap-2 px-4 py-2 rounded font-black uppercase text-[11px] tracking-wider transition-all ${view === 'history' ? 'bg-[#c8952e] text-[#0b0b0b]' : 'bg-[#1e1e1e] text-white border border-[#2a2a2a]'}`}>
          <History className="w-4 h-4"/> Historial
        </button>
        <button onClick={() => setView('credits')} className={`flex items-center gap-2 px-4 py-2 rounded font-black uppercase text-[11px] tracking-wider transition-all ${view === 'credits' ? 'bg-[#c8952e] text-[#0b0b0b]' : 'bg-[#1e1e1e] text-white border border-[#2a2a2a]'}`}>
          <ClipboardList className="w-4 h-4"/> Consultar Créditos
        </button>
        <button onClick={() => setShowReport('Y')} className="flex items-center gap-2 px-4 py-2 rounded font-black uppercase text-[11px] tracking-wider bg-[#1e1e1e] text-white border border-[#2a2a2a]">
          <FileText className="w-4 h-4"/> Reporte Y
        </button>
        <button onClick={() => setShowReport('Z')} className="flex items-center gap-2 px-4 py-2 rounded font-black uppercase text-[11px] tracking-wider bg-[#1e1e1e] text-white border border-[#2a2a2a]">
          <Receipt className="w-4 h-4"/> Reporte Z
        </button>
        <button onClick={() => setView('returns')} className={`flex items-center gap-2 px-4 py-2 rounded font-black uppercase text-[11px] tracking-wider transition-all ${view === 'returns' ? 'bg-[#c8952e] text-[#0b0b0b]' : 'bg-[#1e1e1e] text-white border border-[#2a2a2a]'}`}>
          <RotateCcw className="w-4 h-4"/> Devoluciones
        </button>
      </div>

      {view === 'pos' && (
        <div className="flex flex-col gap-3 flex-1 overflow-hidden">
          {/* Barra de Búsqueda */}
          <div className="relative group shrink-0">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8952e] z-10"><Barcode className="w-5 h-5" /></div>
            <input 
              ref={searchInputRef}
              className="w-full bg-[#131313] border border-[#c8952e]/40 text-white placeholder-white/30 font-black uppercase pl-14 py-3 rounded-md outline-none focus:border-[#c8952e]" 
              placeholder="Escanee o busque producto..." value={search} onChange={e => setSearch(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && matches.length >= 1 && agregar(matches[0].id)} autoFocus
            />
            {matches.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-[#1e1e1e] border border-[#2a2a2a] rounded-b-lg shadow-2xl z-[100] mt-1 overflow-hidden">
                {matches.map(p => (
                  <div key={p.id} onClick={() => agregar(p.id)} className="flex items-center justify-between p-3 hover:bg-[#c8952e]/20 cursor-pointer border-b border-[#2a2a2a]">
                    <div className="text-white text-sm font-black uppercase">{p.nombre} <span className="text-[#c8952e] text-[10px] mono ml-2">[{p.codigo}]</span></div>
                    <div className="text-[#c8952e] font-black text-sm">{Utils.fmtUSD(p.precioUSD)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-1 gap-4 overflow-hidden">
            {/* Panel Izquierdo (Controles y Totales) */}
            <div className="w-1/3 flex flex-col gap-3 h-full">
              <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-5 space-y-5 h-full flex flex-col">
                <div className="space-y-1">
                  <label className="text-white text-[11px] font-black uppercase block tracking-widest">IDENTIFICACIÓN CLIENTE</label>
                  <input className="w-full h-11 bg-[#0b0b0b] text-white border border-[#2a2a2a] rounded-md px-4 font-black uppercase outline-none focus:border-[#c8952e]" value={cliente} onChange={e => setCliente(e.target.value)} />
                </div>
                
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-white text-[11px] font-black uppercase block mb-2 tracking-widest">MÉTODOS APLICADOS</label>
                  <div className="flex-1 p-3 border border-white/10 bg-[#181818] rounded-xl overflow-y-auto space-y-2 flex flex-col items-center justify-center text-white italic text-[10px]">
                    {pagos.length === 0 ? "Sin abonos" : (
                      pagos.map((p, idx) => (
                        <div key={idx} className="w-full flex justify-between items-center p-2 bg-black/40 rounded border border-white/5 text-white">
                          <span className="font-black uppercase">{Utils.metodoLabel(p.metodo)}</span>
                          <span className="font-black text-[#c8952e]">{Utils.fmtUSD(p.montoUSD)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Caja de Saldo Restante - Estilo Imagen */}
                <div className="p-5 border border-[#3a9bdc]/30 bg-[#3a9bdc]/5 rounded-xl text-center space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <label className="text-white text-[11px] font-black uppercase block tracking-widest">SALDO RESTANTE</label>
                    <Wallet className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-4xl font-black text-[#3a9bdc]">{Utils.fmtUSD(saldoRestanteUSD)}</div>
                  
                  <div className="bg-black py-4 rounded-xl border border-white/10">
                    <label className="text-white text-[10px] font-black uppercase block mb-1 tracking-tighter">EQUIVALENTE A PAGAR</label>
                    <div className="text-3xl font-black text-white">Bs. {saldoRestanteBS.toFixed(2)}</div>
                    <button onClick={() => setShowMultiModal(true)} className="px-5 py-1.5 bg-[#c8952e] text-[#0b0b0b] rounded mt-3 text-[10px] font-black uppercase tracking-widest">Registrar Abono</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Derecho (Carrito) */}
            <div className="w-2/3 flex flex-col gap-3 overflow-hidden h-full">
              <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-xl shadow-2xl">
                {/* Cabecera del Carrito - Estilo Imagen */}
                <div className="grid grid-cols-[1fr_100px_80px_100px_110px_100px_40px] gap-2 px-5 py-4 bg-[#131313] text-white text-[11px] font-black uppercase tracking-widest">
                  <div>DESCRIPCIÓN</div><div className="text-center">CANT</div><div className="text-center">U.M.</div><div className="text-right">PRECIO ($)</div><div className="text-right">PRECIO (BS)</div><div className="text-right">TOTAL</div><div className="text-center"></div>
                </div>
                
                {/* Listado de Productos - Fondo Blanco, Texto Negro */}
                <div className="flex-1 overflow-y-auto bg-white">
                  {state.carrito.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-black/10"><ShoppingCart className="w-20 h-20 mb-2"/><p className="font-black uppercase text-sm">Esperando productos...</p></div>
                  ) : (
                    state.carrito.map((item, i) => {
                      const prod = state.productos.find(p => p.id === item.productoId);
                      return (
                        <div key={i} className="grid grid-cols-[1fr_100px_80px_100px_110px_100px_40px] gap-2 items-center px-5 py-3 border-b border-black/5 text-black">
                          <div className="flex flex-col min-w-0">
                            <div className="truncate font-black text-sm uppercase text-black leading-tight">{item.nombre}</div>
                            <div className="text-[10px] font-black text-black">{item.productoId}</div>
                          </div>
                          <div className="flex items-center justify-center gap-1 bg-[#f4f4f4] rounded-lg p-1 scale-90 border border-black/5">
                            <button onClick={() => updateQty(i, -1)} className="text-black font-black text-base px-2">-</button>
                            <span className="text-sm font-black w-4 text-center">{item.cantidad}</span>
                            <button onClick={() => updateQty(i, 1)} className="text-black font-black text-base px-2">+</button>
                          </div>
                          <div className="text-center text-[11px] font-black uppercase text-black">{prod?.cantidad || '750ml'}</div>
                          <div className="text-right text-sm font-black text-black">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                          <div className="text-right text-[11px] font-black text-black">Bs. {(item.precioUnitUSD * state.tasa).toFixed(2)}</div>
                          <div className="text-right text-sm font-black text-black">{Utils.fmtUSD(item.subtotalUSD)}</div>
                          <div className="flex justify-center"><button onClick={() => updateQty(i, -999)} className="text-black/30 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4"/></button></div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer del Carrito - Estilo Imagen */}
                <div className="p-5 bg-[#131313] border-t border-[#2a2a2a] flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-white text-[11px] font-black uppercase block tracking-widest">TOTAL FACTURA</label>
                    <div className="flex items-baseline gap-4">
                      <div className="text-5xl font-black text-[#c8952e]">{Utils.fmtUSD(subtotalUSD)}</div>
                      <div className="text-xl font-black text-white">Bs. {totalBS.toFixed(2)}</div>
                    </div>
                  </div>
                  <button onClick={ejecutarVenta} disabled={state.carrito.length === 0} className="flex items-center gap-3 px-12 py-4 bg-[#c8952e] text-[#0b0b0b] font-black uppercase text-base rounded shadow-2xl disabled:opacity-20 hover:bg-[#e6b84a] transition-all">
                    <CheckCircle2 className="w-6 h-6"/> PROCESAR
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vistas Secundarias */}
      {view === 'history' && (
        <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl flex-1 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#181818] border-b border-[#2a2a2a] px-6 py-4 flex justify-between items-center">
            <h3 className="text-white font-black uppercase tracking-widest flex items-center gap-3"><History className="text-[#c8952e]"/> Historial del Día</h3>
            <button onClick={() => setView('pos')} className="text-white font-black uppercase text-xs px-4 py-2 bg-[#2a2a2a] rounded">Cerrar</button>
          </div>
          <div className="overflow-y-auto flex-1 p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#0b0b0b]">
                <tr>
                  <th className="px-6 py-3 text-white font-black text-[10px] uppercase">Recibo</th>
                  <th className="px-6 py-3 text-white font-black text-[10px] uppercase">Fecha/Hora</th>
                  <th className="px-6 py-3 text-white font-black text-[10px] uppercase">Cliente</th>
                  <th className="px-6 py-3 text-white font-black text-[10px] uppercase">Tipo</th>
                  <th className="px-6 py-3 text-white font-black text-[10px] uppercase text-right">Total USD</th>
                  <th className="px-6 py-3 text-white font-black text-[10px] uppercase text-right">Total BS</th>
                </tr>
              </thead>
              <tbody>
                {state.ventas.map(v => (
                  <tr key={v.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3 mono text-[#c8952e] font-black text-xs">{v.id}</td>
                    <td className="px-6 py-3 text-white font-bold text-xs">{v.fecha.replace('T', ' ').slice(0, 16)}</td>
                    <td className="px-6 py-3 text-white font-black text-xs uppercase">{v.cliente}</td>
                    <td className="px-6 py-3"><span className="px-2 py-0.5 bg-white/10 text-white rounded font-black text-[9px] uppercase">{v.metodoPago}</span></td>
                    <td className="px-6 py-3 text-[#c8952e] font-black text-xs text-right">{Utils.fmtUSD(v.totalUSD)}</td>
                    <td className="px-6 py-3 text-white font-black text-xs text-right">{Utils.fmtBS(v.totalBS)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'credits' && (
        <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl flex-1 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#181818] border-b border-[#2a2a2a] px-6 py-4 flex justify-between items-center">
            <h3 className="text-white font-black uppercase tracking-widest flex items-center gap-3"><ClipboardList className="text-[#c8952e]"/> Consulta de Créditos</h3>
            <button onClick={() => setView('pos')} className="text-white font-black uppercase text-xs px-4 py-2 bg-[#2a2a2a] rounded">Cerrar</button>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-[#0b0b0b]">
                <tr>
                  <th className="px-6 py-3 text-white font-black text-[10px] uppercase">Cliente</th>
                  <th className="px-6 py-3 text-white font-black text-[10px] uppercase text-right">Monto</th>
                  <th className="px-6 py-3 text-white font-black text-[10px] uppercase text-right">Saldo</th>
                  <th className="px-6 py-3 text-white font-black text-[10px] uppercase text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {state.cxc.filter(d => d.estado !== 'pagada').map(d => (
                  <tr key={d.id} className="border-b border-white/5">
                    <td className="px-6 py-3 text-white font-black text-xs uppercase">{d.cliente}</td>
                    <td className="px-6 py-3 text-white font-bold text-xs text-right">{Utils.fmtUSD(d.montoUSD)}</td>
                    <td className="px-6 py-3 text-[#e04848] font-black text-xs text-right">{Utils.fmtUSD(d.saldoUSD)}</td>
                    <td className="px-6 py-3 text-center">
                      <button onClick={() => {
                        const m = prompt('Monto en USD a abonar:', d.saldoUSD.toString());
                        if (m) {
                          const val = parseFloat(m);
                          if (!isNaN(val)) {
                            const nuevasDeudas = state.cxc.map(item => {
                              if (item.id === d.id) {
                                const nuevoSaldo = item.saldoUSD - val;
                                return { ...item, abonadoUSD: item.abonadoUSD + val, saldoUSD: nuevoSaldo, estado: nuevoSaldo <= 0 ? 'pagada' : 'pendiente' };
                              }
                              return item;
                            });
                            updateState({ cxc: nuevasDeudas });
                            alert('Abono registrado');
                          }
                        }
                      }} className="px-3 py-1 bg-[#27ae60] text-white rounded font-black text-[9px] uppercase">Abonar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modales */}
      {showMultiModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowMultiModal(false)}></div>
          <div className="relative w-full max-w-[400px] bg-[#1e1e1e] border-2 border-[#c8952e]/40 rounded-xl shadow-2xl">
            <div className="flex justify-between items-center py-4 px-6 border-b border-white/10">
              <h3 className="text-white text-sm font-black uppercase">Registrar Pago</h3>
              <button onClick={() => setShowMultiModal(false)}><X className="text-white w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-white text-[11px] font-black uppercase">Método</label>
                <select className="w-full h-12 bg-[#0b0b0b] text-white border border-white/20 rounded px-4 font-black uppercase outline-none focus:border-[#c8952e]" value={metodoActual} onChange={e => setMetodoActual(e.target.value as any)}>
                  <option value="efectivo_usd">Efectivo USD</option><option value="efectivo_bs">Efectivo BS</option><option value="punto_venta">Punto de Venta</option><option value="pagomovil">Pago Movil</option><option value="biopago">Biopago</option><option value="zelle">Zelle</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-white text-[11px] font-black uppercase">Monto</label>
                <input type="number" className="w-full h-14 text-2xl font-black bg-[#0b0b0b] text-white border border-white/20 rounded px-4 outline-none focus:border-[#c8952e]" value={montoInput} onChange={e => setMontoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPago()} />
              </div>
              <button className="w-full h-14 bg-[#c8952e] text-[#0b0b0b] rounded font-black uppercase tracking-widest text-base" onClick={addPago}>Confirmar Abono</button>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowReport(null)}></div>
          <div className="relative bg-white text-black max-w-[420px] w-full font-mono p-8 text-[11px] leading-tight rounded shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="text-center space-y-1 mb-6">
              <h3 className="font-black text-base uppercase">{state.empresa.nombre}</h3>
              <p>RIF: {state.empresa.rif}</p>
              <h4 className="font-black border-y-2 border-black py-2 mt-4 uppercase">REPORTE "{showReport}"</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span>FECHA:</span><span>{Utils.ahora().replace('T', ' ')}</span></div>
              <div className="flex justify-between font-black text-xs mt-4"><span>TOTAL VENTAS:</span><span>{Utils.fmtUSD(state.ventas.filter(v => v.fecha.startsWith(Utils.hoy())).reduce((s, v) => s + v.totalUSD, 0))}</span></div>
              <p className="text-center mt-10">--- FIN DEL DOCUMENTO ---</p>
            </div>
            <button onClick={() => setShowReport(null)} className="w-full mt-8 py-3 bg-[#0b0b0b] text-white rounded font-black uppercase no-print">Cerrar Vista</button>
          </div>
        </div>
      )}
    </div>
  );
}
