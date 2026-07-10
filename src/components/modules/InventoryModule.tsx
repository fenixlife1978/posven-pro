
'use client';

import React, { useState, useEffect } from 'react';
import { AppState, Product, Movimiento, KitItem } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { Plus, Search, Edit2, Trash2, Boxes, X, BarChart3, FileText, History, Gift, Layers, Trash, ShoppingBag, TrendingUp, Printer, RotateCcw, Box, ClipboardList } from 'lucide-react';
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
  
  const prods = state.productos.filter(p => 
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
                {state.categorias.map(c => <option key={c} value={c}>{c}</option>)}
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
                    <tr><td colSpan={7} className="text-center py-20 text-ink/30 font-black italic uppercase">No se encontraron resultados</td></tr>
                  ) : (
                    prods.map(p => (
                      <tr key={p.id} className="hover:bg-surface-warm/20 transition-colors">
                        <td className="mono text-xs font-black text-ink">{p.codigo}</td>
                        <td className="font-black text-ink">
                          <div className="flex items-center gap-2">
                            {p.isKit && <Layers className="w-3.5 h-3.5 text-brand-gold" />}
                            {p.nombre.toUpperCase()}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-neutral font-black">{p.categoria}</span>
                        </td>
                        <td className="mono font-bold text-ink">{Utils.fmtUSD(p.costoUSD)}</td>
                        <td className="mono text-brand-gold-deep font-black">{Utils.fmtUSD(p.precioUSD)}</td>
                        <td>
                          <span className={`badge ${p.stock <= p.stockMinimo ? 'badge-err' : 'badge-ok'} font-black px-3`}>
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

  const filteredProducts = state.productos.filter(p => 
    p.activo && (filterValue === '' || ((p[groupBy] as string) || 'Sin asignar') === filterValue)
  );

  const totalCosto = Utils.round(filteredProducts.reduce((acc, p) => acc + (p.costoUSD * p.stock), 0));
  const totalVenta = Utils.round(filteredProducts.reduce((acc, p) => acc + (p.precioUSD * p.stock), 0));

  const handleExportPDF = () => {
    exportarPDFInventarioGeneral(
      filteredProducts, 
      state.empresa, 
      filterValue ? `${groupBy}: ${filterValue}` : groupBy, 
      { costo: totalCosto, venta: totalVenta }
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="kpi p-6 border-line shadow-md bg-white">
          <div className="text-[10px] font-black uppercase mb-1 text-ink">Valor al Costo (CPP Total)</div>
          <div className="text-3xl font-black text-ink">{Utils.fmtUSD(totalCosto)}</div>
          <div className="text-sm font-bold mt-1 italic text-ink/70">{Utils.fmtBS(totalCosto * state.tasa)}</div>
        </div>
        <div className="kpi p-6 border-line shadow-md bg-white">
          <div className="text-[10px] font-black uppercase mb-1 text-ink">Valor al Precio de Venta (Total)</div>
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
            <select 
              className="form-select bg-white text-ink border-none text-[10px] font-black uppercase h-8 px-3 rounded shadow-sm"
              value={filterValue}
              onChange={e => setFilterValue(e.target.value)}
            >
              <option value="">TODOS LOS ITEMS</option>
              {uniqueValues.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
            </select>
          </div>

          <button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px] shadow-sm" onClick={handleExportPDF}>
            <FileText className="w-3.5 h-3.5" /> PDF Profesional
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Cod.</th>
                <th className="font-black text-ink uppercase text-[10px]">Nombre Producto</th>
                <th className="font-black text-ink uppercase text-[10px]">Marca / Pres.</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Costo USD</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Venta USD</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Stock</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Subtotal Costo</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredProducts.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-20 text-ink/20 font-black italic uppercase">No hay productos que coincidan</td></tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="border-b border-line/30 hover:bg-surface-warm/20">
                    <td className="mono text-[11px] font-black text-ink">{p.codigo}</td>
                    <td className="font-black uppercase text-xs text-ink">{p.nombre}</td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-ink">{p.marca}</span>
                        <span className="text-[9px] text-ink font-bold opacity-60">{p.cantidad}</span>
                      </div>
                    </td>
                    <td className="mono text-right font-bold text-ink">{Utils.fmtUSD(p.costoUSD)}</td>
                    <td className="mono text-right text-brand-gold-deep font-black">{Utils.fmtUSD(p.precioUSD)}</td>
                    <td className="text-center">
                      <span className={`badge ${p.stock <= p.stockMinimo ? 'badge-err' : 'badge-neutral'} font-black`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="mono text-right font-black text-ink">{Utils.fmtUSD(Utils.round(p.costoUSD * p.stock))}</td>
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

function ReporteVentas({ state }: { state: AppState }) {
  const [filter, setFilter] = useState('hoy');
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());

  const filtrarVentas = () => {
    const hoy = Utils.hoy();
    const esteMes = hoy.slice(0, 7);
    const esteAño = hoy.slice(0, 4);

    return state.ventas.filter(v => {
      if (filter === 'hoy') return v.fecha.startsWith(hoy);
      if (filter === 'mes') return v.fecha.startsWith(esteMes);
      if (filter === 'año') return v.fecha.startsWith(esteAño);
      if (filter === 'custom') return v.fecha >= desde && v.fecha <= hasta;
      return true;
    });
  };

  const ventas = filtrarVentas();
  const totalVendidos = ventas.reduce((acc, v) => acc + v.items.reduce((sum, item) => sum + item.cantidad, 0), 0);

  const handleExportPDF = () => {
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const hoyStr = Utils.hoy();
    const [year, month] = hoyStr.split('-').map(Number);
    
    let periodoLabel = filter;
    if (filter === 'hoy') {
      periodoLabel = Utils.fmtFecha(hoyStr);
    } else if (filter === 'mes') {
      periodoLabel = `Mes ${meses[month - 1]} ${year}`;
    } else if (filter === 'año') {
      periodoLabel = `Año ${year}`;
    } else if (filter === 'custom') {
      periodoLabel = `${Utils.fmtFecha(desde)} a ${Utils.fmtFecha(hasta)}`;
    }

    exportarPDFVentasDetallado(ventas, state.empresa, periodoLabel, { totalVendidos });
  };

  return (
    <div className="space-y-4">
      <div className="filters flex flex-wrap gap-4 items-end bg-white p-5 rounded-lg border border-line shadow-sm">
        <div className="form-group mb-0">
          <label className="text-ink text-[10px] font-black uppercase mb-1 block">Filtrar por:</label>
          <select className="form-select w-auto bg-surface-soft border-line text-ink font-black h-10 px-3 rounded shadow-inner" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="hoy">Ventas de Hoy</option>
            <option value="mes">Ventas del Mes</option>
            <option value="año">Ventas del Año</option>
            <option value="custom">Periodo Custom</option>
          </select>
        </div>
        
        {filter === 'custom' && (
          <>
            <div className="form-group mb-0">
              <label className="text-ink text-[10px] font-black uppercase mb-1 block">Desde</label>
              <input type="date" className="form-input h-10 px-3" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="form-group mb-0">
              <label className="text-ink text-[10px] font-black uppercase mb-1 block">Hasta</label>
              <input type="date" className="form-input h-10 px-3" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          </>
        )}

        <div className="flex flex-col bg-brand-gold-soft px-4 py-2 rounded border border-brand-gold/30">
          <span className="text-[8px] text-brand-gold-deep font-black uppercase">Unidades Vendidas</span>
          <span className="text-xl font-black text-ink">{totalVendidos}</span>
        </div>

        <button className="btn btn-secondary shadow-sm ml-auto" onClick={handleExportPDF}>
          <FileText className="w-4 h-4" /> Exportar Ventas
        </button>
      </div>

      <div className="card shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-gold" /> BITÁCORA DE VENTAS DEL PERIODO
          </h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
                <th className="font-black text-ink uppercase text-[10px]">Producto</th>
                <th className="font-black text-ink uppercase text-[10px]">Pago</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Cant.</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Precio $</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Total $</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {ventas.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-20 text-ink/20 font-black italic uppercase">Sin ventas en este periodo</td></tr>
              ) : (
                ventas.map(v => v.items.map((item, idx) => (
                  <tr key={`${v.id}-${idx}`} className="border-b border-line/30 hover:bg-surface-warm/10">
                    <td className="text-xs font-bold text-ink">{idx === 0 ? Utils.fmtFecha(v.fecha) : ''}</td>
                    <td className="font-black uppercase text-xs text-ink">{item.nombre}</td>
                    <td><span className="text-[9px] uppercase font-black badge badge-neutral">{v.metodoPago}</span></td>
                    <td className="font-black mono text-ink text-center">{item.cantidad}</td>
                    <td className="mono font-bold text-ink text-right">{Utils.fmtUSD(item.precioUnitUSD)}</td>
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
  const [filter, setFilter] = useState('hoy');
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());

  const filtrarDevoluciones = () => {
    const hoy = Utils.hoy();
    const esteMes = hoy.slice(0, 7);
    const esteAño = hoy.slice(0, 4);

    return (state.devoluciones || []).filter(d => {
      if (filter === 'hoy') return d.fecha.startsWith(hoy);
      if (filter === 'mes') return d.fecha.startsWith(esteMes);
      if (filter === 'año') return d.fecha.startsWith(esteAño);
      if (filter === 'custom') return d.fecha >= desde && d.fecha <= hasta;
      return true;
    });
  };

  const devoluciones = filtrarDevoluciones();
  const totalUSD = devoluciones.reduce((acc, d) => acc + d.totalUSD, 0);

  const handleExportPDF = () => {
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const hoyStr = Utils.hoy();
    const [year, month] = hoyStr.split('-').map(Number);
    
    let periodoLabel = filter;
    if (filter === 'hoy') {
      periodoLabel = Utils.fmtFecha(hoyStr);
    } else if (filter === 'mes') {
      periodoLabel = `Mes ${meses[month - 1]} ${year}`;
    } else if (filter === 'año') {
      periodoLabel = `Año ${year}`;
    } else if (filter === 'custom') {
      periodoLabel = `${Utils.fmtFecha(desde)} a ${Utils.fmtFecha(hasta)}`;
    }

    exportarPDFDevoluciones(devoluciones, state.empresa, periodoLabel, { totalUSD });
  };

  return (
    <div className="space-y-4">
      <div className="filters flex flex-wrap gap-4 items-end bg-white p-5 rounded-lg border border-line shadow-sm">
        <div className="form-group mb-0">
          <label className="text-ink text-[10px] font-black uppercase mb-1 block">Filtrar por:</label>
          <select className="form-select bg-surface-soft border-line text-ink font-black h-10 px-3 rounded shadow-inner" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="hoy">Hoy</option>
            <option value="mes">Mes Actual</option>
            <option value="año">Año Actual</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        
        <div className="flex flex-col bg-status-danger-soft px-4 py-2 rounded border border-status-danger/30">
          <span className="text-[8px] text-status-danger font-black uppercase">Total Reembolsado</span>
          <span className="text-xl font-black text-status-danger">{Utils.fmtUSD(totalUSD)}</span>
        </div>

        <button className="btn btn-secondary shadow-sm ml-auto" onClick={handleExportPDF}>
          <FileText className="w-4 h-4" /> PDF Devoluciones
        </button>
      </div>

      <div className="card shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-brand-gold" /> REGISTRO CRONOLÓGICO DE DEVOLUCIONES
          </h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
                <th className="font-black text-ink uppercase text-[10px]">ID Dev.</th>
                <th className="font-black text-ink uppercase text-[10px]">Venta Ref.</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Total USD</th>
                <th className="font-black text-ink uppercase text-[10px]">Motivo</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {devoluciones.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-20 text-ink/20 font-black italic uppercase">No hay devoluciones registradas</td></tr>
              ) : (
                devoluciones.map(d => (
                  <tr key={d.id} className="border-b border-line/30 hover:bg-surface-warm/10">
                    <td className="text-xs font-bold text-ink">{Utils.fmtFecha(d.fecha)}</td>
                    <td className="text-status-danger font-black mono text-xs">{d.id}</td>
                    <td className="text-ink font-black mono text-xs opacity-60">{d.ventaId}</td>
                    <td className="mono text-right font-black text-ink">{Utils.fmtUSD(d.totalUSD)}</td>
                    <td className="text-xs uppercase italic font-bold text-ink/70">{d.motivo}</td>
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

function ReporteKardex({ state, selectedId, onSelect }: { state: AppState, selectedId: string | null, onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  
  const products = state.productos.filter(p => p.activo);
  const selectedProd = selectedId ? state.productos.find(p => p.id === selectedId) : null;
  const movs = selectedId ? state.movimientos.filter(m => m.productoId === selectedId).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [];

  const filtered = search.trim().length > 0 
    ? products.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())).slice(0, 15)
    : [];

  const handleExportPDF = () => {
    if (!selectedProd) return;
    exportarPDFKardex(selectedProd, movs, state.empresa);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap items-center bg-white p-5 rounded-lg border border-line shadow-sm">
        <div className="form-group mb-0 flex-1 min-w-[300px] relative">
          <label className="text-ink text-[10px] font-black uppercase mb-1 block">Búsqueda Inteligente de Producto</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-brand-gold" />
            <input 
              type="text"
              className="form-input pl-10 pr-10 py-2 bg-surface-soft border-line text-ink font-black uppercase text-xs h-11" 
              placeholder="Escribe código o nombre..." 
              value={selectedProd ? `${selectedProd.codigo} - ${selectedProd.nombre}` : search}
              onChange={(e) => { if (selectedId) onSelect(''); setSearch(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
            />
            {(selectedId || search) && (
              <button onClick={() => { onSelect(''); setSearch(''); }} className="absolute right-3 top-3 text-ink/30 hover:text-status-danger"><X className="w-4 h-4" /></button>
            )}
          </div>
          {showResults && (search.length > 0) && (
            <div className="absolute top-full left-0 right-0 bg-white border border-line rounded shadow-2xl z-[100] mt-1 max-h-60 overflow-y-auto">
              {filtered.length === 0 ? <div className="p-4 text-center text-ink text-[10px] font-black uppercase">Sin resultados</div> : filtered.map(p => (
                <div key={p.id} className="p-3 hover:bg-brand-gold/10 cursor-pointer border-b border-line flex justify-between items-center transition-colors" onMouseDown={() => { onSelect(p.id); setSearch(''); setShowResults(false); }}>
                  <div className="flex flex-col"><span className="text-ink font-black text-xs uppercase">{p.nombre}</span><span className="text-[9px] text-ink font-bold mono opacity-60">{p.codigo}</span></div>
                  <div className="text-right"><div className="text-brand-gold-deep font-black text-xs">{Utils.fmtUSD(p.precioUSD)}</div><div className="text-[8px] text-ink font-black uppercase opacity-40">{p.categoria}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button disabled={!selectedProd} className="btn btn-secondary h-11 px-5 shadow-sm disabled:opacity-20" onClick={handleExportPDF}>
          <FileText className="w-4 h-4" /> Descargar Kardex
        </button>
      </div>

      {selectedProd && (
        <div className="p-6 rounded-xl border border-line bg-white shadow-md flex gap-12 flex-wrap">
          <div><p className="text-[10px] font-black uppercase text-ink opacity-60">Producto</p><p className="text-lg font-black uppercase text-ink">{selectedProd.nombre}</p></div>
          <div><p className="text-[10px] font-black uppercase text-ink opacity-60">Código</p><p className="text-lg font-black mono text-ink">{selectedProd.codigo}</p></div>
          <div><p className="text-[10px] font-black uppercase text-ink opacity-60">Stock Actual</p><p className="text-2xl font-black text-status-info">{selectedProd.stock}</p></div>
          <div><p className="text-[10px] font-black uppercase text-ink opacity-60">Costo (CPP)</p><p className="text-2xl font-black text-ink">{Utils.fmtUSD(selectedProd.costoUSD)}</p></div>
        </div>
      )}

      <div className="card shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <History className="w-5 h-5 text-brand-gold" /> KARDEX HISTÓRICO DE MOVIMIENTOS
          </h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Fecha / Hora</th>
                <th className="font-black text-ink uppercase text-[10px]">Movimiento</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Cant.</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Stock Antes</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Stock Después</th>
                <th className="font-black text-ink uppercase text-[10px]">Referencia</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {!selectedId ? (
                <tr><td colSpan={6} className="text-center py-20 text-ink/20 uppercase italic font-black">Selecciona un ítem para auditar sus movimientos</td></tr>
              ) : movs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-20 text-ink/20 uppercase italic font-black">Sin movimientos en historial</td></tr>
              ) : (
                movs.map(m => {
                  const isEntry = m.tipo === 'compra' || m.tipo === 'ajuste_entrada' || m.tipo === 'devolucion';
                  const displayCant = isEntry ? `+${m.cantidad}` : `-${Math.abs(m.cantidad)}`;
                  return (
                    <tr key={m.id} className="border-b border-line/30 hover:bg-surface-warm/10">
                      <td className="text-[11px] font-black text-ink">{m.fecha.replace('T', ' ').slice(0, 16)}</td>
                      <td><span className="font-black uppercase text-[9px] badge badge-neutral">{m.tipo.replace('_', ' ')}</span></td>
                      <td className={`mono font-black text-sm text-center ${isEntry ? 'text-status-success' : 'text-status-danger'}`}>{displayCant}</td>
                      <td className="mono font-bold text-ink/60 text-center">{m.stockAntes}</td>
                      <td className="mono font-black text-ink text-center">{m.stockDespues}</td>
                      <td className="text-[10px] italic font-bold text-ink/60">{m.referencia}</td>
                    </tr>
                  );
                })
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

  const handleExportPDF = () => {
    const data = ajustes.map(m => {
      const p = state.productos.find(prod => prod.id === m.productoId);
      return { ...m, nombreProd: p?.nombre || 'N/A' };
    });
    exportarPDFHistorialAjustes(data, state.empresa, efectoNetoUSD);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`kpi p-6 border-line shadow-md border-l-8 ${efectoNetoUSD >= 0 ? 'bg-white border-l-status-success' : 'bg-status-danger-soft border-l-status-danger border-status-danger/20'}`}>
          <div className="text-[10px] font-black uppercase mb-1 text-ink">Variación Neta de Capital en Inventario ($)</div>
          <div className="text-3xl font-black text-ink">{Utils.fmtUSD(efectoNetoUSD)}</div>
          <div className="text-sm font-bold mt-1 italic text-ink/60">{Utils.fmtBS(efectoNetoUSD * state.tasa)}</div>
        </div>
      </div>

      <div className="card shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-brand-gold" /> BITÁCORA DE AJUSTES DE ALMACÉN
          </h3>
          <button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px] shadow-sm" onClick={handleExportPDF}>
            <FileText className="w-3.5 h-3.5" /> Reporte de Auditoría
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
                <th className="font-black text-ink uppercase text-[10px]">Producto</th>
                <th className="font-black text-ink uppercase text-[10px]">Tipo de Ajuste</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Cant.</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Antes</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Después</th>
                <th className="font-black text-ink uppercase text-[10px]">Detalle</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {ajustes.map(m => {
                const p = state.productos.find(prod => prod.id === m.productoId);
                const isEntry = m.tipo.includes('entrada') || m.tipo === 'compra';
                return (
                  <tr key={m.id} className="border-b border-line/30 hover:bg-surface-warm/10">
                    <td className="text-[11px] font-bold text-ink">{m.fecha.replace('T', ' ').slice(0, 16)}</td>
                    <td className="font-black uppercase text-ink text-xs">{p?.nombre || 'PRODUCTO ELIMINADO'}</td>
                    <td><span className="uppercase text-[9px] font-black badge badge-neutral">{m.tipo}</span></td>
                    <td className={`mono font-black text-center ${isEntry ? 'text-status-success' : 'text-status-danger'}`}>{isEntry ? '+' : ''}{m.cantidad}</td>
                    <td className="mono font-bold text-ink/50 text-center">{m.stockAntes}</td>
                    <td className="mono font-black text-ink text-center">{m.stockDespues}</td>
                    <td className="text-[10px] italic font-bold text-ink/70">{m.referencia}</td>
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

  const handleExportPDF = () => {
    const data = movs.map(m => {
      const p = state.productos.find(prod => prod.id === m.productoId);
      const costo = p?.costoUSD || 0;
      return { ...m, nombreProd: p?.nombre || 'N/A', costoUnit: costo, subtotal: Utils.round(Math.abs(m.cantidad) * costo) };
    });
    exportarPDFConsumoInterno(data, state.empresa, totalPerdidaUSD);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi p-5 border-line shadow-md bg-white">
          <div className="text-[10px] font-black uppercase mb-1 text-ink">Colaboraciones</div>
          <div className="text-3xl font-black text-ink">{movs.filter(m => m.tipo === 'colaboracion').length}</div>
        </div>
        <div className="kpi p-5 border-line shadow-md bg-white">
          <div className="text-[10px] font-black uppercase mb-1 text-ink">Consumo Interno</div>
          <div className="text-3xl font-black text-ink">{movs.filter(m => m.tipo === 'consumo').length}</div>
        </div>
        <div className="kpi p-5 border-l-8 border-l-status-danger shadow-md bg-white border-line">
          <div className="text-[10px] font-black uppercase mb-1 text-status-danger">Pérdida Total Invertida</div>
          <div className="text-3xl font-black text-status-danger">{Utils.fmtUSD(totalPerdidaUSD)}</div>
        </div>
      </div>
      
      <div className="card shadow-lg border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-gold" /> DESGLOSE DE SALIDAS SIN FACTURACIÓN
          </h3>
          <button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px] shadow-sm" onClick={handleExportPDF}>
            <FileText className="w-3.5 h-3.5" /> Exportar Merma
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="font-black text-ink uppercase text-[10px]">Fecha</th>
                <th className="font-black text-ink uppercase text-[10px]">Producto</th>
                <th className="font-black text-ink uppercase text-[10px]">Tipo</th>
                <th className="font-black text-ink uppercase text-[10px] text-center">Cantidad</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Costo Unit.</th>
                <th className="font-black text-ink uppercase text-[10px] text-right">Costo Total</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {movs.map(m => {
                const p = state.productos.find(prod => prod.id === m.productoId);
                const subPerdida = Utils.round(Math.abs(m.cantidad) * (p?.costoUSD || 0));
                return (
                  <tr key={m.id} className="border-b border-line/30 hover:bg-surface-warm/10">
                    <td className="text-[11px] font-bold text-ink">{m.fecha.slice(0, 10)}</td>
                    <td className="font-black uppercase text-xs text-ink">{p?.nombre}</td>
                    <td><span className="uppercase text-[9px] font-black badge badge-neutral">{m.tipo}</span></td>
                    <td className="font-black mono text-ink text-center">{Math.abs(m.cantidad)}</td>
                    <td className="mono font-bold text-ink text-right">{Utils.fmtUSD(p?.costoUSD || 0)}</td>
                    <td className="mono font-black text-status-danger text-right">{Utils.fmtUSD(subPerdida)}</td>
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
  const [cantidad, setCantidad] = useState<string | number>(1);
  const [nuevoCosto, setNuevoCosto] = useState<string | number>(Utils.round(producto.costoUSD));
  const [ref, setRef] = useState('');

  const handleSave = () => {
    const pCant = parseFloat(cantidad.toString()) || 0;
    const pCosto = parseFloat(nuevoCosto.toString()) || 0;
    if (pCant <= 0) return alert('Cantidad invalida');
    if ((tipo !== 'ajuste_entrada') && pCant > producto.stock) return alert('Stock insuficiente');
    
    const mov: Movimiento = {
      id: Store.uid(),
      productoId: producto.id,
      tipo,
      cantidad: tipo === 'ajuste_entrada' ? pCant : -Math.abs(pCant),
      stockAntes: producto.stock,
      stockDespues: tipo === 'ajuste_entrada' ? producto.stock + pCant : producto.stock - Math.abs(pCant),
      fecha: Utils.ahora(),
      referencia: tipo === 'ajuste_entrada' ? `${ref || 'Entrada manual'} - Costo unit: $${Utils.round(pCosto)}` : (ref || 'Ajuste manual')
    };
    onSave(mov, tipo === 'ajuste_entrada' ? Utils.round(pCosto) : undefined);
  };

  return (
    <div className="modal show">
      <div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-white border-2 border-line max-w-md">
        <div className="modal-head px-5 py-4 border-b border-line">
          <h3 className="text-ink font-black uppercase text-sm">Ajustar Almacén: {producto.nombre.toUpperCase()}</h3>
          <button className="btn-icon h-8 w-8 text-ink" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="modal-body p-6 space-y-5 bg-white">
          <div className="p-4 bg-surface-soft rounded-lg flex justify-between items-center border border-line shadow-inner">
            <div className="flex flex-col"><span className="text-[9px] font-black uppercase opacity-50">Stock Actual</span><span className="text-lg font-black text-ink">{producto.stock} UDS</span></div>
            <div className="flex flex-col items-end"><span className="text-[9px] font-black uppercase opacity-50">CPP Actual</span><span className="text-lg font-black text-brand-gold-deep">${producto.costoUSD.toFixed(2)}</span></div>
          </div>
          
          <div className="form-group">
            <label className="text-ink text-[10px] font-black uppercase block mb-1">Tipo de Movimiento</label>
            <select className="form-select bg-white text-ink border-line rounded-md w-full h-11 px-3 text-sm font-bold shadow-sm" value={tipo} onChange={e => setTipo(e.target.value as any)}>
              <option value="ajuste_entrada">Entrada (+) Re-calcula CPP</option>
              <option value="ajuste_salida">Salida Directa (-)</option>
              <option value="consumo">Consumo del Negocio (-)</option>
              <option value="colaboracion">Donación / Colaboración (-)</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="text-ink text-[10px] font-black uppercase block mb-1">Cantidad de Unidades</label>
              <input type="number" className="form-input h-11 px-3 text-lg" value={cantidad} onChange={e => setCantidad(e.target.value)} min="1" />
            </div>
            {tipo === 'ajuste_entrada' && (
              <div className="form-group">
                <label className="text-ink text-[10px] font-black uppercase block mb-1">Costo de Entrada ($)</label>
                <input type="number" step="0.01" className="form-input h-11 px-3 text-lg text-brand-gold-deep" value={nuevoCosto} onChange={e => setNuevoCosto(e.target.value)} />
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label className="text-ink text-[10px] font-black uppercase block mb-1">Referencia o Justificación</label>
            <textarea className="form-input min-h-[80px] py-2" placeholder="Explique el motivo del ajuste..." value={ref} onChange={e => setRef(e.target.value)}></textarea>
          </div>
        </div>
        <div className="modal-foot p-5 bg-surface-soft border-t border-line">
          <button className="btn btn-secondary font-black" onClick={onClose}>Descartar</button>
          <button className="btn btn-primary font-black shadow-md" onClick={handleSave}>Procesar Ajuste</button>
        </div>
      </div>
    </div>
  );
}

function ModalProducto({ producto, state, onClose, onSave, onUpdateLists }: { producto?: Product, state: AppState, onClose: () => void, onSave: (p: any) => void, onUpdateLists: (l: any) => void }) {
  const [datos, setDatos] = useState<any>({
    codigo: producto?.codigo || '',
    nombre: producto?.nombre || '',
    categoria: producto?.categoria || state.categorias[0] || '',
    departamento: producto?.departamento || state.departamentos[0] || '',
    cantidad: producto?.cantidad || state.presentaciones[0] || '750ml',
    marca: producto?.marca || state.marcas[0] || '',
    costoUSD: Utils.round(producto?.costoUSD || 0),
    precioUSD: Utils.round(producto?.precioUSD || 0),
    precioEstandarUSD: Utils.round(producto?.precioEstandarUSD || producto?.precioUSD || 0),
    precioMayorUSD: Utils.round(producto?.precioMayorUSD || 0),
    precioOfertaUSD: Utils.round(producto?.precioOfertaUSD || 0),
    precioPromoUSD: Utils.round(producto?.precioPromoUSD || 0),
    tipoPrecioPrincipal: producto?.tipoPrecioPrincipal || 'estandar',
    margen: producto?.margen || 0,
    precioBS: Utils.round((producto?.precioUSD || 0) * state.tasa),
    stock: producto?.stock || 0,
    stockMinimo: producto?.stockMinimo || 3,
    proveedor: producto?.proveedor || '',
    aplicaIVA: producto?.aplicaIVA ?? true,
    isKit: producto?.isKit || false,
    kitType: producto?.kitType || 'stock_propio',
    kitItems: producto?.kitItems || [] as KitItem[]
  });

  const updateSelectedPrice = (usd: number | string) => {
    const rUSD = Utils.round(parseFloat(usd.toString()) || 0);
    setDatos((d: any) => {
      const update: any = { precioUSD: usd, precioBS: Utils.round(rUSD * state.tasa) };
      if (d.tipoPrecioPrincipal === 'estandar') update.precioEstandarUSD = usd;
      else if (d.tipoPrecioPrincipal === 'mayor') update.precioMayorUSD = usd;
      else if (d.tipoPrecioPrincipal === 'oferta') update.precioOfertaUSD = usd;
      else if (d.tipoPrecioPrincipal === 'promo') update.precioPromoUSD = usd;
      return { ...d, ...update };
    });
  };

  const recalcularDesdeUSD = (usd: number | string, costo: number | string = datos.costoUSD) => {
    const rUSD = parseFloat(usd.toString()) || 0;
    const rCosto = parseFloat(costo.toString()) || 0;
    const nuevoMargen = rUSD > 0 ? ((rUSD - rCosto) / rUSD) * 100 : 0;
    setDatos((d: any) => ({ ...d, precioUSD: usd, margen: nuevoMargen, precioBS: Utils.round(rUSD * state.tasa), costoUSD: costo }));
    updateSelectedPrice(usd);
  };

  const recalcularDesdeMargen = (m: number | string, costo: number | string = datos.costoUSD) => {
    const rCosto = parseFloat(costo.toString()) || 0;
    const rM = parseFloat(m.toString()) || 0;
    const factor = (1 - (rM / 100));
    const usd = factor > 0 ? Utils.round(rCosto / factor) : 0;
    setDatos((d: any) => ({ ...d, margen: m, precioUSD: usd, precioBS: Utils.round(usd * state.tasa), costoUSD: costo }));
    updateSelectedPrice(usd);
  };

  const recalcularDesdeBS = (bs: number | string) => {
    const rBS = parseFloat(bs.toString()) || 0;
    const usd = Utils.round(rBS / state.tasa);
    const rCosto = parseFloat(datos.costoUSD.toString()) || 0;
    const nuevoMargen = usd > 0 ? ((usd - rCosto) / usd) * 100 : 0;
    setDatos((d: any) => ({ ...d, precioBS: bs, precioUSD: usd, margen: nuevoMargen }));
    updateSelectedPrice(usd);
  };

  useEffect(() => {
    let p = datos.precioEstandarUSD;
    if (datos.tipoPrecioPrincipal === 'mayor') p = datos.precioMayorUSD;
    if (datos.tipoPrecioPrincipal === 'oferta') p = datos.precioOfertaUSD;
    if (datos.tipoPrecioPrincipal === 'promo') p = datos.precioPromoUSD;
    
    const rP = parseFloat(p.toString()) || 0;
    const rCosto = parseFloat(datos.costoUSD.toString()) || 0;
    const m = rP > 0 ? ((rP - rCosto) / rP) * 100 : 0;
    setDatos((d: any) => ({ ...d, precioUSD: p, precioBS: Utils.round(rP * state.tasa), margen: m }));
  }, [datos.tipoPrecioPrincipal]);

  const handleSubmit = () => {
    if (!datos.nombre || !datos.codigo) return alert('Nombre y Código son requeridos');
    onSave({
      ...datos,
      costoUSD: parseFloat(datos.costoUSD.toString()) || 0,
      precioUSD: parseFloat(datos.precioUSD.toString()) || 0,
      stock: parseInt(datos.stock.toString()) || 0,
      stockMinimo: parseInt(datos.stockMinimo.toString()) || 0
    });
  };

  return (
    <div className="modal show">
      <div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-white max-w-2xl border-2 border-line">
        <div className="modal-head py-4 px-6 border-b border-line bg-surface-soft">
          <h3 className="text-lg font-black uppercase text-ink">{producto ? 'Editar Ficha Técnica' : 'Registrar Nuevo Ítem'}</h3>
          <button className="btn-icon h-10 w-10 text-ink" onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <div className="modal-body p-6 space-y-6 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group col-span-1">
              <label className="text-[10px] font-black uppercase text-ink/60 block mb-1">Código Barra / SKU</label>
              <input className="form-input h-11 mono text-base" value={datos.codigo} onChange={e => setDatos({...datos, codigo: e.target.value})} placeholder="Escanee..." />
            </div>
            <div className="form-group col-span-2">
              <label className="text-[10px] font-black uppercase text-ink/60 block mb-1">Nombre Descriptivo</label>
              <input className="form-input h-11 text-base" value={datos.nombre} onChange={e => setDatos({...datos, nombre: e.target.value})} placeholder="Ej: Cacique 500 750ml" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-ink/60 block mb-1">Categoría</label>
              <select className="form-input h-11 text-xs font-bold" value={datos.categoria} onChange={e => setDatos({...datos, categoria: e.target.value})}>
                {state.categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-ink/60 block mb-1">Marca</label>
              <select className="form-input h-11 text-xs font-bold" value={datos.marca} onChange={e => setDatos({...datos, marca: e.target.value})}>
                {state.marcas.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-ink/60 block mb-1">Stock Inicial</label>
              <input type="number" className="form-input h-11 text-center font-black" value={datos.stock} onChange={e => setDatos({...datos, stock: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-ink/60 block mb-1">Stock Mínimo</label>
              <input type="number" className="form-input h-11 text-center font-black text-status-danger" value={datos.stockMinimo} onChange={e => setDatos({...datos, stockMinimo: e.target.value})} />
            </div>
          </div>

          <div className="bg-surface-soft p-5 rounded-xl border border-line shadow-inner">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-ink/60 block mb-1">Costo Neto $</label>
                <input className="form-input h-11 font-black text-ink" type="number" step="0.01" value={datos.costoUSD} onChange={e => recalcularDesdeMargen(datos.margen, e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-status-success block mb-1">Margen %</label>
                <input className="form-input h-11 font-black text-status-success" type="number" step="0.01" value={datos.margen} onChange={e => recalcularDesdeMargen(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-brand-gold-deep block mb-1">PV Divisa $</label>
                <input className="form-input h-11 font-black text-brand-gold-deep" type="number" step="0.01" value={datos.precioUSD} onChange={e => recalcularDesdeUSD(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-ink block mb-1">PV Bolívares</label>
                <input className="form-input h-11 font-black text-ink" type="number" step="0.01" value={datos.precioBS} onChange={e => recalcularDesdeBS(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot p-5 bg-surface-soft border-t border-line flex justify-end gap-3">
          <button className="btn btn-secondary px-8 font-black" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary px-8 font-black shadow-lg" onClick={handleSubmit}>{producto ? 'Actualizar Ficha' : 'Crear Producto'}</button>
        </div>
      </div>
    </div>
  );
}
