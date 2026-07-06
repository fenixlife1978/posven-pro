
"use client";

import React, { useState } from 'react';
import { AppState, SaleItem, Sale } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, ChevronDown } from 'lucide-react';

export default function SalesModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [cliente, setCliente] = useState('Consumidor final');
  const [metodo, setMetodo] = useState('efectivo_usd');

  const prods = state.productos.filter(p => 
    p.activo && 
    (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())) &&
    (catFilter ? p.categoria === catFilter : true)
  );

  const subtotalUSD = state.carrito.reduce((s, i) => s + i.subtotalUSD, 0);
  const totalBS = subtotalUSD * state.tasa;

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
  };

  const ejecutarVenta = () => {
    if (state.carrito.length === 0) return;
    
    const ventaId = Store.uid();
    const hoy = Utils.hoy();
    const ahora = Utils.ahora();
    
    // Update stock and movements
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
      totalBS: subtotalUSD * state.tasa,
      metodoPago: metodo as any,
      estado: 'completada'
    };

    updateState({
      productos: nuevosProductos,
      movimientos: nuevosMovimientos,
      ventas: [...state.ventas, nuevaVenta],
      carrito: []
    });
    
    setCliente('Consumidor final');
    alert('Venta procesada con éxito');
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex gap-2">
        <button className={`btn btn-sm ${!showHistory ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowHistory(false)}>Punto de Venta</button>
        <button className={`btn btn-sm ${showHistory ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowHistory(true)}>Historial</button>
      </div>

      {!showHistory ? (
        <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#5a5650]" />
                <input 
                  className="form-input pl-10" 
                  placeholder="Buscar producto..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
              <select className="form-select w-auto" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">Todas</option>
                {Array.from(new Set(state.productos.map(p => p.categoria))).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {prods.map(p => (
                <div key={p.id} onClick={() => agregar(p.id)} className={`bg-[#181818] border border-[#2a2a2a] p-4 rounded-md cursor-pointer hover:border-[#c8952e] transition-all text-center ${p.stock <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <div className="text-[0.65rem] text-[#5a5650] uppercase mb-1">{p.categoria}</div>
                  <div className="text-[0.82rem] font-semibold h-8 line-clamp-2 mb-2">{p.nombre}</div>
                  <div className="font-display font-bold text-[#c8952e] text-lg">{Utils.fmtUSD(p.precioUSD)}</div>
                  <div className="text-[0.68rem] text-[#5a5650] mt-1">{p.stock} uds</div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full lg:w-[380px] bg-[#181818] border border-[#2a2a2a] rounded-lg flex flex-col sticky top-0 h-fit max-h-[calc(100vh-160px)]">
            <div className="p-4 border-b border-[#2a2a2a] flex justify-between items-center font-display font-bold">
              <span>Carrito</span>
              <button className="text-[#e04848]" onClick={() => updateState({ carrito: [] })}><Trash2 className="w-4 h-4" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {state.carrito.length === 0 ? (
                <div className="text-center py-10 opacity-30 flex flex-col items-center">
                  <ShoppingCart className="w-10 h-10 mb-2" />
                  <p className="text-sm">Carrito vacío</p>
                </div>
              ) : (
                state.carrito.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 border-b border-[#2a2a2a] text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{item.nombre}</div>
                      <div className="text-[0.7rem] text-[#5a5650]">{Utils.fmtUSD(item.precioUnitUSD)} c/u</div>
                    </div>
                    <div className="flex items-center gap-2 bg-[#0b0b0b] rounded p-1 border border-[#2a2a2a]">
                      <button onClick={() => updateQty(i, -1)}><Minus className="w-3 h-3" /></button>
                      <span className="w-6 text-center text-xs font-bold">{item.cantidad}</span>
                      <button onClick={() => updateQty(i, 1)}><Plus className="w-3 h-3" /></button>
                    </div>
                    <div className="font-display font-bold text-[#c8952e] min-w-[60px] text-right">{Utils.fmtUSD(item.subtotalUSD)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-[#131313] border-t border-[#2a2a2a] space-y-3">
              <div className="space-y-2">
                <input className="form-input text-sm" placeholder="Cliente" value={cliente} onChange={e => setCliente(e.target.value)} />
                <select className="form-select text-sm" value={metodo} onChange={e => setMetodo(e.target.value)}>
                  <option value="efectivo_usd">Efectivo USD</option>
                  <option value="efectivo_bs">Efectivo BS</option>
                  <option value="punto_venta">Punto de Venta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="credito">Credito</option>
                </select>
              </div>
              <div className="pt-2 border-t border-[#2a2a2a]">
                <div className="flex justify-between text-xs text-[#5a5650]"><span>Total BS</span><span>{Utils.fmtBS(totalBS)}</span></div>
                <div className="flex justify-between text-xl font-bold text-[#c8952e] mt-1"><span>Total</span><span>{Utils.fmtUSD(subtotalUSD)}</span></div>
              </div>
              <button 
                className="btn btn-primary w-full py-3 justify-center text-lg disabled:opacity-50" 
                disabled={state.carrito.length === 0}
                onClick={ejecutarVenta}
              >
                Cobrar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Total USD</th>
                  <th>Total BS</th>
                  <th>Metodo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {state.ventas.map(v => (
                  <tr key={v.id}>
                    <td className="mono text-xs opacity-50">{v.id.slice(-6).toUpperCase()}</td>
                    <td>{Utils.fmtFecha(v.fecha)}</td>
                    <td>{v.cliente}</td>
                    <td className="mono text-[#c8952e]">{Utils.fmtUSD(v.totalUSD)}</td>
                    <td className="mono opacity-70">{Utils.fmtBS(v.totalBS)}</td>
                    <td>{Utils.metodoLabel(v.metodoPago)}</td>
                    <td><button className="btn btn-sm btn-secondary">Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
