
"use client";

import React, { useState } from 'react';
import { AppState, Product, Movimiento } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { Plus, Search, Edit2, PackagePlus, Trash2, FileText, BarChart3, History, Gift, Boxes, X, ArrowUpRight } from 'lucide-react';

export default function InventoryModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [activeTab, setActiveTab] = useState('productos');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  
  // Modales
  const [showAjuste, setShowAjuste] = useState<string | null>(null);
  
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

  const renderContent = () => {
    switch(activeTab) {
      case 'productos': return (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex gap-4 flex-1 min-w-[300px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#5a5650]" />
                <input className="form-input pl-10" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="form-select w-auto" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">Todas las categorias</option>
                {Array.from(new Set(state.productos.map(p => p.categoria))).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn btn-primary"><Plus className="w-4 h-4" /> Nuevo Producto</button>
          </div>

          <div class="card">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cod.</th>
                    <th>Nombre</th>
                    <th>Cat.</th>
                    <th>CPP USD</th>
                    <th>P. Venta USD</th>
                    <th>P. Venta BS</th>
                    <th>Stock</th>
                    <th>Min.</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {prods.map(p => (
                    <tr key={p.id}>
                      <td class="mono opacity-60 text-xs">{p.codigo}</td>
                      <td class="font-medium">{p.nombre}</td>
                      <td><span class="badge badge-neutral">{p.categoria}</span></td>
                      <td class="mono">{Utils.fmtUSD(p.costoUSD)}</td>
                      <td class="mono text-[#c8952e]">{Utils.fmtUSD(p.precioUSD)}</td>
                      <td class="mono opacity-60">{Utils.fmtBS(p.precioUSD * state.tasa)}</td>
                      <td>
                        <span class={`badge ${p.stock <= p.stockMinimo ? 'badge-err' : 'badge-ok'}`}>
                          {p.stock}
                        </span>
                      </td>
                      <td class="opacity-50">{p.stockMinimo}</td>
                      <td>
                        <div class="flex gap-1">
                          <button class="btn-icon text-[#c8952e]" title="Editar"><Edit2 class="w-3.5 h-3.5" /></button>
                          <button class="btn-icon text-[#3a9bdc]" title="Ajustes de Stock (CPP)" onClick={() => setShowAjuste(p.id)}><Boxes class="w-3.5 h-3.5" /></button>
                          <button class="btn-icon text-[#e04848]" onClick={() => eliminar(p.id)} title="Eliminar"><Trash2 class="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
      case 'reporte_general': return <ReporteGeneral state={state} />;
      case 'reporte_ventas': return <ReporteVentas state={state} />;
      case 'historial_ajustes': return <HistorialAjustes state={state} />;
      case 'consumo_colab': return <ReporteConsumo state={state} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="tabs flex border-b border-[#2a2a2a] overflow-x-auto no-print">
        <button onClick={() => setActiveTab('productos')} className={`tab ${activeTab === 'productos' ? 'active' : ''}`}>Productos</button>
        <button onClick={() => setActiveTab('reporte_general')} className={`tab ${activeTab === 'reporte_general' ? 'active' : ''}`}>Reporte General (CPP)</button>
        <button onClick={() => setActiveTab('reporte_ventas')} className={`tab ${activeTab === 'reporte_ventas' ? 'active' : ''}`}>Reporte de Ventas</button>
        <button onClick={() => setActiveTab('historial_ajustes')} className={`tab ${activeTab === 'historial_ajustes' ? 'active' : ''}`}>Historial de Ajustes</button>
        <button onClick={() => setActiveTab('consumo_colab')} className={`tab ${activeTab === 'consumo_colab' ? 'active' : ''}`}>Consumo y Colab.</button>
      </div>

      {renderContent()}

      {showAjuste && (
        <ModalAjuste 
          producto={state.productos.find(p => p.id === showAjuste)!} 
          onClose={() => setShowAjuste(null)}
          onSave={(mov, nuevoCosto) => {
            const nuevosProds = state.productos.map(p => {
              if (p.id === mov.productoId) {
                let finalCosto = p.costoUSD;
                // Lógica de CPP (Costo Promedio Ponderado)
                if (mov.tipo === 'ajuste_entrada' || mov.tipo === 'compra') {
                  const stockActual = p.stock;
                  const cantidadNueva = mov.cantidad;
                  const costoNuevo = nuevoCosto || p.costoUSD;
                  finalCosto = ((stockActual * p.costoUSD) + (cantidadNueva * costoNuevo)) / (stockActual + cantidadNueva);
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
  const totalCosto = state.productos.reduce((acc, p) => acc + (p.costoUSD * p.stock), 0);
  const totalVenta = state.productos.reduce((acc, p) => acc + (p.precioUSD * p.stock), 0);
  
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="kpi amber">
          <div class="kpi-icon"><BarChart3 /></div>
          <div class="kpi-label">Valor al Costo (CPP Total)</div>
          <div class="kpi-value">{Utils.fmtUSD(totalCosto)}</div>
          <div class="kpi-sub">{Utils.fmtBS(totalCosto * state.tasa)}</div>
        </div>
        <div class="kpi green">
          <div class="kpi-icon"><BarChart3 /></div>
          <div class="kpi-label">Valor al Precio de Venta (Total)</div>
          <div class="kpi-value">{Utils.fmtUSD(totalVenta)}</div>
          <div class="kpi-sub">{Utils.fmtBS(totalVenta * state.tasa)}</div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-head"><h3>Resumen por Categoría y CPP</h3></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Items</th>
                <th>Stock Total</th>
                <th>CPP Promedio</th>
                <th>Valor Costo</th>
                <th>Valor Venta</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set(state.productos.map(p => p.categoria))).map(cat => {
                const catProds = state.productos.filter(p => p.categoria === cat);
                const stockTotal = catProds.reduce((s, p) => s + p.stock, 0);
                const cost = catProds.reduce((s, p) => s + p.costoUSD * p.stock, 0);
                const vent = catProds.reduce((s, p) => s + p.precioUSD * p.stock, 0);
                const cppPromedio = stockTotal > 0 ? cost / stockTotal : 0;
                return (
                  <tr key={cat}>
                    <td class="font-bold">{cat}</td>
                    <td>{catProds.length}</td>
                    <td>{stockTotal}</td>
                    <td class="mono">{Utils.fmtUSD(cppPromedio)}</td>
                    <td class="mono">{Utils.fmtUSD(cost)}</td>
                    <td class="mono text-[#c8952e]">{Utils.fmtUSD(vent)}</td>
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

function ReporteVentas({ state }: { state: AppState }) {
  const [filter, setFilter] = useState('hoy');
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());

  const filtrarVentas = () => {
    const hoy = Utils.hoy();
    const esteMes = hoy.slice(0, 7);
    const esteAño = hoy.slice(0, 4);

    return state.ventas.filter(v => {
      if (filter === 'hoy') return v.fecha === hoy;
      if (filter === 'mes') return v.fecha.startsWith(esteMes);
      if (filter === 'año') return v.fecha.startsWith(esteAño);
      if (filter === 'custom') return v.fecha >= desde && v.fecha <= hasta;
      return true;
    });
  };

  const ventas = filtrarVentas();

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="filters flex flex-wrap gap-4 items-end bg-[#131313] p-4 rounded-lg border border-[#2a2a2a]">
        <div className="form-group mb-0">
          <label className="form-label">Filtrar por:</label>
          <select className="form-select w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="hoy">Hoy</option>
            <option value="mes">Este Mes</option>
            <option value="año">Este Año</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        
        {filter === 'custom' && (
          <>
            <div className="form-group mb-0">
              <label className="form-label">Desde</label>
              <input type="date" className="form-input w-auto" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Hasta</label>
              <input type="date" className="form-input w-auto" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          </>
        )}
        
        <button className="btn btn-secondary ml-auto" onClick={() => window.print()}>
          <FileText className="w-4 h-4" /> EXPORTAR PDF
        </button>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto(s)</th>
                <th>Tipo</th>
                <th>Cant.</th>
                <th>Precio $</th>
                <th>Total $</th>
              </tr>
            </thead>
            <tbody>
              {ventas.length === 0 ? (
                <tr><td colSpan={6} class="text-center py-10 opacity-30">No hay ventas registradas en este periodo</td></tr>
              ) : (
                ventas.map(v => v.items.map((item, idx) => (
                  <tr key={`${v.id}-${idx}`}>
                    <td>{idx === 0 ? Utils.fmtFecha(v.fecha) : ''}</td>
                    <td>{item.nombre}</td>
                    <td>{v.metodoPago}</td>
                    <td class="mono">{item.cantidad}</td>
                    <td class="mono">{Utils.fmtUSD(item.precioUnitUSD)}</td>
                    <td class="mono font-bold">{Utils.fmtUSD(item.subtotalUSD)}</td>
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

function HistorialAjustes({ state }: { state: AppState }) {
  const ajustes = state.movimientos.filter(m => 
    ['ajuste_entrada', 'ajuste_salida', 'consumo', 'colaboracion', 'compra'].includes(m.tipo)
  ).sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div class="card animate-in fade-in slide-in-from-bottom-2">
      <div class="card-head"><h3>Historial de Ajustes e Ingresos (CPP)</h3></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Cant.</th>
              <th>Antes</th>
              <th>Después</th>
              <th>Referencia</th>
            </tr>
          </thead>
          <tbody>
            {ajustes.map(m => {
              const p = state.productos.find(prod => prod.id === m.productoId);
              return (
                <tr key={m.id}>
                  <td>{m.fecha.replace('T', ' ').slice(0, 16)}</td>
                  <td class="font-medium">{p?.nombre || 'Producto Eliminado'}</td>
                  <td><span class={`badge ${m.tipo.includes('entrada') || m.tipo === 'compra' ? 'badge-ok' : 'badge-err'}`}>{m.tipo}</span></td>
                  <td class="mono font-bold">{m.cantidad}</td>
                  <td class="mono opacity-60">{m.stockAntes}</td>
                  <td class="mono font-bold">{m.stockDespues}</td>
                  <td class="text-xs">{m.referencia}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReporteConsumo({ state }: { state: AppState }) {
  const movs = state.movimientos.filter(m => m.tipo === 'consumo' || m.tipo === 'colaboracion');
  
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="kpi amber">
          <div class="kpi-icon"><Gift /></div>
          <div class="kpi-label">Total Colaboraciones</div>
          <div class="kpi-value">{movs.filter(m => m.tipo === 'colaboracion').length}</div>
        </div>
        <div class="kpi red">
          <div class="kpi-icon"><History /></div>
          <div class="kpi-label">Total Consumo Interno</div>
          <div class="kpi-value">{movs.filter(m => m.tipo === 'consumo').length}</div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-head"><h3>Detalle de Consumo y Colaboraciones</h3></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Motivo/Referencia</th>
              </tr>
            </thead>
            <tbody>
              {movs.map(m => {
                const p = state.productos.find(prod => prod.id === m.productoId);
                return (
                  <tr key={m.id}>
                    <td>{m.fecha.slice(0, 10)}</td>
                    <td class="font-bold">{p?.nombre}</td>
                    <td><span class="badge badge-info">{m.tipo}</span></td>
                    <td class="mono">{m.cantidad}</td>
                    <td class="text-sm opacity-80">{m.referencia}</td>
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
  const [cantidad, setCantidad] = useState(1);
  const [nuevoCosto, setNuevoCosto] = useState(producto.costoUSD);
  const [ref, setRef] = useState('');

  const handleSave = () => {
    if (cantidad <= 0) return alert('Cantidad invalida');
    if ((tipo !== 'ajuste_entrada') && cantidad > producto.stock) return alert('Stock insuficiente');
    
    const mov: Movimiento = {
      id: Store.uid(),
      productoId: producto.id,
      tipo,
      cantidad,
      stockAntes: producto.stock,
      stockDespues: tipo === 'ajuste_entrada' ? producto.stock + cantidad : producto.stock - cantidad,
      fecha: new Date().toISOString(),
      referencia: tipo === 'ajuste_entrada' ? `${ref || 'Entrada manual'} - Costo unit: $${nuevoCosto}` : (ref || 'Ajuste manual')
    };
    onSave(mov, tipo === 'ajuste_entrada' ? nuevoCosto : undefined);
  };

  return (
    <div className="modal show">
      <div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box">
        <div className="modal-head">
          <h3>Ajustar Stock: {producto.nombre}</h3>
          <button className="btn-icon" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="modal-body space-y-4">
          <div className="p-3 bg-secondary/30 rounded-lg flex justify-between items-center">
            <span className="text-sm opacity-60">Stock actual: <strong>{producto.stock}</strong></span>
            <span className="text-sm opacity-60">CPP actual: <strong className="text-[#c8952e]">${producto.costoUSD.toFixed(2)}</strong></span>
          </div>
          
          <div className="form-group">
            <label className="form-label">Tipo de Ajuste</label>
            <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value as any)}>
              <option value="ajuste_entrada">Entrada (+) - Recalcula CPP</option>
              <option value="ajuste_salida">Salida (-)</option>
              <option value="consumo">Consumo Interno (-)</option>
              <option value="colaboracion">Colaboración (-)</option>
            </select>
          </div>
          
          <div className="form-row grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Cantidad</label>
              <input type="number" className="form-input" value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 0)} min="1" />
            </div>
            {tipo === 'ajuste_entrada' && (
              <div className="form-group">
                <label className="form-label">Costo Unitario Compra ($)</label>
                <input type="number" step="0.01" className="form-input" value={nuevoCosto} onChange={e => setNuevoCosto(parseFloat(e.target.value) || 0)} />
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label className="form-label">Motivo / Referencia</label>
            <textarea className="form-textarea" placeholder="Ej: Compra a distribuidor, deguste, merma..." value={ref} onChange={e => setRef(e.target.value)}></textarea>
          </div>
        </div>
        <div className="modal-foot">
          <button class="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button class="btn btn-primary" onClick={handleSave}>Aplicar Ajuste</button>
        </div>
      </div>
    </div>
  );
}
