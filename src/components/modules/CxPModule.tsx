import React, { useState } from 'react';
import { AppState, Debt, LibroDiarioEntry } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  FileText, 
  Calculator, 
  Eye, 
  X, 
  Banknote,
  Search,
  Plus,
  ArrowLeft
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CxPModuleProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
}

export default function CxPModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [showDetails, setShowDetails] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<any>('efectivo_usd');

  const pendientes = (state.cxp || []).filter(x => x.estado !== 'pagada');
  const totalPendiente = pendientes.reduce((s, x) => s + x.saldoUSD, 0);

  const fmt4 = (v: number) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const handleOpenPayment = (debt: any) => {
    setShowPaymentModal(debt);
    setPaymentAmount(debt.saldoUSD.toString());
    setPaymentMethod('efectivo_usd');
  };

  const handleProcessPayment = () => {
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El monto debe ser mayor a cero."
      });
      return;
    }

    if (amount > (showPaymentModal.saldoUSD + 0.001)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El monto no puede ser mayor al saldo pendiente."
      });
      return;
    }

    const ahoraStr = Utils.ahora();
    
    // 1. Actualizar CxP
    const nuevasCxP = state.cxp.map(c => {
      if (c.id === showPaymentModal.id) {
        const nuevoSaldo = Math.max(0, c.saldoUSD - amount);
        const historialPagos = c.historialPagos || [];
        return {
          ...c,
          abonadoUSD: c.abonadoUSD + amount,
          saldoUSD: nuevoSaldo,
          estado: nuevoSaldo <= 0.001 ? 'pagada' : 'parcial',
          historialPagos: [...historialPagos, {
            fecha: ahoraStr,
            montoUSD: amount,
            montoBS: amount * state.tasa,
            metodo: paymentMethod,
            reciboId: `PAY-${Store.uid().toUpperCase().slice(0, 4)}`
          }]
        };
      }
      return c;
    });

    // 2. Crear Asiento Contable (Egreso)
    const nuevoAsiento: LibroDiarioEntry = {
      id: 'ACC-' + Store.uid().toUpperCase().slice(0, 5),
      fecha: ahoraStr,
      tipo: 'egreso',
      categoria: 'PAGO_PROVEEDOR',
      pointOfSale: "ADMIN",
      concepto: `PAGO DEUDA A: ${showPaymentModal.proveedor.toUpperCase()} - REF FACT: ${showPaymentModal.numeroFactura || 'S/N'}`,
      montoUSD: amount,
      montoBS: amount * state.tasa,
      metodo: paymentMethod,
      referencia: showPaymentModal.id
    };

    updateState({ 
      cxp: nuevasCxP, 
      libroDiario: [nuevoAsiento, ...(state.libroDiario || [])] 
    });

    toast({
      title: "Pago registrado",
      description: `Se ha registrado el pago de ${Utils.fmtUSD(amount)}`
    });
    
    setShowPaymentModal(null);
    setPaymentAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-ink font-black uppercase italic tracking-tighter text-2xl">Cuentas por Pagar</h2>
          <p className="text-[10px] text-ink font-bold uppercase tracking-widest opacity-60">Control de Obligaciones con Proveedores</p>
        </div>
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
                <th className="text-ink font-black text-[10px] uppercase py-4 border-b border-line">Factura</th>
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
                    <td className="text-ink font-black text-xs py-4 mono">{x.numeroFactura || '-'}</td>
                    <td className="text-ink font-bold text-xs text-right py-4 mono">{fmt4(x.montoUSD)}</td>
                    <td className="text-brand-gold-deep font-black text-sm text-right py-4 mono">{fmt4(x.saldoUSD)}</td>
                    <td className="py-4 px-6 text-center">
                       <div className="flex justify-center gap-1">
                          <button onClick={() => setShowDetails(x)} className="btn-icon h-8 w-8 text-ink hover:text-brand-gold" title="Ver Detalle de Compra"><Eye className="w-4 h-4"/></button>
                          {x.estado !== 'pagada' && (
                             <button onClick={() => handleOpenPayment(x)} className="btn btn-primary h-8 px-4 font-black text-[9px] uppercase shadow-sm">Pagar</button>
                          )}
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

              <div className="space-y-3">
                 <h4 className="text-[10px] font-black uppercase text-ink/40 tracking-[0.2em] border-b border-line pb-2">CRONOLOGÍA DE ABONOS</h4>
                 <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                    {(!showDetails.historialPagos || showDetails.historialPagos.length === 0) ? (
                      <div className="py-10 text-center text-ink/20 font-black uppercase italic text-[10px]">No se han registrado abonos aún</div>
                    ) : (
                      showDetails.historialPagos.map((p: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-surface-soft border border-line rounded-lg">
                           <div className="space-y-0.5">
                              <p className="text-[10px] font-black text-ink uppercase">{Utils.fmtFecha(p.fecha)} - {p.fecha.split('T')[1]?.slice(0,5)}</p>
                              <p className="text-[8px] font-bold text-ink/40 mono">REF RECIBO: {p.reciboId}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-xs font-black text-status-success">+{Utils.fmtUSD(p.montoUSD)}</p>
                              <p className="text-[8px] font-black text-ink/40 uppercase">{Utils.metodoLabel(p.metodo || 'otros')}</p>
                           </div>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            </div>
            <div className="modal-foot p-4 bg-surface-soft border-t border-line text-right">
               <button onClick={() => setShowDetails(null)} className="btn btn-primary px-8 font-black uppercase text-[10px] rounded-lg">Cerrar Ficha</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PAGO DE DEUDA */}
      {showPaymentModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowPaymentModal(null)}></div>
          <div className="modal-box bg-white max-w-sm border-2 border-line rounded-2xl overflow-hidden shadow-2xl">
            <div className="modal-head py-4 px-6 bg-ink border-b border-white/10 flex justify-between items-center">
              <h3 className="text-white font-black uppercase text-xs">REGISTRAR PAGO DE DEUDA</h3>
              <button onClick={() => setShowPaymentModal(null)} className="text-white/40 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="modal-body p-8 space-y-6">
               <div className="bg-surface-soft p-8 rounded-[20px] text-center border border-line shadow-inner">
                  <p className="text-ink/40 text-[9px] font-black uppercase tracking-[0.2em] mb-2">SALDO PENDIENTE</p>
                  <p className="text-3xl font-black text-status-danger">{fmt4(showPaymentModal.saldoUSD)}</p>
               </div>
               
               <div className="form-group">
                 <label className="text-ink text-[10px] font-black uppercase block mb-1">METODO DE PAGO</label>
                 <select 
                    className="form-select h-12 text-sm font-black uppercase border-line bg-surface-soft/50"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                  >
                    <option value="efectivo_usd">Efectivo USD</option>
                    <option value="efectivo_bs">Efectivo BS</option>
                    <option value="pagomovil">Pago Movil</option>
                    <option value="zelle">Zelle</option>
                  </select>
               </div>

               <div className="form-group">
                 <label className="text-ink text-[10px] font-black uppercase block mb-1">MONTO A PAGAR (USD)</label>
                 <div className="relative">
                   <input 
                     className="form-input h-12 text-xl font-black text-ink" 
                     type="number" 
                     value={paymentAmount} 
                     onChange={e => setPaymentAmount(e.target.value)} 
                   />
                 </div>
               </div>
               <button onClick={handleProcessPayment} className="btn btn-primary w-full h-14 font-black uppercase text-xs shadow-xl">CONFIRMAR Y ASENTAR PAGO</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}