
'use client';

import React, { useState, useEffect } from 'react';
import { AppState, Product, Movimiento, KitItem } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { Plus, Search, Edit2, Trash2, Boxes, X, BarChart3, FileText, History, Gift, Layers, Settings2, Trash } from 'lucide-react';

export default function InventoryModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [activeTab, setActiveTab] = useState('productos');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  
  // Modales
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
                {state.categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={() => setShowProducto('nuevo')}><Plus className="w-4 h-4" /> Nuevo Producto</button>
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
                        <td className="mono opacity-60 text-xs">{p.codigo}</td>
                        <td className="font-medium">
                          <div className="flex items-center gap-2">
                            {p.isKit && <Layers className="w-3 h-3 text-[#c8952e]" title="Es un Kit" />}
                            {p.nombre}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span className="badge badge-neutral mb-1">{p.categoria}</span>
                            <span className="text-[0.65rem] text-[#5a5650] uppercase">{p.departamento || 'Sin Dept.'}</span>
                          </div>
                        </td>
                        <td className="mono">{Utils.fmtUSD(p.costoUSD)}</td>
                        <td className="mono text-[#c8952e]">{Utils.fmtUSD(p.precioUSD)}</td>
                        <td>
                          <span className={`badge ${p.stock <= p.stockMinimo ? 'badge-err' : 'badge-ok'}`}>
                            {p.stock}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn-icon text-[#c8952e]" title="Editar" onClick={() => setShowProducto(p.id)}><Edit2 className="w-3.5 h-3.5" /></button>
                            <button className="btn-icon text-[#3a9bdc]" title="Ajustes de Stock" onClick={() => setShowAjuste(p.id)}><Boxes className="w-3.5 h-3.5" /></button>
                            <button className="btn-icon text-[#e04848]" onClick={() => eliminar(p.id)} title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
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

function ModalProducto({ producto, state, onClose, onSave, onUpdateLists }: { producto?: Product, state: AppState, onClose: () => void, onSave: (p: any) => void, onUpdateLists: (l: any) => void }) {
  const [datos, setDatos] = useState({
    codigo: producto?.codigo || '',
    nombre: producto?.nombre || '',
    categoria: producto?.categoria || state.categorias[0] || '',
    departamento: producto?.departamento || state.departamentos[0] || '',
    cantidad: producto?.cantidad || '750ml',
    marca: producto?.marca || state.marcas[0] || '',
    costoUSD: producto?.costoUSD || 0,
    precioUSD: producto?.precioUSD || 0,
    margen: producto?.margen || 0,
    precioBS: (producto?.precioUSD || 0) * state.tasa,
    stock: producto?.stock || 0,
    stockMinimo: producto?.stockMinimo || 3,
    proveedor: producto?.proveedor || '',
    isKit: producto?.isKit || false,
    kitType: producto?.kitType || 'stock_propio',
    kitItems: producto?.kitItems || [] as KitItem[]
  });

  const [kitSearch, setKitSearch] = useState('');

  // Sincronizar usando MARGEN SOBRE VENTA
  // Formula: Precio = Costo / (1 - Margen/100)
  // Formula: Margen = (Precio - Costo) / Precio * 100

  const recalcularDesdeUSD = (usd: number, costo: number = datos.costoUSD) => {
    const nuevoMargen = usd > 0 ? ((usd - costo) / usd) * 100 : 0;
    setDatos(d => ({ ...d, precioUSD: usd, margen: nuevoMargen, precioBS: usd * state.tasa, costoUSD: costo }));
  };

  const recalcularDesdeMargen = (m: number, costo: number = datos.costoUSD) => {
    // Si el margen es 100% o mas, evitamos division por cero
    const factor = (1 - (m / 100));
    const usd = factor > 0 ? costo / factor : 0;
    setDatos(d => ({ ...d, margen: m, precioUSD: usd, precioBS: usd * state.tasa, costoUSD: costo }));
  };

  const recalcularDesdeBS = (bs: number) => {
    const usd = bs / state.tasa;
    const nuevoMargen = usd > 0 ? ((usd - datos.costoUSD) / usd) * 100 : 0;
    setDatos(d => ({ ...d, precioBS: bs, precioUSD: usd, margen: nuevoMargen }));
  };

  const handleSubmit = () => {
    if (!datos.nombre || !datos.codigo) return alert('Nombre y Código son requeridos');
    if (datos.precioUSD <= 0) return alert('El precio debe ser mayor a 0');
    onSave(datos);
  };

  const addToList = (key: 'categorias' | 'departamentos' | 'marcas') => {
    const val = prompt(`Nueva entrada para ${key}:`);
    if (val) {
      const newList = [...state[key], val];
      onUpdateLists({ [key]: newList });
      setDatos(d => ({ ...d, [key.slice(0, -1)]: val }));
    }
  };

  const removeFromList = (key: 'categorias' | 'departamentos' | 'marcas', val: string) => {
    if (confirm(`¿Borrar "${val}" de la lista?`)) {
      const newList = state[key].filter(i => i !== val);
      onUpdateLists({ [key]: newList });
    }
  };

  return (
    <div className="modal show">
      <div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box" style={{ maxWidth: '650px' }}>
        <div className="modal-head">
          <h3>{producto ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <button className="btn-icon" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="modal-body space-y-4">
          
          <div className="form-row grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Código (Barcode)</label>
              <input className="form-input mono" value={datos.codigo} onChange={e => setDatos({...datos, codigo: e.target.value})} placeholder="Escanee o escriba" />
            </div>
            <div className="form-group">
              <div className="flex justify-between items-center mb-1">
                <label className="form-label m-0">Departamento</label>
                <button className="text-[0.65rem] text-[#c8952e]" onClick={() => addToList('departamentos')}>+ Nuevo</button>
              </div>
              <div className="flex gap-1">
                <select className="form-select" value={datos.departamento} onChange={e => setDatos({...datos, departamento: e.target.value})}>
                  {state.departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button className="btn-icon btn-sm text-[#e04848]" onClick={() => removeFromList('departamentos', datos.departamento)}><Trash className="w-3 h-3"/></button>
              </div>
            </div>
          </div>

          <div className="form-row grid grid-cols-2 gap-4">
            <div className="form-group">
              <div className="flex justify-between items-center mb-1">
                <label className="form-label m-0">Categoría</label>
                <button className="text-[0.65rem] text-[#c8952e]" onClick={() => addToList('categorias')}>+ Nuevo</button>
              </div>
              <div className="flex gap-1">
                <select className="form-select" value={datos.categoria} onChange={e => setDatos({...datos, categoria: e.target.value})}>
                  {state.categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button className="btn-icon btn-sm text-[#e04848]" onClick={() => removeFromList('categorias', datos.categoria)}><Trash className="w-3 h-3"/></button>
              </div>
            </div>
            <div className="form-group">
              <div className="flex justify-between items-center mb-1">
                <label className="form-label m-0">Marca</label>
                <button className="text-[0.65rem] text-[#c8952e]" onClick={() => addToList('marcas')}>+ Nuevo</button>
              </div>
              <div className="flex gap-1">
                <select className="form-select" value={datos.marca} onChange={e => setDatos({...datos, marca: e.target.value})}>
                  {state.marcas.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button className="btn-icon btn-sm text-[#e04848]" onClick={() => removeFromList('marcas', datos.marca)}><Trash className="w-3 h-3"/></button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre del producto</label>
            <input className="form-input" value={datos.nombre} onChange={e => setDatos({...datos, nombre: e.target.value})} placeholder="Ej: Johnnie Walker Black Label" />
          </div>

          <div className="bg-[#181818] p-4 rounded-lg border border-[#2a2a2a] space-y-4">
             <div className="form-row grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Costo Unitario USD</label>
                  <input className="form-input" type="number" step="0.01" value={datos.costoUSD} onChange={e => recalcularDesdeMargen(datos.margen, parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Margen de Ganancia (%) <span className="text-[10px] text-[#5a5650] font-normal">(Sobre Venta)</span></label>
                  <input className="form-input text-[#27ae60] font-bold" type="number" value={Math.round(datos.margen * 100) / 100} onChange={e => recalcularDesdeMargen(parseFloat(e.target.value) || 0)} />
                </div>
             </div>
             <div className="form-row grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Precio Venta USD</label>
                  <input className="form-input text-[#c8952e] font-bold" type="number" step="0.01" value={Math.round(datos.precioUSD * 100) / 100} onChange={e => recalcularDesdeUSD(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio Venta BS ({state.tasa})</label>
                  <input className="form-input" type="number" step="0.01" value={Math.round(datos.precioBS * 100) / 100} onChange={e => recalcularDesdeBS(parseFloat(e.target.value) || 0)} />
                </div>
             </div>
          </div>

          <div className="form-row grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Stock Actual</label>
              <input className="form-input" type="number" value={datos.stock} onChange={e => setDatos({...datos, stock: parseInt(e.target.value) || 0})} disabled={!!producto && !datos.isKit} />
              <p className="text-[0.6rem] text-[#5a5650] mt-1">* Solo editable al crear o vía Ajustes.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Stock Mínimo</label>
              <input className="form-input" type="number" value={datos.stockMinimo} onChange={e => setDatos({...datos, stockMinimo: parseInt(e.target.value) || 0})} />
            </div>
          </div>

          {/* SECCION KIT */}
          <div className="border-t border-[#2a2a2a] pt-4 mt-4">
            <div className="flex items-center gap-3 mb-3">
              <input type="checkbox" checked={datos.isKit} onChange={e => setDatos({...datos, isKit: e.target.checked})} className="w-4 h-4 accent-[#c8952e]" />
              <label className="form-label m-0 flex items-center gap-2">Este producto es un Kit <Layers className="w-3.5 h-3.5 text-[#c8952e]"/></label>
            </div>

            {datos.isKit && (
              <div className="bg-[#1e1e1e] p-4 rounded-lg border border-[#333] space-y-4 animate-in fade-in">
                <div className="form-group">
                  <label className="form-label">Tipo de Stock del Kit</label>
                  <select className="form-select" value={datos.kitType} onChange={e => setDatos({...datos, kitType: e.target.value as any})}>
                    <option value="stock_propio">Stock Propio (Independiente)</option>
                    <option value="stock_componentes">Basado en componentes (Calculado)</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="form-label">Componentes del Kit</label>
                  <div className="flex gap-2">
                    <input className="form-input text-sm" placeholder="Buscar producto para añadir..." value={kitSearch} onChange={e => setKitSearch(e.target.value)} />
                  </div>
                  
                  {kitSearch.length > 1 && (
                    <div className="bg-[#0b0b0b] border border-[#333] rounded max-h-32 overflow-y-auto">
                      {state.productos.filter(p => !p.isKit && p.activo && (p.nombre.toLowerCase().includes(kitSearch.toLowerCase()) || p.codigo.includes(kitSearch))).map(p => (
                        <div key={p.id} className="p-2 hover:bg-[#181818] cursor-pointer text-xs flex justify-between" onClick={() => {
                          if (!datos.kitItems.find(i => i.productoId === p.id)) {
                            setDatos({...datos, kitItems: [...datos.kitItems, { productoId: p.id, nombre: p.nombre, cantidad: 1 }]});
                          }
                          setKitSearch('');
                        }}>
                          <span>{p.nombre}</span>
                          <span className="text-[#c8952e]">${p.precioUSD}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    {datos.kitItems.map((item, idx) => (
                      <div key={item.productoId} className="flex items-center gap-2 bg-[#0b0b0b] p-2 rounded text-xs border border-[#2a2a2a]">
                        <span className="flex-1 truncate">{item.nombre}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[#5a5650]">Cant:</span>
                          <input type="number" className="bg-[#181818] border border-[#333] rounded w-12 p-1 text-center" value={item.cantidad} onChange={e => {
                            const ni = [...datos.kitItems];
                            ni[idx].cantidad = Math.max(1, parseInt(e.target.value) || 1);
                            setDatos({...datos, kitItems: ni});
                          }} />
                        </div>
                        <button className="text-[#e04848] p-1" onClick={() => setDatos({...datos, kitItems: datos.kitItems.filter((_, i) => i !== idx)})}><X className="w-3 h-3"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit}>{producto ? 'Actualizar' : 'Crear producto'}</button>
        </div>
      </div>
    </div>
  );
}

function ReporteGeneral({ state }: { state: AppState }) {
  const [groupBy, setGroupBy] = useState<'categoria' | 'departamento' | 'proveedor'>('categoria');
  
  const totalCosto = state.productos.reduce((acc, p) => acc + (p.costoUSD * p.stock), 0);
  const totalVenta = state.productos.reduce((acc, p) => acc + (p.precioUSD * p.stock), 0);
  
  const uniqueKeys = Array.from(new Set(state.productos.map(p => p[groupBy] || 'Sin asignar'))).sort();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="kpi amber">
          <div className="kpi-icon"><BarChart3 /></div>
          <div className="kpi-label">Valor al Costo (CPP Total)</div>
          <div className="kpi-value">{Utils.fmtUSD(totalCosto)}</div>
          <div className="kpi-sub">{Utils.fmtBS(totalCosto * state.tasa)}</div>
        </div>
        <div className="kpi green">
          <div className="kpi-icon"><BarChart3 /></div>
          <div className="kpi-label">Valor al Precio de Venta (Total)</div>
          <div className="kpi-value">{Utils.fmtUSD(totalVenta)}</div>
          <div className="kpi-sub">{Utils.fmtBS(totalVenta * state.tasa)}</div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-head">
          <h3>Resumen por {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)} y CPP</h3>
          <div className="flex gap-2 no-print">
            <button className={`btn btn-sm ${groupBy === 'categoria' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGroupBy('categoria')}>Categoría</button>
            <button className={`btn btn-sm ${groupBy === 'departamento' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGroupBy('departamento')}>Departamento</button>
            <button className={`btn btn-sm ${groupBy === 'proveedor' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGroupBy('proveedor')}>Proveedor</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="capitalize">{groupBy}</th>
                <th>Items</th>
                <th>Stock Total</th>
                <th>CPP Promedio</th>
                <th>Valor Costo</th>
                <th>Valor Venta</th>
              </tr>
            </thead>
            <tbody>
              {uniqueKeys.map(key => {
                const groupProds = state.productos.filter(p => (p[groupBy] || 'Sin asignar') === key);
                const stockTotal = groupProds.reduce((s, p) => s + p.stock, 0);
                const costTotal = groupProds.reduce((s, p) => s + (p.costoUSD * p.stock), 0);
                const ventTotal = groupProds.reduce((s, p) => s + (p.precioUSD * p.stock), 0);
                const cppPromedio = stockTotal > 0 ? costTotal / stockTotal : 0;
                
                return (
                  <tr key={key}>
                    <td className="font-bold">{key}</td>
                    <td>{groupProds.length}</td>
                    <td>{stockTotal}</td>
                    <td className="mono">{Utils.fmtUSD(cppPromedio)}</td>
                    <td className="mono">{Utils.fmtUSD(costTotal)}</td>
                    <td className="mono text-[#c8952e]">{Utils.fmtUSD(ventTotal)}</td>
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

      <div className="card">
        <div className="table-wrap">
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
                <tr><td colSpan={6} className="text-center py-10 opacity-30">No hay ventas registradas en este periodo</td></tr>
              ) : (
                ventas.map(v => v.items.map((item, idx) => (
                  <tr key={`${v.id}-${idx}`}>
                    <td>{idx === 0 ? Utils.fmtFecha(v.fecha) : ''}</td>
                    <td>{item.nombre}</td>
                    <td>{v.metodoPago}</td>
                    <td className="mono">{item.cantidad}</td>
                    <td className="mono">{Utils.fmtUSD(item.precioUnitUSD)}</td>
                    <td className="mono font-bold">{Utils.fmtUSD(item.subtotalUSD)}</td>
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
    <div className="card animate-in fade-in slide-in-from-bottom-2">
      <div className="card-head"><h3>Historial de Ajustes e Ingresos (CPP)</h3></div>
      <div className="table-wrap">
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
                  <td className="font-medium">{p?.nombre || 'Producto Eliminado'}</td>
                  <td><span className={`badge ${m.tipo.includes('entrada') || m.tipo === 'compra' ? 'badge-ok' : 'badge-err'}`}>{m.tipo}</span></td>
                  <td className="mono font-bold">{m.cantidad}</td>
                  <td className="mono opacity-60">{m.stockAntes}</td>
                  <td className="mono font-bold">{m.stockDespues}</td>
                  <td className="text-xs">{m.referencia}</td>
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
        <div className="kpi amber">
          <div className="kpi-icon"><Gift /></div>
          <div className="kpi-label">Total Colaboraciones</div>
          <div className="kpi-value">{movs.filter(m => m.tipo === 'colaboracion').length}</div>
        </div>
        <div className="kpi red">
          <div className="kpi-icon"><History /></div>
          <div className="kpi-label">Total Consumo Interno</div>
          <div className="kpi-value">{movs.filter(m => m.tipo === 'consumo').length}</div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-head"><h3>Detalle de Consumo y Colaboraciones</h3></div>
        <div className="table-wrap">
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
                    <td className="font-bold">{p?.nombre}</td>
                    <td><span className="badge badge-info">{m.tipo}</span></td>
                    <td className="mono">{m.cantidad}</td>
                    <td className="text-sm opacity-80">{m.referencia}</td>
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
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Aplicar Ajuste</button>
        </div>
      </div>
    </div>
  );
}
