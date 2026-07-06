
"use client";

import React from 'react';
import { AppState } from '@/lib/types';
import { Utils } from '@/lib/db-store';

export default function CxPModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const pendientes = state.cxp.filter(x => x.estado !== 'pagada');
  const totalPendiente = pendientes.reduce((s, x) => s + x.saldoUSD, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi blue">
          <div className="kpi-label">Pendientes</div>
          <div className="kpi-value">{pendientes.length}</div>
        </div>
        <div className="kpi red">
          <div className="kpi-label">Total a Pagar</div>
          <div className="kpi-value">{Utils.fmtUSD(totalPendiente)}</div>
          <div className="kpi-sub">{Utils.fmtBS(totalPendiente * state.tasa)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Cuentas por Pagar</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Venc.</th>
                <th>Proveedor</th>
                <th>Concepto</th>
                <th>Monto USD</th>
                <th>Saldo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {state.cxp.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 opacity-30">Sin cuentas</td></tr>
              ) : (
                state.cxp.map(x => (
                  <tr key={x.id}>
                    <td>{Utils.fmtFecha(x.fecha)}</td>
                    <td>{Utils.fmtFecha(x.fechaVencimiento)}</td>
                    <td>{x.proveedor}</td>
                    <td>{x.concepto}</td>
                    <td className="mono">{Utils.fmtUSD(x.montoUSD)}</td>
                    <td className="mono text-[#c8952e] font-bold">{Utils.fmtUSD(x.saldoUSD)}</td>
                    <td><button className="btn btn-sm btn-primary">Pagar</button></td>
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
