
"use client";

import React, { useState } from 'react';
import { AppState } from '@/lib/types';
import { Utils } from '@/lib/db-store';

export default function ReportsModule({ state }: { state: AppState }) {
  const [tab, setTab] = useState('ventas');
  
  const totalVentas = state.ventas.reduce((s, v) => s + v.totalUSD, 0);
  const totalCosto = state.ventas.reduce((s, v) => {
    return s + v.items.reduce((si, item) => {
      const p = state.productos.find(x => x.id === item.productoId);
      return si + (p ? p.costoUSD * item.cantidad : 0);
    }, 0);
  }, 0);
  
  const ganancia = totalVentas - totalCosto;

  return (
    <div className="space-y-6">
      <div className="tabs flex border-b border-[#2a2a2a] mb-6 overflow-x-auto">
        <button onClick={() => setTab('ventas')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-all ${tab === 'ventas' ? 'border-[#c8952e] text-[#c8952e]' : 'border-transparent text-[#5a5650]'}`}>Ventas</button>
        <button onClick={() => setTab('rentabilidad')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-all ${tab === 'rentabilidad' ? 'border-[#c8952e] text-[#c8952e]' : 'border-transparent text-[#5a5650]'}`}>Rentabilidad</button>
      </div>

      {tab === 'ventas' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="kpi amber">
               <div className="kpi-label">Ventas Totales</div>
               <div className="kpi-value">{Utils.fmtUSD(totalVentas)}</div>
             </div>
             <div className="kpi green">
               <div className="kpi-label">Transacciones</div>
               <div className="kpi-value">{state.ventas.length}</div>
             </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Detalle de Ventas</h3></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Monto USD</th><th>Metodo</th></tr></thead>
                <tbody>
                  {state.ventas.map(v => (
                    <tr key={v.id}>
                      <td>{Utils.fmtFecha(v.fecha)}</td>
                      <td>{v.cliente}</td>
                      <td className="mono">{Utils.fmtUSD(v.totalUSD)}</td>
                      <td>{Utils.metodoLabel(v.metodoPago)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="kpi amber"><div className="kpi-label">Venta Total</div><div className="kpi-value">{Utils.fmtUSD(totalVentas)}</div></div>
            <div className="kpi red"><div className="kpi-label">Costo Total</div><div className="kpi-value">{Utils.fmtUSD(totalCosto)}</div></div>
            <div className="kpi green">
              <div className="kpi-label">Ganancia Neta</div>
              <div className="kpi-value">{Utils.fmtUSD(ganancia)}</div>
              <div className="kpi-sub">Margen: {totalVentas > 0 ? ((ganancia/totalVentas)*100).toFixed(1) : 0}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
