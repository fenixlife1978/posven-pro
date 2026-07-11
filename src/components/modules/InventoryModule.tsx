'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppState, Product, Movimiento, KitItem } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Boxes, 
  X, 
  BarChart3, 
  FileText, 
  History, 
  Gift, 
  Layers, 
  Trash, 
  ShoppingBag, 
  TrendingUp, 
  Printer, 
  RotateCcw, 
  Box, 
  ClipboardList, 
  Info, 
  Tag, 
  DollarSign, 
  Settings,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  Check
} from 'lucide-react';
import { 
  generarPDFInventarioSimple, 
  exportarPDFInventarioGeneral, 
  exportarPDFVentasDetallado, 
  exportarPDFKardex, 
  exportarPDFHistorialAjustes, 
  exportarPDFConsumoInterno,
  exportarPDFDevoluciones
} from '@/lib/pdf-generator';

export default function InventoryModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
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

  const eliminar = (id: string) => {
    if (!confirm('¿Seguro que desea eliminar este producto?')) return;
    const nuevos = state.productos.map(p => p.id === id ? { ...p, activo: false } : p);
    updateState({ productos: nuevos });
  };

  const handleDownloadBasicInv = () => {
    generarPDFInventarioSimple(prods, state.empresa);
  };

  const renderContent = () => {
    switch(activeTab) {
      case 'productos': return (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex gap-4 flex-1 min-w-[300px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-ink" />
                <input className="form-input pl-10" placeholder="Buscar producto por nombre o código..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="form-select w-auto bg-white border-line rounded-md px-3 py-2 text-sm font-bold text-ink" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">Todas las categorías</option>
                {(state.categorias || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary shadow-sm" onClick={handleDownloadBasicInv}><FileText className="w-4 h-4" /> Exportar PDF</button>
              <button className="btn btn-primary shadow-md" onClick={() => setShowProducto('nuevo')}><Plus className="w-4 h-4" /> Nuevo Producto</button>
            </div>
          </div>

          <div className="card shadow-lg rounded-xl overflow-hidden">
            <div className="card-head bg-ink border-b border-white/10 px-6 py-4">
              <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
                <Box className="w-5 h-5 text-brand-gold" /> CATALOGO DE PRODUCTOS ACTIVOS
              </h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr className="bg-surface-soft">
                    <th className="font-black text-ink uppercase text-[10px]">Código</th>
                    <th className="font-black text-ink uppercase text-[10px]">Nombre Producto</th>
                    <th className="font-black text-ink uppercase text-[10px]">Categoría</th>
                    <th className="font-black text-ink uppercase text-[10px]">Costo USD</th>
                    <th className="font-black text-ink uppercase text-[10px]">P. Venta USD</th>
                    <th className="font-black text-ink uppercase text-[10px]">Stock</th>
                    <th className="font-black text-ink uppercase text-[10px]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {prods.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-20 text-ink/30 font-black italic uppercase">No se encontraron productos reales</td></tr>
                  ) : (
                    prods.map(p => (
                      <tr key={p.id} className="border-b border-line/30 hover:bg-surface-warm/20 transition-colors">
                        <td className="mono text-xs font-black text-ink">{p.codigo}</td>
                        <td className="font-black text-ink uppercase">
                          <div className="flex items-center gap-2">
                            {p.isKit && <Layers className="w-3.5 h-3.5 text-brand-gold" />}
                            {p.nombre}
                          </div>
                        </td>
                        <td><span className="badge badge-neutral font-black">{p.categoria}</span></td>
                        <td className="mono font-bold text-ink">{Utils.fmtUSD(p.costoUSD)}</td>
                        <td className="mono text-brand-gold-deep font-black">{Utils.fmtUSD(p.precioUSD)}</td>
                        <td>
                          <span className={`badge ${p.stock <= (p.stockMinimo || 0) ? 'badge-err' : 'badge-ok'} font-black px-3`}>
                            {p.stock}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
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
                  tipo: 'compra',
                  cantidad: nuevo.stock,
                  stockAntes: 0,
                  stockDespues: nuevo.stock,
                  fecha: Utils.ahora(),
                  referencia: 'Stock inicial'
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
                  const cantidadNueva = mov.cantidad;
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
  const [groupBy, setGroupBy] = useState<'categoria' | 'departamento' | 'proveedor'>('categoria');
  const [filterValue, setFilterValue] = useState<string>('');
  const uniqueValues = Array.from(new Set(state.productos.filter(p => p.activo).map(p => (p[groupBy] as string) || 'Sin asignar'))).sort();
  const filteredProducts = state.productos.filter(p => p.activo && (filterValue === '' || ((p[groupBy] as string) || 'Sin asignar') === filterValue));
  const totalCosto = Utils.round(filteredProducts.reduce((acc, p) => acc + (p.costoUSD * p.stock), 0));
  const totalVenta = Utils.round(filteredProducts.reduce((acc, p) => acc + (p.precioUSD * p.stock), 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="kpi p-6 border-line shadow-md bg-white">
          <div className="text-[10px] font-black uppercase mb-1 text-ink opacity-60">Valor al Costo (CPP Total)</div>
          <div className="text-3xl font-black text-ink">{Utils.fmtUSD(totalCosto)}</div>
          <div className="text-sm font-bold mt-1 italic text-ink/70">{Utils.fmtBS(totalCosto * state.tasa)}</div>
        </div>
        <div className="kpi p-6 border-line shadow-md bg-white">
          <div className="text-[10px] font-black uppercase mb-1 text-ink opacity-60">Valor al Precio de Venta (Total)</div>
          <div className="text-3xl font-black text-status-success">{Utils.fmtUSD(totalVenta)}</div>
          <div className="text-sm font-bold mt-1 italic text-ink/70">{Utils.fmtBS(totalVenta * state.tasa)}</div>
        </div>
      </div>
      
      <div className="card shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
              <Boxes className="w-5 h-5 text-brand-gold" /> INVENTARIO CPP POR {groupBy.toUpperCase()}
            </h3>
            <select className="form-select bg-white text-ink border-none text-[10px] font-black uppercase h-8 px-3 rounded shadow-sm" value={filterValue} onChange={e => setFilterValue(e.target.value)}>
              <option value="">TODOS LOS ITEMS</option>
              {uniqueValues.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px] shadow-sm" onClick={() => exportarPDFInventarioGeneral(filteredProducts, state.empresa, groupBy, { costo: totalCosto, venta: totalVenta })}>
            <FileText className="w-3.5 h-3.5" /> PDF Profesional
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Cod.</th>
                <th className="font-black text-ink uppercase text-[10px]">Nombre Producto</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Costo USD</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Venta USD</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Stock</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Subtotal Costo</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredProducts.map(p => (
                <tr key={p.id} className="border-b border-line/30 hover:bg-surface-warm/20">
                  <td className="mono text-[11px] font-black text-ink">{p.codigo}</td>
                  <td className="font-black uppercase text-xs text-ink">{p.nombre}</td>
                  <td className="mono text-right font-bold text-ink">{Utils.fmtUSD(p.costoUSD)}</td>
                  <td className="mono text-right text-brand-gold-deep font-black">{Utils.fmtUSD(p.precioUSD)}</td>
                  <td className="text-center"><span className="badge badge-neutral font-black">{p.stock}</span></td>
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
  const [filter, setFilter] = useState('hoy');
  const ventas = state.ventas.filter(v => filter === 'hoy' ? v.fecha.startsWith(Utils.hoy()) : true);
  const totalVendidos = ventas.reduce((acc, v) => acc + v.items.reduce((sum, item) => sum + item.cantidad, 0), 0);

  return (
    <div className="space-y-4">
      <div className="card shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-gold" /> BITÁCORA DE VENTAS REALES
          </h3>
          <button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px] shadow-sm" onClick={() => exportarPDFVentasDetallado(ventas, state.empresa, filter, { totalVendidos })}>
            <FileText className="w-3.5 h-3.5" /> Exportar Ventas
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
                <th className="font-black text-ink uppercase text-[10px]">Producto</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Cant.</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Total USD</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {ventas.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-20 text-ink/20 font-black italic uppercase">Sin operaciones reales</td></tr>
              ) : (
                ventas.flatMap(v => v.items.map((item: any, idx: number) => (
                  <tr key={`${v.id}-${idx}`} className="border-b border-line/30">
                    <td className="text-xs font-bold text-ink">{idx === 0 ? v.fecha.slice(0, 10) : ''}</td>
                    <td className="font-black uppercase text-xs text-ink">{item.nombre}</td>
                    <td className="font-black mono text-ink text-center">{item.cantidad}</td>
                    <td className="mono font-black text-brand-gold-deep text-right">{Utils.fmtUSD(item.subtotalUSD)}</td>
                  </tr>
                )))
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
      <div className="card shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-brand-gold" /> REGISTRO DE DEVOLUCIONES PROCESADAS
          </h3>
          <button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px] shadow-sm" onClick={() => exportarPDFDevoluciones(devoluciones, state.empresa, 'Histórico', { totalUSD })}>
            <FileText className="w-3.5 h-3.5" /> PDF Auditoría
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
                <th className="font-black text-ink uppercase text-[10px]">Venta Ref.</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Total Devuelto</th>
                <th className="font-black text-ink uppercase text-[10px]">Motivo</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {devoluciones.map(d => (
                <tr key={d.id} className="border-b border-line/30">
                  <td className="text-xs font-bold text-ink">{Utils.fmtFecha(d.fecha)}</td>
                  <td className="text-ink font-black mono text-xs">{d.ventaId}</td>
                  <td className="mono text-right font-black text-status-danger">{Utils.fmtUSD(d.totalUSD)}</td>
                  <td className="text-xs uppercase italic font-bold text-ink/70">{d.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase()))
    ).slice(0, 5);
  }, [search, state.productos]);

  return (
    <div className="space-y-4">
      <div className="card shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <div className="flex flex-col">
            <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
              <History className="w-5 h-5 text-brand-gold" /> KARDEX HISTÓRICO DE MOVIMIENTOS
            </h3>
            {selectedProd && <div className="text-[8px] text-brand-gold font-black uppercase mt-1 tracking-widest">PRODUCTO SELECCIONADO: {selectedProd.nombre}</div>}
          </div>
          <div className="flex gap-2 relative">
            <div className="relative">
              <input 
                className="form-input h-9 text-[10px] uppercase font-black w-64 pr-8" 
                placeholder="BUSCAR PRODUCTO O PALABRAS CLAVE..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
              <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-ink/30" />
              
              {matches.length > 0 && (
                <div className="absolute top-full right-0 w-64 bg-white border border-line rounded-lg shadow-2xl z-50 mt-1 overflow-hidden">
                  {matches.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => { onSelect(p.id); setSearch(''); }} 
                      className="p-3 border-b border-line hover:bg-brand-gold/10 cursor-pointer flex flex-col transition-all"
                    >
                      <span className="text-[10px] font-black text-ink uppercase leading-tight">{p.nombre}</span>
                      <span className="text-[8px] text-ink/40 mono mt-0.5">{p.codigo}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button 
              className="btn btn-secondary h-9 px-6 font-black uppercase text-[10px] shadow-sm flex items-center gap-2" 
              onClick={() => selectedProd && exportarPDFKardex(selectedProd, movs, state.empresa)}
              disabled={!selectedProd}
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
                <th className="font-black text-ink uppercase text-[10px]">Movimiento</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Cant.</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Stock Después</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {movs.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-20 text-ink/20 font-black uppercase italic">Utilice el buscador para localizar un ítem</td></tr>
              ) : (
                movs.map(m => (
                  <tr key={m.id} className="border-b border-line/30">
                    <td className="text-[11px] font-black text-ink">{m.fecha.slice(0, 16).replace('T', ' ')}</td>
                    <td><span className="badge badge-neutral font-black uppercase text-[8px]">{m.tipo}</span></td>
                    <td className={`mono font-black text-center ${m.cantidad > 0 ? 'text-status-success' : 'text-status-danger'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</td>
                    <td className="mono font-black text-ink text-center">{m.stockDespues}</td>
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

function HistorialAjustes({ state }: { state: AppState }) {
  const ajustes = state.movimientos.filter(m => ['ajuste_entrada', 'ajuste_salida', 'consumo', 'colaboracion', 'compra'].includes(m.tipo)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const efectoNetoUSD = Utils.round(ajustes.reduce((acc, m) => {
    const p = state.productos.find(prod => prod.id === m.productoId);
    const costo = p?.costoUSD || 0;
    const esEntrada = m.tipo.includes('entrada') || m.tipo === 'compra' || m.tipo === 'devolucion';
    return acc + (esEntrada ? (m.cantidad * costo) : -(Math.abs(m.cantidad) * costo));
  }, 0));

  const handleExport = () => {
    const dataForPDF = ajustes.map(m => {
      const p = state.productos.find(prod => prod.id === m.productoId);
      return { ...m, nombreProd: p?.nombre || 'ITEM ELIMINADO' };
    });
    exportarPDFHistorialAjustes(dataForPDF, state.empresa, efectoNetoUSD);
  };

  return (
    <div className="space-y-4">
      <div className={`kpi p-6 border-line shadow-md border-l-8 ${efectoNetoUSD < 0 ? 'bg-status-danger-soft border-l-status-danger' : 'bg-white border-l-status-success'}`}>
        <div className="text-[10px] font-black uppercase mb-1 text-ink opacity-60">Variación Neta de Capital en Inventario ($)</div>
        <div className={`text-3xl font-black ${efectoNetoUSD < 0 ? 'text-status-danger' : 'text-ink'}`}>{Utils.fmtUSD(efectoNetoUSD)}</div>
      </div>

      <div className="card shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-brand-gold" /> BITÁCORA DE AJUSTES DE ALMACÉN
          </h3>
          <button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px] shadow-sm" onClick={handleExport}>
            <FileText className="w-3.5 h-3.5" /> Exportar Ajustes
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
                <th className="font-black text-ink uppercase text-[10px]">Producto</th>
                <th className="font-black text-ink uppercase text-[10px]">Ajuste</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Cantidad</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {ajustes.map(m => {
                const p = state.productos.find(prod => prod.id === m.productoId);
                return (
                  <tr key={m.id} className="border-b border-line/30">
                    <td className="text-[11px] font-bold text-ink">{m.fecha.slice(0, 16).replace('T', ' ')}</td>
                    <td className="font-black uppercase text-ink text-xs">{p?.nombre || 'ELIMINADO'}</td>
                    <td><span className="badge badge-neutral uppercase text-[8px] font-black">{m.tipo}</span></td>
                    <td className="mono font-black text-center">{m.cantidad}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReporteConsumo({ state }: { state: AppState }) {
  const movs = state.movimientos.filter(m => m.tipo === 'consumo' || m.tipo === 'colaboracion');
  const totalPerdidaUSD = Utils.round(movs.reduce((acc, m) => {
    const p = state.productos.find(prod => prod.id === m.productoId);
    return acc + (Math.abs(m.cantidad) * (p?.costoUSD || 0));
  }, 0));

  const handleExport = () => {
    const dataForPDF = movs.map(m => {
      const p = state.productos.find(prod => prod.id === m.productoId);
      const costo = p?.costoUSD || 0;
      return { 
        ...m, 
        nombreProd: p?.nombre || 'ELIMINADO', 
        costoUnit: costo, 
        subtotal: Math.abs(m.cantidad) * costo 
      };
    });
    exportarPDFConsumoInterno(dataForPDF, state.empresa, totalPerdidaUSD);
  };

  return (
    <div className="space-y-6">
      <div className="card shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-gold" /> SALIDAS POR CONSUMO INTERNO
          </h3>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[9px] text-white/50 block font-black uppercase">Pérdida Total</span>
              <span className="text-brand-gold font-black text-sm">{Utils.fmtUSD(totalPerdidaUSD)}</span>
            </div>
            <button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px] shadow-sm" onClick={handleExport}>
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
                <th className="font-black text-ink uppercase text-[10px]">Producto</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Cant.</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Costo Total</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {movs.map(m => {
                const p = state.productos.find(prod => prod.id === m.productoId);
                const sub = Math.abs(m.cantidad) * (p?.costoUSD || 0);
                return (
                  <tr key={m.id} className="border-b border-line/30">
                    <td className="text-xs font-bold text-ink">{m.fecha.slice(0, 10)}</td>
                    <td className="font-black uppercase text-xs text-ink">{p?.nombre}</td>
                    <td className="font-black mono text-center">{Math.abs(m.cantidad)}</td>
                    <td className="mono font-black text-status-danger text-right">{Utils.fmtUSD(sub)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ModalAjuste({ producto, onClose, onSave }: { producto: Product, onClose: () => void, onSave: (m: Movimiento, nuevoCosto?: number) => void }) {
  const [tipo, setTipo] = useState<'ajuste_entrada' | 'ajuste_salida' | 'consumo' | 'colaboracion'>('ajuste_entrada');
  const [cantidad, setCantidad] = useState<string>('1');
  const [nuevoCosto, setNuevoCosto] = useState<string>(String(producto.costoUSD));
  const [ref, setRef] = useState('');

  const handleSave = () => {
    const pCant = parseFloat(cantidad) || 0;
    const pCosto = parseFloat(nuevoCosto) || 0;
    if (pCant <= 0) return alert('Cantidad invalida');
    const mov: Movimiento = {
      id: Store.uid(),
      productoId: producto.id,
      tipo,
      cantidad: tipo === 'ajuste_entrada' ? pCant : -Math.abs(pCant),
      stockAntes: producto.stock,
      stockDespues: tipo === 'ajuste_entrada' ? producto.stock + pCant : producto.stock - Math.abs(pCant),
      fecha: Utils.ahora(),
      referencia: ref || 'Ajuste manual'
    };
    onSave(mov, tipo === 'ajuste_entrada' ? pCosto : undefined);
  };

  return (
    <div className="modal show"><div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-white max-w-md border-2 border-line">
        <div className="modal-head px-5 py-4 border-b border-line bg-surface-soft">
          <h3 className="text-ink font-black uppercase text-sm">AJUSTAR: {producto.nombre.toUpperCase()}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-ink" /></button>
        </div>
        <div className="modal-body p-6 space-y-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
             <div className="form-group"><label className="text-[10px] font-black uppercase text-ink/60 mb-1 block">Tipo</label>
               <select className="form-select h-10 text-xs font-bold" value={tipo} onChange={e => setTipo(e.target.value as any)}>
                 <option value="ajuste_entrada">Entrada (+)</option><option value="ajuste_salida">Salida (-)</option>
               </select>
             </div>
             <div className="form-group"><label className="text-[10px] font-black uppercase text-ink/60 mb-1 block">Cantidad</label>
               <input className="form-input h-10 text-center font-black" type="text" value={cantidad} onChange={e => setCantidad(e.target.value)} />
             </div>
          </div>
          <button className="btn btn-primary w-full h-12 font-black uppercase text-xs shadow-md" onClick={handleSave}>Procesar Ajuste</button>
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
    presentacion: producto?.cantidad || state.presentaciones[0] || '',
    costoUSD: producto?.costoUSD?.toString() ?? '0',
    margen: producto?.margen?.toString() ?? '0',
    precioUSD: producto?.precioUSD?.toString() ?? '0',
    precioBS: ((producto?.precioUSD || 0) * state.tasa).toString(),
    precioMayorUSD: producto?.precioMayorUSD?.toString() ?? '0',
    precioPromoUSD: producto?.precioPromoUSD?.toString() ?? '0',
    precioDescuentoUSD: producto?.precioOfertaUSD?.toString() ?? '0',
    stock: producto?.stock?.toString() ?? '0',
    stockMinimo: producto?.stockMinimo?.toString() ?? '3',
    aplicaIVA: producto?.aplicaIVA ?? false,
    isKit: producto?.isKit || false,
    kitType: producto?.kitType || 'stock_propio',
    kitItems: producto?.kitItems || [],
    proveedor: producto?.proveedor || (state.proveedores[0]?.nombre || '')
  });

  const [kitSearch, setKitSearch] = useState('');
  const filteredProdsForKit = useMemo(() => {
    if (kitSearch.length < 2) return [];
    return state.productos.filter(p => !p.isKit && (p.nombre.toLowerCase().includes(kitSearch.toLowerCase()) || p.codigo.toLowerCase().includes(kitSearch.toLowerCase()))).slice(0, 5);
  }, [kitSearch, state.productos]);

  const validarDecimal = (val: string) => /^[\d]*\.?[\d]*$/.test(val) || val === '';

  const handleMargenChange = (val: string) => {
    if (!validarDecimal(val)) return;
    setDatos((prev: any) => {
      const cost = parseFloat(prev.costoUSD) || 0;
      const margin = parseFloat(val) || 0;
      let price = 0;
      if (cost > 0 && margin > 0 && margin < 100) {
        price = cost / (1 - margin / 100);
      } else if (margin >= 100) {
        price = cost;
      }
      const priceBS = price * state.tasa;
      return {
        ...prev,
        margen: val,
        precioUSD: price > 0 ? price.toString() : '0',
        precioBS: priceBS > 0 ? priceBS.toString() : '0'
      };
    });
  };

  const handlePriceUSDChange = (val: string) => {
    if (!validarDecimal(val)) return;
    setDatos((prev: any) => {
      const cost = parseFloat(prev.costoUSD) || 0;
      const priceUSD = parseFloat(val) || 0;
      let margin = 0;
      if (priceUSD > 0 && cost > 0) {
        margin = ((priceUSD - cost) / priceUSD) * 100;
        if (margin > 99.99) margin = 99.99;
      }
      const priceBS = priceUSD * state.tasa;
      return {
        ...prev,
        precioUSD: val,
        margen: margin > 0 ? margin.toString() : '0',
        precioBS: priceBS > 0 ? priceBS.toString() : '0'
      };
    });
  };

  const handlePriceBSChange = (val: string) => {
    if (!validarDecimal(val)) return;
    setDatos((prev: any) => {
      const cost = parseFloat(prev.costoUSD) || 0;
      const priceBS = parseFloat(val) || 0;
      const priceUSD = priceBS / state.tasa;
      let margin = 0;
      if (priceUSD > 0 && cost > 0) {
        margin = ((priceUSD - cost) / priceUSD) * 100;
        if (margin > 99.99) margin = 99.99;
      }
      return {
        ...prev,
        precioBS: val,
        precioUSD: priceUSD > 0 ? priceUSD.toString() : '0',
        margen: margin > 0 ? margin.toString() : '0'
      };
    });
  };

  const handleCostoChange = (val: string) => {
    if (!validarDecimal(val)) return;
    setDatos((prev: any) => ({ ...prev, costoUSD: val }));
  };

  const handleAddListItem = (listName: 'categorias' | 'marcas' | 'presentaciones') => {
    const newVal = prompt(`Ingrese nueva opción para ${listName.toUpperCase()}:`);
    if (newVal) {
      onUpdateLists({ [listName]: [...(state[listName] || []), newVal] });
      setDatos((prev: any) => ({ ...prev, [listName === 'presentaciones' ? 'presentacion' : listName.slice(0, -1)]: newVal }));
    }
  };

  const handleRemoveListItem = (listName: 'categorias' | 'marcas' | 'presentaciones', current: string) => {
    if (confirm(`¿Eliminar "${current}" de la lista?`)) {
      const newList = (state[listName] || []).filter(i => i !== current);
      onUpdateLists({ [listName]: newList });
      setDatos((prev: any) => ({ ...prev, [listName === 'presentaciones' ? 'presentacion' : listName.slice(0, -1)]: newList[0] || '' }));
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
      precioPromoUSD: parseFloat(datos.precioPromoUSD) || 0,
      precioOfertaUSD: parseFloat(datos.precioDescuentoUSD) || 0,
      stock: parseFloat(datos.stock) || 0,
      stockMinimo: parseFloat(datos.stockMinimo) || 0,
      cantidad: datos.presentacion
    });
  };

  return (
    <div className="modal show"><div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-white max-w-2xl border-2 border-line rounded-xl overflow-hidden shadow-2xl">
        <div className="modal-head py-4 px-6 border-b border-line bg-ink flex justify-between items-center">
          <h3 className="text-white font-black uppercase italic tracking-tighter text-sm flex items-center gap-2">
            <Box className="w-5 h-5 text-brand-gold" /> {producto ? 'EDITAR FICHA DE PRODUCTO' : 'REGISTRO DE NUEVO ÍTEM'}
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex bg-surface-soft border-b border-line">
          <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'general' ? 'border-brand-gold text-brand-gold bg-white' : 'border-transparent text-ink/40'}`}>General & Stock</button>
          <button onClick={() => setActiveTab('precios')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'precios' ? 'border-brand-gold text-brand-gold bg-white' : 'border-transparent text-ink/40'}`}>Precios & Ganancia</button>
          <button onClick={() => setActiveTab('kit')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'kit' ? 'border-brand-gold text-brand-gold bg-white' : 'border-transparent text-ink/40'}`}>Kits / Combos</button>
        </div>

        <div className="modal-body p-6 space-y-6 bg-white max-h-[70vh] overflow-y-auto">
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-ink/50 block">Código de Barras / Manual</label>
                  <input className="form-input h-10 font-black text-ink" value={datos.codigo} onChange={e => setDatos({...datos, codigo: e.target.value})} placeholder="Escanee o escriba código..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-ink/50 block">Nombre del Producto</label>
                  <input className="form-input h-10 font-black text-ink uppercase" value={datos.nombre} onChange={e => setDatos({...datos, nombre: e.target.value})} placeholder="Ej: RON SANTA TERESA 750ML" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black uppercase text-ink/50">Categoría</label>
                    <div className="flex gap-1">
                      <button onClick={() => handleAddListItem('categorias')} className="text-brand-gold hover:text-brand-gold-deep"><PlusCircle className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleRemoveListItem('categorias', datos.categoria)} className="text-status-danger"><MinusCircle className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                  <select className="form-select h-10 text-xs font-bold" value={datos.categoria} onChange={e => setDatos({...datos, categoria: e.target.value})}>
                    {(state.categorias || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-ink/50 block mb-1">Proveedor Asignado</label>
                  <select className="form-select h-10 text-xs font-bold" value={datos.proveedor} onChange={e => setDatos({...datos, proveedor: e.target.value})}>
                    {(state.proveedores || []).map((p: any) => {
                      const name = typeof p === 'string' ? p : p.nombre;
                      return <option key={typeof p === 'string' ? p : p.id} value={name}>{name?.toUpperCase() || 'S/N'}</option>;
                    })}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-black uppercase text-ink/50">Marca</label>
                      <div className="flex gap-1">
                        <button onClick={() => handleAddListItem('marcas')} className="text-brand-gold hover:text-brand-gold-deep"><PlusCircle className="w-3.5 h-3.5"/></button>
                        <button onClick={() => handleRemoveListItem('marcas', datos.marca)} className="text-status-danger"><MinusCircle className="w-3.5 h-3.5"/></button>
                      </div>
                    </div>
                    <select className="form-select h-10 text-xs font-bold" value={datos.marca} onChange={e => setDatos({...datos, marca: e.target.value})}>
                      {(state.marcas || []).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-black uppercase text-ink/50">Medida</label>
                      <div className="flex gap-1">
                        <button onClick={() => handleAddListItem('presentaciones')} className="text-brand-gold hover:text-brand-gold-deep"><PlusCircle className="w-3.5 h-3.5"/></button>
                        <button onClick={() => handleRemoveListItem('presentaciones', datos.presentacion)} className="text-status-danger"><MinusCircle className="w-3.5 h-3.5"/></button>
                      </div>
                    </div>
                    <select className="form-select h-10 text-xs font-bold" value={datos.presentacion} onChange={e => setDatos({...datos, presentacion: e.target.value})}>
                      {(state.presentaciones || []).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-3 bg-surface-soft border border-line rounded-xl text-center">
                    <label className="text-[9px] font-black uppercase text-ink/50 block mb-1">Stock Inicial</label>
                    <input className="bg-transparent border-none text-center font-black text-xl w-full focus:outline-none" type="text" inputMode="decimal" value={datos.stock} onChange={e => setDatos({...datos, stock: e.target.value})} />
                  </div>
                  <div className="p-3 bg-status-danger-soft border border-status-danger/20 rounded-xl text-center">
                    <label className="text-[9px] font-black uppercase text-status-danger/70 block mb-1">Mínimo Crítico</label>
                    <input className="bg-transparent border-none text-center font-black text-xl w-full text-status-danger focus:outline-none" type="text" inputMode="decimal" value={datos.stockMinimo} onChange={e => setDatos({...datos, stockMinimo: e.target.value})} />
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-surface-soft p-5 rounded-2xl border border-line shadow-inner">
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-ink/50">Costo ($)</label><input className="form-input h-12 font-black text-lg" type="text" value={datos.costoUSD} onChange={(e) => handleCostoChange(e.target.value)} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-brand-gold-deep">Margen %</label><input className="form-input h-12 font-black text-lg text-brand-gold-deep" type="text" value={datos.margen} onChange={(e) => handleMargenChange(e.target.value)} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-status-success">Venta ($)</label><input className="form-input h-12 font-black text-lg text-status-success" type="text" value={datos.precioUSD} onChange={(e) => handlePriceUSDChange(e.target.value)} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-ink">Venta (BS)</label><input className="form-input h-12 font-black text-lg text-ink" type="text" value={datos.precioBS} onChange={(e) => handlePriceBSChange(e.target.value)} /></div>
              </div>
              <div className="p-4 bg-brand-gold-soft/20 rounded-xl border border-brand-gold/10 flex items-start gap-3"><Info className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" /><p className="text-[10px] text-brand-gold-deep font-bold leading-tight">El recalculo utiliza la tasa actual (Bs. {state.tasa.toFixed(2)}) y Markup sobre venta.</p></div>
            </div>
          )}

          {activeTab === 'kit' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 p-4 bg-ink text-white rounded-xl">
                <div className="flex items-center gap-3">
                  <button onClick={() => setDatos({...datos, isKit: !datos.isKit})} className={`w-12 h-6 rounded-full transition-all relative ${datos.isKit ? 'bg-brand-gold' : 'bg-white/20'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${datos.isKit ? 'right-1' : 'left-1'}`} /></button>
                  <label className="text-[11px] font-black uppercase tracking-widest cursor-pointer" onClick={() => setDatos({...datos, isKit: !datos.isKit})}>Habilitar como KIT / COMBO</label>
                </div>
                {datos.isKit && (
                  <div className="flex gap-6 border-t border-white/10 pt-4 mt-1">
                    <div className="flex items-center gap-2"><input type="radio" id="sp" name="kitType" checked={datos.kitType === 'stock_propio'} onChange={() => setDatos({...datos, kitType: 'stock_propio'})} className="accent-brand-gold w-4 h-4" /><label htmlFor="sp" className="text-[9px] font-black uppercase cursor-pointer">Stock Propio (Pre-armado)</label></div>
                    <div className="flex items-center gap-2"><input type="radio" id="sc" name="kitType" checked={datos.kitType === 'stock_componentes'} onChange={() => setDatos({...datos, kitType: 'stock_componentes'})} className="accent-brand-gold w-4 h-4" /><label htmlFor="sc" className="text-[9px] font-black uppercase cursor-pointer">Depende de Componentes</label></div>
                  </div>
                )}
              </div>
              {datos.isKit && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-ink/30" /><input className="form-input h-12 pl-10 text-xs font-black uppercase" placeholder="Buscar componentes..." value={kitSearch} onChange={e => setKitSearch(e.target.value)} />{filteredProdsForKit.length > 0 && (<div className="absolute top-full left-0 right-0 bg-white border border-line rounded-lg shadow-2xl z-50 mt-1 overflow-hidden">{filteredProdsForKit.map(pk => (<div key={pk.id} onClick={() => { setDatos({...datos, kitItems: [...datos.kitItems, { productoId: pk.id, nombre: pk.nombre, cantidad: 1 }]}); setKitSearch(''); }} className="p-3 border-b border-line hover:bg-brand-gold-soft cursor-pointer flex justify-between items-center"><span className="text-xs font-black text-ink uppercase">{pk.nombre}</span><Plus className="w-4 h-4 text-brand-gold"/></div>))}</div>)}</div>
                  <div className="card border-line shadow-sm overflow-hidden"><div className="table-wrap"><table><thead className="bg-surface-soft"><tr><th className="text-[10px] font-black uppercase">Componente</th><th className="text-[10px] font-black uppercase text-center">Cant</th><th></th></tr></thead><tbody>
                    {datos.kitItems.map((ki: KitItem, index: number) => (
                      <tr key={index} className="border-b border-line/30"><td className="text-[11px] font-black uppercase text-ink">{ki.nombre}</td><td className="text-center"><input className="w-12 h-8 text-center font-black bg-surface-soft rounded border border-line" type="number" value={ki.cantidad} onChange={e => { const n = [...datos.kitItems]; n[index].cantidad = parseInt(e.target.value) || 1; setDatos({...datos, kitItems: n}); }} /></td><td className="text-center"><button onClick={() => setDatos({...datos, kitItems: datos.kitItems.filter((_:any, i:number) => i !== index)})} className="text-status-danger"><Trash2 className="w-4 h-4"/></button></td></tr>
                    ))}
                    {datos.kitItems.length === 0 && (<tr><td colSpan={3} className="py-10 text-center text-ink/20 font-black uppercase italic text-[10px]">Añada productos para conformar el combo</td></tr>)}
                  </tbody></table></div></div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-foot p-5 bg-surface-soft border-t border-line flex justify-end gap-3 no-print"><button className="btn btn-secondary px-8 font-black uppercase text-[10px]" onClick={onClose}>Cancelar Operación</button><button className="btn btn-primary px-10 font-black uppercase text-[10px] shadow-lg flex items-center gap-2" onClick={handleSave}><Check className="w-4 h-4" /> {producto ? 'GUARDAR CAMBIOS' : 'CREAR NUEVO PRODUCTO'}</button></div>
      </div>
    </div>
  );
}
