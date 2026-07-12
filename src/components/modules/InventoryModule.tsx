'use client';

import React, { useState, useMemo } from 'react';
import { AppState, Product, Movimiento, KitItem, Supplier } from '@/lib/types';
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
  Box, 
  PlusCircle, 
  MinusCircle, 
  Check, 
  Filter, 
  PackageCheck, 
  AlertCircle,
  Truck,
  Calculator,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
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
  exportarPDFKardex, 
  exportarPDFDevoluciones
} from '@/lib/pdf-generator';

export function InventoryModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [activeTab, setActiveTab] = useState('productos');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [selectedKardexId, setSelectedKardexId] = useState<string | null>(null);
  const [selectedCPPId, setSelectedCPPId] = useState<string | null>(null);
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
            <div className="flex flex-wrap gap-4 flex-1 w-full">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-ink/30" />
                <input className="form-input pl-9 h-11 text-sm font-bold bg-white border-line" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="form-select h-11 bg-white border-line text-xs font-black uppercase w-48" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">Todas las categorías</option>
                {(state.categorias || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="h-11 font-black uppercase text-[10px]" onClick={() => generarPDFInventarioSimple(prods, state.empresa)}>PDF Simple</Button>
              <Button className="h-11 bg-brand-gold hover:bg-brand-gold-deep text-ink font-black uppercase text-[10px] shadow-lg" onClick={() => setShowProducto('nuevo')}><Plus className="w-4 h-4" /> Nuevo Ítem</Button>
            </div>
          </div>

          <Card className="bg-white border-line shadow-xl rounded-xl overflow-hidden">
            <div className="card-head bg-ink border-b border-white/10 px-6 py-4">
               <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2"><Box className="w-5 h-5 text-brand-gold" /> CATÁLOGO MAESTRO</h3>
            </div>
            <div className="table-wrap">
              <Table>
                <TableHeader><TableRow className="bg-surface-soft"><TableHead className="text-ink font-black uppercase text-[10px]">Código</TableHead><TableHead className="text-ink font-black uppercase text-[10px]">Nombre</TableHead><TableHead className="text-ink font-black uppercase text-[10px]">Categoría</TableHead><TableHead className="text-ink font-black uppercase text-[10px] text-right">Costo</TableHead><TableHead className="text-ink font-black uppercase text-[10px] text-right">Venta</TableHead><TableHead className="text-ink font-black uppercase text-[10px] text-center">Stock</TableHead><TableHead className="text-ink font-black uppercase text-[10px] text-center">Acciones</TableHead></TableRow></TableHeader>
                <TableBody className="bg-white">{prods.map(p => (
                  <TableRow key={p.id} className="border-b border-line/30">
                    <TableCell className="mono text-xs font-black text-ink">{p.codigo}</TableCell>
                    <TableCell className="font-bold text-ink uppercase">{p.nombre}</TableCell>
                    <TableCell><span className="badge badge-neutral text-ink font-black uppercase text-[9px]">{p.categoria}</span></TableCell>
                    <TableCell className="mono font-bold text-ink/50 text-right">{Utils.fmtUSD(p.costoUSD)}</TableCell>
                    <TableCell className="mono text-brand-gold-deep font-black text-right">{Utils.fmtUSD(p.precioUSD)}</TableCell>
                    <TableCell className="text-center"><span className={`badge ${p.stock <= (p.stockMinimo || 0) ? 'badge-err' : 'badge-neutral'} font-black text-xs`}>{p.stock}</span></TableCell>
                    <TableCell><div className="flex justify-center gap-1"><button className="btn-icon h-8 w-8 text-ink hover:text-brand-gold" onClick={() => setShowProducto(p.id)}><Edit2 className="w-4 h-4"/></button><button className="btn-icon h-8 w-8 text-ink hover:text-status-info" onClick={() => { setSelectedKardexId(p.id); setActiveTab('kardex'); }}><History className="w-4 h-4"/></button><button className="btn-icon h-8 w-8 text-ink hover:text-status-success" onClick={() => setShowAjuste(p.id)}><Boxes className="w-4 h-4"/></button><button className="btn-icon h-8 w-8 text-ink hover:text-status-danger" onClick={() => eliminar(p.id)}><Trash2 className="w-4 h-4"/></button></div></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          </Card>
        </div>
      );
      case 'reporte_general': return <ReporteGeneral state={state} onAction={(type, id) => { if (type === 'edit') setShowProducto(id); if (type === 'kardex') { setSelectedKardexId(id); setActiveTab('kardex'); } if (type === 'adjust') setShowAjuste(id); if (type === 'cpp') setSelectedCPPId(id); }} />;
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
      <div className="tabs border-line border-b no-print">
        <button onClick={() => setActiveTab('productos')} className={`tab ${activeTab === 'productos' ? 'active' : 'text-ink font-black'}`}>Productos</button>
        <button onClick={() => setActiveTab('reporte_general')} className={`tab ${activeTab === 'reporte_general' ? 'active' : 'text-ink font-black'}`}>Inventario CPP</button>
        <button onClick={() => setActiveTab('reporte_ventas')} className={`tab ${activeTab === 'reporte_ventas' ? 'active' : 'text-ink font-black'}`}>Ventas</button>
        <button onClick={() => setActiveTab('reporte_devoluciones')} className={`tab ${activeTab === 'reporte_devoluciones' ? 'active' : 'text-ink font-black'}`}>Devoluciones</button>
        <button onClick={() => setActiveTab('kardex')} className={`tab ${activeTab === 'kardex' ? 'active' : 'text-ink font-black'}`}>Kardex</button>
        <button onClick={() => setActiveTab('historial_ajustes')} className={`tab ${activeTab === 'historial_ajustes' ? 'active' : 'text-ink font-black'}`}>Ajustes</button>
        <button onClick={() => setActiveTab('consumo_colab')} className={`tab ${activeTab === 'consumo_colab' ? 'active' : 'text-ink font-black'}`}>Consumo / Colab</button>
      </div>

      <div className="animate-in fade-in duration-300">{renderContent()}</div>

      {selectedCPPId && <ModalCPP producto={state.productos.find(p => p.id === selectedCPPId)!} movimientos={state.movimientos.filter(m => m.productoId === selectedCPPId)} onClose={() => setSelectedCPPId(null)} />}
      {showProducto && <ModalProducto state={state} producto={showProducto === 'nuevo' ? undefined : state.productos.find(p => p.id === showProducto)} onClose={() => setShowProducto(null)} onUpdateLists={(lists) => updateState(lists)} onSave={(datos) => { let nuevosProds; if (showProducto === 'nuevo') { const nuevo: Product = { ...datos, id: Store.uid(), fechaCreacion: Utils.hoy(), activo: true }; nuevosProds = [...state.productos, nuevo]; if (nuevo.stock > 0) { const mov: Movimiento = { id: Store.uid(), productoId: nuevo.id, tipo: 'inicial', cantidad: nuevo.stock, stockAntes: 0, stockDespues: nuevo.stock, fecha: Utils.ahora(), referencia: 'INICIAL' }; updateState({ productos: nuevosProds, movimientos: [...state.movimientos, mov] }); } else updateState({ productos: nuevosProds }); } else { nuevosProds = state.productos.map(p => p.id === showProducto ? { ...p, ...datos } : p); updateState({ productos: nuevosProds }); } setShowProducto(null); }} />}
      {showAjuste && <ModalAjuste producto={state.productos.find(p => p.id === showAjuste)!} onClose={() => setShowAjuste(null)} onSave={(mov, nuevoCosto) => { const pOrig = state.productos.find(p => p.id === mov.productoId); if (!pOrig) return; let prodsUpd = [...state.productos]; let movsUpd = [...state.movimientos]; if (pOrig.isKit && pOrig.kitType === 'stock_componentes' && pOrig.kitItems) { pOrig.kitItems.forEach(ki => { const cpIdx = prodsUpd.findIndex(cp => cp.id === ki.productoId); if (cpIdx !== -1) { const cp = { ...prodsUpd[cpIdx] }; const impact = mov.cantidad * ki.cantidad; const before = cp.stock; cp.stock += impact; movsUpd.push({ id: Store.uid(), productoId: cp.id, tipo: mov.tipo, cantidad: impact, stockAntes: before, stockDespues: cp.stock, fecha: mov.fecha, referencia: `${mov.tipo.toUpperCase()} KIT: ${pOrig.nombre}` }); prodsUpd[cpIdx] = cp; } }); } else { prodsUpd = prodsUpd.map(p => { if (p.id === mov.productoId) { let fCosto = p.costoUSD; if (mov.tipo === 'ajuste_entrada' || mov.tipo === 'compra') { const sTot = p.stock + Math.abs(mov.cantidad); if (sTot > 0) fCosto = Utils.round(((p.stock * p.costoUSD) + (Math.abs(mov.cantidad) * (nuevoCosto || p.costoUSD))) / sTot); } return { ...p, stock: mov.stockDespues, costoUSD: fCosto }; } return p; }); movsUpd.push(mov); } updateState({ productos: prodsUpd, movimientos: movsUpd }); setShowAjuste(null); }} />}
    </div>
  );
}

function ReporteGeneral({ state, onAction }: { state: AppState, onAction: (type: string, id: string) => void }) {
  const [provFilter, setProvFilter] = useState('');
  const safeProv = useMemo(() => (state.proveedores || []).map(p => typeof p === 'string' ? { id: p, nombre: p } : p), [state.proveedores]);
  const fProds = state.productos.filter(p => p.activo && (provFilter ? p.proveedor === provFilter : true));
  const tCosto = Utils.round(fProds.reduce((a, p) => a + (p.costoUSD * p.stock), 0));
  const tVenta = Utils.round(fProds.reduce((a, p) => a + (p.precioUSD * p.stock), 0));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end bg-white p-5 rounded-xl border border-line shadow-sm no-print">
        <div className="form-group mb-0">
          <label className="text-ink text-[10px] font-black uppercase block mb-1.5 opacity-70">Filtrar por Proveedor</label>
          <div className="relative"><Truck className="absolute left-3 top-2.5 w-4 h-4 text-brand-gold opacity-50" /><select className="form-select pl-10 h-10 bg-surface-soft border-line text-ink font-bold text-sm rounded-lg" value={provFilter} onChange={e => setProvFilter(e.target.value)}><option value="">TODOS</option>{safeProv.map(p => (<option key={p.id} value={p.nombre}>{p.nombre?.toUpperCase()}</option>))}</select></div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="kpi p-6 border-line bg-white shadow-md rounded-2xl"><div className="text-[10px] font-black uppercase text-ink opacity-60">Valor Costo (CPP)</div><div className="text-3xl font-black">{Utils.fmtUSD(tCosto)}</div></div><div className="kpi p-6 border-line bg-white shadow-md rounded-2xl"><div className="text-[10px] font-black uppercase text-ink opacity-60">Valor Venta</div><div className="text-3xl font-black text-status-success">{Utils.fmtUSD(tVenta)}</div></div></div>
      <Card className="shadow-lg border-line rounded-xl overflow-hidden bg-white"><div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center"><h3 className="text-white font-black text-xs uppercase italic flex items-center gap-2"><Boxes className="w-5 h-5 text-brand-gold" /> INVENTARIO VALORIZADO</h3><button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px]" onClick={() => exportarPDFInventarioGeneral(fProds, state.empresa, 'categoria', { costo: tCosto, venta: tVenta })}>PDF PROFESIONAL</button></div><div className="table-wrap"><Table><TableHeader><TableRow className="bg-surface-soft"><TableHead className="font-black text-ink uppercase text-[10px]">Producto</TableHead><TableHead className="font-black text-ink uppercase text-[10px] text-right">Costo</TableHead><TableHead className="font-black text-ink uppercase text-[10px] text-right">Venta</TableHead><TableHead className="font-black text-ink uppercase text-[10px] text-center">Stock</TableHead><TableHead className="font-black text-ink uppercase text-[10px] text-right">Subtotal</TableHead><TableHead className="font-black text-ink uppercase text-[10px] text-center">Acciones</TableHead></TableRow></TableHeader><TableBody>{fProds.map(p => (<TableRow key={p.id} className="border-b border-line/30"><TableCell className="font-black uppercase text-xs text-ink">{p.nombre}</TableCell><TableCell className="mono text-right text-xs text-ink/60">{Utils.fmtUSD(p.costoUSD)}</TableCell><TableCell className="mono text-right text-brand-gold-deep font-black">{Utils.fmtUSD(p.precioUSD)}</TableCell><TableCell className="text-center"><span className="badge badge-neutral font-black">{p.stock}</span></TableCell><TableCell className="mono text-right font-black text-ink">{Utils.fmtUSD(p.costoUSD * p.stock)}</TableCell><TableCell><div className="flex justify-center gap-1"><button className="btn-icon text-ink" onClick={() => onAction('edit', p.id)}><Edit2 className="w-4 h-4"/></button><button className="btn-icon text-ink" onClick={() => onAction('kardex', p.id)}><History className="w-4 h-4"/></button><button className="btn-icon text-ink" onClick={() => onAction('adjust', p.id)}><Boxes className="w-4 h-4"/></button><button className="btn-icon text-blue-600" onClick={() => onAction('cpp', p.id)}><Calculator className="w-4 h-4"/></button></div></TableCell></TableRow>))}</TableBody></Table></div></Card>
    </div>
  );
}

function ModalCPP({ producto, movimientos, onClose }: { producto: Product, movimientos: Movimiento[], onClose: () => void }) {
  const compras = movimientos.filter(m => m.tipo === 'compra' || m.tipo === 'ajuste_entrada').sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
  const fmt4 = (v: number) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return (
    <div className="modal show"><div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-white max-w-sm border-none rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="modal-head py-3 px-5 border-none bg-black flex justify-between items-center rounded-t-xl">
          <div className="flex items-center gap-2 text-white"><Calculator className="w-4 h-4" /><h3 className="font-bold text-xs uppercase tracking-wider">Detalle de Costo - CPP</h3></div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="text-center"><h4 className="font-bold text-base text-gray-900 mb-0.5">{producto.nombre}</h4><p className="text-[9px] font-black text-gray-400">{producto.codigo}</p></div>
          <div className="bg-gray-50 rounded-lg p-3 flex justify-between items-center"><span className="text-[10px] font-bold text-gray-500 uppercase">COSTO ACTUAL (PONDERADO)</span><span className="text-[#2563EB] font-mono font-black text-lg">{fmt4(producto.costoUSD)}</span></div>
          <div className="space-y-3"><h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1.5">HISTORIAL DE COSTOS (ÚLTIMAS COMPRAS)</h5><div className="max-h-[220px] overflow-y-auto space-y-3 pr-1">
            {compras.length === 0 ? <div className="py-8 text-center text-gray-300 text-[10px]">Sin historial de compras</div> : compras.map((m, idx) => (
              <div key={m.id} className="space-y-1.5"><div className="flex justify-between items-baseline text-[10px] font-bold text-gray-600"><span>{Utils.fmtFecha(m.fecha)}</span><span className="font-mono">{fmt4(producto.costoUSD)}</span><span className="text-gray-400">x{Math.abs(m.cantidad)} uds</span></div></div>
            ))}
          </div></div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center"><p className="text-[7px] font-bold text-amber-700 uppercase">El costo actual se calcula mediante Promedio Ponderado (CPP)</p><p className="text-[7px] font-medium text-amber-600 italic">Fórmula: ((Stock Ant × Costo Ant) + (Cantidad Nueva × Costo Nuevo)) / Stock Total</p></div>
        </div>
        <div className="p-2.5 bg-gray-50 border-t border-gray-100 flex justify-end"><button onClick={onClose} className="px-5 py-2 text-[10px] font-black uppercase text-gray-500 hover:text-gray-900">Cerrar</button></div>
      </div>
    </div>
  );
}

function ReporteVentas({ state }: { state: AppState }) {
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());
  const gVentas = useMemo(() => {
    const groups: any = {};
    state.ventas.filter(v => v.fecha.slice(0, 10) >= desde && v.fecha.slice(0, 10) <= hasta).forEach(v => {
      v.items.forEach(it => { if (!groups[it.productoId]) groups[it.productoId] = { n: it.nombre, q: 0, t: 0 }; groups[it.productoId].q += it.cantidad; groups[it.productoId].t += it.subtotalUSD; });
    });
    return Object.values(groups).sort((a: any, b: any) => b.q - a.q);
  }, [state.ventas, desde, hasta]);
  return (
    <div className="space-y-4">
      <div className="flex gap-4 p-5 bg-white border border-line rounded-xl shadow-sm"><input type="date" className="form-input w-40" value={desde} onChange={e => setDesde(e.target.value)} /><input type="date" className="form-input w-40" value={hasta} onChange={e => setHasta(e.target.value)} /></div>
      <Card className="bg-white shadow-lg rounded-xl overflow-hidden"><div className="table-wrap"><Table><TableHeader className="bg-surface-soft"><TableRow><TableHead className="font-black uppercase text-[10px]">Producto</TableHead><TableHead className="text-center font-black uppercase text-[10px]">Cant</TableHead><TableHead className="text-right font-black uppercase text-[10px]">Total USD</TableHead></TableRow></TableHeader><TableBody>{gVentas.map((g: any, i: number) => (<TableRow key={i} className="border-b border-line/30"><TableCell className="font-black uppercase text-xs">{g.n}</TableCell><TableCell className="text-center font-black">{g.q}</TableCell><TableCell className="text-right font-black text-brand-gold-deep">{Utils.fmtUSD(g.t)}</TableCell></TableRow>))}</TableBody></Table></div></Card>
    </div>
  );
}

