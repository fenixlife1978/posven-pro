
'use client';

import React, { useState, useEffect } from 'react';
import { AppState, Product, Movimiento, KitItem } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { Plus, Search, Edit2, Trash2, Boxes, X, BarChart3, FileText, History, Gift, Layers, Trash, ShoppingBag, TrendingUp, Printer, RotateCcw } from 'lucide-react';
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
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-ink" />
                <input className="form-input pl-10" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="form-select w-auto bg-white border-line rounded-md px-3 py-2 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">Todas las categorias</option>
                {state.categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={handleDownloadBasicInv}><FileText className="w-4 h-4" /> PDF</button>
              <button className="btn btn-primary" onClick={() => setShowProducto('nuevo')}><Plus className="w-4 h-4" /> Nuevo Producto</button>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cod.</th>
                    <th>Nombre</th>
                    <th>Cat. / Dep.</th>
                    <th>Costo USD</th>
                    <th>P. Venta USD</th>
                    <th>Stock</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {prods.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 opacity-30">No se encontraron productos</td></tr>
                  ) : (
                    prods.map(p => (
                      <tr key={p.id}>
                        <td className="mono text-xs font-bold">{p.codigo}</td>
                        <td className="font-bold">
                          <div className="flex items-center gap-2">
                            {p.isKit && <Layers className="w-3 h-3 text-[#c8952e]" />}
                            {p.nombre}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span className="badge badge-neutral mb-1">{p.categoria}</span>
                            <span className="text-[0.65rem] text-ink uppercase font-bold">{p.departamento || 'Sin Dept.'}</span>
                          </div>
                        </td>
                        <td className="mono font-bold">{Utils.fmtUSD(p.costoUSD)}</td>
                        <td className="mono text-[#c8952e] font-black">{Utils.fmtUSD(p.precioUSD)}</td>
                        <td>
                          <span className={`badge ${p.stock <= p.stockMinimo ? 'badge-err' : 'badge-ok'}`}>
                            {p.stock}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn-icon text-[#c8952e]" onClick={() => setShowProducto(p.id)}><Edit2 className="w-3.5 h-3.5" /></button>
                            <button className="btn-icon text-[#3a9bdc]" onClick={() => { setSelectedKardexId(p.id); setActiveTab('kardex'); }}><History className="w-3.5 h-3.5" /></button>
                            <button className="btn-icon text-[#27ae60]" onClick={() => setShowAjuste(p.id)}><Boxes className="w-3.5 h-3.5" /></button>
                            <button className="btn-icon text-[#e04848]" onClick={() => eliminar(p.id)}><Trash2 className="w-3.5 h-3.5" /></button>
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
      <div className="tabs flex border-b border-line overflow-x-auto no-print">
        <button onClick={() => setActiveTab('productos')} className={`tab ${activeTab === 'productos' ? 'active' : ''}`}>Productos</button>
        <button onClick={() => setActiveTab('reporte_general')} className={`tab ${activeTab === 'reporte_general' ? 'active' : ''}`}>Reporte General (CPP)</button>
        <button onClick={() => setActiveTab('reporte_ventas')} className={`tab ${activeTab === 'reporte_ventas' ? 'active' : ''}`}>Reporte de Ventas</button>
        <button onClick={() => setActiveTab('reporte_devoluciones')} className={`tab ${activeTab === 'reporte_devoluciones' ? 'active' : ''}`}>Devoluciones</button>
        <button onClick={() => setActiveTab('kardex')} className={`tab ${activeTab === 'kardex' ? 'active' : ''}`}>Kardex</button>
        <button onClick={() => setActiveTab('historial_ajustes')} className={`tab ${activeTab === 'historial_ajustes' ? 'active' : ''}`}>Historial de Ajustes</button>
        <button onClick={() => setActiveTab('consumo_colab')} className={`tab ${activeTab === 'consumo_colab' ? 'active' : ''}`}>Consumo y Colab.</button>
      </div>

      {renderContent()}

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="kpi p-6 rounded-xl border border-line">
          <div className="text-[10px] font-black uppercase mb-1 text-ink">Valor al Costo (CPP Total)</div>
          <div className="text-3xl font-black text-ink">{Utils.fmtUSD(totalCosto)}</div>
          <div className="text-sm font-bold mt-1 italic text-ink">{Utils.fmtBS(totalCosto * state.tasa)}</div>
        </div>
        <div className="kpi p-6 rounded-xl border border-line">
          <div className="text-[10px] font-black uppercase mb-1 text-ink">Valor al Precio de Venta (Total)</div>
          <div className="text-3xl font-black text-[#27ae60]">{Utils.fmtUSD(totalVenta)}</div>
          <div className="text-sm font-bold mt-1 italic text-ink">{Utils.fmtBS(totalVenta * state.tasa)}</div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-4">
            <h3 className="text-ink font-black uppercase text-xs">
              {filterValue ? `Listado: ${filterValue}` : 'Listado General de Productos'}
            </h3>
            <select 
              className="form-select w-auto bg-white text-ink border-line text-[10px] font-black uppercase h-10 px-2"
              value={filterValue}
              onChange={e => setFilterValue(e.target.value)}
            >
              <option value="">TODOS LOS ITEMS</option>
              {uniqueValues.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <button className={`btn btn-sm ${groupBy === 'categoria' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setGroupBy('categoria'); setFilterValue(''); }}>Categoría</button>
            <button className={`btn btn-sm ${groupBy === 'departamento' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setGroupBy('departamento'); setFilterValue(''); }}>Departamento</button>
            <button className={`btn btn-sm ${groupBy === 'proveedor' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setGroupBy('proveedor'); setFilterValue(''); }}>Proveedor</button>
            <button className="btn btn-secondary font-black text-xs uppercase ml-4" onClick={handleExportPDF}>
              <FileText className="w-4 h-4" /> PDF PROFESIONAL
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="uppercase">Cod.</th>
                <th className="uppercase">Nombre Producto</th>
                <th className="uppercase">Marca / Pres.</th>
                <th className="uppercase text-right">Costo USD</th>
                <th className="uppercase text-right">Venta USD</th>
                <th className="uppercase text-center">Stock</th>
                <th className="uppercase text-right">Subtotal Costo</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-20 opacity-30 uppercase font-black italic">No hay productos que coincidan</td></tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id}>
                    <td className="mono text-[10px] font-bold">{p.codigo}</td>
                    <td className="font-black uppercase text-xs">{p.nombre}</td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-ink">{p.marca}</span>
                        <span className="text-[9px] text-ink font-bold">{p.cantidad}</span>
                      </div>
                    </td>
                    <td className="mono text-right font-bold">{Utils.fmtUSD(p.costoUSD)}</td>
                    <td className="mono text-right text-[#c8952e] font-black">{Utils.fmtUSD(p.precioUSD)}</td>
                    <td className="text-center">
                      <span className={`badge ${p.stock <= p.stockMinimo ? 'badge-err' : 'badge-neutral'} font-black`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="mono text-right font-black">{Utils.fmtUSD(Utils.round(p.costoUSD * p.stock))}</td>
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

  const statsMap: Record<string, { nombre: string, cantidad: number, precio: number }> = {};
  ventas.forEach(v => {
    v.items.forEach(item => {
      if (!statsMap[item.productoId]) {
        statsMap[item.productoId] = { nombre: item.nombre, cantidad: 0, precio: item.precioUnitUSD };
      }
      statsMap[item.productoId].cantidad += item.cantidad;
    });
  });

  const top3 = Object.values(statsMap).sort((a, b) => b.cantidad - a.cantidad).slice(0, 3);

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
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="filters flex flex-wrap gap-4 items-end bg-white p-4 rounded-lg border border-line">
        <div className="form-group mb-0">
          <label className="text-ink text-[10px] font-black uppercase mb-1 block">Filtrar por:</label>
          <select className="form-select w-auto bg-white border-line text-ink" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="hoy">Hoy</option>
            <option value="mes">Este Mes</option>
            <option value="año">Este Año</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        
        {filter === 'custom' && (
          <>
            <div className="form-group mb-0">
              <label className="text-ink text-[10px] font-black uppercase mb-1 block">Desde</label>
              <input type="date" className="form-input w-auto bg-white border-line text-ink" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="form-group mb-0">
              <label className="text-ink text-[10px] font-black uppercase mb-1 block">Hasta</label>
              <input type="date" className="form-input w-auto bg-white border-line text-ink" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          </>
        )}

        <div className="flex flex-col bg-surface-soft px-4 py-1.5 rounded border border-line">
          <span className="text-[8px] text-ink font-black uppercase">Volumen Total</span>
          <span className="text-lg font-black text-[#c8952e]">{totalVendidos} <span className="text-[9px] text-ink">UDS</span></span>
        </div>

        <button className="btn btn-secondary font-black text-xs uppercase ml-auto" onClick={handleExportPDF}>
          <FileText className="w-4 h-4" /> EXPORTAR PDF
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {top3.map((p, i) => (
          <div key={i} className="flex flex-col p-3 rounded border border-line bg-white flex-1">
            <span className="text-[8px] font-black uppercase mb-1 text-[#c8952e]">Top {i+1} Ventas</span>
            <span className="text-xs font-black uppercase truncate text-ink">{p.nombre}</span>
            <span className="text-lg font-black text-ink">{p.cantidad} <span className="text-[10px] opacity-70">UNIDADES</span></span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="uppercase">Fecha</th>
                <th className="uppercase">Producto(s)</th>
                <th className="uppercase">Tipo</th>
                <th className="uppercase">Cant.</th>
                <th className="uppercase">Precio $</th>
                <th className="uppercase">Total $</th>
              </tr>
            </thead>
            <tbody>
              {ventas.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 opacity-30 uppercase font-black italic">No hay ventas registradas</td></tr>
              ) : (
                ventas.map(v => v.items.map((item, idx) => (
                  <tr key={`${v.id}-${idx}`}>
                    <td className="text-xs font-bold">{idx === 0 ? Utils.fmtFecha(v.fecha) : ''}</td>
                    <td className="font-bold uppercase">{item.nombre}</td>
                    <td className="text-[10px] uppercase font-black">{v.metodoPago}</td>
                    <td className="font-black mono">{item.cantidad}</td>
                    <td className="mono font-bold">{Utils.fmtUSD(item.precioUnitUSD)}</td>
                    <td className="mono font-black">{Utils.fmtUSD(item.subtotalUSD)}</td>
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
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="filters flex flex-wrap gap-4 items-end bg-white p-4 rounded-lg border border-line">
        <div className="form-group mb-0">
          <label className="text-ink text-[10px] font-black uppercase mb-1 block">Filtrar por:</label>
          <select className="form-select w-auto bg-white border-line text-ink" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="hoy">Hoy</option>
            <option value="mes">Este Mes</option>
            <option value="año">Este Año</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        
        {filter === 'custom' && (
          <>
            <div className="form-group mb-0">
              <label className="text-ink text-[10px] font-black uppercase mb-1 block">Desde</label>
              <input type="date" className="form-input w-auto bg-white border-line text-ink" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="form-group mb-0">
              <label className="text-ink text-[10px] font-black uppercase mb-1 block">Hasta</label>
              <input type="date" className="form-input w-auto bg-white border-line text-ink" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          </>
        )}

        <div className="flex flex-col bg-surface-soft px-4 py-1.5 rounded border border-line">
          <span className="text-[8px] text-ink font-black uppercase">Total Reembolsado</span>
          <span className="text-lg font-black text-[#e04848]">{Utils.fmtUSD(totalUSD)}</span>
        </div>

        <button className="btn btn-secondary font-black text-xs uppercase ml-auto" onClick={handleExportPDF}>
          <FileText className="w-4 h-4" /> EXPORTAR PDF
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="uppercase">Fecha</th>
                <th className="uppercase">ID Dev.</th>
                <th className="uppercase">Venta Ref.</th>
                <th className="uppercase text-right">Total USD</th>
                <th className="uppercase">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {devoluciones.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 opacity-30 uppercase font-black italic">No hay devoluciones registradas</td></tr>
              ) : (
                devoluciones.map(d => (
                  <tr key={d.id}>
                    <td className="text-xs font-bold">{Utils.fmtFecha(d.fecha)}</td>
                    <td className="text-[#e04848] font-black mono text-xs">{d.id}</td>
                    <td className="text-ink font-black mono text-xs">{d.ventaId}</td>
                    <td className="mono text-right font-black">{Utils.fmtUSD(d.totalUSD)}</td>
                    <td className="text-xs uppercase italic font-bold">{d.motivo}</td>
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
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex gap-4 flex-wrap items-center">
        <div className="form-group mb-0 flex-1 min-w-[300px] relative">
          <label className="text-ink text-[10px] font-black uppercase mb-1 block">SELECCIONAR PRODUCTO (Búsqueda Inteligente)</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#c8952e]" />
            <input 
              type="text"
              className="form-input pl-10 pr-10 py-2 bg-white border-line text-ink font-black uppercase text-xs" 
              placeholder="Escriba código o nombre del producto..." 
              value={selectedProd ? `${selectedProd.codigo} - ${selectedProd.nombre}` : search}
              onChange={(e) => { if (selectedId) onSelect(''); setSearch(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
            />
            {(selectedId || search) && (
              <button onClick={() => { onSelect(''); setSearch(''); }} className="absolute right-3 top-2.5 text-ink hover:text-[#e04848]"><X className="w-4 h-4" /></button>
            )}
          </div>
          {showResults && (search.length > 0) && (
            <div className="absolute top-full left-0 right-0 bg-white border border-line rounded shadow-2xl z-[100] mt-1 max-h-60 overflow-y-auto">
              {filtered.length === 0 ? <div className="p-4 text-center text-ink text-[10px] font-black uppercase">Sin resultados</div> : filtered.map(p => (
                <div key={p.id} className="p-3 hover:bg-[#c8952e]/20 cursor-pointer border-b border-line flex justify-between items-center transition-colors" onMouseDown={() => { onSelect(p.id); setSearch(''); setShowResults(false); }}>
                  <div className="flex flex-col"><span className="text-ink font-black text-xs uppercase">{p.nombre}</span><span className="text-[9px] text-ink font-bold mono">{p.codigo}</span></div>
                  <div className="text-right"><div className="text-[#c8952e] font-black text-xs">{Utils.fmtUSD(p.precioUSD)}</div><div className="text-[8px] text-ink font-black uppercase">{p.categoria}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button disabled={!selectedProd} className="btn btn-secondary font-black text-xs h-10 px-4 uppercase disabled:opacity-30" onClick={handleExportPDF}>
          <FileText className="w-4 h-4" /> DESCARGAR PDF
        </button>
      </div>

      {selectedProd && (
        <div className="p-6 rounded-xl border border-line bg-white flex gap-12">
          <div><p className="text-[10px] font-black uppercase text-ink">Producto</p><p className="text-lg font-black uppercase text-ink">{selectedProd.nombre}</p></div>
          <div><p className="text-[10px] font-black uppercase text-ink">Código</p><p className="text-lg font-black mono text-ink">{selectedProd.codigo}</p></div>
          <div><p className="text-[10px] font-black uppercase text-ink">Stock Actual</p><p className="text-2xl font-black text-[#3a9bdc]">{selectedProd.stock}</p></div>
          <div><p className="text-[10px] font-black uppercase text-ink">Costo (CPP)</p><p className="text-2xl font-black text-ink">{Utils.fmtUSD(selectedProd.costoUSD)}</p></div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="uppercase">Fecha / Hora</th>
                <th className="uppercase">Tipo Movimiento</th>
                <th className="uppercase">Cant.</th>
                <th className="uppercase">Antes</th>
                <th className="uppercase">Después</th>
                <th className="uppercase">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {!selectedId ? (
                <tr><td colSpan={6} className="text-center py-20 opacity-30 uppercase italic font-black">Seleccione un producto para ver el Kardex</td></tr>
              ) : movs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-20 opacity-30 uppercase italic font-black">Sin movimientos registrados</td></tr>
              ) : (
                movs.map(m => {
                  const isEntry = m.tipo === 'compra' || m.tipo === 'ajuste_entrada' || m.tipo === 'devolucion';
                  const displayCant = isEntry ? `+${m.cantidad}` : `-${Math.abs(m.cantidad)}`;
                  return (
                    <tr key={m.id}>
                      <td className="text-[11px] font-black">{m.fecha.replace('T', ' ').slice(0, 16)}</td>
                      <td><span className="font-black uppercase text-[9px]">{m.tipo.replace('_', ' ')}</span></td>
                      <td className={`mono font-black text-sm ${isEntry ? 'text-[#27ae60]' : 'text-[#e04848]'}`}>{displayCant}</td>
                      <td className="mono font-bold">{m.stockAntes}</td>
                      <td className="mono font-black">{m.stockDespues}</td>
                      <td className="text-[10px] italic font-bold">{m.referencia}</td>
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
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`kpi p-6 rounded-xl border ${efectoNetoUSD >= 0 ? 'bg-[#c8952e]/10 border-[#c8952e]/20' : 'bg-[#e04848]/10 border-[#e04848]/20'}`}>
          <div className="text-[10px] font-black uppercase mb-1 text-ink">Efecto Neto en Valor Inventario ($)</div>
          <div className="text-3xl font-black text-ink">{Utils.fmtUSD(efectoNetoUSD)}</div>
          <div className="text-sm font-bold mt-1 italic text-ink">{Utils.fmtBS(efectoNetoUSD * state.tasa)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3 className="text-ink font-black uppercase text-xs">Ajustes Realizados</h3>
          <button className="btn btn-secondary font-black text-xs uppercase" onClick={handleExportPDF}>
            <FileText className="w-4 h-4" /> EXPORTAR PDF
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="uppercase">Fecha</th>
                <th className="uppercase">Producto</th>
                <th className="uppercase">Tipo</th>
                <th className="uppercase">Cant.</th>
                <th className="uppercase">Antes</th>
                <th className="uppercase">Después</th>
                <th className="uppercase">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {ajustes.map(m => {
                const p = state.productos.find(prod => prod.id === m.productoId);
                const isEntry = m.tipo.includes('entrada') || m.tipo === 'compra';
                return (
                  <tr key={m.id}>
                    <td className="text-[11px] font-bold">{m.fecha.replace('T', ' ').slice(0, 16)}</td>
                    <td className="font-black uppercase">{p?.nombre || 'N/A'}</td>
                    <td><span className="uppercase text-[9px] font-black">{m.tipo}</span></td>
                    <td className={`mono font-black ${isEntry ? 'text-[#27ae60]' : 'text-[#e04848]'}`}>{isEntry ? '+' : ''}{m.cantidad}</td>
                    <td className="mono font-bold">{m.stockAntes}</td>
                    <td className="mono font-black">{m.stockDespues}</td>
                    <td className="text-[10px] italic font-bold">{m.referencia}</td>
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi p-4 rounded-xl border border-line bg-white">
          <div className="text-[10px] font-black uppercase mb-1 text-ink">Total Colaboraciones</div>
          <div className="text-3xl font-black text-ink">{movs.filter(m => m.tipo === 'colaboracion').length}</div>
        </div>
        <div className="kpi p-4 rounded-xl border border-line bg-white">
          <div className="text-[10px] font-black uppercase mb-1 text-ink">Total Consumo Interno</div>
          <div className="text-3xl font-black text-ink">{movs.filter(m => m.tipo === 'consumo').length}</div>
        </div>
        <div className="kpi p-4 rounded-xl border border-[#e04848]/20 bg-[#e04848]/5">
          <div className="text-[10px] font-black uppercase mb-1 text-[#e04848]">Costo Total (Pérdida)</div>
          <div className="text-3xl font-black text-[#e04848]">{Utils.fmtUSD(totalPerdidaUSD)}</div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-head">
          <h3 className="text-ink font-black uppercase text-xs">Detalle de Salidas</h3>
          <button className="btn btn-secondary font-black text-xs uppercase" onClick={handleExportPDF}>
            <FileText className="w-4 h-4" /> DESCARGAR REPORTE
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="uppercase">Fecha</th>
                <th className="uppercase">Producto</th>
                <th className="uppercase">Tipo</th>
                <th className="uppercase">Cantidad</th>
                <th className="uppercase">Costo Unit.</th>
                <th className="uppercase">Subtotal (Pérdida)</th>
              </tr>
            </thead>
            <tbody>
              {movs.map(m => {
                const p = state.productos.find(prod => prod.id === m.productoId);
                const subPerdida = Utils.round(Math.abs(m.cantidad) * (p?.costoUSD || 0));
                return (
                  <tr key={m.id}>
                    <td className="text-[11px] font-bold">{m.fecha.slice(0, 10)}</td>
                    <td className="font-black uppercase">{p?.nombre}</td>
                    <td><span className="uppercase text-[9px] font-black">{m.tipo}</span></td>
                    <td className="font-black mono">{Math.abs(m.cantidad)}</td>
                    <td className="mono font-bold">{Utils.fmtUSD(p?.costoUSD || 0)}</td>
                    <td className="mono font-black text-[#e04848]">{Utils.fmtUSD(subPerdida)}</td>
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
      <div className="modal-box bg-white border-2 border-line">
        <div className="modal-head px-5 py-3 border-b border-line">
          <h3 className="text-ink font-black uppercase text-sm">Ajustar Stock: {producto.nombre}</h3>
          <button className="btn-icon" onClick={onClose}><X className="w-4 h-4 text-ink" /></button>
        </div>
        <div className="modal-body p-6 space-y-4">
          <div className="p-3 bg-surface-soft rounded-lg flex justify-between items-center border border-line">
            <span className="text-[10px] text-ink font-black uppercase">Stock actual: <strong className="text-ink ml-1">{producto.stock}</strong></span>
            <span className="text-[10px] text-ink font-black uppercase">CPP actual: <strong className="text-[#c8952e] ml-1">${producto.costoUSD.toFixed(2)}</strong></span>
          </div>
          
          <div className="form-group">
            <label className="text-ink text-[10px] font-black uppercase block mb-1">Tipo de Ajuste</label>
            <select className="form-select bg-white text-ink border-line rounded-md w-full p-2 text-sm" value={tipo} onChange={e => setTipo(e.target.value as any)}>
              <option value="ajuste_entrada">Entrada (+) - Recalcula CPP</option>
              <option value="ajuste_salida">Salida (-)</option>
              <option value="consumo">Consumo Interno (-)</option>
              <option value="colaboracion">Colaboración (-)</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="text-ink text-[10px] font-black uppercase block mb-1">Cantidad</label>
              <input type="number" className="form-input bg-white text-ink" value={cantidad} onChange={e => setCantidad(e.target.value)} min="1" />
            </div>
            {tipo === 'ajuste_entrada' && (
              <div className="form-group">
                <label className="text-ink text-[10px] font-black uppercase block mb-1">Costo Unitario Compra ($)</label>
                <input type="number" step="0.01" className="form-input bg-white text-ink" value={nuevoCosto} onChange={e => setNuevoCosto(e.target.value)} />
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label className="text-ink text-[10px] font-black uppercase block mb-1">Motivo / Referencia</label>
            <textarea className="form-textarea bg-white text-ink border-line rounded-md w-full p-2 text-sm" placeholder="Ej: Compra a distribuidor, de guste, merma..." value={ref} onChange={e => setRef(e.target.value)}></textarea>
          </div>
        </div>
        <div className="modal-foot px-5 py-3 border-t border-line">
          <button className="btn btn-secondary font-black uppercase" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary font-black uppercase" onClick={handleSave}>Aplicar Ajuste</button>
        </div>
      </div>
    </div>
  );
}
