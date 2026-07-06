
"use client";

import React from 'react';
import { AppState } from '@/lib/types';
import { Utils } from '@/lib/db-store';

export default function CxCModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const pendientes = state.cxc.filter(x => x.estado !== 'pagada');
  const totalPendiente = pendientes.reduce((s, x) => s + x.saldoUSD, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi amber">
          <div className="kpi-label">Pendientes</div>
          <div className="kpi-value">{pendientes.length}</div>
        </div>
        <div className="kpi red">
          <div className="kpi-label">Total Pendiente</div>
          <div className="kpi-value">{Utils.fmtUSD(totalPendiente)}</div>
          <div className="kpi-sub">{Utils.fmtBS(totalPendiente * state.tasa)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Cuentas por Cobrar</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Venc.</th>
                <th>Cliente</th>
                <th>Monto USD</th>
                <th>Abonado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {state.cxc.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 opacity-30">Sin cuentas</td></tr>
              ) : (
                state.cxc.map(x => (
                  <tr key={x.id}>
                    <td>{Utils.fmtFecha(x.fecha)}</td>
                    <td>{Utils.fmtFecha(x.fechaVencimiento)}</td>
                    <td>{x.cliente}</td>
                    <td className="mono">{Utils.fmtUSD(x.montoUSD)}</td>
                    <td className="mono text-[#27ae60]">{Utils.fmtUSD(x.abonadoUSD)}</td>
                    <td className="mono text-[#c8952e] font-bold">{Utils.fmtUSD(x.saldoUSD)}</td>
                    <td><span className={`badge ${x.estado === 'pagada' ? 'badge-ok' : 'badge-warn'}`}>{x.estado}</span></td>
                    <td><button className="btn btn-sm btn-ok">Abonar</button></td>
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
