"use client";

import React from 'react';
import { AppState } from '@/lib/types';
import { Utils } from '@/lib/db-store';
import { Package, HandCoins, ArrowUpRight, TrendingUp } from 'lucide-react';

export default function DashboardModule({ state }: { state: AppState }) {
  const hoy = Utils.hoy();
  const ventasHoy = state.ventas.filter(v => v.fecha === hoy);
  const totalHoyUSD = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
  
  const cxcPend = state.cxc.filter(x => x.estado !== 'pagada').reduce((s, x) => s + x.saldoUSD, 0);
  const valorInv = state.productos.filter(p => p.activo).reduce((s, p) => s + p.precioUSD * p.stock, 0);
  
  const bajoStock = state.productos.filter(p => p.activo && p.stock <= p.stockMinimo);
  const ultimasVentas = [...state.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="kpi amber bg-[#c8952e]/5 border-[#c8952e]/20">
          <div className="kpi-label">Ventas Hoy (USD)</div>
          <div className="flex items-baseline gap-2">
            <div className="kpi-value text-[#c8952e]">{Utils.fmtUSD(totalHoyUSD)}</div>
            <span className="text-[10px] text-[#27ae60] font-black flex items-center"><ArrowUpRight className="w-3 h-3" /> +12%</span>
          </div>
          <div className="kpi-sub">{Utils.fmtBS(totalHoyUSD * state.tasa)}</div>
        </div>

        <div className="kpi blue bg-[#3a9bdc]/5 border-[#3a9bdc]/20">
          <div className="kpi-label">Cuentas por Cobrar</div>
          <div className="kpi-value text-[#3a9bdc]">{Utils.fmtUSD(cxcPend)}</div>
          <div className="kpi-sub">{state.cxc.filter(x => x.estado !== 'pagada').length} pendientes</div>
        </div>

        <div className="kpi green bg-[#27ae60]/5 border-[#27ae60]/20">
          <div className="kpi-label">Valor Inventario</div>
          <div className="kpi-value text-[#27ae60]">{Utils.fmtUSD(valorInv)}</div>
          <div className="kpi-sub">Mercancía activa</div>
        </div>

        <div className="kpi red bg-[#e04848]/5 border-[#e04848]/20">
          <div className="kpi-label">Alertas Stock</div>
          <div className="kpi-value text-[#e04848]">{bajoStock.length}</div>
          <div className="kpi-sub">Productos bajo el mínimo</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-head bg-[#181818]">
              <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-[#c8952e]" /> Últimos Movimientos
              </h3>
              <button className="text-[9px] font-black text-[#c8952e] uppercase hover:underline">Ver Reporte</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ref.</th>
                    <th>Cliente</th>
                    <th>Monto USD</th>
                    <th>Método</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasVentas.map(v => (
                    <tr key={v.id}>
                      <td className="mono font-bold text-white/40 text-xs">#{v.id}</td>
                      <td className="font-black uppercase text-xs">{v.cliente}</td>
                      <td className="font-black text-[#c8952e] text-xs">{Utils.fmtUSD(v.totalUSD)}</td>
                      <td className="text-[9px] font-black text-white/60 uppercase">{Utils.metodoLabel(v.metodoPago)}</td>
                      <td><span className="badge badge-ok uppercase text-[8px]">Completada</span></td>
                    </tr>
                  ))}
                  {ultimasVentas.length === 0 && <tr><td colSpan={5} className="text-center py-10 italic text-white/20">No hay ventas hoy</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-head bg-[#181818]">
              <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-[#e04848]" /> Alertas Críticas
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {bajoStock.length === 0 ? (
                <div className="py-10 text-center opacity-30">
                  <Package className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase">Stock en orden</p>
                </div>
              ) : (
                bajoStock.map(p => (
                  <div key={p.id} className="p-3 bg-black/40 border border-white/5 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-white uppercase">{p.nombre}</p>
                      <p className="text-[8px] text-white/40 uppercase">{p.categoria}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-[#e04848]">{p.stock} Uds</p>
                      <p className="text-[8px] text-white/40 font-bold">MÍN: {p.stockMinimo}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}