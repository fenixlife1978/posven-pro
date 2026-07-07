
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AppState, SaleItem, Sale, PaymentMethod, ReportZ } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Receipt, 
  Barcode, 
  Wallet, 
  X, 
  CheckCircle2, 
  FileText,
  RotateCcw,
  History,
  ClipboardList
} from 'lucide-react';

interface PagoRealizado {
  metodo: PaymentMethod;
  montoUSD: number;
  montoBS: number;
}

export default function SalesModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'pos' | 'history' | 'credits' | 'returns'>('pos');
  const [showReport, setShowReport] = useState<'Y' | 'Z' | null>(null);
  const [cliente, setCliente] = useState('Consumidor final');
  
  const [pagos, setPagos] = useState<PagoRealizado[]>([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [metodoActual, setMetodoActual] = useState<PaymentMethod>('efectivo_usd');
  const [montoInput, setMontoInput] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  const subtotalUSD = state.carrito.reduce((s, i) => s + i.subtotalUSD, 0);
  const totalBS = subtotalUSD * state.tasa;
  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  const saldoRestanteUSD = Math.max(0, subtotalUSD - totalPagadoUSD);
  const saldoRestanteBS = saldoRestanteUSD * state.tasa;

  const matches = search.trim().length > 0 
    ? state.productos
        .filter(p => p.activo && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())))
        .sort((a, b) => {
          const s = search.toLowerCase();
          if (a.codigo.toLowerCase() === s) return -1;
          if (a.codigo.toLowerCase().startsWith(s)) return -1;
          return 0;
        }).slice(0, 8)
    : [];

  const agregar = (pid: string) => {
    const p = state.productos.find(x => x.id === pid);
    if (!p || p.stock <= 0) return;
    const nuevoCarrito = [...state.carrito];
    const idx = nuevoCarrito.findIndex(i => i.productoId === pid);
    if (idx >= 0) {
      if (nuevoCarrito[idx].cantidad >= p.stock) return;
      nuevoCarrito[idx].cantidad++;
      nuevoCarrito[idx].subtotalUSD = nuevoCarrito[idx].cantidad * nuevoCarrito[idx].precioUnitUSD;
    } else {
      nuevoCarrito.push({ productoId: pid, nombre: p.nombre, precioUnitUSD: p.precioUSD, cantidad: 1, subtotalUSD: p.precioUSD });
    }
    updateState({ carrito: nuevoCarrito });
    setSearch('');
    setPagos([]);
    searchInputRef.current?.focus();
  };

  const updateQty = (idx: number, delta: number) => {
    const nuevo = [...state.carrito];
    const item = nuevo[idx];
    const p = state.productos.find(x => x.id === item.productoId);
    const n = item.cantidad + delta;
    if (n <= 0) nuevo.splice(idx, 1);
    else if (p && n <= p.stock) {
      item.cantidad = n;
      item.subtotalUSD = n * item.precioUnitUSD;
    }
    updateState({ carrito: nuevo });
    setPagos([]);
  };

  const addPago = () => {
    let monto = parseFloat(montoInput);
    if (isNaN(monto) || monto <= 0) {
      monto = metodoActual === 'efectivo_usd' ? saldoRestanteUSD : saldoRestanteBS;
    }
    let montoUSD = metodoActual === 'efectivo_usd' ? monto : monto / state.tasa;
    let montoBS = metodoActual === 'efectivo_usd' ? monto * state.tasa : monto;
    if (montoUSD > (saldoRestanteUSD + 0.01)) return alert("Excede el saldo");
    setPagos([...pagos, { metodo: metodoActual, montoUSD, montoBS }]);
    setMontoInput('');
    setShowMultiModal(false);
  };

  const ejecutarVenta = () => {
    if (state.carrito.length === 0 || saldoRestanteUSD > 0.01) return;
    const ventaId = Store.uid();
    const ahora = Utils.ahora();
    const nuevosProductos = state.productos.map(p => {
      const item = state.carrito.find(i => i.productoId === p.id);
      return item ? { ...p, stock: p.stock - item.cantidad } : p;
    });
    const nuevaVenta: Sale = {
      id: ventaId, fecha: Utils.hoy(), cliente, items: [...state.carrito],
      subtotalUSD, descuentoUSD: 0, totalUSD: subtotalUSD, totalBS,
      metodoPago: pagos.length > 1 ? 'mixto' : (pagos[0]?.metodo || 'efectivo_usd'), estado: 'completada'
    };
    updateState({
      productos: nuevosProductos,
      ventas: [...state.ventas, nuevaVenta],
      carrito: [],
      acumuladoHistorico: state.acumuladoHistorico + subtotalUSD
    });
    setPagos([]);
    setCliente('Consumidor final');
    alert('Venta procesada con éxito');
  };

  const emitirReporteZ = () => {
    if (!confirm('¿Desea realizar el CIERRE FISCAL Z? Esto bloqueará las ventas de hoy.')) return;
    const hoy = Utils.hoy();
    const ventasHoy = state.ventas.filter(v => v.fecha === hoy);
    const totalHoy = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
    const nuevoZ: ReportZ = {
      id: `Z-${String(state.ultimoZ + 1).padStart(4, '0')}`,
      fecha: hoy,
      numeroZ: state.ultimoZ + 1,
      desdeFactura: ventasHoy[0]?.id || 'N/A',
      hastaFactura: ventasHoy[ventasHoy.length - 1]?.id || 'N/A',
      baseImponibleUSD: totalHoy / 1.16,
      ivaUSD: totalHoy - (totalHoy / 1.16),
      exentoUSD: 0,
      totalBrutoUSD: totalHoy,
      acumuladoHistoricoUSD: state.acumuladoHistorico + totalHoy
    };
    updateState({ reportesZ: [...state.reportesZ, nuevoZ], ultimoZ: state.ultimoZ + 1 });
    setShowReport('Z');
  };

  return (
    <div className="flex flex-col gap-2 h-[calc(100vh-120px)] max-w-7xl mx-auto w-full overflow-hidden">
      {/* Pestañas Superiores */}
      <div className="flex gap-2 no-print shrink-0 overflow-x-auto pb-1">
        <button onClick={() => setView('pos')} className={`btn btn-sm ${view === 'pos' ? 'btn-primary' : 'btn-secondary'}`}><ShoppingCart className="w-3.5 h-3.5"/> Punto de Venta</button>
        <button onClick={() => setView('history')} className={`btn btn-sm ${view === 'history' ? 'btn-primary' : 'btn-secondary'}`}><History className="w-3.5 h-3.5"/> Historial</button>
        <button onClick={() => setView('credits')} className="btn btn-sm btn-secondary text-white font-bold"><ClipboardList className="w-3.5 h-3.5"/> Consultar Créditos</button>
        <button onClick={() => setShowReport('Y')} className="btn btn-sm btn-secondary text-white font-bold"><FileText className="w-3.5 h-3.5"/> Reporte Y</button>
        <button onClick={emitirReporteZ} className="btn btn-sm btn-secondary text-white font-bold"><Receipt className="w-3.5 h-3.5"/> Reporte Z</button>
        <button onClick={() => setView('returns')} className="btn btn-sm btn-secondary text-white font-bold"><RotateCcw className="w-3.5 h-3.5"/> Devoluciones</button>
      </div>

      {view === 'pos' ? (
        <div className="flex flex-col gap-2 flex-1 overflow-hidden">
          {/* Barra de Búsqueda */}
          <div className="relative group shrink-0">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8952e] z-10"><Barcode className="w-5 h-5" /></div>
            <input 
              ref={searchInputRef}
              className="form-input pl-14 py-2 text-base bg-[#131313] border-[#c8952e]/30 text-white placeholder-white/40" 
              placeholder="Escanee o busque producto..." value={search} onChange={e => setSearch(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && matches.length >= 1 && agregar(matches[0].id)} autoFocus
            />
            {matches.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-[#1e1e1e] border border-[#2a2a2a] rounded-b-lg shadow-2xl z-[100] mt-1 overflow-hidden">
                {matches.map(p => (
                  <div key={p.id} onClick={() => agregar(p.id)} className="flex items-center justify-between p-2 hover:bg-[#c8952e]/20 cursor-pointer border-b border-[#2a2a2a]">
                    <div className="text-white text-xs font-bold">{p.nombre} <span className="text-white/40 text-[9px] mono ml-2">{p.codigo}</span></div>
                    <div className="text-[#c8952e] font-bold text-sm">{Utils.fmtUSD(p.precioUSD)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-1 gap-3 overflow-hidden">
            {/* Panel Izquierdo 1/3 */}
            <div className="w-1/3 flex flex-col gap-2">
              <div className="card p-3 space-y-3 bg-[#131313] border-[#2a2a2a] h-full flex flex-col">
                <div className="form-group mb-0">
                  <label className="text-white text-[10px] font-bold uppercase block mb-1">IDENTIFICACIÓN CLIENTE</label>
                  <input className="form-input h-8 text-xs bg-[#0b0b0b] text-white border-[#2a2a2a]" value={cliente} onChange={e => setCliente(e.target.value)} />
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-white text-[10px] font-bold uppercase block mb-1">MÉTODOS APLICADOS</label>
                  <div className="flex-1 p-2 border border-white/10 bg-[#181818] rounded-lg overflow-y-auto">
                    {pagos.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-[10px] border-b border-white/5 py-1 text-white">
                        <span className="font-bold">{Utils.metodoLabel(p.metodo)}</span>
                        <span className="font-bold text-[#c8952e]">{Utils.fmtUSD(p.montoUSD)}</span>
                      </div>
                    ))}
                    {pagos.length === 0 && <div className="text-[10px] text-white/20 italic py-2 text-center">Sin abonos</div>}
                  </div>
                </div>
                <div className="p-3 border border-[#3a9bdc]/30 bg-[#3a9bdc]/5 rounded-lg text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <label className="text-white text-[10px] font-bold uppercase">SALDO RESTANTE</label>
                    <button onClick={() => setShowMultiModal(true)} className="btn-icon h-6 w-6 bg-[#c8952e] text-black"><Wallet className="w-3.5 h-3.5"/></button>
                  </div>
                  <div className={`text-2xl font-black ${saldoRestanteUSD <= 0.01 ? 'text-[#27ae60]' : 'text-[#3a9bdc]'}`}>
                    {saldoRestanteUSD <= 0.01 ? 'SALDADO' : Utils.fmtUSD(saldoRestanteUSD)}
                  </div>
                  <div className="bg-black py-2 rounded-lg border-2 border-white/20">
                    <label className="text-white text-[8px] font-bold uppercase block mb-1">EQUIVALENTE A PAGAR</label>
                    <div className="text-2xl font-black text-white">{Utils.fmtBS(saldoRestanteBS)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Derecho 2/3 (Carrito) */}
            <div className="w-2/3 flex flex-col gap-2 overflow-hidden">
              <div className="card flex-1 flex flex-col overflow-hidden bg-white border-none shadow-xl">
                {/* Cabecera del Carrito */}
                <div className="grid grid-cols-[1fr_80px_60px_70px_80px_80px_40px] gap-2 px-3 py-2 bg-[#131313] text-white text-[9px] font-black uppercase tracking-widest">
                  <div>Descripción</div><div className="text-center">Cant</div><div className="text-center">U.M.</div><div className="text-right">Precio ($)</div><div className="text-right">Precio (Bs)</div><div className="text-right">Total</div><div className="text-center"></div>
                </div>
                {/* Items del Carrito */}
                <div className="flex-1 overflow-y-auto p-1 space-y-1">
                  {state.carrito.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-black/10"><ShoppingCart className="w-12 h-12 mb-2"/><p className="font-bold uppercase text-[10px]">Vacío</p></div>
                  ) : (
                    state.carrito.map((item, i) => {
                      const product = state.productos.find(p => p.id === item.productoId);
                      return (
                        <div key={i} className="grid grid-cols-[1fr_80px_60px_70px_80px_80px_40px] gap-2 items-center px-2 py-1 bg-white border-b border-black/5 text-black">
                          <div className="flex flex-col min-w-0">
                            <div className="truncate font-black text-[10px] uppercase text-black">{item.nombre}</div>
                            <div className="text-[8px] font-bold text-black mono">{item.productoId}</div>
                          </div>
                          <div className="flex items-center justify-center gap-1 bg-black/5 rounded p-0.5">
                            <button onClick={() => updateQty(i, -1)} className="text-black font-black text-xs hover:bg-black/10 px-1 rounded">-</button>
                            <span className="w-5 text-center text-[10px] font-black">{item.cantidad}</span>
                            <button onClick={() => updateQty(i, 1)} className="text-black font-black text-xs hover:bg-black/10 px-1 rounded">+</button>
                          </div>
                          <div className="text-center text-[9px] font-black text-black">{product?.cantidad || '-'}</div>
                          <div className="text-right text-[10px] font-black text-black">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                          <div className="text-right text-[10px] font-black text-black">{Utils.fmtBS(item.precioUnitUSD * state.tasa)}</div>
                          <div className="text-right text-[11px] font-black text-black">{Utils.fmtUSD(item.subtotalUSD)}</div>
                          <div className="flex justify-center"><button onClick={() => updateQty(i, -item.cantidad)} className="text-black/30 hover:text-red-600"><Trash2 className="w-3.5 h-3.5"/></button></div>
                        </div>
                      )
                    })
                  )}
                </div>
                {/* Total Factura (Inferior Carrito) */}
                <div className="p-3 bg-[#131313] border-t border-[#2a2a2a] flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-white text-[10px] font-black uppercase block">TOTAL FACTURA</label>
                    <div className="flex items-baseline gap-2">
                      <div className="text-3xl font-black text-[#c8952e]">{Utils.fmtUSD(subtotalUSD)}</div>
                      <div className="text-sm font-bold text-white">{Utils.fmtBS(totalBS)}</div>
                    </div>
                  </div>
                  <button onClick={ejecutarVenta} disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01} className="btn btn-primary h-12 px-8 font-black uppercase text-xs disabled:opacity-20"><CheckCircle2 className="w-5 h-5 mr-2"/> PROCESAR</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card flex-1 bg-[#131313] text-white p-4">
          <div className="flex justify-between items-center mb-4"><h3 className="text-white font-bold uppercase">{view}</h3><button onClick={() => setView('pos')} className="btn btn-sm btn-secondary">Cerrar</button></div>
          <div className="text-center py-20 opacity-20 italic">Sección de {view} próximamente integrada...</div>
        </div>
      )}

      {/* Modal Abono */}
      {showMultiModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowMultiModal(false)}></div>
          <div className="modal-box max-w-[350px] bg-[#1e1e1e] border-2 border-white/20">
            <div className="modal-head py-3 px-4 border-b border-white/10"><h3 className="text-white text-xs font-black uppercase">REGISTRAR ABONO</h3><button onClick={() => setShowMultiModal(false)}><X className="text-white"/></button></div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-black p-3 rounded-lg text-center border border-white/10"><p className="text-white/40 text-[9px] font-bold uppercase mb-1">Pendiente</p><p className="text-2xl font-black text-[#3a9bdc]">{Utils.fmtUSD(saldoRestanteUSD)}</p><p className="text-xs text-white font-bold">{Utils.fmtBS(saldoRestanteBS)}</p></div>
              <div className="space-y-1"><label className="text-white text-[10px] font-bold uppercase">MÉTODO</label>
                <select className="form-select h-10 bg-[#0b0b0b] text-white border-white/20" value={metodoActual} onChange={e => setMetodoActual(e.target.value as any)}>
                  <option value="efectivo_usd">Efectivo USD</option><option value="efectivo_bs">Efectivo BS</option><option value="punto_venta">Punto de Venta</option><option value="pagomovil">Pago Movil</option><option value="biopago">Biopago</option><option value="zelle">Zelle</option>
                </select>
              </div>
              <div className="space-y-1"><label className="text-white text-[10px] font-bold uppercase">MONTO ({metodoActual.includes('usd') ? 'USD' : 'BS'})</label>
                <input type="number" className="form-input h-12 text-lg font-black bg-[#0b0b0b] text-white border-white/20" placeholder={metodoActual.includes('usd') ? saldoRestanteUSD.toFixed(2) : saldoRestanteBS.toFixed(2)} value={montoInput} onChange={e => setMontoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPago()} autoFocus />
              </div>
              <button className="btn btn-primary w-full h-12 font-black uppercase text-xs" onClick={addPago}>CONFIRMAR ABONO</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reportes Y/Z */}
      {showReport && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowReport(null)}></div>
          <div className="modal-box bg-white text-black max-w-[400px] font-mono p-6 text-[11px] leading-tight rounded">
            <div className="text-center space-y-1 mb-4">
              <h3 className="font-black text-sm uppercase">{state.empresa.nombre}</h3>
              <p>RIF: {state.empresa.rif}</p>
              <p>{state.empresa.direccion}</p>
              <h4 className="font-black border-y border-black py-1 mt-2">REPORTE "{showReport}"</h4>
            </div>
            {showReport === 'Y' ? (
              <div className="space-y-2">
                <div className="flex justify-between"><span>FECHA:</span><span>{Utils.fmtFecha(Utils.hoy())}</span></div>
                <div className="flex justify-between"><span>CAJERO:</span><span>ADMIN (ID: 001)</span></div>
                <div className="border-t border-dashed border-black my-2"></div>
                <div className="font-black">RESUMEN POR PAGO:</div>
                <div className="flex justify-between"><span>EFECTIVO USD:</span><span>{Utils.fmtUSD(state.ventas.filter(v => v.fecha === Utils.hoy() && v.metodoPago === 'efectivo_usd').reduce((s, v) => s + v.totalUSD, 0))}</span></div>
                <div className="flex justify-between"><span>EFECTIVO BS:</span><span>{Utils.fmtBS(state.ventas.filter(v => v.fecha === Utils.hoy() && v.metodoPago === 'efectivo_bs').reduce((s, v) => s + v.totalBS, 0))}</span></div>
                <div className="flex justify-between"><span>PUNTO/OTROS:</span><span>{Utils.fmtUSD(state.ventas.filter(v => v.fecha === Utils.hoy() && !v.metodoPago.includes('efectivo')).reduce((s, v) => s + v.totalUSD, 0))}</span></div>
                <div className="border-t border-dashed border-black my-2"></div>
                <div className="flex justify-between font-black"><span>TOTAL VENTAS:</span><span>{Utils.fmtUSD(state.ventas.filter(v => v.fecha === Utils.hoy()).reduce((s, v) => s + v.totalUSD, 0))}</span></div>
                <p className="text-center mt-4">--- FIN DE TURNO ---</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between font-black"><span>REPORTE Z #:</span><span>{String(state.ultimoZ).padStart(4, '0')}</span></div>
                <div className="flex justify-between"><span>FECHA FISCAL:</span><span>{Utils.fmtFecha(Utils.hoy())}</span></div>
                <div className="border-t border-dashed border-black my-2"></div>
                <div className="flex justify-between"><span>DESDE FACT:</span><span>{state.reportesZ[state.reportesZ.length-1]?.desdeFactura}</span></div>
                <div className="flex justify-between"><span>HASTA FACT:</span><span>{state.reportesZ[state.reportesZ.length-1]?.hastaFactura}</span></div>
                <div className="border-t border-dashed border-black my-2"></div>
                <div className="flex justify-between"><span>EXENTO USD:</span><span>$ 0.00</span></div>
                <div className="flex justify-between"><span>BASE IMP (16%):</span><span>{Utils.fmtUSD(state.reportesZ[state.reportesZ.length-1]?.baseImponibleUSD || 0)}</span></div>
                <div className="flex justify-between"><span>IVA RECAUDADO:</span><span>{Utils.fmtUSD(state.reportesZ[state.reportesZ.length-1]?.ivaUSD || 0)}</span></div>
                <div className="flex justify-between font-black border-t border-black pt-1"><span>TOTAL BRUTO:</span><span>{Utils.fmtUSD(state.reportesZ[state.reportesZ.length-1]?.totalBrutoUSD || 0)}</span></div>
                <div className="flex justify-between text-[9px] opacity-60 mt-4"><span>ACUMULADO HISTÓRICO:</span><span>{Utils.fmtUSD(state.reportesZ[state.reportesZ.length-1]?.acumuladoHistoricoUSD || 0)}</span></div>
                <p className="text-center mt-6">--- CIERRE DIARIO DEFINITIVO ---</p>
              </div>
            )}
            <button onClick={() => setShowReport(null)} className="btn btn-sm btn-secondary w-full mt-6 no-print">Cerrar Reporte</button>
            <button onClick={() => window.print()} className="btn btn-sm btn-primary w-full mt-2 no-print">Imprimir</button>
          </div>
        </div>
      )}
    </div>
  );
}
