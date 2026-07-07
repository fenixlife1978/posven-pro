"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AppState, SaleItem, Sale, PaymentMethod } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Receipt, 
  Barcode, 
  Wallet, 
  X, 
  CheckCircle2, 
  DollarSign, 
  Banknote 
} from 'lucide-react';

interface PagoRealizado {
  metodo: PaymentMethod;
  montoUSD: number;
  montoBS: number;
}

export default function SalesModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [cliente, setCliente] = useState('Consumidor final');
  
  const [pagos, setPagos] = useState<PagoRealizado[]>([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [metodoActual, setMetodoActual] = useState<PaymentMethod>('efectivo_usd');
  const [montoInput, setMontoInput] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  const subtotalUSD = state.carrito.reduce((s, i) => s + i.subtotalUSD, 0);
  const totalBS = subtotalUSD * state.tasa;

  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  const totalPagadoBS = pagos.reduce((s, p) => s + p.montoBS, 0);
  
  const saldoRestanteUSD = Math.max(0, subtotalUSD - totalPagadoUSD);
  const saldoRestanteBS = Math.max(0, totalBS - totalPagadoBS);

  const matches = search.trim().length > 0 
    ? state.productos
        .filter(p => 
          p.activo && 
          (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase()))
        )
        .sort((a, b) => {
          const s = search.toLowerCase();
          const aCode = a.codigo.toLowerCase();
          const bCode = b.codigo.toLowerCase();
          if (aCode === s && bCode !== s) return -1;
          if (aCode.startsWith(s) && !bCode.startsWith(s)) return -1;
          return 0;
        })
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
    
    if (n <= 0) {
      nuevo.splice(idx, 1);
    } else if (p && n <= p.stock) {
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

    let montoUSD = 0;
    let montoBS = 0;

    if (metodoActual === 'efectivo_usd') {
      montoUSD = monto;
      montoBS = monto * state.tasa;
    } else {
      montoBS = monto;
      montoUSD = monto / state.tasa;
    }

    if (montoUSD > (saldoRestanteUSD + 0.01)) {
      alert("El monto excede el saldo pendiente");
      return;
    }

    setPagos([...pagos, { metodo: metodoActual, montoUSD, montoBS }]);
    setMontoInput('');
    setShowMultiModal(false);
  };

  const ejecutarVenta = () => {
    if (state.carrito.length === 0 || saldoRestanteUSD > 0.01) return;
    
    const ventaId = Store.uid();
    const hoy = Utils.hoy();
    const ahora = Utils.ahora();
    
    const nuevosProductos = [...state.productos];
    const nuevosMovimientos = [...state.movimientos];
    
    state.carrito.forEach(item => {
      const p = nuevosProductos.find(x => x.id === item.productoId);
      if (p) {
        const antes = p.stock;
        p.stock -= item.cantidad;
        nuevosMovimientos.push({
          id: Store.uid(),
          productoId: item.productoId,
          tipo: 'venta',
          cantidad: item.cantidad,
          stockAntes: antes,
          stockDespues: p.stock,
          fecha: ahora,
          referencia: `Venta ${ventaId.slice(-6)}`
        });
      }
    });

    const nuevaVenta: Sale = {
      id: ventaId,
      fecha: hoy,
      cliente,
      items: [...state.carrito],
      subtotalUSD,
      descuentoUSD: 0,
      totalUSD: subtotalUSD,
      totalBS: totalBS,
      metodoPago: pagos.length > 1 ? 'mixto' : (pagos[0]?.metodo || 'efectivo_usd'),
      estado: 'completada'
    };

    updateState({
      productos: nuevosProductos,
      movimientos: nuevosMovimientos,
      ventas: [...state.ventas, nuevaVenta],
      carrito: []
    });
    
    setPagos([]);
    setCliente('Consumidor final');
    alert('Venta procesada con éxito');
  };

  return (
    <div className="flex flex-col gap-2 h-[calc(100vh-100px)] max-w-7xl mx-auto w-full overflow-hidden">
      <div className="flex gap-2 no-print shrink-0">
        <button className={`btn btn-sm ${!showHistory ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowHistory(false)}>
          <ShoppingCart className="w-3.5 h-3.5" /> Punto de Venta
        </button>
        <button className={`btn btn-sm ${showHistory ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowHistory(true)}>
          <Receipt className="w-3.5 h-3.5" /> Historial
        </button>
      </div>

      {!showHistory ? (
        <div className="flex flex-col gap-2 flex-1 overflow-hidden">
          <div className="relative group shrink-0">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8952e] z-10">
              <Barcode className="w-5 h-5" />
            </div>
            <input 
              ref={searchInputRef}
              className="form-input pl-14 py-2.5 text-base bg-[#131313] border-[#c8952e]/50 focus:border-[#c8952e] shadow-xl text-white font-bold" 
              placeholder="Escanee o busque producto..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && matches.length >= 1 && agregar(matches[0].id)}
              autoFocus
            />
            
            {matches.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-[#1e1e1e] border border-[#333] rounded-b-lg shadow-2xl z-[100] mt-1 overflow-hidden">
                {matches.map(p => (
                  <div key={p.id} onClick={() => agregar(p.id)} className="flex items-center justify-between p-3 hover:bg-[#c8952e]/20 cursor-pointer border-b border-[#2a2a2a] last:border-0">
                    <div>
                      <div className="font-bold text-sm text-white">{p.nombre}</div>
                      <div className="text-[10px] text-white mono uppercase font-bold">{p.codigo} • {p.stock} uds.</div>
                    </div>
                    <div className="text-[#c8952e] font-display font-black text-base">{Utils.fmtUSD(p.precioUSD)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-1 gap-3 overflow-hidden">
            
            <div className="w-1/3 flex flex-col gap-2 overflow-hidden">
              <div className="card p-3 space-y-3 bg-[#131313] border-[#2a2a2a] h-full flex flex-col">
                
                <div className="form-group mb-0">
                  <label className="form-label text-[10px] uppercase font-bold text-[#c8952e] mb-1 tracking-widest">Identificación Cliente</label>
                  <input className="form-input h-10 text-sm bg-[#0b0b0b] border-[#333] text-white font-bold" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre..." />
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-[9px] text-white font-black uppercase tracking-widest block mb-1">Métodos Aplicados</label>
                  <div className="flex-1 p-2 border border-white/10 bg-[#181818] rounded-lg overflow-y-auto">
                    {pagos.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-[11px] border-b border-[#333] py-2 last:border-0">
                        <span className="capitalize text-white font-bold">{Utils.metodoLabel(p.metodo)}</span>
                        <span className="font-black text-[#c8952e]">{Utils.fmtUSD(p.montoUSD)}</span>
                      </div>
                    ))}
                    {pagos.length === 0 && <div className="text-[11px] text-white/40 italic py-4 text-center font-bold">Sin abonos registrados</div>}
                  </div>
                </div>

                <div className="p-3 border-2 border-[#3498db] bg-[#3498db]/10 rounded-xl text-center space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <label className="text-[10px] text-[#3498db] font-black uppercase tracking-widest block">Saldo Restante</label>
                    <button 
                      onClick={() => setShowMultiModal(true)}
                      className="btn-icon h-8 w-8 bg-[#c8952e] text-black border border-black/20"
                    >
                      <Wallet className="w-4 h-4" />
                    </button>
                  </div>
                  <div className={`text-3xl font-display font-black tracking-tight ${saldoRestanteUSD <= 0.01 ? 'text-[#2ecc71]' : 'text-[#3498db]'}`}>
                    {saldoRestanteUSD <= 0.01 ? 'SALDADO' : Utils.fmtUSD(saldoRestanteUSD)}
                  </div>
                  
                  <div className="bg-[#000000] py-3 px-2 rounded-xl border-2 border-[#333]">
                    <div className="text-[9px] text-white uppercase font-black mb-1 tracking-widest text-center">EQUIVALENTE A PAGAR</div>
                    <div className="text-2xl font-display font-black text-white tracking-tighter text-center">
                      {Utils.fmtBS(saldoRestanteBS)}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="w-2/3 flex flex-col gap-2 overflow-hidden">
              <div className="card flex-1 flex flex-col overflow-hidden border-[#2a2a2a] bg-[#131313]">
                
                {/* Cabecera del Carrito */}
                <div className="grid grid-cols-[1fr_85px_60px_80px_80px_85px_35px] gap-2 px-3 py-2 bg-[#1a1a1a] border-b-2 border-[#333] text-[9px] uppercase font-black text-white tracking-widest">
                  <div>Descripción</div>
                  <div className="text-center">Cant</div>
                  <div className="text-center">U.M.</div>
                  <div className="text-right">Precio ($)</div>
                  <div className="text-right">Precio (Bs)</div>
                  <div className="text-right">Total</div>
                  <div className="text-center"></div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                  {state.carrito.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/20">
                      <ShoppingCart className="w-20 h-20 mb-3" />
                      <p className="text-xs uppercase tracking-[0.2em] font-black">Carrito Vacío</p>
                    </div>
                  ) : (
                    state.carrito.map((item, i) => {
                      const product = state.productos.find(p => p.id === item.productoId);
                      return (
                        <div key={i} className="grid grid-cols-[1fr_85px_60px_80px_80px_85px_35px] gap-2 items-center px-2 py-2 bg-[#0b0b0b] rounded-lg border border-[#333] hover:border-[#c8952e] transition-colors">
                          <div className="flex flex-col min-w-0">
                            <div className="truncate font-black text-[11px] uppercase text-white">{item.nombre}</div>
                            <div className="text-[8px] text-white/60 mono truncate font-bold">{item.productoId}</div>
                          </div>
                          
                          <div className="flex items-center justify-center gap-2 bg-[#181818] rounded-md p-1 border border-[#333]">
                            <button className="h-5 w-5 flex items-center justify-center bg-[#222] rounded text-white hover:bg-white hover:text-black" onClick={() => updateQty(i, -1)}><Minus className="w-3 h-3" /></button>
                            <span className="w-5 text-center text-xs font-black text-[#c8952e]">{item.cantidad}</span>
                            <button className="h-5 w-5 flex items-center justify-center bg-[#222] rounded text-white hover:bg-white hover:text-black" onClick={() => updateQty(i, 1)}><Plus className="w-3 h-3" /></button>
                          </div>
                          
                          <div className="text-center text-[10px] text-white font-black">{product?.cantidad || '-'}</div>
                          
                          <div className="text-right text-[11px] mono font-black text-white">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                          <div className="text-right text-[10px] mono font-bold text-white/80">{Utils.fmtBS(item.precioUnitUSD * state.tasa)}</div>
                          
                          <div className="text-right text-xs font-display font-black text-[#c8952e]">{Utils.fmtUSD(item.subtotalUSD)}</div>
                          
                          <div className="flex justify-center">
                            <button className="text-white hover:text-[#ff4d4d] transition-colors p-1" onClick={() => updateQty(i, -item.cantidad)}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="card-foot p-3 bg-[#1a1a1a] border-t-2 border-[#333]">
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="text-[10px] text-white uppercase tracking-widest font-black mb-1">Total Factura</div>
                      <div className="flex items-baseline gap-3">
                        <div className="text-3xl font-display font-black text-[#c8952e]">{Utils.fmtUSD(subtotalUSD)}</div>
                        <div className="text-base text-white font-black">{Utils.fmtBS(totalBS)}</div>
                      </div>
                    </div>
                    
                    <div className="w-1/3">
                      <button 
                        className="btn btn-primary w-full h-12 justify-center text-sm uppercase font-black tracking-[0.15em] disabled:opacity-20 shadow-xl" 
                        disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01}
                        onClick={ejecutarVenta}
                      >
                        <CheckCircle2 className="w-5 h-5 mr-2" /> Procesar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      ) : (
        <div className="card shadow-2xl animate-in fade-in flex-1 overflow-hidden bg-[#131313] border-[#333]">
          <div className="card-head py-3 px-4 border-b-2 border-[#333]">
            <h3 className="text-sm font-black text-[#c8952e] uppercase tracking-widest">Historial de Ventas</h3>
          </div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-[#1a1a1a] sticky top-0 z-10">
                <tr>
                  <th className="font-black">ID</th>
                  <th className="font-black">Fecha</th>
                  <th className="font-black">Cliente</th>
                  <th className="font-black">Monto USD</th>
                  <th className="font-black">Método</th>
                </tr>
              </thead>
              <tbody>
                {[...state.ventas].reverse().map(v => (
                  <tr key={v.id} className="hover:bg-white/5 border-b border-[#222]">
                    <td className="mono text-[10px] text-[#c8952e] font-black">{v.id.slice(-6).toUpperCase()}</td>
                    <td className="text-white font-bold">{Utils.fmtFecha(v.fecha)}</td>
                    <td className="text-white font-bold">{v.cliente}</td>
                    <td className="mono text-[#c8952e] font-black text-sm">{Utils.fmtUSD(v.totalUSD)}</td>
                    <td><span className="badge badge-neutral uppercase text-[9px] font-black">{Utils.metodoLabel(v.metodoPago)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showMultiModal && (
        <div className="modal show">
          <div className="modal-bg" onClick={() => setShowMultiModal(false)}></div>
          <div className="modal-box max-w-[340px] border-2 border-[#333]">
            <div className="modal-head py-3 px-5 border-b-2 border-[#333]">
              <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Abonar a Cuenta</h3>
              <button onClick={() => setShowMultiModal(false)} className="text-white hover:text-[#c8952e]"><X className="w-5 h-5"/></button>
            </div>
            <div className="modal-body p-5 space-y-5">
              <div className="bg-[#000] p-4 rounded-xl text-center border-2 border-[#3498db]">
                <p className="text-[10px] uppercase text-white mb-1 font-black tracking-widest">Saldo Pendiente</p>
                <p className="text-2xl font-display font-black text-[#3498db]">{Utils.fmtUSD(saldoRestanteUSD)}</p>
                <p className="text-xs text-white font-bold mt-1">{Utils.fmtBS(saldoRestanteBS)}</p>
              </div>

              <div className="form-group mb-0">
                <label className="form-label text-[10px] uppercase font-black text-white mb-1">Seleccionar Método</label>
                <select className="form-select h-12 text-sm font-bold bg-[#0b0b0b] border-[#333] text-white" value={metodoActual} onChange={e => setMetodoActual(e.target.value as any)}>
                  <option value="efectivo_usd">Efectivo USD</option>
                  <option value="efectivo_bs">Efectivo Bs.</option>
                  <option value="biopago">Biopago</option>
                  <option value="pagomovil">PagoMovil</option>
                  <option value="punto_venta">Punto de Venta</option>
                  <option value="zelle">Zelle</option>
                </select>
              </div>

              <div className="form-group mb-0">
                <label className="form-label text-[10px] uppercase font-black text-white mb-1">
                  Monto a Pagar ({metodoActual === 'efectivo_usd' ? 'USD' : 'BS'})
                </label>
                <input 
                  type="number" 
                  className="form-input h-14 text-xl font-black text-[#c8952e] bg-[#0b0b0b] border-[#333]" 
                  placeholder={metodoActual === 'efectivo_usd' ? saldoRestanteUSD.toFixed(2) : saldoRestanteBS.toFixed(2)}
                  value={montoInput}
                  onChange={e => setMontoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPago()}
                  autoFocus
                />
              </div>

              <button className="btn btn-primary w-full h-12 justify-center font-black uppercase text-xs tracking-widest shadow-lg" onClick={addPago}>
                Confirmar Abono
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}