
"use client";

import React from 'react';
import { AppState } from '@/lib/types';
import { Utils } from '@/lib/db-store';

export default function ReturnsModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-head">
          <h3>Devoluciones</h3>
          <button className="btn btn-primary btn-sm">Nueva Devolución</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Venta Ref.</th>
                <th>Items</th>
                <th>Total USD</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {state.devoluciones.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 opacity-30">Sin devoluciones</td></tr>
              ) : (
                state.devoluciones.map(d => (
                  <tr key={d.id}>
                    <td>{Utils.fmtFecha(d.fecha)}</td>
                    <td className="mono opacity-50">{d.ventaId.slice(-6).toUpperCase()}</td>
                    <td className="text-xs">{d.items.map(i => `${i.nombre} x${i.cantidad}`).join(', ')}</td>
                    <td className="mono text-[#e04848]">{Utils.fmtUSD(d.totalUSD)}</td>
                    <td>{d.motivo}</td>
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
