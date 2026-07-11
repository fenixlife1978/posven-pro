'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppState, Product, Movimiento, KitItem, SaleItem } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Boxes, 
  X, 
  FileText, 
  History, 
  Layers, 
  ShoppingBag, 
  TrendingUp, 
  Box, 
  ClipboardList, 
  Info, 
  PlusCircle, 
  MinusCircle, 
  Check, 
  Filter, 
  PackageCheck, 
  AlertCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  generarPDFInventarioSimple, 
  exportarPDFInventarioGeneral, 
  exportarPDFVentasDetallado, 
  exportarPDFKardex, 
  exportarPDFHistorialAjustes, 
  exportarPDFConsumoInterno,
  exportarPDFDevoluciones
} from '@/lib/pdf-generator';

export function InventoryModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [activeTab, setActiveTab] = useState('productos');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [selectedKardexId, setSelectedKardexId] = useState<string | null>(null);
  
  const [showAjuste, setShowAjuste] = useState<string | null>(null);
  const [showProducto, setShowProducto] = useState<string | null | 'nuevo'>(null);
  
  const prods = (state.productos || []).filter(p => 
    p.activo && 
    (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())) &&
    (catFilter ? p.categoria === catFilter : true)
  );

  const lowStockCount = prods.filter(p => p.stock <= (p.stockMinimo || 0)).length;

  const eliminar = (id: string) => {
    if (!confirm('¿Seguro que desea eliminar este producto?')) return;
    const nuevos = state.productos.map(p => p.id === id ? { ...p, activo: false } : p);
    updateState({ productos: nuevos });
  };

  const renderContent = () => {
    switch(activeTab) {
      case 'productos': return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="kpi bg-white border-line p-6 rounded-2xl shadow-sm flex items-center gap-4">
              <div className="p-3 bg-brand-gold-soft rounded-xl"><PackageCheck className="w-6 h-6 text-brand-gold-deep" /></div>
              <div>
                <p className="text-[10px] font-black uppercase text-ink/40">Total Productos</p>
                <p className="text-2xl font-black text-ink">{prods.length}</p>
              </div>
            </div>
            <div className={`kpi p-6 rounded-2xl shadow-sm border-l-[6px] flex items-center gap-4 ${lowStockCount > 0 ? 'bg-status-danger-soft border-l-status-danger' : 'bg-white border-line'}`}>
              <div className={`p-3 rounded-xl ${lowStockCount > 0 ? 'bg-status-danger text-white' : 'bg-surface-soft text-ink/20'}`}>
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-ink/40">Stock Bajo</p>
                <p className={`text-2xl font-black ${lowStockCount > 0 ? 'text-status-danger' : 'text-ink'}`}>{lowStockCount}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex gap-4 flex-1 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-ink/30" />
                <Input 
                  className="pl-9 h-11 text-sm font-bold bg-white border-line" 
                  placeholder="Buscar producto por nombre o código..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-ink/30" />
                <select 
                  className="form-select h-11 bg-white border-line text-xs font-black uppercase"
                  value={catFilter} 
                  onChange={e => setCatFilter(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {(state.categorias || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="secondary" className="flex-1 md:flex-none h-11 font-black uppercase text-[10px]" onClick={() => generarPDFInventarioSimple(prods, state.empresa)}>
                <FileText className="w-4 h-4" /> PDF Simple
              </Button>
              <Button className="flex-1 md:flex-none h-11 bg-brand-gold hover:bg-brand-gold-deep text-ink font-black uppercase text-[10px] shadow-lg" onClick={() => setShowProducto('nuevo')}>
                <Plus className="w-4 h-4" /> Nuevo Ítem
              </Button>
            </div>
          </div>

          <div className="card bg-white border-line shadow-xl rounded-xl overflow-hidden">
            <div className="card-head bg-ink border-b border-white/10 px-6 py-4">
               <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
                 <Box className="w-5 h-5 text-brand-gold" /> CATALOGO MAESTRO DE INVENTARIO
               </h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr className="bg-surface-soft">
                    <th className="text-ink font-black uppercase text-[10px]">Código</th>
                    <th className="text-ink font-black uppercase text-[10px]">Nombre Producto</th>
                    <th className="text-ink font-black uppercase text-[10px]">Categoría</th>
                    <th className="text-ink font-black uppercase text-[10px] text-right">Costo ($)</th>
                    <th className="text-ink font-black uppercase text-[10px] text-right">Venta ($)</th>
                    <th className="text-ink font-black uppercase text-[10px] text-center">Stock</th>
                    <th className="text-ink font-black uppercase text-[10px] text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {prods.length === 0 ? (
                    <tr><TableCell colSpan={7} className="text-center py-20 text-ink/20 font-black italic uppercase">No se encontraron productos coincidentes</TableCell></tr>
                  ) : (
                    prods.map(p => (
                      <tr key={p.id} className="border-b border-line/30 hover:bg-surface-warm/20 transition-colors">
                        <td className="mono text-xs font-black text-ink">{p.codigo}</td>
                        <td className="font-bold text-ink uppercase">
                          <div className="flex items-center gap-2">
                            {p.isKit && <Layers className="w-3.5 h-3.5 text-brand-gold" />}
                            {p.nombre}
                          </div>
                        </td>
                        <td><span className="badge badge-neutral text-ink font-black uppercase text-[9px]">{p.categoria}</span></td>
                        <td className="mono font-bold text-ink/50 text-right">{Utils.fmtUSD(p.costoUSD)}</td>
                        <td className="mono text-brand-gold-deep font-black text-right">{Utils.fmtUSD(p.precioUSD)}</td>
                        <td className="text-center">
                          <span className={`badge ${p.stock <= (p.stockMinimo || 0) ? 'badge-err' : 'badge-neutral'} font-black text-xs min-w-[40px]`}>
                            {p.stock}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-center gap-1">
                            <button className="btn-icon h-8 w-8 text-ink hover:text-brand-gold" onClick={() => setShowProducto(p.id)}><Edit2 className="w-4 h-4" /></button>
                            <button className="btn-icon h-8 w-8 text-ink hover:text-status-info" onClick={() => { setSelectedKardexId(p.id); setActiveTab('kardex'); }}><History className="w-4 h-4" /></button>
                            <button className="btn-icon h-8 w-8 text-ink hover:text-status-success" onClick={() => setShowAjuste(p.id)}><Boxes className="w-4 h-4" /></button>
                            <button className="btn-icon h-8 w-8 text-ink hover:text-status-danger" onClick={() => eliminar(p.id)}><Trash2 className="w-4 h-4" /></button>
                          </div>
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
      case 'reporte_general': return <ReporteGeneral state={state} />;
      case 'reporte_ventas': return <ReporteVentas state={state} />;
      case 'reporte_devoluciones': return <ReporteDevoluciones state={state} />;
      case 'historial_ajustes': return <HistorialAjustes state={state} />;
      case 'kardex': return <ReporteKardex state={state} selectedId={selectedKardexId} onSelect={setSelectedKardexId} />;
      case 'consumo_colab': return <ReporteConsumo state={state} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="tabs border-b border-line no-print">
        <button onClick={() => setActiveTab('productos')} className={`tab ${activeTab === 'productos' ? 'active' : 'text-ink font-black'}`}>Productos</button>
        <button onClick={() => setActiveTab('reporte_general')} className={`tab ${activeTab === 'reporte_general' ? 'active' : 'text-ink font-black'}`}>Inventario CPP</button>
        <button onClick={() => setActiveTab('reporte_ventas')} className={`tab ${activeTab === 'reporte_ventas' ? 'active' : 'text-ink font-black'}`}>Ventas</button>
        <button onClick={() => setActiveTab('reporte_devoluciones')} className={`tab ${activeTab === 'reporte_devoluciones' ? 'active' : 'text-ink font-black'}`}>Devoluciones</button>
        <button onClick={() => setActiveTab('kardex')} className={`tab ${activeTab === 'kardex' ? 'active' : 'text-ink font-black'}`}>Kardex</button>
        <button onClick={() => setActiveTab('historial_ajustes')} className={`tab ${activeTab === 'historial_ajustes' ? 'active' : 'text-ink font-black'}`}>Ajustes</button>
        <button onClick={() => setActiveTab('consumo_colab')} className={`tab ${activeTab === 'consumo_colab' ? 'active' : 'text-ink font-black'}`}>Consumo</button>
      </div>

      <div className="animate-in fade-in duration-300">
        {renderContent()}
      </div>

      {showProducto && (
        <ModalProducto 
          state={state}
          producto={showProducto === 'nuevo' ? undefined : state.productos.find(p => p.id === showProducto)}
          onClose={() => setShowProducto(null)}
          onUpdateLists={(lists) => updateState(lists)}
          onSave={(datos) => {
            let nuevosProds;
            if (showProducto === 'nuevo') {
              const nuevo: Product = {
                ...datos,
                id: Store.uid(),
                fechaCreacion: Utils.hoy(),
                activo: true
              };
              nuevosProds = [...state.productos, nuevo];
              if (nuevo.stock > 0) {
                const mov: Movimiento = {
                  id: Store.uid(),
                  productoId: nuevo.id,
                  tipo: 'inicial' as any,
                  cantidad: nuevo.stock,
                  stockAntes: 0,
                  stockDespues: nuevo.stock,
                  fecha: Utils.ahora(),
                  referencia: 'INICIAL'
                };
                updateState({ productos: nuevosProds, movimientos: [...state.movimientos, mov] });
              } else {
                updateState({ productos: nuevosProds });
              }
            } else {
              nuevosProds = state.productos.map(p => p.id === showProducto ? { ...p, ...datos } : p);
              updateState({ productos: nuevosProds });
            }
            setShowProducto(null);
          }}
        />
      )}

      {showAjuste && (
        <ModalAjuste 
          producto={state.productos.find(p => p.id === showAjuste)!} 
          onClose={() => setShowAjuste(null)}
          onSave={(mov, nuevoCosto) => {
            const nuevosProds = state.productos.map(p => {
              if (p.id === mov.productoId) {
                let finalCosto = p.costoUSD;
                if (mov.tipo === 'ajuste_entrada' || mov.tipo === 'compra') {
                  const stockActual = p.stock;
                  const cantidadNueva = Math.abs(mov.cantidad);
                  const costoNuevo = nuevoCosto || p.costoUSD;
                  const stockTotal = stockActual + cantidadNueva;
                  if (stockTotal > 0) {
                    finalCosto = Utils.round(((stockActual * p.costoUSD) + (cantidadNueva * costoNuevo)) / stockTotal);
                  }
                }
                return { ...p, stock: mov.stockDespues, costoUSD: finalCosto };
              }
              return p;
            });
            updateState({ 
              productos: nuevosProds, 
              movimientos: [...state.movimientos, mov] 
            });
            setShowAjuste(null);
          }}
        />
      )}
    </div>
  );
}

function ReporteGeneral({ state }: { state: AppState }) {
  const filteredProducts = state.productos.filter(p => p.activo);
  const totalCosto = Utils.round(filteredProducts.reduce((acc, p) => acc + (p.costoUSD * p.stock), 0));
  const totalVenta = Utils.round(filteredProducts.reduce((acc, p) => acc + (p.precioUSD * p.stock), 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="kpi p-6 border-line shadow-md bg-white rounded-2xl">
          <div className="text-[10px] font-black uppercase mb-1 text-ink opacity-60">Valor al Costo (CPP Total)</div>
          <div className="text-3xl font-black text-ink">{Utils.fmtUSD(totalCosto)}</div>
        </div>
        <div className="kpi p-6 border-line shadow-md bg-white rounded-2xl">
          <div className="text-[10px] font-black uppercase mb-1 text-ink opacity-60">Valor al Precio de Venta (Total)</div>
          <div className="text-3xl font-black text-status-success">{Utils.fmtUSD(totalVenta)}</div>
        </div>
      </div>
      
      <div className="card shadow-lg border-line rounded-xl overflow-hidden bg-white">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <Boxes className="w-5 h-5 text-brand-gold" /> INVENTARIO VALORIZADO ACTUAL
          </h3>
          <button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px]" onClick={() => exportarPDFInventarioGeneral(filteredProducts, state.empresa, 'categoria', { costo: totalCosto, venta: totalVenta })}>
            PDF Profesional
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Cod.</th>
                <th className="font-black text-ink uppercase text-[10px]">Producto</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Costo Unit.</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Venta Unit.</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Stock</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Subtotal Costo</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id} className="border-b border-line/30">
                  <td className="mono text-[11px] font-black text-ink">{p.codigo}</td>
                  <td className="font-black uppercase text-xs text-ink">{p.nombre}</td>
                  <td className="mono text-right text-xs font-bold text-ink/60">{Utils.fmtUSD(p.costoUSD)}</td>
                  <td className="mono text-right text-brand-gold-deep font-black">{Utils.fmtUSD(p.precioUSD)}</td>
                  <td className="text-center py-3 px-4"><span className="badge badge-neutral font-black">{p.stock}</span></td>
                  <td className="mono text-right font-black text-ink">{Utils.fmtUSD(Utils.round(p.costoUSD * p.stock))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReporteVentas({ state }: { state: AppState }) {
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());
  const [useDates, setUseDates] = useState(false);

  const filteredVentas = useMemo(() => {
    return state.ventas.filter(v => {
      const d = v.fecha.slice(0, 10);
      if (!useDates) return d === Utils.hoy();
      return d >= desde && d <= hasta;
    });
  }, [state.ventas, desde, hasta, useDates]);

  const groupedVentas = useMemo(() => {
    const groups: Record<string, { nombre: string, cantidad: number, totalUSD: number }> = {};
    filteredVentas.forEach(v => {
      v.items.forEach(item => {
        if (!groups[item.productoId]) {
          groups[item.productoId] = { nombre: item.nombre, cantidad: 0, totalUSD: 0 };
        }
        groups[item.productoId].cantidad += item.cantidad;
        groups[item.productoId].totalUSD += item.subtotalUSD;
      });
    });
    return Object.values(groups).sort((a, b) => b.cantidad - a.cantidad);
  }, [filteredVentas]);

  return (
    <div className="space-y-4">
      <div className="card p-5 bg-white border-line flex flex-wrap gap-4 items-end shadow-sm no-print">
        <div className="flex items-center gap-3 bg-surface-soft p-1 rounded-lg border border-line">
           <button onClick={() => setUseDates(false)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${!useDates ? 'bg-ink text-white' : 'text-ink/40'}`}>Hoy</button>
           <button onClick={() => setUseDates(true)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${useDates ? 'bg-brand-gold text-white' : 'text-ink/40'}`}>Periodo</button>
        </div>
        {useDates && (
           <div className="flex items-center gap-2">
              <input type="date" className="form-input h-8 text-xs font-bold" value={desde} onChange={e => setDesde(e.target.value)} />
              <input type="date" className="form-input h-8 text-xs font-bold" value={hasta} onChange={e => setHasta(e.target.value)} />
           </div>
        )}
      </div>

      <div className="card bg-white shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 text-white">
           <h3 className="font-black text-xs uppercase italic tracking-tighter">RESUMEN DE VENTAS POR PRODUCTO</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Producto / Ítem</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Unidades Vendidas</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Recaudado (USD)</th>
              </tr>
            </thead>
            <tbody>
              {groupedVentas.length === 0 ? (
                <tr><TableCell colSpan={3} className="text-center py-20 text-ink/20 font-black italic uppercase">Sin ventas registradas</TableCell></tr>
              ) : (
                groupedVentas.map((g, idx) => (
                  <tr key={idx} className="border-b border-line/30 hover:bg-surface-warm/20 transition-colors">
                    <td className="font-black uppercase text-xs text-ink">{g.nombre}</td>
                    <td className="text-center font-black mono text-ink">{g.cantidad}</td>
                    <td className="text-right font-black text-brand-gold-deep mono">{Utils.fmtUSD(g.totalUSD)}</td>
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

function ReporteDevoluciones({ state }: { state: AppState }) {
  const devoluciones = state.devoluciones || [];
  const totalUSD = devoluciones.reduce((acc, d) => acc + d.totalUSD, 0);

  return (
    <div className="space-y-4">
      <div className="card shadow-lg border-line rounded-xl overflow-hidden bg-white">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center text-white">
          <h3 className="font-black text-xs uppercase italic tracking-tighter">HISTORIAL DE DEVOLUCIONES</h3>
          <button className="btn btn-secondary h-8 px-4 font-black text-[9px]" onClick={() => exportarPDFDevoluciones(devoluciones, state.empresa, 'Histórico', { totalUSD })}>PDF</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="text-[10px] font-black uppercase text-left">Fecha</th>
                <th className="text-[10px] font-black uppercase text-left">Venta Ref.</th>
                <th className="text-[10px] font-black uppercase text-right">Total Dev.</th>
                <th className="text-[10px] font-black uppercase text-left">Motivo</th>
              </tr>
            </thead>
            <tbody>
               {devoluciones.map(d => (
                 <tr key={d.id} className="border-b border-line/30">
                   <td className="text-xs font-bold text-ink">{Utils.fmtFecha(d.fecha)}</td>
                   <td className="text-xs font-black mono text-ink">{d.ventaId}</td>
                   <td className="text-right font-black text-status-danger">{Utils.fmtUSD(d.totalUSD)}</td>
                   <td className="text-xs italic uppercase opacity-60 text-ink">{d.motivo}</td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HistorialAjustes({ state }: { state: AppState }) {
  const ajustes = state.movimientos.filter(m => 
    ['ajuste_entrada', 'ajuste_salida', 'consumo', 'colaboracion', 'compra', 'inicial'].includes(m.tipo)
  ).sort((a,b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="card shadow-lg border-line rounded-xl overflow-hidden bg-white">
      <div className="table-wrap">
        <table>
          <thead className="bg-surface-soft">
            <tr>
              <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
              <th className="font-black text-ink uppercase text-[10px]">Producto</th>
              <th className="font-black text-ink uppercase text-[10px]">Operación</th>
              <th className="font-black text-ink uppercase text-[10px] text-center">Cant</th>
              <th className="font-black text-ink uppercase text-[10px]">Motivo / Ref</th>
            </tr>
          </thead>
          <tbody>
            {ajustes.map(m => (
              <tr key={m.id} className="border-b border-line/30">
                <td className="text-xs font-bold text-ink">{m.fecha.slice(0,16).replace('T', ' ')}</td>
                <td className="font-black uppercase text-xs text-ink">{state.productos.find(p => p.id === m.productoId)?.nombre || 'ELIMINADO'}</td>
                <td><span className="badge badge-neutral text-[9px] font-black uppercase">{m.tipo}</span></td>
                <td className={`text-center font-black ${m.cantidad > 0 ? 'text-status-success' : 'text-status-danger'}`}>{m.cantidad}</td>
                <td className="text-[10px] opacity-40 italic uppercase text-ink">{m.referencia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReporteConsumo({ state }: { state: AppState }) {
  const consumos = state.movimientos.filter(m => ['consumo', 'colaboracion'].includes(m.tipo)).sort((a,b) => b.fecha.localeCompare(a.fecha));
  return (
    <div className="card shadow-lg border-line rounded-xl overflow-hidden bg-white">
      <div className="table-wrap">
        <table>
          <thead className="bg-surface-soft">
            <tr>
              <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
              <th className="font-black text-ink uppercase text-[10px]">Producto</th>
              <th className="font-black text-ink uppercase text-[10px] text-center">Cant</th>
              <th className="font-black text-ink uppercase text-[10px]">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {consumos.map(m => (
              <tr key={m.id} className="border-b border-line/30">
                <td className="text-xs font-bold text-ink">{m.fecha.slice(0,10)}</td>
                <td className="font-black uppercase text-xs text-ink">{state.productos.find(p => p.id === m.productoId)?.nombre}</td>
                <td className={`text-center font-black text-status-danger`}>{Math.abs(m.cantidad)}</td>
                <td className="text-[10px] uppercase font-bold opacity-40 text-ink">{m.referencia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReporteKardex({ state, selectedId, onSelect }: { state: AppState, selectedId: string | null, onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const selectedProd = selectedId ? state.productos.find(p => p.id === selectedId) : null;
  const movs = selectedId ? state.movimientos.filter(m => m.productoId === selectedId).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [];

  const matches = useMemo(() => {
    if (search.trim().length < 2) return [];
    return state.productos.filter(p => 
      p.activo && 
      (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.includes(search))
    ).slice(0, 5);
  }, [search, state.productos]);

  return (
    <div className="space-y-4">
      <div className="card p-5 bg-white border-line shadow-sm rounded-xl">
        <label className="text-[10px] font-black uppercase text-ink opacity-40 block mb-2">Buscar producto para ver Kardex</label>
        <div className="relative">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Escriba nombre o código..." className="h-12 text-sm font-bold bg-white" />
          {matches.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-line shadow-2xl z-50 mt-1 rounded-xl overflow-hidden">
              {matches.map(p => (
                <div key={p.id} className="p-4 border-b border-line hover:bg-brand-gold-soft cursor-pointer transition-all flex justify-between items-center" onClick={() => { onSelect(p.id); setSearch(''); }}>
                  <div><p className="font-black uppercase text-xs text-ink">{p.nombre}</p><p className="text-[10px] opacity-40 text-ink">{p.codigo}</p></div>
                  <Check className="w-4 h-4 text-brand-gold" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedProd && (
        <div className="card overflow-hidden shadow-lg border-line rounded-xl bg-white">
          <div className="card-head bg-ink text-white px-6 py-3 flex justify-between items-center">
            <h3 className="font-black text-xs uppercase tracking-widest text-brand-gold">{selectedProd.nombre}</h3>
            <button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px]" onClick={() => exportarPDFKardex(selectedProd, movs, state.empresa)}>Exportar Kardex</button>
          </div>
          <div className="table-wrap">
             <table>
                <thead className="bg-surface-soft">
                   <tr>
                      <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
                      <th className="font-black text-ink uppercase text-[10px]">Tipo</th>
                      <th className="font-black text-ink uppercase text-[10px] text-center">Cant</th>
                      <th className="font-black text-ink uppercase text-[10px] text-center">Stock Final</th>
                      <th className="font-black text-ink uppercase text-[10px]">Referencia</th>
                   </tr>
                </thead>
                <tbody>
                   {movs.map(m => (
                      <tr key={m.id} className="border-b border-line/30">
                         <td className="text-xs font-bold text-ink">{m.fecha.replace('T', ' ')}</td>
                         <td><span className="badge badge-neutral text-[9px] uppercase font-black">{m.tipo}</span></td>
                         <td className={`text-center font-black ${m.cantidad > 0 ? 'text-status-success' : 'text-status-danger'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</td>
                         <td className="text-center font-bold text-ink">{m.stockDespues}</td>
                         <td className="text-[10px] italic opacity-40 uppercase text-ink">{m.referencia}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalAjuste({ producto, onClose, onSave }: { producto: Product, onClose: () => void, onSave: (m: Movimiento, nuevoCosto?: number) => void }) {
  const [tipo, setTipo] = useState<'ajuste_entrada' | 'ajuste_salida' | 'consumo' | 'colaboracion'>('ajuste_entrada');
  const [cantidad, setCantidad] = useState<string>('1');
  const [nuevoCosto, setNuevoCosto] = useState<string>(String(producto.costoUSD));
  const [motivo, setMotivo] = useState('');

  const handleSave = () => {
    const pCant = parseFloat(cantidad) || 0;
    const pCosto = parseFloat(nuevoCosto) || 0;
    if (pCant <= 0) return alert('Cantidad invalida');
    if (!motivo.trim()) return alert('Por favor indique el motivo del ajuste');

    const mov: Movimiento = {
      id: Store.uid(),
      productoId: producto.id,
      tipo,
      cantidad: tipo === 'ajuste_entrada' ? pCant : -Math.abs(pCant),
      stockAntes: producto.stock,
      stockDespues: tipo === 'ajuste_entrada' ? producto.stock + pCant : producto.stock - Math.abs(pCant),
      fecha: Utils.ahora(),
      referencia: motivo.toUpperCase()
    };
    onSave(mov, tipo === 'ajuste_entrada' ? pCosto : undefined);
  };

  return (
    <div className="modal show"><div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-white max-w-md border-2 border-line rounded-xl overflow-hidden shadow-2xl">
        <div className="modal-head px-5 py-4 border-b border-line bg-surface-soft">
          <h3 className="text-ink font-black uppercase text-sm">AJUSTAR: {producto.nombre.toUpperCase()}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-ink" /></button>
        </div>
        <div className="modal-body p-6 space-y-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
             <div className="form-group"><label className="text-[10px] font-black uppercase text-ink/60 mb-1 block">Tipo</label>
               <select className="form-select h-10 text-xs font-bold" value={tipo} onChange={e => setTipo(e.target.value as any)}>
                 <option value="ajuste_entrada">Entrada (+)</option>
                 <option value="ajuste_salida">Salida (-)</option>
               </select>
             </div>
             <div className="form-group"><label className="text-[10px] font-black uppercase text-ink/60 mb-1 block">Cantidad</label>
               <Input className="h-10 text-center font-black bg-white" type="text" value={cantidad} onChange={e => setCantidad(e.target.value)} />
             </div>
          </div>
          <div className="form-group">
            <label className="text-[10px] font-black uppercase text-ink/60 mb-1 block">Motivo del Ajuste</label>
            <Input 
              className="h-10 text-xs font-black uppercase bg-white" 
              placeholder="Ej: ERROR DE CONTEO, DAÑO, ETC..." 
              value={motivo} 
              onChange={e => setMotivo(e.target.value)} 
            />
          </div>
          <Button className="btn btn-primary w-full h-12 font-black uppercase text-xs shadow-md mt-2" onClick={handleSave}>Procesar Ajuste</Button>
        </div>
      </div>
    </div>
  );
}

function ModalProducto({ producto, state, onClose, onSave, onUpdateLists }: { producto?: Product, state: AppState, onClose: () => void, onSave: (p: any) => void, onUpdateLists: (l: any) => void }) {
  const [activeTab, setActiveTab] = useState<'general' | 'precios' | 'kit'>('general');
  const [datos, setDatos] = useState<any>({
    codigo: producto?.codigo || '',
    nombre: producto?.nombre || '',
    categoria: producto?.categoria || state.categorias[0] || '',
    marca: producto?.marca || state.marcas[0] || '',
    costoUSD: producto?.costoUSD?.toString() ?? '0',
    margen: producto?.margen?.toString() ?? '0',
    precioUSD: producto?.precioUSD?.toString() ?? '0',
    precioBS: producto ? (producto.precioUSD * state.tasa).toFixed(2) : '0',
    precioMayorUSD: producto?.precioMayorUSD?.toString() ?? '0',
    precioOfertaUSD: producto?.precioOfertaUSD?.toString() ?? '0',
    precioPromoUSD: producto?.precioPromoUSD?.toString() ?? '0',
    stock: producto?.stock?.toString() ?? '0',
    stockMinimo: producto?.stockMinimo?.toString() ?? '3',
    aplicaIVA: producto?.aplicaIVA ?? false,
    isKit: producto?.isKit || false,
    kitType: producto?.kitType || 'stock_propio',
    kitItems: producto?.kitItems || [],
    proveedor: producto?.proveedor || ''
  });

  const [kitSearch, setKitSearch] = useState('');
  const filteredProdsForKit = useMemo(() => {
    if (kitSearch.length < 2) return [];
    return state.productos.filter(p => !p.isKit && (p.nombre.toLowerCase().includes(kitSearch.toLowerCase()) || p.codigo.toLowerCase().includes(kitSearch.toLowerCase()))).slice(0, 5);
  }, [kitSearch, state.productos]);

  const validarDecimal = (val: string) => /^[\d]*\.?[\d]*$/.test(val) || val === '';

  const recalcularTridireccional = (field: 'margen' | 'precioUSD' | 'precioBS', value: string) => {
    if (!validarDecimal(value)) return;
    const cost = parseFloat(datos.costoUSD) || 0;
    const val = parseFloat(value) || 0;
    const tasa = state.tasa;

    let newMargen = parseFloat(datos.margen) || 0;
    let newUSD = parseFloat(datos.precioUSD) || 0;
    let newBS = parseFloat(datos.precioBS) || 0;

    if (field === 'margen') {
      newMargen = val;
      if (newMargen < 100) {
        newUSD = cost / (1 - (newMargen / 100));
        newBS = newUSD * tasa;
      }
    } else if (field === 'precioUSD') {
      newUSD = val;
      if (newUSD > 0) {
        newMargen = ((newUSD - cost) / newUSD) * 100;
        newBS = newUSD * tasa;
      }
    } else if (field === 'precioBS') {
      newBS = val;
      if (newBS > 0) {
        newUSD = newBS / tasa;
        newMargen = ((newUSD - cost) / newUSD) * 100;
      }
    }

    setDatos({
      ...datos,
      [field]: value,
      margen: field === 'margen' ? value : newMargen.toFixed(2),
      precioUSD: field === 'precioUSD' ? value : newUSD.toFixed(2),
      precioBS: field === 'precioBS' ? value : newBS.toFixed(2)
    });
  };

  const handleAddListItem = (listName: 'categorias' | 'marcas') => {
    const newVal = prompt(`Ingrese nueva opción para ${listName.toUpperCase()}:`);
    if (newVal) {
      onUpdateLists({ [listName]: [...(state[listName] || []), newVal] });
      setDatos((prev: any) => ({ ...prev, [listName === 'categorias' ? 'categoria' : 'marca']: newVal }));
    }
  };

  const handleRemoveListItem = (listName: 'categorias' | 'marcas', current: string) => {
    if (confirm(`¿Eliminar "${current}" de la lista?`)) {
      const newList = (state[listName] || []).filter(i => i !== current);
      onUpdateLists({ [listName]: newList });
      setDatos((prev: any) => ({ ...prev, [listName === 'categorias' ? 'categoria' : 'marca']: newList[0] || '' }));
    }
  };

  const handleSave = () => {
    if (!datos.nombre || !datos.codigo) return alert('Nombre y Código requeridos');
    onSave({
      ...datos,
      costoUSD: parseFloat(datos.costoUSD) || 0,
      margen: parseFloat(datos.margen) || 0,
      precioUSD: parseFloat(datos.precioUSD) || 0,
      precioMayorUSD: parseFloat(datos.precioMayorUSD) || 0,
      precioOfertaUSD: parseFloat(datos.precioOfertaUSD) || 0,
      precioPromoUSD: parseFloat(datos.precioPromoUSD) || 0,
      stock: parseFloat(datos.stock) || 0,
      stockMinimo: parseFloat(datos.stockMinimo) || 0
    });
  };

  return (
    <div className="modal show"><div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-white max-w-2xl border-2 border-line rounded-xl overflow-hidden shadow-2xl">
        <div className="modal-head py-4 px-6 border-b border-line bg-ink flex justify-between items-center text-white">
          <h3 className="font-black uppercase italic tracking-tighter text-sm flex items-center gap-2">
            <Box className="w-5 h-5 text-brand-gold" /> {producto ? 'EDITAR FICHA' : 'NUEVO ÍTEM / PRODUCTO'}
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex bg-surface-soft border-b border-line">
          <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'general' ? 'border-brand-gold text-brand-gold bg-white' : 'border-transparent text-ink/40'}`}>General</button>
          <button onClick={() => setActiveTab('precios')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'precios' ? 'border-brand-gold text-brand-gold bg-white' : 'border-transparent text-ink/40'}`}>Precios</button>
          <button onClick={() => setActiveTab('kit')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'kit' ? 'border-brand-gold text-brand-gold bg-white' : 'border-transparent text-ink/40'}`}>Kits / Combos</button>
        </div>

        <div className="modal-body p-6 space-y-6 bg-white max-h-[70vh] overflow-y-auto">
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-ink/50 block">Código (Scanner/Manual)</label>
                  <Input className="h-10 font-black text-ink bg-white" value={datos.codigo} onChange={e => setDatos({...datos, codigo: e.target.value})} placeholder="00000000" autoFocus />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-ink/50 block">Nombre del Producto</label>
                  <Input className="h-10 font-black text-ink uppercase bg-white" value={datos.nombre} onChange={e => setDatos({...datos, nombre: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black uppercase text-ink/50">Categoría</label>
                    <div className="flex gap-1">
                      <button onClick={() => handleAddListItem('categorias')} className="text-brand-gold"><PlusCircle className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleRemoveListItem('categorias', datos.categoria)} className="text-status-danger"><MinusCircle className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                  <select className="form-select h-10 text-xs font-bold bg-white" value={datos.categoria} onChange={e => setDatos({...datos, categoria: e.target.value})}>
                    {(state.categorias || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-ink/50 block">Proveedor</label>
                   <select className="form-select h-10 text-xs font-bold bg-white" value={datos.proveedor} onChange={e => setDatos({...datos, proveedor: e.target.value})}>
                     <option value="">SIN ASIGNAR</option>
                     {state.proveedores.map((p: any) => {
                       const name = typeof p === 'string' ? p : p.nombre;
                       const id = typeof p === 'string' ? p : p.id;
                       return <option key={id} value={name}>{name?.toUpperCase()}</option>;
                     })}
                   </select>
                 </div>
              </div>
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div className={`p-3 bg-surface-soft border border-line rounded-xl text-center ${producto ? 'opacity-50' : ''}`}>
                     <label className="text-[9px] font-black uppercase text-ink/50 block mb-1">Stock Inicial</label>
                     <Input 
                        className="bg-transparent border-none text-center font-black text-xl w-full focus:outline-none" 
                        disabled={!!producto}
                        value={datos.stock} 
                        onChange={e => setDatos({...datos, stock: e.target.value})} 
                      />
                   </div>
                   <div className="p-3 bg-status-danger-soft border border-status-danger/20 rounded-xl text-center">
                     <label className="text-[9px] font-black uppercase text-status-danger/70 block mb-1">Mínimo</label>
                     <Input className="bg-transparent border-none text-center font-black text-xl w-full text-status-danger focus:outline-none" value={datos.stockMinimo} onChange={e => setDatos({...datos, stockMinimo: e.target.value})} />
                   </div>
                 </div>
                 <div className="flex items-center gap-3 p-4 bg-surface-soft rounded-xl border border-line">
                   <button onClick={() => setDatos({...datos, aplicaIVA: !datos.aplicaIVA})} className={`w-12 h-6 rounded-full transition-all relative ${datos.aplicaIVA ? 'bg-status-success' : 'bg-ink/20'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${datos.aplicaIVA ? 'right-1' : 'left-1'}`} /></button>
                   <label className="text-[10px] font-black uppercase text-ink cursor-pointer" onClick={() => setDatos({...datos, aplicaIVA: !datos.aplicaIVA})}>Aplica IVA (16%)</label>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'precios' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-surface-soft p-5 rounded-2xl border border-line shadow-inner">
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-ink/50">Costo ($)</label><Input className="h-12 font-black text-lg bg-white" value={datos.costoUSD} onChange={e => setDatos({...datos, costoUSD: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-brand-gold-deep">Margen %</label><Input className="h-12 font-black text-lg text-brand-gold-deep bg-white" value={datos.margen} onChange={e => recalcularTridireccional('margen', e.target.value)} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-status-success">Venta ($)</label><Input className="h-12 font-black text-lg text-status-success bg-white" value={datos.precioUSD} onChange={e => recalcularTridireccional('precioUSD', e.target.value)} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-ink">Venta (BS)</label><Input className="h-12 font-black text-lg bg-white" value={datos.precioBS} onChange={e => recalcularTridireccional('precioBS', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                 <div className="space-y-1"><label className="text-[9px] font-black uppercase text-ink/40">P. Mayor ($)</label><Input className="h-10 font-bold bg-white" value={datos.precioMayorUSD} onChange={e => setDatos({...datos, precioMayorUSD: e.target.value})} /></div>
                 <div className="space-y-1"><label className="text-[9px] font-black uppercase text-ink/40">P. Descuento ($)</label><Input className="h-10 font-bold bg-white" value={datos.precioOfertaUSD} onChange={e => setDatos({...datos, precioOfertaUSD: e.target.value})} /></div>
                 <div className="space-y-1"><label className="text-[9px] font-black uppercase text-ink/40">P. Promo ($)</label><Input className="h-10 font-bold bg-white" value={datos.precioPromoUSD} onChange={e => setDatos({...datos, precioPromoUSD: e.target.value})} /></div>
              </div>
            </div>
          )}

          {activeTab === 'kit' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 p-4 bg-ink text-white rounded-xl">
                <div className="flex items-center gap-3">
                  <button onClick={() => setDatos({...datos, isKit: !datos.isKit})} className={`w-12 h-6 rounded-full transition-all relative ${datos.isKit ? 'bg-brand-gold' : 'bg-white/20'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${datos.isKit ? 'right-1' : 'left-1'}`} /></button>
                  <label className="text-[11px] font-black uppercase tracking-widest cursor-pointer" onClick={() => setDatos({...datos, isKit: !datos.isKit})}>Habilitar KIT / COMBO</label>
                </div>
                {datos.isKit && (
                  <div className="flex gap-6 border-t border-white/10 pt-4">
                    <div className="flex items-center gap-2"><input type="radio" id="kit_sp" checked={datos.kitType === 'stock_propio'} onChange={() => setDatos({...datos, kitType: 'stock_propio'})} className="accent-brand-gold" /><label htmlFor="kit_sp" className="text-[9px] font-black uppercase cursor-pointer">Stock Propio (Pre-armado)</label></div>
                    <div className="flex items-center gap-2"><input type="radio" id="kit_sc" checked={datos.kitType === 'stock_componentes'} onChange={() => setDatos({...datos, kitType: 'stock_componentes'})} className="accent-brand-gold" /><label htmlFor="kit_sc" className="text-[9px] font-black uppercase cursor-pointer">Depende de Componentes</label></div>
                  </div>
                )}
              </div>
              {datos.isKit && (
                <div className="space-y-4">
                  <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-ink/30" /><Input className="h-12 pl-10 text-xs font-black uppercase bg-white" placeholder="Buscar productos componentes..." value={kitSearch} onChange={e => setKitSearch(e.target.value)} />{filteredProdsForKit.length > 0 && (<div className="absolute top-full left-0 right-0 bg-white border border-line rounded-lg shadow-2xl z-50 mt-1 overflow-hidden">{filteredProdsForKit.map(pk => (<div key={pk.id} onClick={() => { setDatos({...datos, kitItems: [...datos.kitItems, { productoId: pk.id, nombre: pk.nombre, cantidad: 1 }]}); setKitSearch(''); }} className="p-3 border-b border-line hover:bg-brand-gold-soft cursor-pointer flex justify-between items-center"><span className="text-xs font-black uppercase text-ink">{pk.nombre}</span><Plus className="w-4 h-4 text-brand-gold"/></div>))}</div>)}</div>
                  <div className="card border-line shadow-sm overflow-hidden bg-white"><div className="table-wrap"><table><thead className="bg-surface-soft"><tr><th className="text-[10px] font-black uppercase text-ink">Componente</th><th className="text-[10px] font-black uppercase text-center text-ink">Cant</th><th /></tr></thead><tbody>
                    {datos.kitItems.map((ki: KitItem, index: number) => (
                      <tr key={index} className="border-b border-line/30"><td className="text-[11px] font-black uppercase text-ink">{ki.nombre}</td><td className="text-center"><Input className="w-12 h-8 text-center font-black bg-surface-soft border-line inline-block" type="number" value={ki.cantidad} onChange={e => { const n = [...datos.kitItems]; n[index].cantidad = parseInt(e.target.value) || 1; setDatos({...datos, kitItems: n}); }} /></td><td className="text-center"><button onClick={() => setDatos({...datos, kitItems: datos.kitItems.filter((_:any, i:number) => i !== index)})} className="text-status-danger"><Trash2 className="w-4 h-4"/></button></td></tr>
                    ))}
                    {datos.kitItems.length === 0 && (<tr><td colSpan={3} className="py-10 text-center text-ink/20 font-black uppercase italic text-[10px]">Añada productos componentes</td></tr>)}
                  </tbody></table></div></div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-foot p-5 bg-surface-soft border-t border-line flex justify-end gap-3"><Button variant="secondary" className="px-8 font-black uppercase text-[10px]" onClick={onClose}>Cerrar</Button><Button className="bg-brand-gold hover:bg-brand-gold-deep text-ink px-10 font-black uppercase text-[10px] shadow-lg" onClick={handleSave}>{producto ? 'ACTUALIZAR' : 'CREAR PRODUCTO'}</Button></div>
      </div>
    </div>
  );
}
