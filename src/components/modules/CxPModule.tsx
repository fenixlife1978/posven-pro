
"use client";

import React from 'react';
import { AppState } from '@/lib/types';
import { Utils } from '@/lib/db-store';

export default function CxPModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const pendientes = state.cxp.filter(x => x.estado !== 'pagada');
  const totalPendiente = pendientes.reduce((s, x) => s + x.saldoUSD, 0);

  return (
    <div className="space-y-6">
      {/* KPIs DE ALTO CONTRASTE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="kpi bg-white border-line p-7 rounded-2xl shadow-sm border-l-[6px] border-l-ink">
          <div className="text-ink text-[10px] font-black uppercase mb-2 tracking-wider">Cuentas Pendientes</div>
          <div className="text-4xl font-black text-ink">{pendientes.length}</div>
          <div className="text-ink/60 text-[10px] font-black mt-1.5 uppercase tracking-widest">Facturas por Liquidar</div>
        </div>
        <div className="kpi bg-white border-line p-7 rounded-2xl shadow-sm border-l-[6px] border-l-status-danger">
          <div className="text-ink text-[10px] font-black uppercase mb-2 tracking-wider">Total a Pagar (USD)</div>
          <div className="text-4xl font-black text-status-danger">{Utils.fmtUSD(totalPendiente)}</div>
          <div className="text-ink font-bold text-sm mt-1.5 opacity-80">{Utils.fmtBS(totalPendiente * state.tasa)}</div>
        </div>
      </div>

      <div className="card shadow-md border-line overflow-hidden bg-white">
        <div className="card-head bg-surface-soft border-b border-line px-6 py-4">
          <h3 className="text-ink font-black text-xs uppercase tracking-widest">Cuentas por Pagar a Proveedores</h3>
        </div>
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-soft">
                <th className="text-ink font-black text-[10px] uppercase py-4 px-6 border-b border-line">Fecha</th>
                <th className="text-ink font-black text-[10px] uppercase py-4 border-b border-line">Venc.</th>
                <th className="text-ink font-black text-[10px] uppercase py-4 border-b border-line">Proveedor</th>
                <th className="text-ink font-black text-[10px] uppercase py-4 border-b border-line">Concepto</th>
                <th className="text-ink font-black text-[10px] uppercase py-4 text-right border-b border-line">Monto USD</th>
                <th className="text-ink font-black text-[10px] uppercase py-4 text-right border-b border-line">Saldo</th>
                <th className="text-ink font-black text-[10px] uppercase py-4 px-6 text-center border-b border-line">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {state.cxp.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-24 text-ink/20 font-black uppercase italic tracking-widest">
                    No se registran cuentas por pagar actualmente
                  </td>
                </tr>
              ) : (
                state.cxp.map(x => (
                  <tr key={x.id} className="border-b border-line/40 hover:bg-surface-warm/20 transition-colors">
                    <td className="text-ink font-bold text-xs py-4 px-6">{Utils.fmtFecha(x.fecha)}</td>
                    <td className={`text-xs font-bold py-4 ${x.fechaVencimiento < Utils.hoy() && x.estado !== 'pagada' ? 'text-status-danger' : 'text-ink'}`}>
                      {Utils.fmtFecha(x.fechaVencimiento)}
                    </td>
                    <td className="text-ink font-black text-xs uppercase py-4">{x.proveedor}</td>
                    <td className="text-ink font-medium text-xs py-4">{x.concepto}</td>
                    <td className="text-ink font-bold text-xs text-right py-4 mono">{Utils.fmtUSD(x.montoUSD)}</td>
                    <td className="text-brand-gold-deep font-black text-sm text-right py-4 mono">{Utils.fmtUSD(x.saldoUSD)}</td>
                    <td className="py-4 px-6 text-center">
                      <button className="btn btn-primary h-8 px-4 font-black text-[9px] uppercase shadow-sm">Pagar</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
