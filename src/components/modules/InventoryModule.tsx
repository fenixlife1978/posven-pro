'use client';

import React, { useState, useEffect } from 'react';
import { AppState, Product, Movimiento, KitItem } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { Plus, Search, Edit2, Trash2, Boxes, X, BarChart3, FileText, History, Gift, Layers, Trash } from 'lucide-react';

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
                            {p.isKit && <Layers className="w-3 h-3 text-[#c8952e]" />}
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
      case 'historial_ajustes': return <HistorialAjustes state={state} />;
      case 'kardex': return <ReporteKardex state={state} selectedId={selectedKardexId} onSelect={setSelectedKardexId} />;
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

function ModalProducto({ producto, state, onClose, onSave, onUpdateLists }: { producto?: Product, state: AppState, onClose: () => void, onSave: (p: any) => void, onUpdateLists: (l: any) => void }) {
  const [datos, setDatos] = useState({
    codigo: producto?.codigo || '',
    nombre: producto?.nombre || '',
    categoria: producto?.categoria || state.categorias[0] || '',
    departamento: producto?.departamento || state.departamentos[0] || '',
    cantidad: producto?.cantidad || state.presentaciones[0] || '750ml',
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

  const [provSearch, setProvSearch] = useState(datos.proveedor || '');
  const [showProvList, setShowProvList] = useState(false);
  const [kitSearch, setKitSearch] = useState('');

  const recalcularDesdeUSD = (usd: number, costo: number = datos.costoUSD) => {
    const nuevoMargen = usd > 0 ? ((usd - costo) / usd) * 100 : 0;
    setDatos(d => ({ ...d, precioUSD: usd, margen: nuevoMargen, precioBS: usd * state.tasa, costoUSD: costo }));
  };

  const recalcularDesdeMargen = (m: number, costo: number = datos.costoUSD) => {
    const factor = (1 - (m / 100));
    const usd = factor > 0 ? costo / factor : 0;
    setDatos(d => ({ ...d, margen: m, precioUSD: usd, precioBS: usd * state.tasa, costoUSD: costo }));
  };

  const recalcularDesdeBS = (bs: number) => {
    const usd = bs / state.tasa;
    const nuevoMargen = usd > 0 ? ((usd - datos.costoUSD) / usd) * 100 : 0;
    setDatos(d => ({ ...d, precioBS: bs, precioUSD: usd, margen: nuevoMargen }));
  };

  // Sincronizar precioUSD cuando cambia el tipo principal o los precios
  useEffect(() => {
    let p = datos.precioEstandarUSD;
    if (datos.tipoPrecioPrincipal === 'mayor') p = datos.precioMayorUSD;
    if (datos.tipoPrecioPrincipal === 'oferta') p = datos.precioOfertaUSD;
    if (datos.tipoPrecioPrincipal === 'promo') p = datos.precioPromoUSD;
    recalcularDesdeUSD(p);
  }, [datos.tipoPrecioPrincipal, datos.precioEstandarUSD, datos.precioMayorUSD, datos.precioOfertaUSD, datos.precioPromoUSD]);

  const handleSubmit = () => {
    if (!datos.nombre || !datos.codigo) return alert('Nombre y Código son requeridos');
    if (datos.precioUSD <= 0) return alert('El precio de venta debe ser mayor a 0');
    onSave(datos);
  };

  const addToList = (key: 'categorias' | 'departamentos' | 'marcas' | 'presentaciones' | 'proveedores') => {
    const val = prompt(`Nueva entrada para ${key}:`);
    if (val) {
      const currentList = state[key] as string[];
      if (!currentList.includes(val)) {
        const newList = [...currentList, val];
        onUpdateLists({ [key]: newList });
        if (key === 'presentaciones') setDatos(d => ({ ...d, cantidad: val }));
        else if (key === 'proveedores') { setProvSearch(val); setDatos(d => ({ ...d, proveedor: val })); }
        else setDatos(d => ({ ...d, [key.slice(0, -1)]: val }));
      }
    }
  };

  const removeFromList = (key: 'categorias' | 'departamentos' | 'marcas' | 'presentaciones' | 'proveedores', val: string) => {
    if (confirm(`¿Borrar "${val}" de la lista?`)) {
      const currentList = state[key] as string[];
      const newList = currentList.filter(i => i !== val);
      onUpdateLists({ [key]: newList });
    }
  };

  return (
    <div className="modal show">
      <div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box" style={{ maxWidth: '680px' }}>
        <div className="modal-head py-3 px-5">
          <h3 className="text-base font-black uppercase text-white">{producto ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <button className="btn-icon btn-sm" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="modal-body p-5 space-y-4">
          
          {/* Fila 1: Codigo, Dept, Cat */}
          <div className="grid grid-cols-3 gap-3">
            <div className="form-group mb-0">
              <label className="form-label text-[10px] mb-1 uppercase text-white font-black">Código / Barcode</label>
              <input className="form-input py-1.5 mono text-sm" value={datos.codigo} onChange={e => setDatos({...datos, codigo: e.target.value})} placeholder="Escanee" />
            </div>
            <div className="form-group mb-0">
              <div className="flex justify-between items-center mb-1">
                <label className="form-label text-[10px] m-0 uppercase text-white font-black">Dpto.</label>
                <button className="text-[9px] text-[#c8952e] font-black" onClick={() => addToList('departamentos')}>+ ADD</button>
              </div>
              <div className="flex gap-1">
                <select className="form-select py-1.5 text-xs bg-[#0b0b0b] text-white" value={datos.departamento} onChange={e => setDatos({...datos, departamento: e.target.value})}>
                  {state.departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button className="btn-icon btn-sm h-7 w-7 text-[#e04848]" onClick={() => removeFromList('departamentos', datos.departamento)}><Trash className="w-3 h-3"/></button>
              </div>
            </div>
            <div className="form-group mb-0">
              <div className="flex justify-between items-center mb-1">
                <label className="form-label text-[10px] m-0 uppercase text-white font-black">Cat.</label>
                <button className="text-[9px] text-[#c8952e] font-black" onClick={() => addToList('categorias')}>+ ADD</button>
              </div>
              <div className="flex gap-1">
                <select className="form-select py-1.5 text-xs bg-[#0b0b0b] text-white" value={datos.categoria} onChange={e => setDatos({...datos, categoria: e.target.value})}>
                  {state.categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button className="btn-icon btn-sm h-7 w-7 text-[#e04848]" onClick={() => removeFromList('categorias', datos.categoria)}><Trash className="w-3 h-3"/></button>
              </div>
            </div>
          </div>

          {/* Fila 2: Marca y Nombre */}
          <div className="grid grid-cols-3 gap-3">
            <div className="form-group mb-0">
              <div className="flex justify-between items-center mb-1">
                <label className="form-label text-[10px] m-0 uppercase text-white font-black">Marca</label>
                <button className="text-[9px] text-[#c8952e] font-black" onClick={() => addToList('marcas')}>+ ADD</button>
              </div>
              <div className="flex gap-1">
                <select className="form-select py-1.5 text-xs bg-[#0b0b0b] text-white" value={datos.marca} onChange={e => setDatos({...datos, marca: e.target.value})}>
                  {state.marcas.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button className="btn-icon btn-sm h-7 w-7 text-[#e04848]" onClick={() => removeFromList('marcas', datos.marca)}><Trash className="w-3 h-3"/></button>
              </div>
            </div>
            <div className="form-group mb-0 col-span-2">
              <label className="form-label text-[10px] mb-1 uppercase text-white font-black">Nombre del producto</label>
              <input className="form-input py-1.5 text-sm" value={datos.nombre} onChange={e => setDatos({...datos, nombre: e.target.value})} placeholder="Ej: Johnnie Walker Black Label" />
            </div>
          </div>

          {/* Fila 3: Precios Compactos (Calculadora) */}
          <div className="bg-[#181818] p-3 rounded-lg border border-[#2a2a2a]">
            <div className="grid grid-cols-4 gap-3">
              <div className="form-group mb-0">
                <label className="form-label text-[9px] mb-1 text-white/60 uppercase">COSTO $</label>
                <input className="form-input py-1.5 text-sm" type="number" step="0.01" value={datos.costoUSD} onChange={e => recalcularDesdeMargen(datos.margen, parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-[9px] mb-1 text-white/60 uppercase">MARGEN %</label>
                <input className="form-input py-1.5 text-sm text-[#27ae60] font-bold" type="number" value={Math.round(datos.margen * 100) / 100} onChange={e => recalcularDesdeMargen(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-[9px] mb-1 text-white/60 uppercase">VENTA ACTUAL $</label>
                <input className="form-input py-1.5 text-sm text-[#c8952e] font-black bg-black" type="number" step="0.01" value={Math.round(datos.precioUSD * 100) / 100} readOnly />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-[9px] mb-1 text-white/60 uppercase">VENTA ACTUAL BS</label>
                <input className="form-input py-1.5 text-sm font-bold bg-black" type="number" step="0.01" value={Math.round(datos.precioBS * 100) / 100} readOnly />
              </div>
            </div>
          </div>

          {/* SECCIÓN PRECIOS ADICIONALES */}
          <div className="bg-[#131313] p-3 rounded-lg border border-[#333] space-y-3">
            <label className="text-[10px] font-black text-[#c8952e] uppercase block mb-1">Definición de Precios y Uso en POS</label>
            <div className="grid grid-cols-4 gap-3">
              <PriceInput 
                label="ESTÁNDAR" 
                value={datos.precioEstandarUSD} 
                isActive={datos.tipoPrecioPrincipal === 'estandar'}
                onSelect={() => setDatos({...datos, tipoPrecioPrincipal: 'estandar'})}
                onChange={(v) => setDatos({...datos, precioEstandarUSD: v})}
              />
              <PriceInput 
                label="AL MAYOR" 
                value={datos.precioMayorUSD} 
                isActive={datos.tipoPrecioPrincipal === 'mayor'}
                onSelect={() => setDatos({...datos, tipoPrecioPrincipal: 'mayor'})}
                onChange={(v) => setDatos({...datos, precioMayorUSD: v})}
              />
              <PriceInput 
                label="OFERTA" 
                value={datos.precioOfertaUSD} 
                isActive={datos.tipoPrecioPrincipal === 'oferta'}
                onSelect={() => setDatos({...datos, tipoPrecioPrincipal: 'oferta'})}
                onChange={(v) => setDatos({...datos, precioOfertaUSD: v})}
              />
              <PriceInput 
                label="PROMO" 
                value={datos.precioPromoUSD} 
                isActive={datos.tipoPrecioPrincipal === 'promo'}
                onSelect={() => setDatos({...datos, tipoPrecioPrincipal: 'promo'})}
                onChange={(v) => setDatos({...datos, precioPromoUSD: v})}
              />
            </div>
          </div>

          {/* Fila 4: Inventario y Presentacion */}
          <div className="grid grid-cols-3 gap-3">
            <div className="form-group mb-0">
              <label className="form-label text-[10px] mb-1 uppercase text-white font-black">Stock Inicial</label>
              <input className="form-input py-1.5 text-sm" type="number" value={datos.stock} onChange={e => setDatos({...datos, stock: parseInt(e.target.value) || 0})} disabled={!!producto && !datos.isKit} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label text-[10px] mb-1 uppercase text-white font-black">Mínimo</label>
              <input className="form-input py-1.5 text-sm" type="number" value={datos.stockMinimo} onChange={e => setDatos({...datos, stockMinimo: parseInt(e.target.value) || 0})} />
            </div>
            <div className="form-group mb-0">
              <div className="flex justify-between items-center mb-1">
                <label className="form-label text-[10px] m-0 uppercase text-white font-black">Presentación</label>
                <button className="text-[9px] text-[#c8952e] font-black" onClick={() => addToList('presentaciones')}>+ ADD</button>
              </div>
              <div className="flex gap-1">
                <select className="form-select py-1.5 text-xs bg-[#0b0b0b] text-white" value={datos.cantidad} onChange={e => setDatos({...datos, cantidad: e.target.value})}>
                  {state.presentaciones.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button className="btn-icon btn-sm h-7 w-7 text-[#e04848]" onClick={() => removeFromList('presentaciones', datos.cantidad)}><Trash className="w-3 h-3"/></button>
              </div>
            </div>
          </div>

          {/* Fila 5: Proveedor (Búsqueda Inteligente) */}
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="form-group mb-0 relative">
              <label className="form-label text-[10px] mb-1 uppercase text-white font-black">Proveedor</label>
              <input 
                className="form-input py-1.5 text-sm" 
                value={provSearch} 
                onChange={e => {
                  setProvSearch(e.target.value);
                  setDatos({...datos, proveedor: e.target.value});
                  setShowProvList(true);
                }} 
                onFocus={() => setShowProvList(true)}
                onBlur={() => setTimeout(() => setShowProvList(false), 200)}
                placeholder="Escriba para buscar o registrar..." 
              />
              {showProvList && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-[#1e1e1e] border border-[#333] rounded shadow-2xl z-[100] max-h-40 overflow-y-auto">
                  {state.proveedores.filter(p => p.toLowerCase().includes(provSearch.toLowerCase())).map(p => (
                    <div 
                      key={p} 
                      className="p-2 hover:bg-[#c8952e]/20 cursor-pointer text-xs text-white border-b border-white/5"
                      onMouseDown={() => {
                        setProvSearch(p);
                        setDatos({...datos, proveedor: p});
                        setShowProvList(false);
                      }}
                    >
                      {p}
                    </div>
                  ))}
                  <div 
                    className="p-2 text-[#c8952e] text-[10px] font-black cursor-pointer uppercase hover:bg-white/5"
                    onMouseDown={() => addToList('proveedores')}
                  >
                    + REGISTRAR NUEVO PROVEEDOR
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 p-2 bg-[#181818] rounded border border-[#2a2a2a]">
              <input 
                type="checkbox" 
                checked={datos.aplicaIVA} 
                onChange={e => setDatos({...datos, aplicaIVA: e.target.checked})} 
                className="w-4 h-4 accent-[#c8952e]" 
              />
              <label className="text-[10px] font-black text-white uppercase m-0 flex-1">
                {datos.aplicaIVA ? 'APLICA IVA (16%)' : 'PRODUCTO EXENTO'}
              </label>
            </div>
          </div>

          {/* SECCION KIT COMPACTA */}
          <div className="border-t border-[#2a2a2a] pt-3">
            <div className="flex items-center gap-3 mb-2">
              <input type="checkbox" checked={datos.isKit} onChange={e => setDatos({...datos, isKit: e.target.checked})} className="w-3.5 h-3.5 accent-[#c8952e]" />
              <label className="form-label m-0 text-xs text-white font-black flex items-center gap-2">Este producto es un Kit <Layers className="w-3 h-3 text-[#c8952e]"/></label>
            </div>

            {datos.isKit && (
              <div className="bg-[#1e1e1e] p-3 rounded-lg border border-[#333] space-y-3 animate-in fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group mb-0">
                    <label className="form-label text-[9px] uppercase mb-1 text-white/40">Tipo de Stock</label>
                    <select className="form-select py-1 text-xs bg-black text-white" value={datos.kitType} onChange={e => setDatos({...datos, kitType: e.target.value as any})}>
                      <option value="stock_propio">Propio</option>
                      <option value="stock_componentes">Calculado</option>
                    </select>
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label text-[9px] uppercase mb-1 text-white/40">Añadir Componente</label>
                    <input className="form-input py-1 text-xs" placeholder="Buscar..." value={kitSearch} onChange={e => setKitSearch(e.target.value)} />
                  </div>
                </div>
                
                {kitSearch.length > 1 && (
                  <div className="bg-[#0b0b0b] border border-[#333] rounded max-h-24 overflow-y-auto">
                    {state.productos.filter(p => !p.isKit && p.activo && (p.nombre.toLowerCase().includes(kitSearch.toLowerCase()) || p.codigo.includes(kitSearch))).map(p => (
                      <div key={p.id} className="p-1.5 hover:bg-[#181818] cursor-pointer text-[10px] flex justify-between" onClick={() => {
                        if (!datos.kitItems.find(i => i.productoId === p.id)) {
                          setDatos({...datos, kitItems: [...datos.kitItems, { productoId: p.id, nombre: p.nombre, cantidad: 1 }]});
                        }
                        setKitSearch('');
                      }}>
                        <span className="text-white">{p.nombre}</span>
                        <span className="text-[#c8952e] font-bold">${p.precioUSD}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {datos.kitItems.map((item, idx) => (
                    <div key={item.productoId} className="flex items-center gap-2 bg-[#0b0b0b] p-1.5 rounded text-[10px] border border-[#2a2a2a]">
                      <span className="flex-1 truncate text-white">{item.nombre}</span>
                      <input type="number" className="bg-[#181818] border border-[#333] rounded w-8 p-0.5 text-center text-white" value={item.cantidad} onChange={e => {
                        const ni = [...datos.kitItems];
                        ni[idx].cantidad = Math.max(1, parseInt(e.target.value) || 1);
                        setDatos({...datos, kitItems: ni});
                      }} />
                      <button className="text-[#e04848]" onClick={() => setDatos({...datos, kitItems: datos.kitItems.filter((_, i) => i !== idx)})}><X className="w-3 h-3"/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
        <div className="modal-foot py-3 px-5">
          <button className="btn btn-sm btn-secondary font-black uppercase" onClick={onClose}>Cancelar</button>
          <button className="btn btn-sm btn-primary font-black uppercase" onClick={handleSubmit}>{producto ? 'Actualizar' : 'Crear producto'}</button>
        </div>
      </div>
    </div>
  );
}

function PriceInput({ label, value, isActive, onSelect, onChange }: any) {
  return (
    <div className={`p-2 rounded border transition-all ${isActive ? 'bg-[#c8952e]/10 border-[#c8952e]' : 'bg-black border-[#2a2a2a]'}`}>
      <div className="flex justify-between items-center mb-1">
        <label className={`text-[8px] font-black ${isActive ? 'text-[#c8952e]' : 'text-white/40'}`}>{label}</label>
        <div 
          onClick={onSelect}
          className={`w-3 h-3 rounded-full border cursor-pointer flex items-center justify-center ${isActive ? 'border-[#c8952e] bg-[#c8952e]' : 'border-white/20'}`}
        >
          {isActive && <div className="w-1 h-1 bg-black rounded-full" />}
        </div>
      </div>
      <input 
        type="number" 
        step="0.01"
        className="w-full bg-transparent text-white font-bold text-xs outline-none" 
        value={value} 
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function ReporteGeneral({ state }: { state: AppState }) {
  const [groupBy, setGroupBy] = useState<'categoria' | 'departamento' | 'proveedor'>('categoria');
  
  const totalCosto = state.productos.reduce((acc, p) => acc + (p.costoUSD * p.stock), 0);
  const totalVenta = state.productos.reduce((acc, p) => acc + (p.precioUSD * p.stock), 0);
  
  const uniqueKeys = Array.from(new Set(state.productos.map(p => (p[groupBy] as string) || 'Sin asignar'))).sort();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="kpi amber">
          <div className="kpi-icon"><BarChart3 /></div>
          <div className="text-white text-[10px] font-black uppercase mb-1">Valor al Costo (CPP Total)</div>
          <div className="text-3xl font-black text-white">{Utils.fmtUSD(totalCosto)}</div>
          <div className="text-white text-sm font-bold mt-1 italic">{Utils.fmtBS(totalCosto * state.tasa)}</div>
        </div>
        <div className="kpi green">
          <div className="kpi-icon"><BarChart3 /></div>
          <div className="text-white text-[10px] font-black uppercase mb-1">Valor al Precio de Venta (Total)</div>
          <div className="text-3xl font-black text-[#27ae60]">{Utils.fmtUSD(totalVenta)}</div>
          <div className="text-white text-sm font-bold mt-1 italic">{Utils.fmtBS(totalVenta * state.tasa)}</div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-head">
          <h3 className="text-white font-black uppercase text-xs">Resumen por {groupBy} y CPP</h3>
          <div className="flex gap-2 no-print">
            <button className={`btn btn-sm ${groupBy === 'categoria' ? 'btn-primary' : 'btn-secondary text-white'}`} onClick={() => setGroupBy('categoria')}>Categoría</button>
            <button className={`btn btn-sm ${groupBy === 'departamento' ? 'btn-primary' : 'btn-secondary text-white'}`} onClick={() => setGroupBy('departamento')}>Departamento</button>
            <button className={`btn btn-sm ${groupBy === 'proveedor' ? 'btn-primary' : 'btn-secondary text-white'}`} onClick={() => setGroupBy('proveedor')}>Proveedor</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="text-white font-black text-[10px] uppercase">{groupBy}</th>
                <th className="text-white font-black text-[10px] uppercase">Items</th>
                <th className="text-white font-black text-[10px] uppercase">Stock Total</th>
                <th className="text-white font-black text-[10px] uppercase">CPP Promedio</th>
                <th className="text-white font-black text-[10px] uppercase">Valor Costo</th>
                <th className="text-white font-black text-[10px] uppercase">Valor Venta</th>
              </tr>
            </thead>
            <tbody>
              {uniqueKeys.map(key => {
                const groupProds = state.productos.filter(p => ((p[groupBy] as string) || 'Sin asignar') === key);
                const stockTotal = groupProds.reduce((s, p) => s + p.stock, 0);
                const costTotal = groupProds.reduce((s, p) => s + (p.costoUSD * p.stock), 0);
                const ventTotal = groupProds.reduce((s, p) => s + (p.precioUSD * p.stock), 0);
                const cppPromedio = stockTotal > 0 ? costTotal / stockTotal : 0;
                
                return (
                  <tr key={key} className="border-b border-white/5">
                    <td className="text-white font-black text-xs uppercase">{key}</td>
                    <td className="text-white font-bold text-xs">{groupProds.length}</td>
                    <td className="text-white font-bold text-xs">{stockTotal}</td>
                    <td className="text-white font-black text-xs mono">{Utils.fmtUSD(cppPromedio)}</td>
                    <td className="text-white font-black text-xs mono">{Utils.fmtUSD(costTotal)}</td>
                    <td className="text-[#c8952e] font-black text-xs mono">{Utils.fmtUSD(ventTotal)}</td>
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
      if (filter === 'hoy') return v.fecha.startsWith(hoy);
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
          <label className="text-white text-[10px] font-black uppercase mb-1 block">Filtrar por:</label>
          <select className="form-select w-auto bg-black text-white" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="hoy">Hoy</option>
            <option value="mes">Este Mes</option>
            <option value="año">Este Año</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        
        {filter === 'custom' && (
          <>
            <div className="form-group mb-0">
              <label className="text-white text-[10px] font-black uppercase mb-1 block">Desde</label>
              <input type="date" className="form-input w-auto bg-black text-white" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="form-group mb-0">
              <label className="text-white text-[10px] font-black uppercase mb-1 block">Hasta</label>
              <input type="date" className="form-input w-auto bg-black text-white" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          </>
        )}
        
        <button className="btn btn-secondary ml-auto text-white font-black text-xs uppercase" onClick={() => window.print()}>
          <FileText className="w-4 h-4" /> EXPORTAR PDF
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="text-white font-black text-[10px] uppercase">Fecha</th>
                <th className="text-white font-black text-[10px] uppercase">Producto(s)</th>
                <th className="text-white font-black text-[10px] uppercase">Tipo</th>
                <th className="text-white font-black text-[10px] uppercase">Cant.</th>
                <th className="text-white font-black text-[10px] uppercase">Precio $</th>
                <th className="text-white font-black text-[10px] uppercase">Total $</th>
              </tr>
            </thead>
            <tbody>
              {ventas.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-white font-black uppercase italic opacity-30">No hay ventas registradas</td></tr>
              ) : (
                ventas.map(v => v.items.map((item, idx) => (
                  <tr key={`${v.id}-${idx}`} className="border-b border-white/5">
                    <td className="text-white text-xs">{idx === 0 ? Utils.fmtFecha(v.fecha) : ''}</td>
                    <td className="text-white font-bold text-xs uppercase">{item.nombre}</td>
                    <td className="text-white text-[9px] uppercase"><span className="badge badge-neutral">{v.metodoPago}</span></td>
                    <td className="text-white font-black text-xs mono">{item.cantidad}</td>
                    <td className="text-white font-bold text-xs mono">{Utils.fmtUSD(item.precioUnitUSD)}</td>
                    <td className="text-[#c8952e] font-black text-xs mono">{Utils.fmtUSD(item.subtotalUSD)}</td>
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

function ReporteKardex({ state, selectedId, onSelect }: { state: AppState, selectedId: string | null, onSelect: (id: string) => void }) {
  const products = state.productos.filter(p => p.activo);
  const movs = selectedId ? state.movimientos.filter(m => m.productoId === selectedId).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [];
  const prod = selectedId ? state.productos.find(p => p.id === selectedId) : null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex gap-4 flex-wrap items-center">
        <div className="form-group mb-0 flex-1 min-w-[250px]">
          <label className="text-white text-[10px] font-black uppercase mb-1 block">Seleccionar Producto</label>
          <select className="form-select bg-black text-white" value={selectedId || ''} onChange={e => onSelect(e.target.value)}>
            <option value="">-- Seleccione un producto --</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>)}
          </select>
        </div>
        {prod && (
          <div className="p-3 bg-secondary/30 rounded-lg flex gap-6 border border-white/10">
            <div className="text-center"><p className="text-[10px] text-white font-black uppercase">Stock Actual</p><p className="text-xl font-black text-[#c8952e]">{prod.stock}</p></div>
            <div className="text-center"><p className="text-[10px] text-white font-black uppercase">CPP Actual</p><p className="text-xl font-black text-[#27ae60]">{Utils.fmtUSD(prod.costoUSD)}</p></div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h3 className="text-white font-black uppercase text-xs">Kardex Detallado de Movimientos</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="text-white font-black text-[10px] uppercase">Fecha</th>
                <th className="text-white font-black text-[10px] uppercase">Tipo de Movimiento</th>
                <th className="text-white font-black text-[10px] uppercase">Cant.</th>
                <th className="text-white font-black text-[10px] uppercase">Saldo Antes</th>
                <th className="text-white font-black text-[10px] uppercase">Saldo Después</th>
                <th className="text-white font-black text-[10px] uppercase">Referencia / Detalle</th>
              </tr>
            </thead>
            <tbody>
              {!selectedId ? (
                <tr><td colSpan={6} className="text-center py-20 text-white font-black uppercase italic opacity-30">Seleccione un producto para ver su historial</td></tr>
              ) : movs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-20 text-white font-black uppercase italic opacity-30">No se registran movimientos</td></tr>
              ) : (
                movs.map(m => {
                  const isEntry = m.tipo === 'compra' || m.tipo === 'ajuste_entrada' || m.tipo === 'devolucion';
                  const displayCant = isEntry ? `+${m.cantidad}` : `-${Math.abs(m.cantidad)}`;
                  return (
                    <tr key={m.id} className="border-b border-white/5">
                      <td className="text-white text-[10px]">{m.fecha.replace('T', ' ').slice(0, 16)}</td>
                      <td><span className={`badge ${isEntry ? 'badge-ok' : 'badge-err'} text-[9px] font-black uppercase`}>{m.tipo.replace('_', ' ')}</span></td>
                      <td className={`mono font-black text-sm ${isEntry ? 'text-[#27ae60]' : 'text-[#e04848]'}`}>{displayCant}</td>
                      <td className="mono text-white/40 text-xs">{m.stockAntes}</td>
                      <td className="mono text-white font-black text-xs">{m.stockDespues}</td>
                      <td className="text-[10px] text-white/60 italic">{m.referencia}</td>
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
  const ajustes = state.movimientos.filter(m => 
    ['ajuste_entrada', 'ajuste_salida', 'consumo', 'colaboracion', 'compra'].includes(m.tipo)
  ).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const efectoNetoUSD = ajustes.reduce((acc, m) => {
    const p = state.productos.find(prod => prod.id === m.productoId);
    const costo = p?.costoUSD || 0;
    const esEntrada = m.tipo.includes('entrada') || m.tipo === 'compra' || m.tipo === 'devolucion';
    return acc + (esEntrada ? (m.cantidad * costo) : -(Math.abs(m.cantidad) * costo));
  }, 0);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`kpi ${efectoNetoUSD >= 0 ? 'amber' : 'red'}`}>
          <div className="kpi-icon"><History /></div>
          <div className="text-white text-[10px] font-black uppercase mb-1">Efecto Neto en Inventario ($)</div>
          <div className="text-3xl font-black text-white">{Utils.fmtUSD(efectoNetoUSD)}</div>
          <div className="text-white text-sm font-bold mt-1 italic">{Utils.fmtBS(efectoNetoUSD * state.tasa)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3 className="text-white font-black uppercase text-xs">Historial de Ajustes e Ingresos</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="text-white font-black text-[10px] uppercase">Fecha</th>
                <th className="text-white font-black text-[10px] uppercase">Producto</th>
                <th className="text-white font-black text-[10px] uppercase">Tipo</th>
                <th className="text-white font-black text-[10px] uppercase">Cant.</th>
                <th className="text-white font-black text-[10px] uppercase">Antes</th>
                <th className="text-white font-black text-[10px] uppercase">Después</th>
                <th className="text-white font-black text-[10px] uppercase">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {ajustes.map(m => {
                const p = state.productos.find(prod => prod.id === m.productoId);
                const isEntry = m.tipo.includes('entrada') || m.tipo === 'compra';
                return (
                  <tr key={m.id} className="border-b border-white/5">
                    <td className="text-white text-[10px]">{m.fecha.replace('T', ' ').slice(0, 16)}</td>
                    <td className="text-white font-bold text-xs uppercase">{p?.nombre || 'Producto Eliminado'}</td>
                    <td><span className={`badge ${isEntry ? 'badge-ok' : 'badge-err'} text-[9px] font-black uppercase`}>{m.tipo}</span></td>
                    <td className={`mono font-black text-xs ${isEntry ? 'text-[#27ae60]' : 'text-[#e04848]'}`}>{isEntry ? '+' : '-'}{Math.abs(m.cantidad)}</td>
                    <td className="mono text-white/40 text-xs">{m.stockAntes}</td>
                    <td className="mono text-white font-black text-xs">{m.stockDespues}</td>
                    <td className="text-[10px] text-white/60">{m.referencia}</td>
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
  
  const totalPerdidaUSD = movs.reduce((acc, m) => {
    const p = state.productos.find(prod => prod.id === m.productoId);
    return acc + (Math.abs(m.cantidad) * (p?.costoUSD || 0));
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi amber">
          <div className="kpi-icon"><Gift /></div>
          <div className="text-white text-[10px] font-black uppercase mb-1">Total Colaboraciones</div>
          <div className="text-3xl font-black text-white">{movs.filter(m => m.tipo === 'colaboracion').length}</div>
        </div>
        <div className="kpi red">
          <div className="kpi-icon"><History /></div>
          <div className="text-white text-[10px] font-black uppercase mb-1">Total Consumo Interno</div>
          <div className="text-3xl font-black text-white">{movs.filter(m => m.tipo === 'consumo').length}</div>
        </div>
        <div className="kpi red">
          <div className="kpi-icon"><Trash2 className="text-[#e04848]" /></div>
          <div className="text-white text-[10px] font-black uppercase mb-1">Costo Total (pérdida)</div>
          <div className="text-3xl font-black text-[#e04848]">{Utils.fmtUSD(totalPerdidaUSD)}</div>
          <div className="text-white text-sm font-bold mt-1 italic">{Utils.fmtBS(totalPerdidaUSD * state.tasa)}</div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-head"><h3 className="text-white font-black uppercase text-xs">Detalle de Consumo y Colaboraciones</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="text-white font-black text-[10px] uppercase">Fecha</th>
                <th className="text-white font-black text-[10px] uppercase">Producto</th>
                <th className="text-white font-black text-[10px] uppercase">Tipo</th>
                <th className="text-white font-black text-[10px] uppercase">Cantidad</th>
                <th className="text-white font-black text-[10px] uppercase">Costo Unit.</th>
                <th className="text-white font-black text-[10px] uppercase">Subtotal (Pérdida)</th>
              </tr>
            </thead>
            <tbody>
              {movs.map(m => {
                const p = state.productos.find(prod => prod.id === m.productoId);
                const subPerdida = Math.abs(m.cantidad) * (p?.costoUSD || 0);
                return (
                  <tr key={m.id} className="border-b border-white/5">
                    <td className="text-white text-[10px]">{m.fecha.slice(0, 10)}</td>
                    <td className="text-white font-bold text-xs uppercase">{p?.nombre}</td>
                    <td><span className="badge badge-info text-[9px] font-black uppercase">{m.tipo}</span></td>
                    <td className="text-white font-black text-xs mono">{Math.abs(m.cantidad)}</td>
                    <td className="text-white/40 text-[10px] mono">{Utils.fmtUSD(p?.costoUSD || 0)}</td>
                    <td className="text-[#e04848] font-black text-xs mono">{Utils.fmtUSD(subPerdida)}</td>
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
      cantidad: tipo === 'ajuste_entrada' ? cantidad : -Math.abs(cantidad),
      stockAntes: producto.stock,
      stockDespues: tipo === 'ajuste_entrada' ? producto.stock + cantidad : producto.stock - Math.abs(cantidad),
      fecha: Utils.ahora(),
      referencia: tipo === 'ajuste_entrada' ? `${ref || 'Entrada manual'} - Costo unit: $${nuevoCosto}` : (ref || 'Ajuste manual')
    };
    onSave(mov, tipo === 'ajuste_entrada' ? nuevoCosto : undefined);
  };

  return (
    <div className="modal show">
      <div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-[#1e1e1e] border-2 border-white/10">
        <div className="modal-head px-5 py-3 border-b border-white/10">
          <h3 className="text-white font-black uppercase text-sm">Ajustar Stock: {producto.nombre}</h3>
          <button className="btn-icon" onClick={onClose}><X className="w-4 h-4 text-white" /></button>
        </div>
        <div className="modal-body p-6 space-y-4">
          <div className="p-3 bg-black rounded-lg flex justify-between items-center border border-white/10">
            <span className="text-[10px] text-white font-black uppercase">Stock actual: <strong className="text-white ml-1">{producto.stock}</strong></span>
            <span className="text-[10px] text-white font-black uppercase">CPP actual: <strong className="text-[#c8952e] ml-1">${producto.costoUSD.toFixed(2)}</strong></span>
          </div>
          
          <div className="form-group">
            <label className="text-white text-[10px] font-black uppercase block mb-1">Tipo de Ajuste</label>
            <select className="form-select bg-black text-white" value={tipo} onChange={e => setTipo(e.target.value as any)}>
              <option value="ajuste_entrada">Entrada (+) - Recalcula CPP</option>
              <option value="ajuste_salida">Salida (-)</option>
              <option value="consumo">Consumo Interno (-)</option>
              <option value="colaboracion">Colaboración (-)</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="text-white text-[10px] font-black uppercase block mb-1">Cantidad</label>
              <input type="number" className="form-input bg-black text-white" value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 0)} min="1" />
            </div>
            {tipo === 'ajuste_entrada' && (
              <div className="form-group">
                <label className="text-white text-[10px] font-black uppercase block mb-1">Costo Unitario Compra ($)</label>
                <input type="number" step="0.01" className="form-input bg-black text-white" value={nuevoCosto} onChange={e => setNuevoCosto(parseFloat(e.target.value) || 0)} />
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label className="text-white text-[10px] font-black uppercase block mb-1">Motivo / Referencia</label>
            <textarea className="form-textarea bg-black text-white" placeholder="Ej: Compra a distribuidor, deguste, merma..." value={ref} onChange={e => setRef(e.target.value)}></textarea>
          </div>
        </div>
        <div className="modal-foot px-5 py-3 border-t border-white/10">
          <button className="btn btn-secondary font-black uppercase" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary font-black uppercase" onClick={handleSave}>Aplicar Ajuste</button>
        </div>
      </div>
    </div>
  );
}
