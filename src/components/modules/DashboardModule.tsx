"use client";

import React, { useState, useEffect } from 'react';
import { AppState } from '@/lib/types';
import { Utils } from '@/lib/db-store';
import { DollarSign, Package, HandCoins, FileText, ArrowRight, TrendingUp } from 'lucide-react';

export default function DashboardModule({ state }: { state: AppState }) {
  const [barHeights, setBarHeights] = useState<number[]>([]);

  useEffect(() => {
    setBarHeights([1, 2, 3, 4, 5, 6, 7].map(() => Math.random() * 100));
  }, []);

  const hoy = Utils.hoy();
  const ventasHoy = state.ventas.filter(v => v.fecha === hoy);
  const totalHoyUSD = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
  const totalHoyBS = totalHoyUSD * state.tasa;
  
  const cxcPend = state.cxc.filter(x => x.estado !== 'pagada').reduce((s, x) => s + x.saldoUSD, 0);
  const cxpPend = state.cxp.filter(x => x.estado !== 'pagada').reduce((s, x) => s + x.saldoUSD, 0);
  const valorInv = state.productos.filter(p => p.activo).reduce((s, p) => s + p.precioUSD * p.stock, 0);
  
  const bajoStock = state.productos.filter(p => p.activo && p.stock <= p.stockMinimo);
  const ultimasVentas = [...state.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* GRID KPI BENTO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPI 
          type="amber" 
          icon={<DollarSign />} 
          label="Ventas de hoy" 
          value={Utils.fmtUSD(totalHoyUSD)} 
          sub={`${Utils.fmtBS(totalHoyBS)} • ${ventasHoy.length} trans.`} 
        />
        <KPI 
          type="green" 
          icon={<Package />} 
          label="Valor Inventario" 
          value={Utils.fmtUSD(valorInv)} 
          sub={`${Utils.fmtBS(valorInv * state.tasa)} • ${state.productos.length} prods.`} 
        />
        <KPI 
          type="red" 
          icon={<HandCoins />} 
          label="Por Cobrar" 
          value={Utils.fmtUSD(cxcPend)} 
          sub={`${Utils.fmtBS(cxcPend * state.tasa)}`} 
        />
        <KPI 
          type="blue" 
          icon={<FileText />} 
          label="Por Pagar" 
          value={Utils.fmtUSD(cxpPend)} 
          sub={`${Utils.fmtBS(cxpPend * state.tasa)}`} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* GRAFICO SEMANAL BENTO */}
        <div className="lg:col-span-8 bento-card p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight">Rendimiento Semanal</h3>
            <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full text-xs font-black">
              <TrendingUp size={14}/> +12.5%
            </div>
          </div>
          <div className="flex items-end gap-3 h-48">
            {barHeights.map((h, i) => (
              <div key={i} className="flex-1 bg-slate-100 rounded-2xl relative group overflow-hidden">
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-[#c8952e] opacity-80 group-hover:opacity-100 transition-all duration-500 rounded-t-xl" 
                  style={{ height: `${h}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-black uppercase mt-6 tracking-widest">
            <span>LUN</span><span>MAR</span><span>MIE</span><span>JUE</span><span>VIE</span><span>SAB</span><span>DOM</span>
          </div>
        </div>

        {/* ALERTAS STOCK BENTO */}
        <div className="lg:col-span-4 bento-card p-8 bg-slate-900 text-white">
          <h3 className="text-lg font-black uppercase mb-6 tracking-tight flex items-center gap-2">
            <Package size={20} className="text-amber-400"/> Alertas Stock ({bajoStock.length})
          </h3>
          <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2">
            {bajoStock.length === 0 ? (
              <p className="text-center py-10 text-white/20 font-black uppercase text-xs">Todo en orden</p>
            ) : (
              bajoStock.map(p => (
                <div key={p.id} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase">{p.nombre}</span>
                    <span className="text-[10px] opacity-40 uppercase">{p.categoria}</span>
                  </div>
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full font-black text-[10px]">{p.stock} UDS</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* TABLA VENTAS BENTO */}
      <div className="bento-card overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight">Últimas Transacciones</h3>
          <button className="text-xs font-black text-[#c8952e] flex items-center gap-1 hover:gap-2 transition-all">
            VER TODAS <ArrowRight size={14}/>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Fecha / Hora</th>
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Cliente</th>
                <th className="px-8 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Monto USD</th>
                <th className="px-8 py-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">Método</th>
                <th className="px-8 py-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ultimasVentas.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4 text-xs font-medium text-slate-600">
                    {v.fecha.includes('T') ? v.fecha.replace('T', ' ').slice(0, 16) : v.fecha}
                  </td>
                  <td className="px-8 py-4 text-xs font-black uppercase text-slate-900">{v.cliente}</td>
                  <td className="px-8 py-4 text-right font-black text-slate-900">{Utils.fmtUSD(v.totalUSD)}</td>
                  <td className="px-8 py-4 text-center">
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase">
                      {Utils.metodoLabel(v.metodoPago)}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${v.estado === 'completada' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      {v.estado}
                    </span>
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

function KPI({ type, icon, label, value, sub }: any) {
  const themes: any = {
    amber: 'bg-[#c8952e]/5 border-[#c8952e]/10 text-[#c8952e]',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    red: 'bg-rose-50 border-rose-100 text-rose-600',
    blue: 'bg-sky-50 border-sky-100 text-sky-600'
  };
  return (
    <div className={`bento-card p-8 border ${themes[type]}`}>
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-2xl ${type === 'amber' ? 'bg-[#c8952e]/10' : 'bg-white shadow-sm'}`}>
          {React.cloneElement(icon as React.ReactElement, { size: 24 })}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
      </div>
      <div className="text-3xl font-black text-slate-900 tracking-tight mb-2">{value}</div>
      <div className="text-xs font-bold opacity-60 italic">{sub}</div>
    </div>
  );
}