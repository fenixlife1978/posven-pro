
'use client';

import React, { useState, useEffect } from 'react';
import { AppState, Product, Movimiento, KitItem } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { Plus, Search, Edit2, Trash2, Boxes, X, BarChart3, FileText, History, Gift, Layers, Settings2, Trash, ArrowLeft, Printer, Trash2 as TrashIcon } from 'lucide-react';

export default function InventoryModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [activeTab, setActiveTab] = useState('productos');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [selectedKardexId, setSelectedKardexId] = useState<string | null>(null);
  
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
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#ffffff]" />
                <input className="form-input pl-10 bg-[#131313] text-white border-[#2a2a2a] h-11" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="form-select w-auto bg-[#131313] text-white border-[#2a2a2a] h-11 px-4" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">Todas las categorias</option>
                {state.categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn btn-primary h-11 px-6 font-black uppercase text-xs" onClick={() => setShowProducto('nuevo')}><Plus className="w-4 h-4" /> Nuevo Producto</button>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr className="bg-[#0b0b0b]">
                    <th className="text-white font-black text-[10px] uppercase">Cod.</th>
                    <th className="text-white font-black text-[10px] uppercase">Nombre</th>
                    <th className="text-white font-black text-[10px] uppercase">Cat. / Dep.</th>
                    <th className="text-white font-black text-[10px] uppercase">Costo USD</th>
                    <th className="text-white font-black text-[10px] uppercase">P. Venta USD</th>
                    <th className="text-white font-black text-[10px] uppercase">Stock</th>
                    <th className="text-white font-black text-[10px] uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-[#131313]">
                  {prods.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-20 text-white font-black uppercase italic opacity-40">No se encontraron productos</td></tr>
                  ) : (
                    prods.map(p => (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="mono text-white/60 text-xs font-bold">{p.codigo}</td>
                        <td className="font-bold text-white text-xs">
                          <div className="flex items-center gap-2">
                            {p.isKit && <Layers className="w-3 h-3 text-[#c8952e]" title="Es un Kit" />}
                            {p.nombre}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span className="badge badge-neutral mb-1 font-black text-[9px] uppercase">{p.categoria}</span>
                            <span className="text-[0.65rem] text-white font-black uppercase">{p.departamento || 'Sin Dept.'}</span>
                          </div>
                        </td>
                        <td className="mono text-white font-bold text-xs">{Utils.fmtUSD(p.costoUSD)}</td>
                        <td className="mono text-[#c8952e] font-black text-sm">{Utils.fmtUSD(p.precioUSD)}</td>
                        <td>
                          <span className={`badge ${p.stock <= p.stockMinimo ? 'badge-err' : 'badge-ok'} font-black text-[10px]`}>
                            {p.stock}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn-icon text-[#c8952e]" title="Editar" onClick={() => setShowProducto(p.id)}><Edit2 className="w-3.5 h-3.5" /></button>
                            <button className="btn-icon text-[#3a9bdc]" title="Ver Kardex" onClick={() => { setSelectedKardexId(p.id); setActiveTab('kardex'); }}><History className="w-3.5 h-3.5" /></button>
                            <button className="btn-icon text-[#27ae60]" title="Ajustes de Stock" onClick={() => setShowAjuste(p.id)}><Boxes className="w-3.5 h-3.5" /></button>
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
      case 'kardex': return <ReporteKardex state={state} selectedId={selectedKardexId} onSelect={setSelectedKardexId} />;
      case 'consumo_colab': return <ReporteConsumo state={state} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="tabs flex border-b border-[#2a2a2a] overflow-x-auto no-print">
        <button onClick={() => setActiveTab('productos')} className={`tab ${activeTab === 'productos' ? 'active' : ''} font-black uppercase tracking-widest text-[10px]`}>Productos</button>
        <button onClick={() => setActiveTab('reporte_general')} className={`tab ${activeTab === 'reporte_general' ? 'active' : ''} font-black uppercase tracking-widest text-[10px]`}>Reporte General (CPP)</button>
        <button onClick={() => setActiveTab('reporte_ventas')} className={`tab ${activeTab === 'reporte_ventas' ? 'active' : ''} font-black uppercase tracking-widest text-[10px]`}>Reporte de Ventas</button>
        <button onClick={() => setActiveTab('kardex')} className={`tab ${activeTab === 'kardex' ? 'active' : ''} font-black uppercase tracking-widest text-[10px]`}>Kardex</button>
        <button onClick={() => setActiveTab('historial_ajustes')} className={`tab ${activeTab === 'historial_ajustes' ? 'active' : ''} font-black uppercase tracking-widest text-[10px]`}>Historial de Ajustes</button>
        <button onClick={() => setActiveTab('consumo_colab')} className={`tab ${activeTab === 'consumo_colab' ? 'active' : ''} font-black uppercase tracking-widest text-[10px]`}>Consumo y Colab.</button>
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
                    finalCosto = ((stockActual * p.costoUSD) + (cantidadNueva * costoNuevo)) / stockTotal;
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

// --- SUBCOMPONENTES DE REPORTES ---

function ReporteGeneral({ state }: { state: AppState }) {
  const valorInvCosto = state.productos.filter(p => p.activo).reduce((s, p) => s + (p.costoUSD * p.stock), 0);
  const valorInvVenta = state.productos.filter(p => p.activo).reduce((s, p) => s + (p.precioUSD * p.stock), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="kpi bg-[#181818] border-[#2a2a2a] p-6 rounded-xl border">
          <div className="text-white text-[10px] font-black uppercase mb-1">Valor Inventario (Costo CPP)</div>
          <div className="text-3xl font-black text-white">{Utils.fmtUSD(valorInvCosto)}</div>
          <div className="text-white text-xs font-bold mt-1 uppercase italic">{Utils.fmtBS(valorInvCosto * state.tasa)}</div>
        </div>
        <div className="kpi bg-[#181818] border-[#2a2a2a] p-6 rounded-xl border">
          <div className="text-white text-[10px] font-black uppercase mb-1">Valor Inventario (Precio Venta)</div>
          <div className="text-3xl font-black text-[#c8952e]">{Utils.fmtUSD(valorInvVenta)}</div>
          <div className="text-white text-xs font-bold mt-1 uppercase italic">{Utils.fmtBS(valorInvVenta * state.tasa)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head px-5 py-3 border-b border-[#2a2a2a] bg-[#181818] flex justify-between items-center">
          <h3 className="text-white font-black text-xs uppercase tracking-widest">Existencias Detalladas</h3>
          <button onClick={() => window.print()} className="btn btn-sm btn-secondary font-bold text-white uppercase text-[9px] flex items-center gap-2"><Printer className="w-3 h-3"/> Imprimir Reporte</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-[#0b0b0b]">
                <th className="text-white font-black text-[10px] uppercase">Producto</th>
                <th className="text-white font-black text-[10px] uppercase text-right">Stock</th>
                <th className="text-white font-black text-[10px] uppercase text-right">Costo CPP</th>
                <th className="text-white font-black text-[10px] uppercase text-right">Subtotal Costo</th>
              </tr>
            </thead>
            <tbody className="bg-[#131313]">
              {state.productos.filter(p => p.activo).map(p => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="text-white font-bold text-xs uppercase">{p.nombre}</td>
                  <td className="text-white font-black text-xs text-right">{p.stock}</td>
                  <td className="text-white font-bold text-xs text-right">{Utils.fmtUSD(p.costoUSD)}</td>
                  <td className="text-[#c8952e] font-black text-xs text-right">{Utils.fmtUSD(p.costoUSD * p.stock)}</td>
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
  return (
    <div className="card p-20 text-center animate-in fade-in">
      <FileText className="w-12 h-12 text-[#c8952e] mx-auto mb-4 opacity-50" />
      <h3 className="text-white font-black uppercase text-xl">Reporte de Ventas por Producto</h3>
      <p className="text-white/40 font-black uppercase text-[10px] mt-2">Próximamente disponible con gráficos de demanda.</p>
    </div>
  );
}

const isExit = (tipo: string) => ['venta', 'ajuste_salida', 'consumo', 'colaboracion'].includes(tipo.toLowerCase());

function HistorialAjustes({ state }: { state: AppState }) {
  const ajustes = state.movimientos.filter(m => 
    m.tipo.startsWith('ajuste') || 
    m.tipo === 'compra' || 
    m.tipo === 'consumo' || 
    m.tipo === 'colaboracion'
  ).sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="card animate-in slide-in-from-bottom-2">
      <div className="card-head bg-[#181818] px-5 py-3 border-b border-[#2a2a2a]"><h3 className="text-white font-black text-xs uppercase">Historial de Ajustes Manuales</h3></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr className="bg-[#0b0b0b]">
              <th className="text-white font-black text-[10px] uppercase">Fecha / Hora</th>
              <th className="text-white font-black text-[10px] uppercase">Producto</th>
              <th className="text-white font-black text-[10px] uppercase">Tipo</th>
              <th className="text-white font-black text-[10px] uppercase text-right">Cant.</th>
              <th className="text-white font-black text-[10px] uppercase">Ref / Nota</th>
            </tr>
          </thead>
          <tbody className="bg-[#131313]">
            {ajustes.map(m => {
              const p = state.productos.find(x => x.id === m.productoId);
              const negative = m.cantidad < 0 || isExit(m.tipo);
              const displayQty = Math.abs(m.cantidad);
              return (
                <tr key={m.id} className="border-b border-white/5">
                  <td className="text-white font-bold text-xs">{m.fecha.replace('T', ' ').slice(0, 16)}</td>
                  <td className="text-white font-black text-xs uppercase">{p?.nombre || 'Eliminado'}</td>
                  <td><span className={`badge ${negative ? 'badge-err' : 'badge-ok'} text-[9px] uppercase font-black`}>{m.tipo}</span></td>
                  <td className={`text-right font-black text-xs ${negative ? 'text-[#e04848]' : 'text-[#27ae60]'}`}>
                    {negative ? `-${displayQty}` : `+${displayQty}`}
                  </td>
                  <td className="text-white/60 text-[10px] uppercase italic">{m.referencia}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReporteKardex({ state, selectedId, onSelect }: { state: AppState, selectedId: string | null, onSelect: (id: string | null) => void }) {
  const movs = selectedId ? state.movimientos.filter(m => m.productoId === selectedId).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [];
  const p = state.productos.find(x => x.id === selectedId);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex gap-4">
        <select className="form-select flex-1 bg-[#131313] text-white border-[#2a2a2a] h-11" value={selectedId || ''} onChange={e => onSelect(e.target.value)}>
          <option value="">Seleccione un producto para ver su historial...</option>
          {state.productos.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {selectedId && (
        <div className="card">
          <div className="card-head px-5 py-3 border-b border-[#2a2a2a] bg-[#181818]">
            <h3 className="text-white font-black text-xs uppercase tracking-widest">Kardex: {p?.nombre}</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr className="bg-[#0b0b0b]">
                  <th className="text-white font-black text-[10px] uppercase">Fecha</th>
                  <th className="text-white font-black text-[10px] uppercase">Operación</th>
                  <th className="text-white font-black text-[10px] uppercase text-right">E/S</th>
                  <th className="text-white font-black text-[10px] uppercase text-right">Saldo</th>
                  <th className="text-white font-black text-[10px] uppercase">Referencia</th>
                </tr>
              </thead>
              <tbody className="bg-[#131313]">
                {movs.map(m => {
                  const negative = m.cantidad < 0 || isExit(m.tipo);
                  const displayQty = Math.abs(m.cantidad);
                  return (
                    <tr key={m.id} className="border-b border-white/5">
                      <td className="text-white font-bold text-xs">{m.fecha.replace('T', ' ').slice(0, 16)}</td>
                      <td className="text-white font-black text-[10px] uppercase">{m.tipo}</td>
                      <td className={`text-right font-black text-xs ${negative ? 'text-[#e04848]' : 'text-[#27ae60]'}`}>
                        {negative ? `-${displayQty}` : `+${displayQty}`}
                      </td>
                      <td className="text-[#c8952e] font-black text-xs text-right">{m.stockDespues}</td>
                      <td className="text-white/40 text-[10px] uppercase italic truncate max-w-[200px]">{m.referencia}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ReporteConsumo({ state }: { state: AppState }) {
  return (
    <div className="card p-20 text-center animate-in fade-in">
      <Gift className="w-12 h-12 text-[#3a9bdc] mx-auto mb-4 opacity-50" />
      <h3 className="text-white font-black uppercase text-xl">Reporte de Consumo y Colaboraciones</h3>
      <p className="text-white/40 font-black uppercase text-[10px] mt-2">Auditoría de cortesías y uso interno próximamente.</p>
    </div>
  );
}

// --- MODALES ---

function ModalProducto({ producto, state, onClose, onSave, onUpdateLists }: { producto?: Product, state: AppState, onClose: () => void, onSave: (p: any) => void, onUpdateLists: (l: any) => void }) {
  const [datos, setDatos] = useState({
    codigo: producto?.codigo || '',
    nombre: producto?.nombre || '',
    categoria: producto?.categoria || state.categorias[0] || '',
    departamento: producto?.departamento || state.departamentos[0] || '',
    cantidad: producto?.cantidad || state.presentaciones[0] || '',
    marca: producto?.marca || state.marcas[0] || '',
    costoUSD: producto?.costoUSD || 0,
    precioUSD: producto?.precioUSD || 0,
    precioEstandarUSD: producto?.precioEstandarUSD || producto?.precioUSD || 0,
    precioMayorUSD: producto?.precioMayorUSD || 0,
    precioOfertaUSD: producto?.precioOfertaUSD || 0,
    precioPromoUSD: producto?.precioPromoUSD || 0,
    tipoPrecioPrincipal: producto?.tipoPrecioPrincipal || 'estandar',
    margen: producto?.margen || 0,
    precioBS: (producto?.precioUSD || 0) * state.tasa,
    stock: producto?.stock || 0,
    stockMinimo: producto?.stockMinimo || 3,
    proveedor: producto?.proveedor || '',
    aplicaIVA: producto?.aplicaIVA ?? true,
    isKit: producto?.isKit || false,
    kitType: producto?.kitType || 'stock_propio',
    kitItems: producto?.kitItems || [] as KitItem[]
  });

  const [kitSearch, setKitSearch] = useState('');
  const [provSearch, setProvSearch] = useState(producto?.proveedor || '');
  const [showProvSuggestions, setShowProvSuggestions] = useState(false);

  const recalcularDesdeUSD = (usd: number, costo: number = datos.costoUSD) => {
    const nuevoMargen = usd > 0 ? ((usd - costo) / usd) * 100 : 0;
    setDatos(d => ({ ...d, precioUSD: usd, precioEstandarUSD: usd, margen: nuevoMargen, precioBS: usd * state.tasa, costoUSD: costo }));
  };

  const recalcularDesdeMargen = (m: number, costo: number = datos.costoUSD) => {
    const factor = (1 - (m / 100));
    const usd = factor > 0 ? costo / factor : 0;
    setDatos(d => ({ ...d, margen: m, precioUSD: usd, precioEstandarUSD: usd, precioBS: usd * state.tasa, costoUSD: costo }));
  };

  const recalcularDesdeBS = (bs: number) => {
    const usd = bs / state.tasa;
    const nuevoMargen = usd > 0 ? ((usd - datos.costoUSD) / usd) * 100 : 0;
    setDatos(d => ({ ...d, precioBS: bs, precioUSD: usd, precioEstandarUSD: usd, margen: nuevoMargen }));
  };

  const handleSubmit = () => {
    if (!datos.nombre || !datos.codigo) return alert('Nombre y Código son requeridos');
    let pVenta = datos.precioEstandarUSD;
    if (datos.tipoPrecioPrincipal === 'mayor') pVenta = datos.precioMayorUSD;
    else if (datos.tipoPrecioPrincipal === 'oferta') pVenta = datos.precioOfertaUSD;
    else if (datos.tipoPrecioPrincipal === 'promo') pVenta = datos.precioPromoUSD;
    if (pVenta <= 0) return alert('El precio de venta debe ser mayor a 0');
    onSave({ ...datos, precioUSD: pVenta });
  };

  const addToList = (key: 'categorias' | 'departamentos' | 'marcas' | 'presentaciones' | 'proveedores') => {
    const val = prompt(`Nueva entrada para ${key}:`);
    if (val) {
      const newList = [...(state[key] as string[]), val];
      onUpdateLists({ [key]: newList });
      const fieldKey = key === 'presentaciones' ? 'cantidad' : key === 'proveedores' ? 'proveedor' : key.slice(0, -1);
      setDatos(d => ({ ...d, [fieldKey]: val }));
      if (key === 'proveedores') setProvSearch(val);
    }
  };

  const removeFromList = (key: 'categorias' | 'departamentos' | 'marcas' | 'presentaciones' | 'proveedores', val: string) => {
    if (confirm(`¿Borrar "${val}"?`)) {
      const newList = (state[key] as string[]).filter(i => i !== val);
      onUpdateLists({ [key]: newList });
    }
  };

  const filteredProveedores = state.proveedores.filter(p => p.toLowerCase().includes(provSearch.toLowerCase()));

  return (
    <div className="modal show">
      <div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-[#1e1e1e] max-w-[750px] border-2 border-[#2a2a2a] shadow-2xl">
        <div className="modal-head py-3 px-5 border-b border-[#2a2a2a] bg-[#181818]">
          <h3 className="text-white font-black uppercase tracking-widest text-sm">{producto ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <button className="btn-icon btn-sm text-white" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="modal-body p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="form-group mb-0">
              <label className="text-white font-black text-[10px] mb-1 uppercase block">Código / Barcode</label>
              <input className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-3 mono text-sm" value={datos.codigo} onChange={e => setDatos({...datos, codigo: e.target.value})} />
            </div>
            <div className="form-group mb-0 col-span-2">
              <label className="text-white font-black text-[10px] mb-1 uppercase block">Nombre del Producto</label>
              <input className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-3 font-bold text-sm" value={datos.nombre} onChange={e => setDatos({...datos, nombre: e.target.value})} />
            </div>
          </div>

          <div className="bg-[#181818] p-4 rounded border border-[#2a2a2a] space-y-3">
            <h4 className="text-[10px] font-black uppercase text-[#c8952e] mb-2">Costos y Precio Estándar</h4>
            <div className="grid grid-cols-4 gap-3">
              <div className="form-group mb-0">
                <label className="text-white font-black text-[9px] mb-1 block uppercase">Costo USD</label>
                <input type="number" step="0.01" className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-3 text-sm" value={datos.costoUSD} onChange={e => recalcularDesdeMargen(datos.margen, parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group mb-0">
                <label className="text-white font-black text-[9px] mb-1 block uppercase">Margen %</label>
                <input type="number" className="form-input bg-[#0b0b0b] text-[#27ae60] border-[#2a2a2a] h-10 px-3 text-sm font-black" value={datos.margen} onChange={e => recalcularDesdeMargen(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group mb-0">
                <div className="flex justify-between items-center mb-1"><label className="text-white font-black text-[9px] uppercase">Venta USD</label><input type="radio" checked={datos.tipoPrecioPrincipal === 'estandar'} onChange={() => setDatos({...datos, tipoPrecioPrincipal: 'estandar'})} /></div>
                <input type="number" className="form-input bg-[#0b0b0b] text-[#c8952e] border-[#2a2a2a] h-10 px-3 text-sm font-black" value={datos.precioEstandarUSD} onChange={e => recalcularDesdeUSD(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group mb-0">
                <label className="text-white font-black text-[9px] mb-1 block uppercase">Venta BS</label>
                <input type="number" className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-3 text-sm font-black" value={datos.precioBS} onChange={e => recalcularDesdeBS(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="form-group mb-0">
              <label className="text-white font-black text-[10px] mb-1 uppercase block">Categoría</label>
              <div className="flex gap-1">
                <select className="form-select flex-1 bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-2 text-xs" value={datos.categoria} onChange={e => setDatos({...datos, categoria: e.target.value})}>
                  {state.categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button className="btn-icon h-10 w-10 text-[#c8952e]" onClick={() => addToList('categorias')}>+</button>
              </div>
            </div>
            <div className="form-group mb-0">
              <label className="text-white font-black text-[10px] mb-1 uppercase block">Proveedor</label>
              <div className="relative">
                <input className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-3 text-xs" value={provSearch} onChange={e => {setProvSearch(e.target.value); setDatos({...datos, proveedor: e.target.value}); setShowProvSuggestions(true);}} />
                {showProvSuggestions && filteredProveedores.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-[#1e1e1e] border border-[#333] z-50">
                    {filteredProveedores.map(p => <div key={p} className="p-2 hover:bg-[#c8952e]/20 cursor-pointer text-xs" onClick={() => {setDatos({...datos, proveedor: p}); setProvSearch(p); setShowProvSuggestions(false);}}>{p}</div>)}
                  </div>
                )}
              </div>
            </div>
            <div className="form-group mb-0">
              <label className="text-white font-black text-[10px] mb-1 uppercase block">Stock Inicial</label>
              <input type="number" className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-3 text-sm" value={datos.stock} onChange={e => setDatos({...datos, stock: parseInt(e.target.value) || 0})} disabled={!!producto} />
            </div>
          </div>

          <div className="flex items-center gap-4 bg-[#181818] p-4 rounded border border-[#2a2a2a]">
             <div className="flex items-center gap-2">
               <input type="checkbox" checked={datos.aplicaIVA} onChange={e => setDatos({...datos, aplicaIVA: e.target.checked})} className="w-4 h-4 accent-[#c8952e]" />
               <label className="text-white font-black text-xs uppercase cursor-pointer">Aplica Impuesto (IVA 16%)</label>
             </div>
             {!datos.aplicaIVA && <span className="badge badge-warn font-black text-[9px] uppercase">Producto Exento</span>}
          </div>
        </div>
        <div className="modal-foot py-4 px-6 bg-[#181818] border-t border-[#2a2a2a] flex justify-end gap-3">
          <button className="btn btn-secondary h-10 font-black uppercase text-xs" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary h-10 font-black uppercase text-xs px-8" onClick={handleSubmit}>{producto ? 'Actualizar Producto' : 'Crear Producto'}</button>
        </div>
      </div>
    </div>
  );
}

function ModalAjuste({ producto, onClose, onSave }: { producto: Product, onClose: () => void, onSave: (mov: Movimiento, nuevoCosto?: number) => void }) {
  const [tipo, setTipo] = useState<'ajuste_entrada' | 'ajuste_salida' | 'compra' | 'consumo' | 'colaboracion'>('ajuste_entrada');
  const [cantidad, setCantidad] = useState(0);
  const [costo, setCosto] = useState(producto.costoUSD);
  const [referencia, setReferencia] = useState('');

  const handleSave = () => {
    if (cantidad <= 0) return alert('La cantidad debe ser mayor a 0');
    const isExitType = ['ajuste_salida', 'consumo', 'colaboracion'].includes(tipo);
    const cantFinal = isExitType ? -Math.abs(cantidad) : Math.abs(cantidad);
    const stockDespues = producto.stock + cantFinal;
    if (stockDespues < 0) return alert('El stock no puede quedar en negativo');

    const mov: Movimiento = {
      id: Store.uid(),
      productoId: producto.id,
      tipo: tipo as any,
      cantidad: cantFinal,
      stockAntes: producto.stock,
      stockDespues: stockDespues,
      fecha: Utils.ahora(),
      referencia: referencia || `Ajuste manual de ${tipo}`
    };

    onSave(mov, costo);
  };

  return (
    <div className="modal show">
      <div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-[#1e1e1e] border-[#2a2a2a] max-w-md">
        <div className="modal-head border-b border-[#2a2a2a] p-4">
          <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2"><Boxes className="w-5 h-5 text-[#27ae60]"/> Ajuste de Stock</h3>
          <button onClick={onClose}><X className="text-white"/></button>
        </div>
        <div className="modal-body p-6 space-y-4">
          <div className="bg-black/30 p-3 rounded border border-white/10 text-center mb-4">
            <p className="text-white/40 text-[9px] font-black uppercase mb-1">Stock Actual</p>
            <p className="text-3xl font-black text-white">{producto.stock}</p>
            <p className="text-white font-bold text-xs uppercase mt-1">{producto.nombre}</p>
          </div>

          <div className="form-group">
            <label className="text-white text-[10px] font-black uppercase block mb-1">Tipo de Movimiento</label>
            <select className="form-select bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-3 font-bold text-xs" value={tipo} onChange={e => setTipo(e.target.value as any)}>
              <option value="ajuste_entrada">Ajuste de Entrada (+)</option>
              <option value="ajuste_salida">Ajuste de Salida (-)</option>
              <option value="compra">Compra a Proveedor (+)</option>
              <option value="consumo">Consumo Interno (-)</option>
              <option value="colaboracion">Colaboración / Cortesía (-)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="text-white text-[10px] font-black uppercase block mb-1">Cantidad</label>
              <input type="number" className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-3 font-black" value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 0)} />
            </div>
            {tipo === 'compra' && (
              <div className="form-group">
                <label className="text-white text-[10px] font-black uppercase block mb-1">Costo Unitario ($)</label>
                <input type="number" step="0.01" className="form-input bg-[#0b0b0b] text-white border-[#c8952e]/30 h-10 px-3 font-black" value={costo} onChange={e => setCosto(parseFloat(e.target.value) || 0)} />
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="text-white text-[10px] font-black uppercase block mb-1">Referencia / Observación</label>
            <input className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10 px-3 text-xs" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ej: Factura #1234 o Rotura" />
          </div>

          <button className="btn btn-primary w-full h-12 font-black uppercase text-xs mt-4" onClick={handleSave}>Procesar Ajuste</button>
        </div>
      </div>
    </div>
  );
}
