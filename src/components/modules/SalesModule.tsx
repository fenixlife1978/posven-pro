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
    <div className="space-y-4 h-full flex flex-col max-w-7xl mx-auto w-full">
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
          {/* BUSCADOR SUPERIOR */}
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8952e] z-10">
              <Barcode className="w-6 h-6" />
            </div>
            <input 
              ref={searchInputRef}
              className="form-input pl-14 py-6 text-lg bg-[#131313] border-[#c8952e]/30 focus:border-[#c8952e] shadow-xl shadow-black/20" 
              placeholder="Escanee o busque por código o nombre..." 
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

          <div className="flex flex-1 gap-4 overflow-hidden mb-4">
            
            {/* PANEL DE CONTROL (1/3 IZQUIERDA) */}
            <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">
              <div className="card p-4 space-y-6 bg-[#131313] border-[#2a2a2a] shadow-xl h-full flex flex-col">
                
                {/* Datos Cliente */}
                <div className="form-group mb-0">
                  <label className="form-label text-[10px] uppercase font-bold text-[#c8952e] mb-2 tracking-widest">Identificación Cliente</label>
                  <input className="form-input h-11 text-sm bg-[#0b0b0b] border-[#2a2a2a]" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre o Cédula..." />
                </div>

                {/* Métodos de Pago Aplicados */}
                <div className="flex-1 space-y-2">
                  <label className="text-[9px] text-[#8a847c] font-bold uppercase tracking-widest block">Métodos Aplicados</label>
                  <div className="h-[200px] p-3 border border-white/5 bg-[#181818] rounded-lg overflow-y-auto shadow-inner">
                    {pagos.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-[11px] border-b border-[#2a2a2a] py-2 last:border-0">
                        <span className="capitalize text-[#8a847c]">{Utils.metodoLabel(p.metodo)}</span>
                        <span className="font-bold text-[#c8952e]">{Utils.fmtUSD(p.montoUSD)}</span>
                      </div>
                    ))}
                    {pagos.length === 0 && <div className="text-[11px] opacity-20 italic py-4 text-center">No hay abonos registrados</div>}
                  </div>
                </div>

                {/* Saldo Restante e Indicador Bs */}
                <div className="p-4 border border-[#3a9bdc]/30 bg-[#3a9bdc]/5 rounded-xl text-center space-y-4">
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <label className="text-[9px] text-[#3a9bdc] font-bold uppercase tracking-widest block">Saldo Restante</label>
                      <button 
                        onClick={() => setShowMultiModal(true)}
                        className="btn-icon h-7 w-7 bg-[#c8952e]/10 text-[#c8952e] border border-[#c8952e]/20 hover:bg-[#c8952e] hover:text-black transition-all"
                        title="Registrar Abono"
                      >
                        <Wallet className="w-4 h-4" />
                      </button>
                    </div>
                    <div className={`text-3xl font-display font-black tracking-tight ${saldoRestanteUSD <= 0.01 ? 'text-[#27ae60]' : 'text-[#3a9bdc]'}`}>
                      {saldoRestanteUSD <= 0.01 ? 'SALDADO' : Utils.fmtUSD(saldoRestanteUSD)}
                    </div>
                  </div>
                  
                  <div className="bg-black py-4 px-3 rounded-lg border border-[#2a2a2a] shadow-2xl">
                    <div className="text-[8px] text-[#5a5650] uppercase font-bold mb-1 tracking-widest">Equivalente a pagar</div>
                    <div className="text-3xl font-display font-black text-white tracking-tighter">
                      {Utils.fmtBS(saldoRestanteBS)}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* CARRITO Y ACCION FINAL (2/3 DERECHA) */}
            <div className="w-2/3 flex flex-col gap-4">
              <div className="card flex-1 flex flex-col overflow-hidden shadow-2xl border-[#2a2a2a]">
                <div className="card-head bg-[#131313]/50">
                  <h3 className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-[#c8952e]" /> Carrito de Venta
                  </h3>
                  <button className="btn btn-sm btn-secondary text-[#e04848] border-none" onClick={() => { updateState({ carrito: [] }); setPagos([]); }}>
                    <Trash2 className="w-3.5 h-3.5" /> Vaciar Carrito
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3">
                  {state.carrito.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 py-20">
                      <ShoppingCart className="w-24 h-24 mb-4" />
                      <p className="text-xl font-display uppercase tracking-widest">Esperando Productos...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {state.carrito.map((item, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 bg-[#0b0b0b] rounded-lg border border-[#2a2a2a] hover:border-[#c8952e]/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-bold text-xs uppercase tracking-tight">{item.nombre}</div>
                            <div className="text-[10px] text-[#5a5650] mono font-bold uppercase mt-1">{item.productoId} • {Utils.fmtUSD(item.precioUnitUSD)}</div>
                          </div>
                          <div className="flex items-center gap-3 bg-[#131313] rounded-lg p-1.5 border border-[#2a2a2a]">
                            <button className="btn-icon btn-sm h-7 w-7 bg-[#181818]" onClick={() => updateQty(i, -1)}><Minus className="w-3 h-3" /></button>
                            <span className="w-8 text-center text-sm font-black">{item.cantidad}</span>
                            <button className="btn-icon btn-sm h-7 w-7 bg-[#181818]" onClick={() => updateQty(i, 1)}><Plus className="w-3 h-3" /></button>
                          </div>
                          <div className="text-right min-w-[100px]">
                            <div className="font-display font-black text-[#c8952e] text-lg">{Utils.fmtUSD(item.subtotalUSD)}</div>
                          </div>
                          <button className="text-[#5a5650] hover:text-[#e04848] p-2" onClick={() => updateQty(i, -item.cantidad)}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SECCION FINAL DE TOTAL Y PROCESO (EN LA PARTE INFERIOR DEL CARRITO) */}
              <div className="card p-4 bg-[#131313] border-[#c8952e]/20 shadow-xl">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="text-[10px] text-[#5a5650] uppercase tracking-widest font-bold mb-1">Total Factura</div>
                    <div className="flex items-baseline gap-3">
                      <div className="text-4xl font-display font-black text-[#c8952e]">{Utils.fmtUSD(subtotalUSD)}</div>
                      <div className="text-lg text-[#8a847c] font-bold">{Utils.fmtBS(totalBS)}</div>
                    </div>
                  </div>
                  
                  <div className="w-1/3">
                    <button 
                      className="btn btn-primary w-full h-16 justify-center text-base uppercase font-black tracking-widest disabled:opacity-20 shadow-lg shadow-[#c8952e]/5 group" 
                      disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01}
                      onClick={ejecutarVenta}
                    >
                      <CheckCircle2 className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" /> Procesar Pago
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      ) : (
        <div className="card shadow-xl animate-in fade-in">
          <div className="card-head"><h3>Historial Reciente de Ventas</h3></div>
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

      {/* MODAL DE ABONO MULTI-MÉTODO */}
      {showMultiModal && (
        <div className="modal show">
          <div className="modal-bg" onClick={() => setShowMultiModal(false)}></div>
          <div className="modal-box max-w-[360px] animate-in zoom-in-95 duration-200">
            <div className="modal-head py-3">
              <h3 className="text-sm font-bold uppercase tracking-widest">Registrar Abono</h3>
              <button onClick={() => setShowMultiModal(false)}><X className="w-4 h-4"/></button>
            </div>
            <div className="modal-body p-5 space-y-5">
              <div className="bg-[#181818] p-4 rounded-xl text-center border border-[#2a2a2a] shadow-inner">
                <p className="text-[10px] uppercase opacity-50 mb-1 font-bold">Saldo Pendiente</p>
                <p className="text-2xl font-display font-black text-[#3a9bdc]">{Utils.fmtUSD(saldoRestanteUSD)}</p>
                <p className="text-xs opacity-40 font-bold">{Utils.fmtBS(saldoRestanteBS)}</p>
              </div>

              <div className="form-group">
                <label className="form-label text-[10px] uppercase font-bold text-[#8a847c] mb-2">Método de Pago</label>
                <select className="form-select h-12 text-sm" value={metodoActual} onChange={e => setMetodoActual(e.target.value as any)}>
                  <option value="efectivo_usd">Efectivo USD</option>
                  <option value="efectivo_bs">Efectivo BS</option>
                  <option value="punto_venta">Punto de Venta (BS)</option>
                  <option value="transferencia">Transferencia (BS)</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label text-[10px] uppercase font-bold text-[#8a847c] mb-2">
                  Monto a recibir ({metodoActual === 'efectivo_usd' ? 'USD' : 'BS'})
                </label>
                <input 
                  type="number" 
                  className="form-input h-14 text-xl font-black text-[#c8952e]" 
                  placeholder={metodoActual === 'efectivo_usd' ? saldoRestanteUSD.toFixed(2) : saldoRestanteBS.toFixed(2)}
                  value={montoInput}
                  onChange={e => setMontoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPago()}
                  autoFocus
                />
              </div>

              <button className="btn btn-primary w-full h-12 justify-center font-black uppercase text-xs tracking-widest" onClick={addPago}>
                Confirmar Abono
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}