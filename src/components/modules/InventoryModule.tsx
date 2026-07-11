import React, { useState, useMemo, useEffect } from 'react';
import { Package, Plus, Search, Filter, Pencil, Trash2, AlertCircle, FileText, Boxes, RotateCcw, TrendingUp, History, Box, ClipboardList, Info, Check, X, PlusCircle, MinusCircle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { AppState, Product, Movimiento, KitItem } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  generarPDFInventarioSimple, 
  exportarPDFVentasDetallado, 
  exportarPDFInventarioGeneral, 
  exportarPDFKardex, 
  exportarPDFHistorialAjustes, 
  exportarPDFConsumoInterno, 
  exportarPDFDevoluciones 
} from '@/lib/pdf-generator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface InventoryModuleProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
}

export function InventoryModule({ state, updateState }: InventoryModuleProps) {
  const [activeTab, setActiveTab] = useState('inventory');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKardexId, setSelectedKardexId] = useState<string | null>(null);
  const [showAjusteModal, setShowAjusteModal] = useState<string | null>(null);

  const filteredProducts = (state.productos || []).filter(p =>
    p.activo && (
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const lowStockCount = (state.productos || []).filter(p => p.activo && (p.stock || 0) <= (p.stockMinimo || 0)).length;

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar este producto?')) {
      const updated = state.productos.map(p => p.id === id ? { ...p, activo: false } : p);
      updateState({ productos: updated });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-brand-gold" />
          <h2 className="text-2xl font-bold">Control de Inventario</h2>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => generarPDFInventarioSimple(state.productos.filter(p => p.activo), state.empresa)}
            className="gap-2"
          >
            <FileText className="w-4 h-4" /> Exportar PDF
          </Button>
          <Button 
            onClick={() => {
              setSelectedProduct(undefined);
              setIsModalOpen(true);
            }}
            className="bg-brand-gold text-black hover:bg-brand-gold/90 gap-2 font-bold"
          >
            <Plus className="w-4 h-4" /> Nuevo Producto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-brand-gold/10 rounded-xl">
                <Package className="w-6 h-6 text-brand-gold" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Productos</p>
                <p className="text-2xl font-bold">{state.productos.filter(p => p.activo).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Stock Bajo</p>
                <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 border-b border-line overflow-x-auto no-print">
        <button onClick={() => setActiveTab('inventory')} className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}>Inventario</button>
        <button onClick={() => setActiveTab('sales')} className={`tab ${activeTab === 'sales' ? 'active' : ''}`}>Resumen Ventas</button>
        <button onClick={() => setActiveTab('reporte_general')} className={`tab ${activeTab === 'reporte_general' ? 'active' : ''}`}>Valorizado CPP</button>
        <button onClick={() => setActiveTab('reporte_devoluciones')} className={`tab ${activeTab === 'reporte_devoluciones' ? 'active' : ''}`}>Devoluciones</button>
        <button onClick={() => setActiveTab('kardex')} className={`tab ${activeTab === 'kardex' ? 'active' : ''}`}>Kardex</button>
        <button onClick={() => setActiveTab('historial_ajustes')} className={`tab ${activeTab === 'historial_ajustes' ? 'active' : ''}`}>Ajustes</button>
        <button onClick={() => setActiveTab('consumo_colab')} className={`tab ${activeTab === 'consumo_colab' ? 'active' : ''}`}>Consumo</button>
      </div>

      {activeTab === 'inventory' && (
        <>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input placeholder="Buscar por nombre o código..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Producto</TableHead><TableHead>Categoría</TableHead><TableHead>Precio USD</TableHead><TableHead>Stock</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => (
                    <TableRow key={p.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-xs font-bold text-brand-gold-deep">{p.codigo || 'N/A'}</TableCell>
                      <TableCell className="font-semibold">{p.nombre}</TableCell>
                      <TableCell>{p.categoria}</TableCell>
                      <TableCell className="font-bold text-brand-gold-deep">{Utils.fmtUSD(p.precioUSD)}</TableCell>
                      <TableCell>{p.stock}</TableCell>
                      <TableCell><Badge variant={p.stock <= p.stockMinimo ? "destructive" : "secondary"}>{p.stock <= p.stockMinimo ? "Bajo Stock" : "Disponible"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedProduct(p); setIsModalOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-green-600" onClick={() => setShowAjusteModal(p.id)}><PlusCircle className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'sales' && <ReporteVentas state={state} />}
      {activeTab === 'reporte_general' && <ReporteGeneral state={state} />}
      {activeTab === 'reporte_devoluciones' && <ReporteDevoluciones state={state} />}
      {activeTab === 'kardex' && <ReporteKardex state={state} selectedId={selectedKardexId} onSelect={setSelectedKardexId} />}
      {activeTab === 'historial_ajustes' && <HistorialAjustes state={state} />}
      {activeTab === 'consumo_colab' && <ReporteConsumo state={state} />}

      <ProductFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} product={selectedProduct} onSave={() => {}} state={state} updateState={updateState} />

      {showAjusteModal && (
        <ModalAjuste 
          producto={state.productos.find(p => p.id === showAjusteModal)!} 
          onClose={() => setShowAjusteModal(null)}
          onSave={(mov, nuevoCosto) => {
            const nuevosProds = state.productos.map(p => {
              if (p.id === mov.productoId) {
                let finalCosto = p.costoUSD;
                if (mov.tipo === 'ajuste_entrada' || (mov.tipo as string) === 'compra') {
                  const stockActual = p.stock;
                  const cantidadNueva = mov.cantidad;
                  const costoNuevo = nuevoCosto || p.costoUSD;
                  const stockTotal = stockActual + cantidadNueva;
                  if (stockTotal > 0) finalCosto = Utils.round(((stockActual * p.costoUSD) + (cantidadNueva * costoNuevo)) / stockTotal);
                }
                return { ...p, stock: mov.stockDespues, costoUSD: finalCosto };
              }
              return p;
            });
            updateState({ productos: nuevosProds, movimientos: [...state.movimientos, mov] });
            setShowAjusteModal(null);
          }}
        />
      )}
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
        if (!groups[item.nombre]) {
          groups[item.nombre] = { nombre: item.nombre, cantidad: 0, totalUSD: 0 };
        }
        groups[item.nombre].cantidad += item.cantidad;
        groups[item.nombre].totalUSD += item.subtotalUSD;
      });
    });
    return Object.values(groups).sort((a, b) => b.cantidad - a.cantidad);
  }, [filteredVentas]);

  const handleExport = () => {
    const summaryVentas = [{
      id: 'RESUMEN',
      fecha: useDates ? `${desde} al ${hasta}` : Utils.hoy(),
      metodoPago: 'VARIOS',
      items: groupedVentas.map(g => ({
        nombre: g.nombre,
        cantidad: g.cantidad,
        precioUnitUSD: g.totalUSD / (g.cantidad || 1),
        subtotalUSD: g.totalUSD
      }))
    }];
    exportarPDFVentasDetallado(summaryVentas, state.empresa, useDates ? `${desde} al ${hasta}` : 'Hoy', {});
  };

  return (
    <div className="space-y-4">
      <div className="card p-5 bg-white border-line flex flex-wrap gap-4 items-end shadow-sm">
        <div className="flex gap-2 bg-surface-soft p-1 rounded-lg">
           <button onClick={() => setUseDates(false)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase ${!useDates ? 'bg-ink text-white' : 'text-ink/40'}`}>Hoy</button>
           <button onClick={() => setUseDates(true)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase ${useDates ? 'bg-brand-gold text-white' : 'text-ink/40'}`}>Periodo</button>
        </div>
        {useDates && (
          <div className="flex items-center gap-2">
            <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={desde} onChange={e => setDesde(e.target.value)} />
            <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
        )}
        <div className="flex-1 flex justify-end">
          <button className="btn btn-secondary h-10 px-6 border-line text-ink font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-surface-soft" onClick={handleExport}>
            <FileText className="w-4 h-4" /> Exportar Resumen
          </button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Producto / Item</TableHead><TableHead className="text-center">Cant. Vendida</TableHead><TableHead className="text-right">Total Recaudado (USD)</TableHead></TableRow></TableHeader>
            <TableBody>
              {groupedVentas.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20 text-ink/20 font-black italic uppercase">Sin ventas en este periodo</TableCell></TableRow>
              ) : (
                groupedVentas.map((item, idx) => (
                  <TableRow key={idx} className="border-b border-line/30">
                    <TableCell className="font-black uppercase text-xs text-ink">{item.nombre}</TableCell>
                    <TableCell className="font-black mono text-ink text-center">{item.cantidad}</TableCell>
                    <TableCell className="mono font-black text-brand-gold-deep text-right">{Utils.fmtUSD(item.totalUSD)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function ReporteGeneral({ state }: { state: AppState }) {
  const [groupBy, setGroupBy] = useState<'categoria' | 'departamento' | 'proveedor'>('categoria');
  const [filterValue, setFilterValue] = useState<string>('');
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());
  const [useDates, setUseDates] = useState(false);

  const filteredProducts = state.productos.filter(p => {
    const matchesGroup = (filterValue === '' || ((p[groupBy] as any) || 'Sin asignar') === filterValue);
    const date = p.fechaCreacion ? p.fechaCreacion.slice(0, 10) : '';
    const matchesDate = !useDates || (date >= desde && date <= hasta);
    return p.activo && matchesGroup && matchesDate;
  });

  const totalCosto = Utils.round(filteredProducts.reduce((acc, p) => acc + (p.costoUSD * p.stock), 0));
  const totalVenta = Utils.round(filteredProducts.reduce((acc, p) => acc + (p.precioUSD * p.stock), 0));

  return (
    <div className="space-y-6">
      <div className="card p-5 bg-white border-line flex flex-wrap gap-4 items-end shadow-sm no-print">
        <div className="flex gap-2 bg-surface-soft p-1 rounded-lg">
           <button onClick={() => setUseDates(false)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase ${!useDates ? 'bg-ink text-white' : 'text-ink/40'}`}>Actual</button>
           <button onClick={() => setUseDates(true)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase ${useDates ? 'bg-brand-gold text-white' : 'text-ink/40'}`}>Por Periodo</button>
        </div>
        {useDates && (
          <div className="flex items-center gap-2">
            <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={desde} onChange={e => setDesde(e.target.value)} />
            <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
        )}
        <div className="flex-1 flex justify-end">
          <button className="btn btn-secondary h-10 px-6 border-line text-ink font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-surface-soft" onClick={() => exportarPDFInventarioGeneral(filteredProducts, state.empresa, groupBy, { costo: totalCosto, venta: totalVenta })}>
            <FileText className="w-4 h-4" /> Exportar PDF
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="kpi bg-white border-line p-6 shadow-md rounded-xl"><p className="text-[10px] font-black uppercase mb-1 opacity-60">Valor al Costo (CPP Total)</p><p className="text-3xl font-black">{Utils.fmtUSD(totalCosto)}</p></div>
        <div className="kpi bg-white border-line p-6 shadow-md rounded-xl"><p className="text-[10px] font-black uppercase mb-1 opacity-60">Valor Venta Proyectado</p><p className="text-3xl font-black text-status-success">{Utils.fmtUSD(totalVenta)}</p></div>
      </div>
      <Card className="overflow-hidden"><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Cod.</TableHead><TableHead>Producto</TableHead><TableHead className="text-right">Costo Unit.</TableHead><TableHead className="text-right">Venta Unit.</TableHead><TableHead className="text-center">Stock</TableHead><TableHead className="text-right">Subtotal Costo</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredProducts.map(p => (
              <TableRow key={p.id} className="border-b border-line/30 hover:bg-gray-50">
                <TableCell className="mono text-[11px] font-black">{p.codigo}</TableCell>
                <TableCell className="font-black uppercase text-xs">{p.nombre}</TableCell>
                <TableCell className="mono text-right text-xs">{Utils.fmtUSD(p.costoUSD)}</TableCell>
                <TableCell className="mono text-right text-brand-gold-deep font-black">{Utils.fmtUSD(p.precioUSD)}</TableCell>
                <TableCell className="text-center"><Badge variant="secondary">{p.stock}</Badge></TableCell>
                <TableCell className="mono text-right font-black">{Utils.fmtUSD(p.costoUSD * p.stock)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div></Card>
    </div>
  );
}

function ReporteDevoluciones({ state }: { state: AppState }) {
  const devoluciones = state.devoluciones || [];
  const totalUSD = devoluciones.reduce((acc, d) => acc + d.totalUSD, 0);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden"><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>ID</TableHead><TableHead>Items</TableHead><TableHead className="text-center">Cant.</TableHead><TableHead className="text-right">Total $</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
          <TableBody>
            {devoluciones.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-20 text-ink/20 font-black italic uppercase">Sin devoluciones</TableCell></TableRow>
            ) : (
              devoluciones.map(d => (
                <TableRow key={d.id} className="border-b border-line/30">
                  <TableCell className="text-xs">{Utils.fmtFecha(d.fecha)}</TableCell>
                  <TableCell className="text-ink font-black mono text-xs">{d.id}</TableCell>
                  <TableCell className="py-2"><div className="space-y-0.5">{d.items.map((it, idx) => (<p key={idx} className="text-[9px] font-black uppercase text-ink/70">• {it.nombre}</p>))}</div></TableCell>
                  <TableCell className="text-center font-black">{d.items.reduce((s, i) => s + i.cantidad, 0)}</TableCell>
                  <TableCell className="mono text-right font-black text-status-danger">{Utils.fmtUSD(d.totalUSD)}</TableCell>
                  <TableCell className="text-xs uppercase italic opacity-60">{d.motivo}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div></Card>
    </div>
  );
}

function HistorialAjustes({ state }: { state: AppState }) {
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());
  const [useDates, setUseDates] = useState(false);

  const ajustes = state.movimientos.filter(m => 
    ['ajuste_entrada', 'ajuste_salida', 'consumo', 'colaboracion', 'compra'].includes(m.tipo) && 
    m.referencia !== 'INICIAL' &&
    (!useDates || (m.fecha.slice(0, 10) >= desde && m.fecha.slice(0, 10) <= hasta))
  ).sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="space-y-4">
      <div className="card p-5 bg-white border-line flex flex-wrap gap-4 items-end shadow-sm">
        <div className="flex gap-2 bg-surface-soft p-1 rounded-lg">
           <button onClick={() => setUseDates(false)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase ${!useDates ? 'bg-ink text-white' : 'text-ink/40'}`}>Todo</button>
           <button onClick={() => setUseDates(true)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase ${useDates ? 'bg-brand-gold text-white' : 'text-ink/40'}`}>Periodo</button>
        </div>
        {useDates && (
          <div className="flex items-center gap-2">
            <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={desde} onChange={e => setDesde(e.target.value)} />
            <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
        )}
      </div>
      <Card className="overflow-hidden"><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Producto</TableHead><TableHead>Tipo</TableHead><TableHead className="text-center">Cant.</TableHead><TableHead className="text-center">Después</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
          <TableBody>
            {ajustes.map(m => {
              const p = state.productos.find(prod => prod.id === m.productoId);
              return (
                <TableRow key={m.id} className="border-b border-line/30">
                  <td className="text-xs">{m.fecha.slice(0, 16).replace('T', ' ')}</td>
                  <td className="font-black uppercase text-xs">{p?.nombre || 'ELIMINADO'}</td>
                  <td><Badge variant="outline" className="uppercase text-[8px]">{m.tipo}</Badge></td>
                  <td className={`mono font-black text-center ${m.cantidad > 0 ? 'text-status-success' : 'text-status-danger'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</td>
                  <td className="mono text-center font-bold">{m.stockDespues}</td>
                  <td className="text-[10px] uppercase italic opacity-60">{m.referencia}</td>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div></Card>
    </div>
  );
}

function ReporteConsumo({ state }: { state: AppState }) {
  const movs = state.movimientos.filter(m => m.tipo === 'consumo' || m.tipo === 'colaboracion').sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden"><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Producto</TableHead><TableHead className="text-center">Cant.</TableHead><TableHead>Tipo</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
          <TableBody>
            {movs.map(m => (
              <TableRow key={m.id} className="border-b border-line/30">
                <TableCell className="text-xs">{m.fecha.slice(0, 10)}</TableCell>
                <TableCell className="font-black uppercase text-xs">{state.productos.find(p => p.id === m.productoId)?.nombre || 'ELIMINADO'}</TableCell>
                <TableCell className="text-center font-black">{Math.abs(m.cantidad)}</TableCell>
                <TableCell><Badge variant="outline" className="uppercase text-[8px]">{m.tipo}</Badge></TableCell>
                <TableCell className="text-[10px] uppercase italic opacity-60">{m.referencia}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div></Card>
    </div>
  );
}

function ModalAjuste({ producto, onClose, onSave }: { producto: Product, onClose: () => void, onSave: (m: Movimiento, nuevoCosto?: number) => void }) {
  const [tipo, setTipo] = useState<'ajuste_entrada' | 'ajuste_salida' | 'consumo' | 'colaboracion'>('ajuste_entrada');
  const [cantidad, setCantidad] = useState<string>('1');
  const [motivo, setMotivo] = useState('');
  const [costo, setCosto] = useState<string>(String(producto.costoUSD));

  const handleSave = () => {
    const pCant = parseFloat(cantidad) || 0;
    if (pCant <= 0 || !motivo.trim()) return alert('Datos inválidos');
    const mov: Movimiento = {
      id: Store.uid(),
      productoId: producto.id,
      tipo,
      cantidad: (tipo === 'ajuste_entrada') ? pCant : -Math.abs(pCant),
      stockAntes: producto.stock,
      stockDespues: (tipo === 'ajuste_entrada') ? producto.stock + pCant : producto.stock - Math.abs(pCant),
      fecha: Utils.ahora(),
      referencia: motivo.toUpperCase()
    };
    onSave(mov, tipo === 'ajuste_entrada' ? parseFloat(costo) : undefined);
  };

  return (
    <div className="modal show"><div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-white max-w-md border-2 border-line rounded-xl p-6">
        <h3 className="text-ink font-black uppercase text-sm mb-4">AJUSTAR: {producto.nombre}</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Tipo</Label>
              <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value as any)}>
                <option value="ajuste_entrada">Entrada (+)</option><option value="ajuste_salida">Salida (-)</option>
              </select>
            </div>
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Cantidad</Label>
              <Input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} />
            </div>
          </div>
          {tipo === 'ajuste_entrada' && (
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Nuevo Costo Unit. ($)</Label>
              <Input type="number" value={costo} onChange={e => setCosto(e.target.value)} />
            </div>
          )}
          <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Motivo</Label>
            <Input className="uppercase" placeholder="EJ: ERROR DE CONTEO" value={motivo} onChange={e => setMotivo(e.target.value)} />
          </div>
          <Button className="w-full h-12 bg-brand-gold text-black font-black uppercase" onClick={handleSave}>Procesar</Button>
        </div>
      </div>
    </div>
  );
}

function ProductFormModal({ isOpen, onClose, product, onSave, state, updateState }: any) {
  const [datos, setDatos] = useState<any>({
    codigo: product?.codigo || '',
    nombre: product?.nombre || '',
    categoria: product?.categoria || state.categorias[0] || '',
    costoUSD: product?.costoUSD?.toString() ?? '0',
    precioUSD: product?.precioUSD?.toString() ?? '0',
    stock: product?.stock?.toString() ?? '0',
    stockMinimo: product?.stockMinimo?.toString() ?? '5'
  });

  const handleSave = () => {
    if (!datos.nombre || !datos.codigo) return alert('Campos requeridos');
    const cost = parseFloat(datos.costoUSD) || 0;
    const price = parseFloat(datos.precioUSD) || 0;
    const stk = parseFloat(datos.stock) || 0;
    
    let prods = [...state.productos];
    if (product) {
      const idx = prods.findIndex(p => p.id === product.id);
      prods[idx] = { ...prods[idx], ...datos, costoUSD: cost, precioUSD: price, stock: stk, stockMinimo: parseFloat(datos.stockMinimo) || 5 };
      updateState({ productos: prods });
    } else {
      const newP: Product = { id: Store.uid(), ...datos, costoUSD: cost, precioUSD: price, stock: stk, stockMinimo: parseFloat(datos.stockMinimo) || 5, activo: true, fechaCreacion: Utils.hoy(), departamento: 'Licores', cantidad: '750ml', marca: '', proveedor: '', margen: price - cost };
      prods.push(newP);
      const mov: Movimiento = { id: Store.uid(), productoId: newP.id, tipo: 'inicial' as any, cantidad: stk, stockAntes: 0, stockDespues: stk, fecha: Utils.ahora(), referencia: 'INICIAL' };
      updateState({ productos: prods, movimientos: [...state.movimientos, mov] });
    }
    onSave();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border-line">
        <DialogHeader><DialogTitle className="text-brand-gold font-black uppercase">{product ? 'Editar' : 'Nuevo'} Producto</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Código</Label><Input value={datos.codigo} onChange={e => setDatos({...datos, codigo: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Categoría</Label>
              <select className="form-select h-10" value={datos.categoria} onChange={e => setDatos({...datos, categoria: e.target.value})}>
                {state.categorias.map((c: any) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Nombre</Label><Input className="uppercase" value={datos.nombre} onChange={e => setDatos({...datos, nombre: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Costo ($)</Label><Input type="number" value={datos.costoUSD} onChange={e => setDatos({...datos, costoUSD: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Precio ($)</Label><Input type="number" value={datos.precioUSD} onChange={e => setDatos({...datos, precioUSD: e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Stock</Label><Input type="number" value={datos.stock} onChange={e => setDatos({...datos, stock: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Mínimo</Label><Input type="number" value={datos.stockMinimo} onChange={e => setDatos({...datos, stockMinimo: e.target.value})} /></div>
          </div>
          <Button className="w-full bg-brand-gold text-black font-black uppercase" onClick={handleSave}>Guardar Ítem</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
