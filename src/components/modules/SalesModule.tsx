
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
  
  // Estados para Pago Mixto
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
    setPagos([]); // Reset pagos si cambia el carrito
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
    setPagos([]); // Reset pagos
  };

  const addPago = () => {
    let monto = parseFloat(montoInput);
    // Si está vacío, asumir el saldo restante
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
    <div className="space-y-4 h-full flex flex-col max-w-5xl mx-auto w-full">
      <div className="flex gap-2 no-print">
        <button className={`btn btn-sm ${!showHistory ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowHistory(false)}>
          <ShoppingCart className="w-3.5 h-3.5" /> Punto de Venta
        </button>
        <button className={`btn btn-sm ${showHistory ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowHistory(true)}>
          <Receipt className="w-3.5 h-3.5" /> Historial
        </button>
      </div>

      {!showHistory ? (
        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8952e] z-10">
              <Barcode className="w-6 h-6" />
            </div>
            <input 
              ref={searchInputRef}
              className="form-input pl-14 py-6 text-lg bg-[#131313] border-[#c8952e]/30 focus:border-[#c8952e] shadow-xl shadow-black/20" 
              placeholder="Escanee o busque..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && matches.length >= 1 && agregar(matches[0].id)}
              autoFocus
            />
            
            {matches.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-[#1e1e1e] border border-[#2a2a2a] rounded-b-lg shadow-2xl z-[100] mt-1 overflow-hidden animate-in fade-in slide-in-from-top-1">
                {matches.map(p => (
                  <div key={p.id} onClick={() => agregar(p.id)} className="flex items-center justify-between p-4 hover:bg-[#c8952e]/10 cursor-pointer border-b border-[#2a2a2a] last:border-0 transition-colors">
                    <div>
                      <div className="font-bold text-sm">{p.nombre}</div>
                      <div className="text-[10px] text-[#5a5650] mono uppercase">{p.codigo} • {p.stock} uds.</div>
                    </div>
                    <div className="text-[#c8952e] font-display font-bold">{Utils.fmtUSD(p.precioUSD)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card flex-1 flex flex-col overflow-hidden shadow-2xl">
            <div className="card-head bg-[#131313]/50">
              <h3 className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#c8952e]" /> Carrito
              </h3>
              <button className="btn btn-sm btn-secondary text-[#e04848]" onClick={() => { updateState({ carrito: [] }); setPagos([]); }}>
                <Trash2 className="w-3.5 h-3.5" /> Vaciar
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {state.carrito.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-10 py-20">
                  <ShoppingCart className="w-20 h-20 mb-4" />
                  <p className="text-lg font-display uppercase tracking-widest">Esperando productos...</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {state.carrito.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 bg-[#0b0b0b] rounded-md border border-[#2a2a2a]">
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold text-xs uppercase">{item.nombre}</div>
                        <div className="text-[10px] text-[#5a5650] mono">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                      </div>
                      <div className="flex items-center gap-2 bg-[#131313] rounded p-1 border border-[#2a2a2a]">
                        <button className="btn-icon btn-sm h-6 w-6" onClick={() => updateQty(i, -1)}><Minus className="w-3 h-3" /></button>
                        <span className="w-6 text-center text-xs font-bold">{item.cantidad}</span>
                        <button className="btn-icon btn-sm h-6 w-6" onClick={() => updateQty(i, 1)}><Plus className="w-3 h-3" /></button>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <div className="font-display font-bold text-[#c8952e] text-sm">{Utils.fmtUSD(item.subtotalUSD)}</div>
                      </div>
                      <button className="text-[#5a5650] hover:text-[#e04848]" onClick={() => updateQty(i, -item.cantidad)}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ZONA DE COBRO DINÁMICA */}
            <div className="p-4 bg-[#131313] border-t border-[#2a2a2a] grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              
              {/* Recuadros Rojos I y II (Acumulado) */}
              <div className="space-y-2">
                <div className="p-2 border border-[#e04848]/30 bg-[#e04848]/5 rounded-lg">
                  <label className="text-[9px] text-[#e04848] font-bold uppercase block mb-1">I - Total Pagado Bs.</label>
                  <div className="text-lg font-display font-bold">{Utils.fmtBS(totalPagadoBS)}</div>
                </div>
                <div className="p-2 border border-[#e04848]/30 bg-[#e04848]/5 rounded-lg">
                  <label className="text-[9px] text-[#e04848] font-bold uppercase block mb-1">II - Total Pagado USD</label>
                  <div className="text-lg font-display font-bold">{Utils.fmtUSD(totalPagadoUSD)}</div>
                </div>
                <div className="form-group mb-0">
                  <label className="form-label text-[10px] uppercase">Cliente</label>
                  <input className="form-input h-9 text-xs" value={cliente} onChange={e => setCliente(e.target.value)} />
                </div>
              </div>

              {/* Recuadros Amarillos (Métodos Seleccionados) y Turquesa (Saldo) */}
              <div className="space-y-2">
                <div className="min-h-[74px] p-2 border border-[#warn]/30 bg-[#warn-bg] rounded-lg overflow-y-auto max-h-[80px]">
                  <label className="text-[9px] text-[#warn] font-bold uppercase block mb-1">Métodos de Pago</label>
                  {pagos.map((p, idx) => (
                    <div key={idx} className="flex justify-between text-[10px] border-b border-[#2a2a2a] py-1 last:border-0">
                      <span className="capitalize">{Utils.metodoLabel(p.metodo)}</span>
                      <span className="font-bold">{Utils.fmtUSD(p.montoUSD)}</span>
                    </div>
                  ))}
                  {pagos.length === 0 && <div className="text-[10px] opacity-30 italic">Esperando abonos...</div>}
                </div>
                
                {/* Recuadro Turquesa (Saldo Restante) */}
                <div className="p-3 border border-[#3a9bdc]/50 bg-[#3a9bdc]/10 rounded-lg text-center">
                  <label className="text-[9px] text-[#3a9bdc] font-bold uppercase block mb-1">Saldo Restante</label>
                  <div className={`text-xl font-display font-black ${saldoRestanteUSD <= 0.01 ? 'text-[#27ae60]' : 'text-[#3a9bdc]'}`}>
                    {saldoRestanteUSD <= 0.01 ? 'SALDADO - LISTO' : Utils.fmtUSD(saldoRestanteUSD)}
                  </div>
                  <div className="text-[10px] opacity-60">{Utils.fmtBS(saldoRestanteBS)}</div>
                </div>
              </div>

              {/* Totales y Acción */}
              <div className="bg-[#0b0b0b] p-4 rounded-lg border border-[#c8952e]/20 relative">
                <button 
                  onClick={() => setShowMultiModal(true)}
                  className="absolute left-4 top-4 btn-icon bg-[#c8952e]/10 text-[#c8952e] border border-[#c8952e]/20"
                  title="Abonar Pago"
                >
                  <Wallet className="w-5 h-5" />
                </button>
                
                <div className="text-right">
                  <div className="text-[10px] text-[#5a5650] uppercase tracking-widest">Total a Pagar</div>
                  <div className="text-2xl font-display font-black text-[#c8952e]">{Utils.fmtUSD(subtotalUSD)}</div>
                  <div className="text-xs text-[#8a847c]">{Utils.fmtBS(totalBS)}</div>
                </div>
                
                <button 
                  className="btn btn-primary w-full mt-4 h-12 justify-center text-sm uppercase font-bold disabled:opacity-20" 
                  disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01}
                  onClick={ejecutarVenta}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Procesar Pago
                </button>
              </div>

            </div>
          </div>
        </div>
      ) : (
        /* Historial de Ventas (Sin cambios significativos para mantener foco) */
        <div className="card shadow-xl animate-in fade-in">
          <div className="card-head"><h3>Historial Reciente</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Monto USD</th><th>Método</th></tr></thead>
              <tbody>
                {[...state.ventas].reverse().map(v => (
                  <tr key={v.id}>
                    <td className="mono text-[10px] opacity-50">{v.id.slice(-6).toUpperCase()}</td>
                    <td>{Utils.fmtFecha(v.fecha)}</td>
                    <td>{v.cliente}</td>
                    <td className="mono text-[#c8952e] font-bold">{Utils.fmtUSD(v.totalUSD)}</td>
                    <td><span className="badge badge-neutral uppercase text-[9px]">{Utils.metodoLabel(v.metodoPago)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL PEQUEÑO DE PAGO MULTI */}
      {showMultiModal && (
        <div className="modal show">
          <div className="modal-bg" onClick={() => setShowMultiModal(false)}></div>
          <div className="modal-box max-w-[340px] animate-in zoom-in-95 duration-200">
            <div className="modal-head py-3">
              <h3 className="text-sm">Registrar Abono</h3>
              <button onClick={() => setShowMultiModal(false)}><X className="w-4 h-4"/></button>
            </div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-[#181818] p-3 rounded text-center border border-[#2a2a2a]">
                <p className="text-[10px] uppercase opacity-50 mb-1">Pendiente</p>
                <p className="text-xl font-display font-bold text-[#3a9bdc]">{Utils.fmtUSD(saldoRestanteUSD)}</p>
                <p className="text-[11px] opacity-40">{Utils.fmtBS(saldoRestanteBS)}</p>
              </div>

              <div className="form-group">
                <label className="form-label text-[10px] uppercase">Método</label>
                <select className="form-select text-xs" value={metodoActual} onChange={e => setMetodoActual(e.target.value as any)}>
                  <option value="efectivo_usd">Efectivo USD</option>
                  <option value="efectivo_bs">Efectivo BS</option>
                  <option value="punto_venta">Punto de Venta (BS)</option>
                  <option value="transferencia">Transferencia (BS)</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label text-[10px] uppercase">
                  Monto a abonar ({metodoActual === 'efectivo_usd' ? 'USD' : 'BS'})
                </label>
                <input 
                  type="number" 
                  className="form-input text-lg font-bold" 
                  placeholder={metodoActual === 'efectivo_usd' ? saldoRestanteUSD.toFixed(2) : saldoRestanteBS.toFixed(2)}
                  value={montoInput}
                  onChange={e => setMontoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPago()}
                  autoFocus
                />
              </div>

              <button className="btn btn-primary w-full h-10 justify-center" onClick={addPago}>
                Aceptar Abono
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