function ReporteDevoluciones({ state }: { state: AppState }) {
  return (
    <Card className="shadow-lg border-line rounded-xl overflow-hidden bg-white"><div className="table-wrap"><Table><TableHeader className="bg-surface-soft"><TableRow><TableHead className="text-[10px] font-black uppercase">Fecha</TableHead><TableHead className="text-[10px] font-black uppercase">Venta</TableHead><TableHead className="text-[10px] font-black uppercase text-right">Total</TableHead><TableHead className="text-[10px] font-black uppercase">Motivo</TableHead></TableRow></TableHeader><TableBody>{state.devoluciones.map(d => (<TableRow key={d.id} className="border-b border-line/30"><TableCell className="text-xs font-bold">{Utils.fmtFecha(d.fecha)}</TableCell><TableCell className="text-xs font-black mono">{d.ventaId}</TableCell><TableCell className="text-right font-black text-status-danger">{Utils.fmtUSD(d.totalUSD)}</TableCell><TableCell className="text-xs italic uppercase opacity-60">{d.motivo}</TableCell></TableRow>))}</TableBody></Table></div></Card>
  );
}

function HistorialAjustes({ state }: { state: AppState }) {
  const ajustes = state.movimientos.filter(m => ['ajuste_entrada', 'ajuste_salida', 'consumo', 'colaboracion'].includes(m.tipo)).sort((a,b) => b.fecha.localeCompare(a.fecha));
  const effNeto = ajustes.reduce((acc, m) => { const p = state.productos.find(x => x.id === m.productoId); return acc + (m.cantidad * (p?.costoUSD || 0)); }, 0);
  return (
    <div className="space-y-6">
      <div className={`kpi p-6 rounded-2xl shadow-sm border-l-[6px] ${effNeto < 0 ? 'bg-status-danger-soft border-l-status-danger' : 'bg-status-success-soft border-l-status-success'}`}><p className="text-[10px] font-black uppercase opacity-40">Efecto Neto en Inventario</p><p className={`text-2xl font-black ${effNeto < 0 ? 'text-status-danger' : 'text-status-success'}`}>{effNeto < 0 ? '' : '+'}{Utils.fmtUSD(effNeto)}</p></div>
      <Card className="shadow-lg border-line rounded-xl overflow-hidden bg-white"><div className="table-wrap"><Table><TableHeader className="bg-surface-soft"><TableRow><TableHead className="font-black uppercase text-[10px]">Fecha</TableHead><TableHead className="font-black uppercase text-[10px]">Producto</TableHead><TableHead className="font-black uppercase text-[10px]">Tipo</TableHead><TableHead className="font-black uppercase text-[10px] text-center">Cant</TableHead><TableHead className="font-black uppercase text-[10px]">Motivo</TableHead></TableRow></TableHeader><TableBody>{ajustes.map(m => { const p = state.productos.find(x => x.id === m.productoId); return (<TableRow key={m.id} className="border-b border-line/30"><TableCell className="text-xs font-bold">{m.fecha.slice(0, 16).replace('T', ' ')}</TableCell><TableCell className="font-black uppercase text-xs">{p?.nombre}</TableCell><TableCell><span className="badge badge-neutral text-[9px] font-black uppercase">{m.tipo.replace('_', ' ')}</span></TableCell><TableCell className={`text-center font-black ${m.cantidad > 0 ? 'text-status-success' : 'text-status-danger'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</TableCell><TableCell className="text-[10px] opacity-60 uppercase">{m.referencia}</TableCell></TableRow>); })}</TableBody></Table></div></Card>
    </div>
  );
}

function ReporteConsumo({ state }: { state: AppState }) {
  const movs = state.movimientos.filter(m => ['consumo', 'colaboracion'].includes(m.tipo)).sort((a,b) => b.fecha.localeCompare(a.fecha));
  const tPerdida = movs.reduce((a, m) => { const p = state.productos.find(x => x.id === m.productoId); return a + (Math.abs(m.cantidad) * (p?.costoUSD || 0)); }, 0);
  return (
    <div className="space-y-6">
      <div className="kpi bg-status-danger-soft border-l-[6px] border-l-status-danger p-6 rounded-2xl"><p className="text-[10px] font-black uppercase text-status-danger">Total Pérdida por Consumo</p><p className="text-2xl font-black text-status-danger">{Utils.fmtUSD(tPerdida)}</p></div>
      <Card className="shadow-lg rounded-xl overflow-hidden bg-white"><div className="table-wrap"><Table><TableHeader className="bg-surface-soft"><TableRow><TableHead className="font-black text-[10px] uppercase">Fecha</TableHead><TableHead className="font-black text-[10px] uppercase">Producto</TableHead><TableHead className="font-black text-[10px] uppercase">Tipo</TableHead><TableHead className="font-black text-[10px] uppercase text-right">P. Costo</TableHead><TableHead className="font-black text-[10px] uppercase text-center">Cant</TableHead><TableHead className="font-black text-[10px] uppercase text-right">Total</TableHead></TableRow></TableHeader><TableBody>{movs.map(m => { const p = state.productos.find(x => x.id === m.productoId); const c = p?.costoUSD || 0; return (<TableRow key={m.id} className="border-b border-line/30"><TableCell className="text-xs font-bold">{m.fecha.slice(0, 10)}</TableCell><TableCell className="font-black uppercase text-xs">{p?.nombre}</TableCell><TableCell><span className="badge badge-neutral font-black text-[9px] uppercase">{m.tipo}</span></TableCell><TableCell className="text-right mono text-xs">{Utils.fmtUSD(c)}</TableCell><TableCell className="text-center font-black text-status-danger">{Math.abs(m.cantidad)}</TableCell><TableCell className="text-right mono font-black text-status-danger">{Utils.fmtUSD(Math.abs(m.cantidad) * c)}</TableCell></TableRow>); })}</TableBody></Table></div></Card>
    </div>
  );
}

function ReporteKardex({ state, selectedId, onSelect }: { state: AppState, selectedId: string | null, onSelect: (id: string) => void }) {
  const [s, setS] = useState('');
  const matches = useMemo(() => s.length < 2 ? [] : state.productos.filter(p => p.activo && (p.nombre.toLowerCase().includes(s.toLowerCase()) || p.codigo.includes(s))).slice(0, 5), [s, state.productos]);
  const p = selectedId ? state.productos.find(x => x.id === selectedId) : null;
  const ms = selectedId ? state.movimientos.filter(m => m.productoId === selectedId).sort((a,b) => b.fecha.localeCompare(a.fecha)) : [];
  return (
    <div className="space-y-4">
      <Card className="p-5 bg-white border-line shadow-sm"><label className="text-[10px] font-black uppercase opacity-40 block mb-2">Buscar producto para ver Kardex</label><div className="relative"><input value={s} onChange={e => setS(e.target.value)} placeholder="Nombre o código..." className="form-input h-12" />{matches.length > 0 && (<div className="absolute top-full left-0 right-0 bg-white border border-line shadow-2xl z-50 mt-1 rounded-xl overflow-hidden">{matches.map(x => (<div key={x.id} className="p-4 border-b hover:bg-brand-gold-soft cursor-pointer" onClick={() => { onSelect(x.id); setS(''); }}><p className="font-black uppercase text-xs">{x.nombre}</p></div>))}</div>)}</div></Card>
      {p && (<Card className="overflow-hidden shadow-lg bg-white"><div className="card-head bg-ink text-white px-6 py-3 flex justify-between items-center"><h3 className="font-black text-xs uppercase text-brand-gold">{p.nombre}</h3><button className="btn btn-secondary h-8 px-4 font-black uppercase text-[9px]" onClick={() => exportarPDFKardex(p, ms, state.empresa)}>PDF</button></div><div className="table-wrap"><Table><TableHeader className="bg-surface-soft"><TableRow><TableHead className="font-black uppercase text-[10px]">Fecha</TableHead><TableHead className="font-black uppercase text-[10px]">Tipo</TableHead><TableHead className="font-black uppercase text-[10px] text-center">Cant</TableHead><TableHead className="font-black uppercase text-[10px] text-center">Stock</TableHead></TableRow></TableHeader><TableBody>{ms.map(m => (<TableRow key={m.id} className="border-b border-line/30"><TableCell className="text-xs font-bold">{m.fecha.replace('T', ' ')}</TableCell><TableCell><span className="badge badge-neutral text-[9px] uppercase">{m.tipo}</span></TableCell><TableCell className={`text-center font-black ${m.cantidad > 0 ? 'text-status-success' : 'text-status-danger'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</TableCell><TableCell className="text-center font-bold">{m.stockDespues}</TableCell></TableRow>))}</TableBody></Table></div></Card>)}
    </div>
  );
}

function ModalAjuste({ producto, onClose, onSave }: { producto: Product, onClose: () => void, onSave: (m: Movimiento, nuevoCosto?: number) => void }) {
  const [t, setT] = useState<'ajuste_entrada' | 'ajuste_salida' | 'consumo' | 'colaboracion'>('ajuste_entrada');
  const [q, setQ] = useState('1');
  const [m, setM] = useState('');
  return (
    <div className="modal show"><div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-white max-w-md border-2 border-line rounded-xl overflow-hidden shadow-2xl">
        <div className="modal-head px-5 py-4 border-b border-line bg-surface-soft"><h3 className="text-ink font-black uppercase text-sm">AJUSTAR: {producto.nombre}</h3><button onClick={onClose}><X className="w-5 h-5"/></button></div>
        <div className="modal-body p-6 space-y-4 bg-white"><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black uppercase opacity-60">Tipo</label><select className="form-select h-10" value={t} onChange={e => setT(e.target.value as any)}><option value="ajuste_entrada">Entrada (+)</option><option value="ajuste_salida">Salida (-)</option><option value="consumo">Consumo</option><option value="colaboracion">Colab</option></select></div><div><label className="text-[10px] font-black uppercase opacity-60">Cant</label><input className="form-input h-10" value={q} onChange={e => setQ(e.target.value)} /></div></div><div><label className="text-[10px] font-black uppercase opacity-60">Motivo</label><input className="form-input h-10 uppercase" value={m} onChange={e => setM(e.target.value)} /></div><Button className="w-full h-12" onClick={() => onSave({ id: Store.uid(), productoId: producto.id, tipo: t, cantidad: (t === 'ajuste_entrada') ? parseFloat(q) : -Math.abs(parseFloat(q)), stockAntes: producto.stock, stockDespues: producto.stock + ((t === 'ajuste_entrada') ? parseFloat(q) : -Math.abs(parseFloat(q))), fecha: Utils.ahora(), referencia: m.toUpperCase() })}>PROCESAR</Button></div>
      </div>
    </div>
  );
}

function ModalProducto({ producto, state, onClose, onSave, onUpdateLists }: { producto?: Product, state: AppState, onClose: () => void, onSave: (p: any) => void, onUpdateLists: (l: any) => void }) {
  const [d, setD] = useState<any>({ codigo: producto?.codigo || '', nombre: producto?.nombre || '', categoria: producto?.categoria || state.categorias[0] || '', costoUSD: producto?.costoUSD?.toString() || '0', precioUSD: producto?.precioUSD?.toString() || '0', stock: producto?.stock?.toString() || '0', stockMinimo: producto?.stockMinimo?.toString() || '5', activo: true });
  return (
    <div className="modal show"><div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-white max-w-lg border-2 border-line rounded-xl overflow-hidden shadow-2xl">
        <div className="modal-head py-4 px-6 bg-ink flex justify-between text-white"><h3 className="font-black uppercase text-sm">{producto ? 'EDITAR' : 'NUEVO'} PRODUCTO</h3><button onClick={onClose}><X className="w-5 h-5"/></button></div>
        <div className="modal-body p-6 space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black uppercase opacity-50">Código</label><input className="form-input" value={d.codigo} onChange={e => setD({...d, codigo: e.target.value})} /></div><div><label className="text-[10px] font-black uppercase opacity-50">Nombre</label><input className="form-input" value={d.nombre} onChange={e => setD({...d, nombre: e.target.value})} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black uppercase opacity-50">Costo</label><input className="form-input" value={d.costoUSD} onChange={e => setD({...d, costoUSD: e.target.value})} /></div><div><label className="text-[10px] font-black uppercase opacity-50">Precio</label><input className="form-input" value={d.precioUSD} onChange={e => setD({...d, precioUSD: e.target.value})} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black uppercase opacity-50">Stock</label><input className="form-input" value={d.stock} onChange={e => setD({...d, stock: e.target.value})} disabled={!!producto}/></div><div><label className="text-[10px] font-black uppercase opacity-50">Min</label><input className="form-input" value={d.stockMinimo} onChange={e => setD({...d, stockMinimo: e.target.value})} /></div></div><Button className="w-full h-12 bg-brand-gold text-ink" onClick={() => onSave({ ...d, costoUSD: parseFloat(d.costoUSD), precioUSD: parseFloat(d.precioUSD), stock: parseFloat(d.stock), stockMinimo: parseFloat(d.stockMinimo) })}>GUARDAR</Button></div>
      </div>
    </div>
  );
}
