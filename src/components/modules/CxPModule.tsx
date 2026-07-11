"use client";

import React, { useState } from 'react';
import { AppState } from '@/lib/types';
import { Utils } from '@/lib/db-store';
import { FileText, Calculator, Eye, X } from 'lucide-react';
import { exportarPDFCxP } from '@/lib/pdf-generator';

export default function CxPModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [showDetails, setShowDetails] = useState<any>(null);

  const pendientes = state.cxp.filter(x => x.estado !== 'pagada');
  const totalPendiente = pendientes.reduce((s, x) => s + x.saldoUSD, 0);

  // Helper local para 4 decimales
  const fmt4 = (v: number) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const handleExportPDF = () => {
    exportarPDFCxP(pendientes, state.empresa, totalPendiente);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-ink font-black uppercase italic tracking-tighter text-2xl">Cuentas por Pagar</h2>
          <p className="text-[10px] text-ink font-bold uppercase tracking-widest opacity-60">Control de Obligaciones con Proveedores</p>
        </div>
        <button onClick={handleExportPDF} className="btn btn-secondary h-11 px-6 font-black uppercase text-xs flex items-center gap-2 shadow-md">
          <FileText className="w-4 h-4" /> Exportar Reporte CxP
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="kpi bg-white border-line p-7 rounded-2xl shadow-sm border-l-[6px] border-l-ink">
          <div className="text-ink text-[10px] font-black uppercase mb-2 tracking-wider">Facturas Pendientes</div>
          <div className="text-4xl font-black text-ink">{pendientes.length}</div>
          <div className="text-ink/60 text-[10px] font-black mt-1.5 uppercase tracking-widest">Compromisos por Liquidar</div>
        </div>
        <div className="kpi bg-white border-line p-7 rounded-2xl shadow-sm border-l-[6px] border-l-status-danger">
          <div className="text-ink text-[10px] font-black uppercase mb-2 tracking-wider">Total a Pagar (USD)</div>
          <div className="text-4xl font-black text-status-danger">{fmt4(totalPendiente)}</div>
          <div className="text-ink font-bold text-sm mt-1.5 opacity-80">{Utils.fmtBS(totalPendiente * state.tasa)}</div>
        </div>
      </div>

      <div className="card shadow-md border-line overflow-hidden bg-white rounded-xl">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand-gold" /> CUENTAS POR PAGAR ACTIVAS
          </h3>
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
                    <td className="text-ink font-bold text-xs text-right py-4 mono">{fmt4(x.montoUSD)}</td>
                    <td className="text-brand-gold-deep font-black text-sm text-right py-4 mono">{fmt4(x.saldoUSD)}</td>
                    <td className="py-4 px-6 text-center">
                       <div className="flex justify-center gap-1">
                          <button onClick={() => setShowDetails(x)} className="btn-icon h-8 w-8 text-ink hover:text-brand-gold" title="Ver Detalle de Compra"><Eye className="w-4 h-4"/></button>
                          <button className="btn btn-primary h-8 px-4 font-black text-[9px] uppercase shadow-sm">Pagar</button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALLES AVANZADOS DE COMPRA */}
      {showDetails && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowDetails(null)}></div>
          <div className="modal-box max-w-[600px] bg-white border-2 border-line rounded-xl overflow-hidden shadow-2xl">
            <div className="modal-head py-4 px-6 border-b border-line bg-ink flex justify-between items-center">
              <h3 className="text-white font-black text-xs uppercase italic tracking-tighter">DETALLE DE COMPRA: {showDetails.id}</h3>
              <button onClick={() => setShowDetails(null)} className="text-white/40 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="modal-body p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-3 bg-surface-soft rounded-lg border border-line">
                    <label className="text-[8px] font-black uppercase text-ink/50 block mb-1">Monto de la Factura</label>
                    <p className="text-lg font-black text-ink">{fmt4(showDetails.montoUSD)}</p>
                 </div>
                 <div className="p-3 bg-brand-gold-soft border border-brand-gold/20 rounded-lg">
                    <label className="text-[8px] font-black uppercase text-brand-gold-deep block mb-1">Saldo por Pagar</label>
                    <p className="text-lg font-black text-brand-gold-deep">{fmt4(showDetails.saldoUSD)}</p>
                 </div>
              </div>

              {showDetails.items && (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between items-center border-b border-line pb-2">
                     <h4 className="text-[10px] font-black uppercase text-ink/40 tracking-[0.2em]">ARTÍCULOS INTEGRANTES DE ESTA DEUDA</h4>
                     <span className="text-[9px] font-black text-ink/60 uppercase">FACTURA #{showDetails.numeroFactura || '-'}</span>
                  </div>
                  <div className="bg-surface-soft/50 rounded-lg overflow-hidden border border-line/30">
                     <table className="w-full">
                        <thead>
                          <tr className="bg-ink/5">
                             <th className="text-[8px] font-black uppercase p-2 text-left">Cant</th>
                             <th className="text-[8px] font-black uppercase p-2 text-left">Descripción</th>
                             <th className="text-[8px] font-black uppercase p-2 text-right">Costo Unit.</th>
                             <th className="text-[8px] font-black uppercase p-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {showDetails.items.map((it: any, idx: number) => (
                            <tr key={idx} className="border-b border-line/20">
                               <td className="text-[9px] font-bold p-2 text-ink">{it.cantidad}</td>
                               <td className="text-[9px] font-black uppercase p-2 text-ink truncate max-w-[180px]">{it.nombre}</td>
                               <td className="text-[9px] font-bold p-2 text-right text-ink">{fmt4(it.costoUnitarioUSD)}</td>
                               <td className="text-[9px] font-black p-2 text-right text-brand-gold-deep">{fmt4(it.subtotalUSD)}</td>
                            </tr>
                          ))}
                        </tbody>
                     </table>
                  </div>
                </div>
              )}

              <div className="p-4 bg-surface-soft rounded-lg border border-line flex flex-col gap-1">
                 <p className="text-[8px] font-black uppercase text-ink/40">Información del Proveedor</p>
                 <p className="text-xs font-black text-ink uppercase">{showDetails.proveedor}</p>
                 <p className="text-[10px] font-bold text-ink/60">FECHA DE EMISIÓN: {Utils.fmtFecha(showDetails.fecha)}</p>
                 <p className="text-[10px] font-bold text-status-danger">VENCIMIENTO: {Utils.fmtFecha(showDetails.fechaVencimiento)}</p>
              </div>
            </div>
            <div className="modal-foot p-4 bg-surface-soft border-t border-line text-right">
               <button onClick={() => setShowDetails(null)} className="btn btn-primary px-8 font-black uppercase text-[10px] rounded-lg">Cerrar Ficha</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
