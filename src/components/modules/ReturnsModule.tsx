"use client";

import React, { useState } from 'react';
import { AppState, Return, Sale, ReturnItem, Movimiento } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  RotateCcw, 
  Search, 
  X, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  ShoppingBag, 
  Undo2,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  History
} from 'lucide-react';

interface NewReturn {
  ventaId: string;
  items: ReturnItem[];
  metodoReembolso: 'EFECTIVO' | 'MISMO_METODO' | 'CREDITO_TIENDA';
  motivo: string;
}

export default function ReturnsModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [saleSearch, setSaleSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'EFECTIVO' | 'MISMO_METODO' | 'CREDITO_TIENDA'>('EFECTIVO');
  const [reason, setMotivo] = useState('');

  const buscarVenta = () => {
    const sale = state.ventas.find(v => v.id === saleSearch || v.id.endsWith(saleSearch));
    if (!sale) return alert('Venta no encontrada');
    
    setSelectedSale(sale);
    // Inicializar items de devolución vacíos
    setReturnItems([]);
  };

  const handleAddItem = (productoId: string, nombre: string, precioUnitUSD: number, maxQty: number) => {
    const alreadyReturned = state.devoluciones
      .filter(d => d.ventaId === selectedSale?.id)
      .flatMap(d => d.items)
      .filter(i => i.productoId === productoId)
      .reduce((sum, i) => sum + i.cantidad, 0);

    const availableToReturn = maxQty - alreadyReturned;

    if (availableToReturn <= 0) {
      return alert('Este producto ya ha sido devuelto en su totalidad.');
    }

    const qty = parseInt(prompt(`Cantidad a devolver (Máx: ${availableToReturn}):`, '1') || '0');
    if (isNaN(qty) || qty <= 0 || qty > availableToReturn) return alert('Cantidad no válida');

    const condition = confirm('¿El producto se encuentra APTO para la venta? (OK: Vuelve a stock, CANCEL: Va a merma/daño)') 
      ? 'REINTEGRADO_STOCK' 
      : 'MERMA_DANADO';

    setReturnItems([...returnItems, {
      productoId,
      nombre,
      cantidad: qty,
      precioUnitUSD,
      estadoProducto: condition as any
    }]);
  };

  const procesarDevolucion = () => {
    if (!selectedSale || returnItems.length === 0) return;
    if (!reason.trim()) return alert('Por favor indique el motivo de la devolución');

    const totalDevuelto = returnItems.reduce((s, i) => s + (i.cantidad * i.precioUnitUSD), 0);
    const idDev = 'DEV-' + Store.uid().toUpperCase().slice(0, 6);
    const ahoraStr = Utils.ahora();

    const nuevaDevolucion: Return = {
      id: idDev,
      ventaId: selectedSale.id,
      fecha: ahoraStr,
      items: [...returnItems],
      totalUSD: totalDevuelto,
      metodoReembolso: refundMethod,
      motivo: reason
    };

    // Actualizar Stock y Kardex
    const nuevosProductos = [...state.productos];
    const nuevosMovimientos: Movimiento[] = [];

    returnItems.forEach(item => {
      const pIdx = nuevosProductos.findIndex(p => p.id === item.productoId);
      if (pIdx >= 0) {
        const p = nuevosProductos[pIdx];
        const stockAntes = p.stock;
        
        // Solo sumamos al stock si está apto para la venta
        if (item.estadoProducto === 'REINTEGRADO_STOCK') {
          nuevosProductos[pIdx] = { ...p, stock: p.stock + item.cantidad };
        }

        nuevosMovimientos.push({
          id: Store.uid(),
          productoId: item.productoId,
          tipo: 'devolucion',
          cantidad: item.cantidad,
          stockAntes,
          stockDespues: nuevosProductos[pIdx].stock,
          fecha: ahoraStr,
          referencia: `DEVOLUCIÓN ${idDev} - REF VENTA ${selectedSale.id}`
        });
      }
    });

    // Actualizar estado de la venta original (Opcional, para visualización)
    const nuevasVentas = state.ventas.map(v => {
      if (v.id === selectedSale.id) {
        return { ...v, estado: 'parcialmente_devuelta' as any };
      }
      return v;
    });

    updateState({
      productos: nuevosProductos,
      devoluciones: [nuevaDevolucion, ...state.devoluciones],
      movimientos: [...state.movimientos, ...nuevosMovimientos],
      ventas: nuevasVentas
    });

    alert('Devolución procesada con éxito');
    setView('list');
    setSelectedSale(null);
    setReturnItems([]);
    setMotivo('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white font-black uppercase italic tracking-tighter text-xl flex items-center gap-2">
            <RotateCcw className="text-[#e04848]" /> Gestión de Devoluciones
          </h2>
          <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Auditoría y Reintegro de Mercancía</p>
        </div>
        <button 
          onClick={() => { setView(view === 'list' ? 'create' : 'list'); setSelectedSale(null); }} 
          className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary text-white'} h-10 px-6 font-black uppercase text-xs flex items-center gap-2`}
        >
          {view === 'list' ? <><RotateCcw className="w-4 h-4" /> Nueva Devolución</> : <><History className="w-4 h-4" /> Ver Historial</>}
        </button>
      </div>

      {view === 'list' ? (
        <div className="card animate-in fade-in duration-300">
          <div className="card-head bg-[#181818] border-b border-[#2a2a2a] px-5 py-4">
            <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#3a9bdc]" /> Historial Cronológico de Devoluciones
            </h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr className="bg-[#0b0b0b]">
                  <th className="text-white font-black text-[10px] uppercase">ID Devolución</th>
                  <th className="text-white font-black text-[10px] uppercase">Fecha</th>
                  <th className="text-white font-black text-[10px] uppercase">Venta Ref.</th>
                  <th className="text-white font-black text-[10px] uppercase">Items</th>
                  <th className="text-white font-black text-[10px] uppercase text-right">Total Devuelto</th>
                  <th className="text-white font-black text-[10px] uppercase">Reembolso</th>
                </tr>
              </thead>
              <tbody className="bg-[#131313]">
                {state.devoluciones.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-20 text-white font-black uppercase italic opacity-40">No hay devoluciones registradas</td></tr>
                ) : (
                  state.devoluciones.map(d => (
                    <tr key={d.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="text-[#e04848] font-black text-xs mono">{d.id}</td>
                      <td className="text-white font-bold text-xs">{Utils.fmtFecha(d.fecha)}</td>
                      <td className="text-white font-black text-xs mono opacity-60">{d.ventaId}</td>
                      <td className="text-white font-bold text-[10px] uppercase">
                        {d.items.length} productos
                      </td>
                      <td className="text-[#c8952e] font-black text-xs text-right">{Utils.fmtUSD(d.totalUSD)}</td>
                      <td><span className="badge badge-neutral font-black text-[9px] uppercase">{d.metodoReembolso}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="lg:col-span-2 space-y-4">
            {!selectedSale ? (
              <div className="card p-12 flex flex-col items-center justify-center text-center space-y-6 bg-[#131313] border-dashed border-2 border-white/10">
                <div className="p-5 bg-white/5 rounded-full"><Search className="w-10 h-10 text-white/20" /></div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-white font-black uppercase text-sm">Localizar Venta Original</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase">Ingrese el número de recibo impreso en el ticket del cliente para iniciar el proceso.</p>
                </div>
                <div className="flex gap-2 w-full max-w-sm">
                  <input 
                    className="form-input flex-1 h-12 bg-black border-[#2a2a2a] text-white font-black uppercase" 
                    placeholder="Ej: 000000024"
                    value={saleSearch}
                    onChange={e => setSaleSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && buscarVenta()}
                  />
                  <button onClick={buscarVenta} className="btn btn-primary h-12 px-6 font-black uppercase text-xs">Buscar</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="card bg-[#181818] border-[#3a9bdc]/30">
                  <div className="card-head py-3 px-5 border-b border-white/10 flex justify-between">
                    <h3 className="text-[#3a9bdc] font-black uppercase text-xs">Venta: {selectedSale.id}</h3>
                    <button onClick={() => setSelectedSale(null)} className="text-white/40 hover:text-white"><X className="w-4 h-4"/></button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr className="bg-black/40">
                          <th className="text-[9px] uppercase">Producto</th>
                          <th className="text-[9px] uppercase text-center">Cant. Compra</th>
                          <th className="text-[9px] uppercase text-right">Precio Hist.</th>
                          <th className="text-[9px] uppercase text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSale.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-white/5">
                            <td className="text-white font-bold text-xs uppercase">{item.nombre}</td>
                            <td className="text-white font-black text-xs text-center">{item.cantidad}</td>
                            <td className="text-white font-black text-xs text-right">{Utils.fmtUSD(item.precioUnitUSD)}</td>
                            <td className="text-center">
                              <button 
                                onClick={() => handleAddItem(item.productoId, item.nombre, item.precioUnitUSD, item.cantidad)}
                                className="btn btn-sm btn-secondary text-white font-black text-[9px] uppercase h-7"
                              >
                                Seleccionar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card bg-[#131313]">
                  <div className="card-head py-3 px-5 border-b border-white/10">
                    <h3 className="text-[#e04848] font-black uppercase text-xs flex items-center gap-2">
                      <Undo2 className="w-4 h-4"/> Ítems en la Devolución Actual
                    </h3>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr className="bg-black/40">
                          <th className="text-[9px] uppercase">Producto</th>
                          <th className="text-[9px] uppercase text-center">Cant.</th>
                          <th className="text-[9px] uppercase">Estado / Destino</th>
                          <th className="text-[9px] uppercase text-right">Subtotal</th>
                          <th className="text-[9px] uppercase text-center"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-white/5">
                            <td className="text-white font-bold text-xs uppercase">{item.nombre}</td>
                            <td className="text-[#e04848] font-black text-xs text-center">{item.cantidad}</td>
                            <td>
                              <span className={`badge ${item.estadoProducto === 'REINTEGRADO_STOCK' ? 'badge-ok' : 'badge-err'} font-black text-[8px] uppercase`}>
                                {item.estadoProducto.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="text-[#c8952e] font-black text-xs text-right">{Utils.fmtUSD(item.cantidad * item.precioUnitUSD)}</td>
                            <td className="text-center">
                              <button onClick={() => setReturnItems(returnItems.filter((_, i) => i !== idx))} className="text-white/20 hover:text-[#e04848]"><Trash2 className="w-3.5 h-3.5"/></button>
                            </td>
                          </tr>
                        ))}
                        {returnItems.length === 0 && (
                          <tr><td colSpan={5} className="text-center py-10 text-white/20 font-black uppercase italic text-[10px]">Añade productos de la venta original</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card bg-[#181818] border-[#e04848]/20 h-fit">
              <div className="card-head py-4 px-6 border-b border-white/10">
                <h3 className="text-white font-black uppercase text-xs">Finalizar Transacción</h3>
              </div>
              <div className="card-body p-6 space-y-6">
                <div className="bg-black/40 p-4 rounded-lg border border-white/10 text-center">
                  <p className="text-white/40 text-[9px] font-black uppercase mb-1">Total a Reembolsar</p>
                  <p className="text-3xl font-black text-[#e04848]">
                    {Utils.fmtUSD(returnItems.reduce((s, i) => s + (i.cantidad * i.precioUnitUSD), 0))}
                  </p>
                </div>

                <div className="form-group">
                  <label className="text-white text-[10px] font-black uppercase block mb-1">Método de Reembolso</label>
                  <select 
                    className="form-select bg-black text-white h-11 text-xs font-black uppercase border-white/20"
                    value={refundMethod}
                    onChange={e => setRefundMethod(e.target.value as any)}
                  >
                    <option value="EFECTIVO">Efectivo de Caja</option>
                    <option value="MISMO_METODO">Reverso (Mismo Método)</option>
                    <option value="CREDITO_TIENDA">Crédito / Vale Interno</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-white text-[10px] font-black uppercase block mb-1">Motivo de la Devolución</label>
                  <textarea 
                    className="form-textarea bg-black text-white text-xs min-h-[100px] border-white/20"
                    placeholder="Describa el porqué de la devolución..."
                    value={reason}
                    onChange={e => setMotivo(e.target.value)}
                  ></textarea>
                </div>

                <div className="p-3 bg-[#e04848]/5 rounded border border-[#e04848]/20 flex gap-3">
                   <AlertTriangle className="w-5 h-5 text-[#e04848] shrink-0" />
                   <p className="text-[9px] text-white/60 font-medium leading-tight">Esta acción generará una nota de crédito y ajustará el inventario según el estado del producto seleccionado.</p>
                </div>

                <button 
                  disabled={returnItems.length === 0 || !reason.trim()}
                  onClick={procesarDevolucion}
                  className="btn btn-primary w-full h-14 font-black uppercase text-xs shadow-xl shadow-[#e04848]/20 disabled:opacity-20"
                >
                  Confirmar Devolución
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}