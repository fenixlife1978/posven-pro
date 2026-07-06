
"use client";

import React, { useState } from 'react';
import { AppState, Product } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { Plus, Search, Edit2, PackagePlus, Trash2 } from 'lucide-react';

export default function InventoryModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const prods = state.productos.filter(p => 
    p.activo && 
    (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())) &&
    (catFilter ? p.categoria === catFilter : true)
  );

  const eliminar = (id: string) => {
    if (!confirm('¿Seguro que desea eliminar este producto?')) return;
    const nuevos = state.productos.map(p => p.id === id ? { ...p, activo: false } : p);
    updateState({ productos: nuevos });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex gap-4 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#5a5650]" />
            <input className="form-input pl-10" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select w-auto" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">Todas las categorias</option>
            {Array.from(new Set(state.productos.map(p => p.categoria))).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn btn-primary"><Plus className="w-4 h-4" /> Nuevo Producto</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cod.</th>
                <th>Nombre</th>
                <th>Cat.</th>
                <th>Costo USD</th>
                <th>P. Venta USD</th>
                <th>P. Venta BS</th>
                <th>Stock</th>
                <th>Min.</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {prods.map(p => (
                <tr key={p.id}>
                  <td className="mono opacity-60 text-xs">{p.codigo}</td>
                  <td className="font-medium">{p.nombre}</td>
                  <td><span className="badge badge-neutral">{p.categoria}</span></td>
                  <td className="mono">{Utils.fmtUSD(p.costoUSD)}</td>
                  <td className="mono text-[#c8952e]">{Utils.fmtUSD(p.precioUSD)}</td>
                  <td className="mono opacity-60">{Utils.fmtBS(p.precioUSD * state.tasa)}</td>
                  <td>
                    <span className={`badge ${p.stock <= p.stockMinimo ? 'badge-err' : 'badge-ok'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="opacity-50">{p.stockMinimo}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn-icon text-[#c8952e]"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button className="btn-icon text-[#3a9bdc]"><PackagePlus className="w-3.5 h-3.5" /></button>
                      <button className="btn-icon text-[#e04848]" onClick={() => eliminar(p.id)}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
