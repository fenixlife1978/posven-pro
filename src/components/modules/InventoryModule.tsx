import React, { useState, useMemo, useEffect } from 'react';
import { Package, Plus, Search, Filter, Pencil, Trash2, AlertCircle, FileText, ChevronRight, BarChart3, RotateCcw, TrendingUp, History, Box, ClipboardList, Info, Check, X, PlusCircle, MinusCircle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  generarPDFInventario, 
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

const ProductFormModal = ({ isOpen, onClose, product, onSave, state, updateState }: any) => {
  const [formData, setFormData] = useState<any>({
    codigo: '',
    nombre: '',
    categoria: 'Ron',
    precioUSD: '0',
    stock: 0,
    stockMinimo: 5,
    costoUSD: '0',
    marca: '',
    proveedor: '',
    api_url: '',
    tipo_licor: 'Nacional',
    activo: true
  });

  useEffect(() => {
    if (product) {
      setFormData({
        codigo: product.codigo || '',
        nombre: product.nombre || '',
        categoria: product.categoria || 'Ron',
        precioUSD: product.precioUSD?.toString() ?? '0',
        stock: product.stock || 0,
        stockMinimo: product.stockMinimo || 5,
        costoUSD: product.costoUSD?.toString() ?? '0',
        marca: product.marca || '',
        proveedor: product.proveedor || '',
        api_url: product.api_url || '',
        tipo_licor: product.tipo_licor || 'Nacional',
        activo: product.activo !== undefined ? product.activo : true
      });
    } else {
      setFormData({
        codigo: '',
        nombre: '',
        categoria: 'Ron',
        precioUSD: '0',
        stock: 0,
        stockMinimo: 5,
        costoUSD: '0',
        marca: '',
        proveedor: '',
        api_url: '',
        tipo_licor: 'Nacional',
        activo: true
      });
    }
  }, [product, isOpen]);

  const handleSave = () => {
    if (!formData.nombre || !formData.codigo || !formData.precioUSD) {
      alert("Por favor complete los campos obligatorios");
      return;
    }

    const precioUSDNum = parseFloat(formData.precioUSD) || 0;
    const costoUSDNum = parseFloat(formData.costoUSD) || 0;

    let productosActualizados = [...state.productos];

    if (product) {
      const idx = productosActualizados.findIndex(p => p.id === product.id);
      if (idx >= 0) {
        productosActualizados[idx] = { 
          ...productosActualizados[idx], 
          ...formData,
          precioUSD: precioUSDNum,
          costoUSD: costoUSDNum,
          margen: precioUSDNum - costoUSDNum,
          id: product.id,
          fechaCreacion: product.fechaCreacion || Utils.hoy()
        };
      }
    } else {
      const newProduct: Product = {
        id: Store.uid(),
        codigo: formData.codigo || '',
        nombre: formData.nombre || '',
        categoria: formData.categoria || 'Ron',
        departamento: 'Licores',
        cantidad: '750ml',
        marca: formData.marca || '',
        proveedor: formData.proveedor || '',
        costoUSD: costoUSDNum,
        precioUSD: precioUSDNum,
        margen: precioUSDNum - costoUSDNum,
        stock: Number(formData.stock) || 0,
        stockMinimo: Number(formData.stockMinimo) || 5,
        fechaCreacion: Utils.hoy(),
        activo: true
      };
      productosActualizados.push(newProduct);
      
      const initialMove: Movimiento = {
        id: Store.uid(),
        productoId: newProduct.id,
        tipo: 'entrada',
        cantidad: newProduct.stock,
        stockAntes: 0,
        stockDespues: newProduct.stock,
        fecha: Utils.ahora(),
        referencia: 'INICIAL'
      };
      updateState({ movimientos: [...state.movimientos, initialMove] });
    }

    updateState({ productos: productosActualizados });
    onSave();
    onClose();
  };

  const handleAddListItem = (listName: string) => {
    const newVal = prompt(`Ingrese nueva opción para ${listName.toUpperCase()}:`);
    if (newVal) {
      updateState({ [listName]: [...(state[listName as keyof AppState] as string[] || []), newVal] });
    }
  };

  const handleRemoveListItem = (listName: string, current: string) => {
    if (confirm(`¿Eliminar "${current}" de la lista?`)) {
      const newList = (state[listName as keyof AppState] as string[] || []).filter(i => i !== current);
      updateState({ [listName]: newList });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white border-line text-ink">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-brand-gold">
            {product ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-ink font-bold uppercase text-[10px] tracking-wider">Código de Barras</Label>
            <Input 
              value={formData.codigo} 
              onChange={(e) => setFormData({...formData, codigo: e.target.value})}
              className="bg-surface-soft border-line text-ink"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-ink font-bold uppercase text-[10px] tracking-wider">Categoría</Label>
            <div className="flex gap-1">
              <select 
                className="form-select w-full"
                value={formData.categoria} 
                onChange={(e) => setFormData({...formData, categoria: e.target.value})}
              >
                {state.categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <button onClick={() => handleAddListItem('categorias')} className="p-2 bg-surface-soft rounded border border-line hover:bg-gray-100"><PlusCircle size={16} /></button>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-ink font-bold uppercase text-[10px] tracking-wider">Nombre del Producto</Label>
          <Input 
            value={formData.nombre} 
            onChange={(e) => setFormData({...formData, nombre: e.target.value})}
            className="bg-surface-soft border-line text-ink"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-ink font-bold uppercase text-[10px] tracking-wider">Precio Venta (USD)</Label>
            <Input 
              type="number"
              value={formData.precioUSD}
              onChange={(e) => setFormData({...formData, precioUSD: e.target.value})}
              className="bg-surface-soft border-line text-ink font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-ink font-bold uppercase text-[10px] tracking-wider">Costo (USD)</Label>
            <Input 
              type="number"
              value={formData.costoUSD}
              onChange={(e) => setFormData({...formData, costoUSD: e.target.value})}
              className="bg-surface-soft border-line text-ink font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-ink font-bold uppercase text-[10px] tracking-wider">Stock Inicial</Label>
            <Input 
              type="number"
              value={formData.stock} 
              onChange={(e) => setFormData({...formData, stock: e.target.value})}
              className="bg-surface-soft border-line text-ink"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-ink font-bold uppercase text-[10px] tracking-wider">Stock Mínimo</Label>
            <Input 
              type="number"
              value={formData.stockMinimo} 
              onChange={(e) => setFormData({...formData, stockMinimo: e.target.value})}
              className="bg-surface-soft border-line text-ink"
            />
          </div>
        </div>

        <Button 
          className="w-full h-12 mt-4 bg-brand-gold text-black font-black uppercase tracking-widest hover:bg-brand-gold-deep"
          onClick={handleSave}
        >
          {product ? 'Actualizar' : 'Guardar'}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

const ModalAjuste = ({ producto, onClose, onSave }: { producto: Product, onClose: () => void, onSave: (m: Movimiento, nuevoCosto?: number) => void }) => {
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
      cantidad: (tipo === 'ajuste_entrada' || (tipo as string) === 'compra') ? pCant : -Math.abs(pCant),
      stockAntes: producto.stock,
      stockDespues: (tipo === 'ajuste_entrada' || (tipo as string) === 'compra') ? (producto.stock + pCant) : (producto.stock - Math.abs(pCant)),
      fecha: Utils.ahora(),
      referencia: motivo.toUpperCase()
    };
    onSave(mov, (tipo === 'ajuste_entrada' || (tipo as string) === 'compra') ? pCosto : undefined);
  };

  return (
    <div className="modal show"><div className="modal-bg" onClick={onClose}></div>
      <div className="modal-box bg-white max-w-md border-2 border-line rounded-xl overflow-hidden shadow-2xl">
        <div className="modal-head py-3 px-5 border-b border-line bg-surface-soft">
          <h3 className="text-ink font-black uppercase text-sm">AJUSTAR: {producto.nombre.toUpperCase()}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-ink" /></button>
        </div>
        <div className="modal-body p-6 space-y-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
             <div className="form-group"><label className="text-[10px] font-black uppercase text-ink/60 mb-1 block">Tipo</label>
               <select className="form-select h-10 text-xs font-bold" value={tipo} onChange={e => setTipo(e.target.value as any)}>
                 <option value="ajuste_entrada">Entrada (+)</option>
                 <option value="ajuste_salida">Salida (-)</option>
                 <option value="consumo">Consumo (-)</option>
                 <option value="colaboracion">Colaboración (-)</option>
               </select>
             </div>
             <div className="form-group"><label className="text-[10px] font-black uppercase text-ink/60 mb-1 block">Cantidad</label>
               <input className="form-input h-10 text-center font-black" type="text" value={cantidad} onChange={e => setCantidad(e.target.value)} />
             </div>
          </div>
          {(tipo === 'ajuste_entrada') && (
            <div className="form-group">
              <label className="text-[10px] font-black uppercase text-ink/60 mb-1 block">Costo Unitario ($)</label>
              <input className="form-input h-10 text-xs font-black" type="text" value={nuevoCosto} onChange={e => setNuevoCosto(e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label className="text-[10px] font-black uppercase text-ink/60 mb-1 block">Motivo del Ajuste</label>
            <input 
              className="form-input h-10 text-xs font-black uppercase" 
              placeholder="Ej: ERROR DE CONTEO, DAÑO, ETC..." 
              value={motivo} 
              onChange={e => setMotivo(e.target.value)} 
            />
          </div>
          <button className="btn btn-primary w-full h-12 font-black uppercase text-xs shadow-xl mt-2" onClick={handleSave}>Procesar Ajuste</button>
        </div>
      </div>
    </div>
  );
};

function ReporteVentas({ state }: { state: AppState }) {
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());
  const [useDates, setUseDates] = useState(false);

  const applyQuickFilter = (type: string) => {
    const today = new Date();
    setUseDates(true);
    if (type === 'hoy') {
      setDesde(Utils.hoy()); setHasta(Utils.hoy());
    } else if (type === 'ayer') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      setDesde(yStr); setHasta(yStr);
    } else if (type === 'mes') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setDesde(first); setHasta(Utils.hoy());
    } else if (type === '7dias') {
      const last7 = new Date(today);
      last7.setDate(today.getDate() - 6);
      setDesde(last7.toISOString().split('T')[0]); setHasta(Utils.hoy());
    }
  };

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
          groups[item.nombre] = {
            nombre: item.nombre,
            cantidad: 0,
            totalUSD: 0
          };
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
        <div className="flex items-center gap-3 bg-surface-soft p-1 rounded-lg border border-line">
           <button onClick={() => { setUseDates(false); applyQuickFilter('hoy'); }} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${!useDates ? 'bg-ink text-white' : 'text-ink/40'}`}>Hoy</button>
           <button onClick={() => setUseDates(true)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${useDates ? 'bg-brand-gold text-white' : 'text-ink/40'}`}>Periodo</button>
        </div>
        
        {useDates && (
          <div className="flex items-center gap-2">
            <div className="form-group mb-0">
              <label className="text-[8px] font-black uppercase opacity-40 block mb-0.5">Desde</label>
              <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="form-group mb-0">
              <label className="text-[8px] font-black uppercase opacity-40 block mb-0.5">Hasta</label>
              <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
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
            <TableHeader>
              <TableRow>
                <TableHead>Producto / Item</TableHead>
                <TableHead className="text-center">Cant. Vendida</TableHead>
                <TableHead className="text-right">Total Recaudado (USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedVentas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-20 text-ink/20 font-black italic uppercase">Sin ventas en este periodo</TableCell>
                </TableRow>
              ) : (
                groupedVentas.map((item, idx) => (
                  <TableRow key={idx} className="border-b border-line/30">
                    <TableCell className="font-black uppercase text-xs text-ink">{item.nombre}</TableCell>
                    <TableCell className="font-black mono text-ink text-center">{item.cantidad}</TableCell>
                    <TableCell className="mono font-black text-brand-gold-deep text-right">{Utils.fmtUSD(item.totalUSD)}</TableCell>
                  </TableRow>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ReporteGeneralComponent({ state }: { state: AppState }) {
  const [groupBy, setGroupBy] = useState<'categoria' | 'departamento' | 'proveedor'>('categoria');
  const [filterValue, setFilterValue] = useState<string>('');
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());
  const [useDates, setUseDates] = useState(false);

  const applyQuickFilter = (type: string) => {
    const today = new Date();
    setUseDates(true);
    if (type === 'hoy') {
      setDesde(Utils.hoy()); setHasta(Utils.hoy());
    } else if (type === 'ayer') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      setDesde(yStr); setHasta(yStr);
    } else if (type === 'mes') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setDesde(first); setHasta(Utils.hoy());
    } else if (type === '7dias') {
      const last7 = new Date(today);
      last7.setDate(today.getDate() - 6);
      setDesde(last7.toISOString().split('T')[0]); setHasta(Utils.hoy());
    }
  };

  const filteredProducts = state.productos.filter(p => {
    const matchesGroup = (filterValue === '' || ((p[groupBy] as string) || 'Sin asignar') === filterValue);
    const date = p.fechaCreacion ? p.fechaCreacion.slice(0, 10) : '';
    const matchesDate = !useDates || (date >= desde && date <= hasta);
    return p.activo && matchesGroup && matchesDate;
  });

  const totalCosto = Utils.round(filteredProducts.reduce((acc, p) => acc + (p.costoUSD * p.stock), 0));
  const totalVenta = Utils.round(filteredProducts.reduce((acc, p) => acc + (p.precioUSD * p.stock), 0));
  const uniqueValues = Array.from(new Set(state.productos.filter(p => p.activo).map(p => (p[groupBy] as string) || 'Sin asignar'))).sort();

  return (
    <div className="space-y-6">
      <div className="card p-5 bg-white border-line flex flex-wrap gap-4 items-end shadow-sm no-print">
        <div className="flex items-center gap-3 bg-surface-soft p-1 rounded-lg border border-line">
           <button onClick={() => setUseDates(false)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${!useDates ? 'bg-ink text-white' : 'text-ink/40'}`}>Actual</button>
           <button onClick={() => setUseDates(true)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${useDates ? 'bg-brand-gold text-white' : 'text-ink/40'}`}>Por Periodo</button>
        </div>
        
        {useDates && (
          <div className="flex items-center gap-2">
            <div className="form-group mb-0">
              <label className="text-[8px] font-black uppercase opacity-40 block mb-0.5">Desde</label>
              <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="form-group mb-0">
              <label className="text-[8px] font-black uppercase opacity-40 block mb-0.5">Hasta</label>
              <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          </div>
        )}
        
        <div className="flex-1 flex justify-end">
          <button className="btn btn-secondary h-10 px-6 border-line text-ink font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-surface-soft" onClick={() => exportarPDFInventarioGeneral(filteredProducts, state.empresa, groupBy, { costo: totalCosto, venta: totalVenta })}>
            <FileText className="w-4 h-4" /> Exportar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="kpi bg-white border-line shadow-md">
          <div className="text-ink text-[10px] font-black uppercase mb-1 opacity-60">Valor al Costo (CPP Total)</div>
          <div className="text-3xl font-black text-ink">{Utils.fmtUSD(totalCosto)}</div>
          <div className="text-sm font-bold mt-1 italic text-ink/70">{Utils.fmtBS(totalCosto * state.tasa)}</div>
        </div>
        <div className="kpi bg-white border-line shadow-md">
          <div className="text-ink text-[10px] font-black uppercase mb-1 opacity-60">Valor al Precio de Venta (Total)</div>
          <div className="text-3xl font-black text-status-success">{Utils.fmtUSD(totalVenta)}</div>
          <div className="text-sm font-bold mt-1 italic text-ink/70">{Utils.fmtBS(totalVenta * state.tasa)}</div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cod.</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Costo Unit.</TableHead>
                <TableHead className="text-right">Venta Unit.</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="text-right">Subtotal Costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map(p => (
                <TableRow key={p.id} className="border-b border-line/30 hover:bg-gray-50">
                  <TableCell className="mono text-[11px] font-black text-ink">{p.codigo}</TableCell>
                  <TableCell className="font-black uppercase text-xs text-ink">{p.nombre}</TableCell>
                  <TableCell className="mono text-right text-xs font-bold text-ink/60">{Utils.fmtUSD(p.costoUSD)}</TableCell>
                  <TableCell className="mono text-right text-brand-gold-deep font-black">{Utils.fmtUSD(p.precioUSD)}</TableCell>
                  <TableCell className="text-center"><span className="badge badge-neutral font-black">{p.stock}</span></TableCell>
                  <TableCell className="mono text-right font-black text-ink">{Utils.fmtUSD(Utils.round(p.costoUSD * p.stock))}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ReporteDevoluciones({ state }: { state: AppState }) {
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());
  const [useDates, setUseDates] = useState(false);

  const filteredDevoluciones = useMemo(() => {
    return (state.devoluciones || []).filter(d => {
      const date = d.fecha.slice(0, 10);
      if (!useDates) return date === Utils.hoy();
      return date >= desde && date <= hasta;
    });
  }, [state.devoluciones, desde, hasta, useDates]);

  const totalUSD = filteredDevoluciones.reduce((acc, d) => acc + d.totalUSD, 0);

  return (
    <div className="space-y-4">
      <div className="card p-5 bg-white border-line flex flex-wrap gap-4 items-end shadow-sm">
        <div className="flex items-center gap-3 bg-surface-soft p-1 rounded-lg border border-line">
           <button onClick={() => setUseDates(false)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${!useDates ? 'bg-ink text-white' : 'text-ink/40'}`}>Hoy</button>
           <button onClick={() => setUseDates(true)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${useDates ? 'bg-brand-gold text-white' : 'text-ink/40'}`}>Periodo</button>
        </div>
        {useDates && (
          <div className="flex items-center gap-2">
            <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={desde} onChange={e => setDesde(e.target.value)} />
            <input type="date" className="form-input h-8 text-xs font-bold px-2 w-32" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
        )}
        <div className="flex-1 flex justify-end">
          <button className="btn btn-secondary h-10 px-6 border-line text-ink font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-surface-soft" onClick={() => exportarPDFDevoluciones(filteredDevoluciones, state.empresa, useDates ? `${desde} al ${hasta}` : 'Hoy', { totalUSD })}>
            <FileText className="w-4 h-4" /> Exportar PDF
          </button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Venta Ref.</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDevoluciones.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-20 text-ink/20 font-black italic uppercase">Sin devoluciones</td></tr>
              ) : (
                filteredDevoluciones.map(d => (
                  <tr key={d.id} className="border-b border-line/30">
                    <td className="text-xs font-bold text-ink">{Utils.fmtFecha(d.fecha)}</td>
                    <td className="text-ink font-black mono text-xs">{d.ventaId}</td>
                    <td className="py-2">
                       <div className="space-y-0.5">
                          {d.items.map((it, idx) => (
                             <p key={idx} className="text-[9px] font-black uppercase text-ink/70 leading-tight">• {it.nombre}</p>
                          ))}
                       </div>
                    </td>
                    <td className="text-center font-black text-ink text-xs">
                       {d.items.reduce((s, it) => s + it.cantidad, 0)}
                    </td>
                    <td className="mono font-black text-status-danger text-right">{Utils.fmtUSD(d.totalUSD)}</td>
                    <td className="text-xs uppercase italic font-bold text-ink/70">{d.motivo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function HistorialAjustes({ state }: { state: AppState }) {
  const [desde, setDesde] = useState(Utils.hoy());
  const [hasta, setHasta] = useState(Utils.hoy());
  const [useDates, setUseDates] = useState(false);

  const ajustesRaw = state.movimientos.filter(m => 
    ['ajuste_entrada', 'ajuste_salida', 'consumo', 'colaboracion', 'compra'].includes(m.tipo) && 
    m.referencia !== 'INICIAL'
  );

  const ajustes = ajustesRaw.filter(m => {
     if (!useDates) return true;
     const d = m.fecha.slice(0, 10);
     return d >= desde && d <= hasta;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const efectoNetoUSD = Utils.round(ajustes.reduce((acc, m) => {
    const p = state.productos.find(prod => prod.id === m.productoId);
    const costo = p?.costoUSD || 0;
    const esEntrada = m.tipo.includes('entrada') || m.tipo === 'compra' || m.tipo === 'devolucion';
    return acc + (esEntrada ? (m.cantidad * costo) : -(Math.abs(m.cantidad) * costo));
  }, 0));

  const handleExport = () => {
    const dataForPDF = ajustes.map(m => {
      const p = state.productos.find(prod => prod.id === m.productoId);
      return { ...m, nombreProd: p?.nombre || 'ITEM ELIMINADO', costo: p?.costoUSD || 0 };
    });
    exportarPDFHistorialAjustes(dataForPDF, state.empresa, efectoNetoUSD);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 bg-white border-line flex flex-wrap gap-4 items-end shadow-sm no-print">
         <div className="flex items-center gap-2">
            <button onClick={() => setUseDates(false)} className={`btn h-8 px-4 text-[9px] font-black uppercase ${!useDates ? 'btn-primary' : 'btn-secondary'}`}>Todo el historial</button>
            <button onClick={() => setUseDates(true)} className={`btn h-8 px-4 text-[9px] font-black uppercase ${useDates ? 'btn-primary' : 'btn-secondary'}`}>Filtrar Periodo</button>
         </div>
         {useDates && (
           <div className="flex items-center gap-3">
              <input type="date" className="form-input h-8 text-xs font-bold w-32" value={desde} onChange={e => setDesde(e.target.value)} />
              <input type="date" className="form-input h-8 text-xs font-bold w-32" value={hasta} onChange={e => setHasta(e.target.value)} />
           </div>
         )}
      </div>

      <div className={`kpi p-6 border-line shadow-md border-l-8 ${efectoNetoUSD < 0 ? 'bg-status-danger-soft border-l-status-danger' : 'bg-white border-l-status-success'}`}>
        <div className="text-[10px] font-black uppercase mb-1 text-ink opacity-60">Variación Neta de Capital en Inventario ($)</div>
        <div className={`text-3xl font-black ${efectoNetoUSD < 0 ? 'text-status-danger' : 'text-ink'}`}>{Utils.fmtUSD(efectoNetoUSD)}</div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead className="text-right">Costo Unit.</TableHead>
                <TableHead className="text-right">Total $</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ajustes.map(m => {
                const p = state.productos.find(prod => prod.id === m.productoId);
                const costo = p?.costoUSD || 0;
                const sub = Math.abs(m.cantidad) * costo;
                return (
                  <tr key={m.id} className="border-b border-line/30">
                    <td className="text-xs font-bold text-ink">{m.fecha.slice(0, 16).replace('T', ' ')}</td>
                    <td className="font-black uppercase text-xs text-ink">{p?.nombre || 'ELIMINADO'}</td>
                    <td><span className="badge badge-neutral uppercase text-[8px] font-black">{m.tipo}</span></td>
                    <td className="mono font-black text-center text-xs">{m.cantidad}</td>
                    <td className="mono text-right text-xs font-bold text-ink/60">{Utils.fmtUSD(costo)}</td>
                    <td className="mono font-black text-brand-gold-deep text-right text-xs">{Utils.fmtUSD(sub)}</td>
                    <td className="text-[9px] font-black uppercase text-ink/40 italic">{m.referencia}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
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
                      className="p-3 border-b border-line hover:bg-brand-gold-soft cursor-pointer flex flex-col transition-all"
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
                <th className="font-black text-ink uppercase text-[10px]">Referencia</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {movs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-20 text-ink/20 font-black italic uppercase">Utilice el buscador para localizar un ítem</td></tr>
              ) : (
                movs.map(m => (
                  <tr key={m.id} className="border-b border-line/30">
                    <td className="text-[11px] font-bold text-ink">{m.fecha.slice(0, 16).replace('T', ' ')}</td>
                    <td><span className={`badge ${m.tipo === 'inicial' ? 'badge-info' : 'badge-neutral'} font-black uppercase text-[8px]`}>{m.tipo === 'inicial' ? 'INICIAL' : m.tipo}</span></td>
                    <td className={`mono font-black text-center ${m.cantidad > 0 ? 'text-status-success' : 'text-status-danger'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</td>
                    <td className="mono font-black text-ink text-center">{m.stockDespues}</td>
                    <td className="text-[10px] font-black uppercase text-ink/40 italic">{m.referencia}</td>
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

export { InventoryModuleComponent as InventoryModule };
