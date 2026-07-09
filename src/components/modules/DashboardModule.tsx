"use client";

import React from 'react';
import { AppState } from '@/lib/types';
import { Utils } from '@/lib/db-store';
import { DollarSign, Package, HandCoins, FileText, ArrowRight } from 'lucide-react';

export default function DashboardModule({ state }: { state: AppState }) {
  const hoy = Utils.hoy();
  const ventasHoy = state.ventas.filter(v => v.fecha === hoy);
  const totalHoyUSD = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
  const totalHoyBS = totalHoyUSD * state.tasa;
  
  const cxcPend = state.cxc.filter(x => x.estado !== 'pagada').reduce((s, x) => s + x.saldoUSD, 0);
  const cxpPend = state.cxp.filter(x => x.estado !== 'pagada').reduce((s, x) => s + x.saldoUSD, 0);
  const valorInv = state.productos.filter(p => p.activo).reduce((s, p) => s + p.precioUSD * p.stock, 0);
  
  const bajoStock = state.productos.filter(p => p.activo && p.stock <= p.stockMinimo);
  const ultimasVentas = [...state.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi amber">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-[#c8952e]" />
            <span className="text-white text-[10px] font-black uppercase">Ventas de hoy</span>
          </div>
          <div className="text-2xl font-black text-white">{Utils.fmtUSD(totalHoyUSD)}</div>
          <div className="text-[11px] font-bold text-white/50">{Utils.fmtBS(totalHoyBS)} • {ventasHoy.length} trans.</div>
        </div>
        
        <div className="kpi green">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-[#27ae60]" />
            <span className="text-white text-[10px] font-black uppercase">Valor Inventario</span>
          </div>
          <div className="text-2xl font-black text-white">{Utils.fmtUSD(valorInv)}</div>
          <div className="text-[11px] font-bold text-white/50">{Utils.fmtBS(valorInv * state.tasa)}</div>
        </div>

        <div className="kpi red">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins className="w-4 h-4 text-[#e04848]" />
            <span className="text-white text-[10px] font-black uppercase">Por Cobrar</span>
          </div>
          <div className="text-2xl font-black text-[#e04848]">{Utils.fmtUSD(cxcPend)}</div>
          <div className="text-[11px] font-bold text-white/50">{Utils.fmtBS(cxcPend * state.tasa)}</div>
        </div>

        <div className="kpi blue">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-[#3a9bdc]" />
            <span className="text-white text-[10px] font-black uppercase">Por Pagar</span>
          </div>
          <div className="text-2xl font-black text-[#3a9bdc]">{Utils.fmtUSD(cxpPend)}</div>
          <div className="text-[11px] font-bold text-white/50">{Utils.fmtBS(cxpPend * state.tasa)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="card">
            <div className="card-head">
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Últimas Transacciones</h3>
              <button className="text-[10px] text-[#c8952e] font-black uppercase flex items-center gap-1">Ver todas <ArrowRight className="w-3 h-3"/></button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="uppercase font-black">Recibo</th>
                    <th className="uppercase font-black">Cliente</th>
                    <th className="uppercase font-black">Monto USD</th>
                    <th className="uppercase font-black">Método</th>
                    <th className="uppercase font-black">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasVentas.map(v => (
                    <tr key={v.id}>
                      <td className="mono text-white text-xs">{v.id}</td>
                      <td className="text-white font-bold text-xs uppercase">{v.cliente}</td>
                      <td className="text-[#c8952e] font-black text-xs">{Utils.fmtUSD(v.totalUSD)}</td>
                      <td><span className="text-[9px] font-black uppercase px-2 py-0.5 bg-white/5 rounded">{Utils.metodoLabel(v.metodoPago)}</span></td>
                      <td><span className="badge badge-ok font-black text-[9px] uppercase">{v.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="card h-full">
            <div className="card-head">
              <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-[#e04848]" /> Alertas de Stock
              </h3>
            </div>
            <div className="card-body space-y-3">
              {bajoStock.length === 0 ? (
                <div className="py-10 text-center text-white/20 font-black uppercase italic text-xs">Todo en orden</div>
              ) : (
                bajoStock.map(p => (
                  <div key={p.id} className="p-3 bg-white/5 rounded border border-white/5 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-white truncate max-w-[120px]">{p.nombre}</span>
                      <span className="text-[8px] font-bold text-white/40 uppercase">{p.categoria}</span>
                    </div>
                    <span className="px-2 py-1 bg-[#e04848]/20 text-[#e04848] rounded font-black text-[9px]">{p.stock} UDS</span>
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