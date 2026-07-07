
"use client";

import React, { useState } from 'react';
import { AppState } from '@/lib/types';
import { Utils } from '@/lib/db-store';
import { Calendar, FileText, TrendingUp, HandCoins, Users, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function ReportsModule({ state }: { state: AppState }) {
  const [tab, setTab] = useState('ventas');
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());
  
  // Filtrado de Ventas por Fecha
  const ventasFiltradas = state.ventas.filter(v => v.fecha >= desde && v.fecha <= hasta);
  const totalVentasUSD = ventasFiltradas.reduce((s, v) => s + v.totalUSD, 0);
  
  // Rentabilidad
  const totalCostoVentas = ventasFiltradas.reduce((s, v) => {
    return s + v.items.reduce((si, item) => {
      const p = state.productos.find(x => x.id === item.productoId);
      return si + (p ? p.costoUSD * item.cantidad : 0);
    }, 0);
  }, 0);
  const gananciaNeta = totalVentasUSD - totalCostoVentas;

  // Cuentas por Cobrar (Pendientes)
  const cxcPendientes = state.cxc.filter(x => x.estado !== 'pagada');
  const totalCxCUSD = cxcPendientes.reduce((s, x) => s + x.saldoUSD, 0);

  // Cuentas por Pagar (Pendientes)
  const cxpPendientes = state.cxp.filter(x => x.estado !== 'pagada');
  const totalCxPUSD = cxpPendientes.reduce((s, x) => s + x.saldoUSD, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* Navegación de Reportes */}
      <div className="tabs flex border-b border-[#2a2a2a] mb-6 overflow-x-auto no-print">
        <button onClick={() => setTab('ventas')} className={`px-6 py-3 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${tab === 'ventas' ? 'border-[#c8952e] text-[#c8952e]' : 'border-transparent text-white hover:text-[#c8952e]'}`}>
          <div className="flex items-center gap-2"><FileText className="w-4 h-4"/> Ventas</div>
        </button>
        <button onClick={() => setTab('cxc')} className={`px-6 py-3 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${tab === 'cxc' ? 'border-[#c8952e] text-[#c8952e]' : 'border-transparent text-white hover:text-[#c8952e]'}`}>
          <div className="flex items-center gap-2"><ArrowDownCircle className="w-4 h-4"/> CxC (Clientes)</div>
        </button>
        <button onClick={() => setTab('cxp')} className={`px-6 py-3 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${tab === 'cxp' ? 'border-[#c8952e] text-[#c8952e]' : 'border-transparent text-white hover:text-[#c8952e]'}`}>
          <div className="flex items-center gap-2"><ArrowUpCircle className="w-4 h-4"/> CxP (Proveedores)</div>
        </button>
        <button onClick={() => setTab('rentabilidad')} className={`px-6 py-3 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${tab === 'rentabilidad' ? 'border-[#c8952e] text-[#c8952e]' : 'border-transparent text-white hover:text-[#c8952e]'}`}>
          <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Rentabilidad</div>
        </button>
      </div>

      {/* Contenido Ventas */}
      {tab === 'ventas' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="card p-4 bg-[#131313] border-[#2a2a2a] flex flex-wrap gap-4 items-end">
            <div className="form-group mb-0">
              <label className="text-white text-[10px] font-black uppercase block mb-1">Desde</label>
              <input type="date" className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-3" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="form-group mb-0">
              <label className="text-white text-[10px] font-black uppercase block mb-1">Hasta</label>
              <input type="date" className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-3" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
            <div className="flex-1 text-right">
              <button className="btn btn-secondary h-10 text-white font-bold" onClick={() => window.print()}>Imprimir Reporte</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="kpi amber bg-[#c8952e]/10 border-[#c8952e]/20 p-6 rounded-xl border">
               <div className="text-white text-[10px] font-black uppercase mb-2">Ventas en el Periodo</div>
               <div className="text-4xl font-black text-[#c8952e]">{Utils.fmtUSD(totalVentasUSD)}</div>
               <div className="text-white text-sm font-bold mt-1">{Utils.fmtBS(totalVentasUSD * state.tasa)}</div>
             </div>
             <div className="kpi blue bg-[#3a9bdc]/10 border-[#3a9bdc]/20 p-6 rounded-xl border">
               <div className="text-white text-[10px] font-black uppercase mb-2">Operaciones Realizadas</div>
               <div className="text-4xl font-black text-white">{ventasFiltradas.length}</div>
               <div className="text-white/60 text-xs font-bold mt-1">Transacciones procesadas</div>
             </div>
          </div>

          <div className="card overflow-hidden">
            <div className="card-head px-5 py-3 border-b border-[#2a2a2a] bg-[#181818]">
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Detalle de Facturación</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead className="bg-[#0b0b0b]">
                  <tr>
                    <th className="text-white font-black text-[10px] uppercase">Fecha</th>
                    <th className="text-white font-black text-[10px] uppercase">Cliente</th>
                    <th className="text-white font-black text-[10px] uppercase">Metodo</th>
                    <th className="text-white font-black text-[10px] uppercase text-right">Monto USD</th>
                    <th className="text-white font-black text-[10px] uppercase text-right">Monto BS</th>
                  </tr>
                </thead>
                <tbody className="bg-[#131313]">
                  {ventasFiltradas.map(v => (
                    <tr key={v.id} className="border-b border-white/5">
                      <td className="text-white font-bold text-xs">{Utils.fmtFecha(v.fecha)}</td>
                      <td className="text-white font-bold text-xs">{v.cliente}</td>
                      <td className="text-white font-bold text-[10px] uppercase">{Utils.metodoLabel(v.metodoPago)}</td>
                      <td className="text-[#c8952e] font-black text-xs text-right">{Utils.fmtUSD(v.totalUSD)}</td>
                      <td className="text-white font-bold text-xs text-right">{Utils.fmtBS(v.totalBS)}</td>
                    </tr>
                  ))}
                  {ventasFiltradas.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-20 text-white font-bold italic opacity-30">No hay datos para este periodo</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Contenido CxC */}
      {tab === 'cxc' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="kpi bg-[#e04848]/10 border-[#e04848]/20 p-6 rounded-xl border">
              <div className="text-white text-[10px] font-black uppercase mb-2">Total por Cobrar (Deuda General)</div>
              <div className="text-4xl font-black text-[#e04848]">{Utils.fmtUSD(totalCxCUSD)}</div>
              <div className="text-white text-sm font-bold mt-1">{Utils.fmtBS(totalCxCUSD * state.tasa)}</div>
            </div>
            <div className="kpi bg-[#181818] border-[#2a2a2a] p-6 rounded-xl border">
              <div className="text-white text-[10px] font-black uppercase mb-2">Clientes en Mora</div>
              <div className="text-4xl font-black text-white">{cxcPendientes.length}</div>
              <div className="text-white/60 text-xs font-bold mt-1">Cuentas pendientes de pago</div>
            </div>
          </div>

          <div className="card">
            <div className="card-head px-5 py-3 border-b border-[#2a2a2a] bg-[#181818]">
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Listado de Deudores</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead className="bg-[#0b0b0b]">
                  <tr>
                    <th className="text-white font-black text-[10px] uppercase">Emisión</th>
                    <th className="text-white font-black text-[10px] uppercase">Vencimiento</th>
                    <th className="text-white font-black text-[10px] uppercase">Cliente</th>
                    <th className="text-white font-black text-[10px] uppercase text-right">Saldo USD</th>
                    <th className="text-white font-black text-[10px] uppercase text-right">Saldo BS</th>
                  </tr>
                </thead>
                <tbody className="bg-[#131313]">
                  {cxcPendientes.map(x => (
                    <tr key={x.id} className="border-b border-white/5">
                      <td className="text-white font-bold text-xs">{Utils.fmtFecha(x.fecha)}</td>
                      <td className="text-[#e04848] font-black text-xs">{Utils.fmtFecha(x.fechaVencimiento)}</td>
                      <td className="text-white font-bold text-xs">{x.cliente}</td>
                      <td className="text-[#c8952e] font-black text-xs text-right">{Utils.fmtUSD(x.saldoUSD)}</td>
                      <td className="text-white font-bold text-xs text-right">{Utils.fmtBS(x.saldoUSD * state.tasa)}</td>
                    </tr>
                  ))}
                  {cxcPendientes.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-20 text-white font-bold italic opacity-30">Libre de deudas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Contenido CxP */}
      {tab === 'cxp' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="kpi bg-[#3a9bdc]/10 border-[#3a9bdc]/20 p-6 rounded-xl border">
              <div className="text-white text-[10px] font-black uppercase mb-2">Total por Pagar (Proveedores)</div>
              <div className="text-4xl font-black text-[#3a9bdc]">{Utils.fmtUSD(totalCxPUSD)}</div>
              <div className="text-white text-sm font-bold mt-1">{Utils.fmtBS(totalCxPUSD * state.tasa)}</div>
            </div>
            <div className="kpi bg-[#181818] border-[#2a2a2a] p-6 rounded-xl border">
              <div className="text-white text-[10px] font-black uppercase mb-2">Facturas por Vencer</div>
              <div className="text-4xl font-black text-white">{cxpPendientes.length}</div>
              <div className="text-white/60 text-xs font-bold mt-1">Créditos comerciales activos</div>
            </div>
          </div>

          <div className="card">
            <div className="card-head px-5 py-3 border-b border-[#2a2a2a] bg-[#181818]">
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Proveedores y Vencimientos</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead className="bg-[#0b0b0b]">
                  <tr>
                    <th className="text-white font-black text-[10px] uppercase">Registro</th>
                    <th className="text-white font-black text-[10px] uppercase">Vencimiento</th>
                    <th className="text-white font-black text-[10px] uppercase">Proveedor</th>
                    <th className="text-white font-black text-[10px] uppercase">Concepto</th>
                    <th className="text-white font-black text-[10px] uppercase text-right">Deuda USD</th>
                  </tr>
                </thead>
                <tbody className="bg-[#131313]">
                  {cxpPendientes.map(x => (
                    <tr key={x.id} className="border-b border-white/5">
                      <td className="text-white font-bold text-xs">{Utils.fmtFecha(x.fecha)}</td>
                      <td className="text-[#3a9bdc] font-black text-xs">{Utils.fmtFecha(x.fechaVencimiento)}</td>
                      <td className="text-white font-bold text-xs uppercase">{x.proveedor}</td>
                      <td className="text-white/60 text-[10px] uppercase">{x.concepto}</td>
                      <td className="text-[#c8952e] font-black text-xs text-right">{Utils.fmtUSD(x.saldoUSD)}</td>
                    </tr>
                  ))}
                  {cxpPendientes.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-20 text-white font-bold italic opacity-30">No hay compromisos pendientes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Contenido Rentabilidad */}
      {tab === 'rentabilidad' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="kpi bg-[#181818] border-[#2a2a2a] p-6 rounded-xl border">
              <div className="text-white text-[10px] font-black uppercase mb-2">Ingreso Bruto</div>
              <div className="text-3xl font-black text-white">{Utils.fmtUSD(totalVentasUSD)}</div>
            </div>
            <div className="kpi bg-[#181818] border-[#2a2a2a] p-6 rounded-xl border">
              <div className="text-white text-[10px] font-black uppercase mb-2">Costo de Mercancía</div>
              <div className="text-3xl font-black text-[#e04848]">{Utils.fmtUSD(totalCostoVentas)}</div>
            </div>
            <div className="kpi bg-[#27ae60]/10 border-[#27ae60]/20 p-6 rounded-xl border">
              <div className="text-white text-[10px] font-black uppercase mb-2">Ganancia Neta</div>
              <div className="text-4xl font-black text-[#27ae60]">{Utils.fmtUSD(gananciaNeta)}</div>
              <div className="text-white text-xs font-bold mt-1">Margen: {totalVentasUSD > 0 ? ((gananciaNeta/totalVentasUSD)*100).toFixed(2) : 0}%</div>
            </div>
          </div>
          <div className="card bg-[#181818] border-[#2a2a2a] p-8 text-center">
            <p className="text-white/40 font-bold italic text-sm">Los cálculos de rentabilidad se basan en el Costo Promedio Ponderado (CPP) registrado al momento de la venta.</p>
          </div>
        </div>
      )}
    </div>
  );
}
