
"use client";

import React, { useState, useEffect } from 'react';
import { AppState } from '@/lib/types';
import { Utils } from '@/lib/db-store';
import { DollarSign, Package, HandCoins, FileText, ArrowRight } from 'lucide-react';

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-head"><h3 className="text-white">Resumen Semanal</h3></div>
          <div className="card-body">
             <div className="flex items-end gap-2 h-20">
                {barHeights.length > 0 ? (
                  barHeights.map((h, i) => (
                    <div key={i} className="flex-1 bg-[#c8952e]/60 rounded-t h-full min-h-[4px]" style={{ height: `${h}%` }} />
                  ))
                ) : (
                  [1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} className="flex-1 bg-[#c8952e]/20 rounded-t h-full min-h-[4px]" style={{ height: '0%' }} />
                  ))
                )}
             </div>
             <div className="flex justify-between text-[0.7rem] text-white font-black mt-2">
               <span>LUN</span><span>MAR</span><span>MIE</span><span>JUE</span><span>VIE</span><span>SAB</span><span>DOM</span>
             </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3 className="text-white">Stock Bajo ({bajoStock.length})</h3></div>
          <div className="card-body p-0 max-h-[160px] overflow-y-auto">
            {bajoStock.length === 0 ? (
              <p className="text-center p-4 text-white font-black text-sm italic uppercase">Sin alertas de stock</p>
            ) : (
              bajoStock.map(p => (
                <div key={p.id} className="flex justify-between p-3 border-b border-[#2a2a2a] text-sm mx-4 text-white font-black">
                  <span className="uppercase">{p.nombre}</span>
                  <span className="badge badge-err font-black">{p.stock} UDS</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3 className="text-white">Últimas Ventas</h3>
          <button className="btn btn-sm btn-secondary flex items-center gap-1 text-white font-black">
            VER TODAS <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="text-white font-black">Fecha</th>
                <th className="text-white font-black">Cliente</th>
                <th className="text-white font-black text-right">Monto</th>
                <th className="text-white font-black">Método</th>
                <th className="text-white font-black">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ultimasVentas.map(v => (
                <tr key={v.id}>
                  <td className="text-white font-black text-xs">{v.fecha.includes('T') ? v.fecha.replace('T', ' ').slice(0, 16) : v.fecha}</td>
                  <td className="text-white font-black uppercase text-xs">{v.cliente}</td>
                  <td className="mono text-[#c8952e] font-black text-right">{Utils.fmtUSD(v.totalUSD)}</td>
                  <td className="text-white font-black uppercase text-[10px]">{Utils.metodoLabel(v.metodoPago)}</td>
                  <td><span className={`badge ${v.estado === 'completada' ? 'badge-ok' : 'badge-warn'} font-black text-[9px] uppercase`}>{v.estado}</span></td>
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
  const colors: any = {
    amber: 'text-[#c8952e] bg-[rgba(200,149,46,0.2)]',
    green: 'text-[#27ae60] bg-[rgba(39,174,96,0.25)]',
    red: 'text-[#e04848] bg-[rgba(224,72,72,0.25)]',
    blue: 'text-[#3a9bdc] bg-[rgba(58,155,220,0.25)]'
  };
  return (
    <div className={`kpi ${type} border-[#2a2a2a]`}>
      <div className={`kpi-icon ${colors[type]}`}>{icon}</div>
      <div className="text-[0.78rem] text-white font-black uppercase mb-1">{label}</div>
      <div className="font-display text-[1.4rem] font-black text-white">{value}</div>
      <div className="text-[0.75rem] text-white font-black mt-1 italic">{sub}</div>
    </div>
  );
}
