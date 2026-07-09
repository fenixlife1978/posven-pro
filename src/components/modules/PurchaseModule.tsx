
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Trash2, 
  Search,
  CheckCircle,
  HandCoins,
  Calendar,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import { Store, Utils } from '@/lib/db-store';
import { AppState, Product, Movimiento, PaymentMethod } from '@/lib/types';

interface PurchaseItemTemp {
  productoId: string;
  nombre: string;
  cantidad: number;
  costoUnitarioUSD: number;
  subtotalUSD: number;
}

interface PurchaseModuleProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
}

export default function PurchaseModule({ state, updateState }: PurchaseModuleProps) {
  // 1. DATOS DE LA FACTURA
  const [proveedor, setProveedor] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [fecha, setFecha] = useState(Utils.hoy());
  const [tasaCompra, setTasaCompra] = useState<number>(state.tasa);
  
  // 2. CONDICIONES DE PAGO
  const [condicion, setCondicion] = useState<'contado' | 'credito' | 'mixto'>('contado');
  const [diasPlazo, setDiasPlazo] = useState(30);
  const [montoPagadoUSD, setMontoPagadoUSD] = useState(0);
  const [montoPagadoBS, setMontoPagadoBS] = useState(0);

  // 3. AÑADIR PRODUCTOS
  const [busqueda, setBusqueda] = useState('');
  const [itemSeleccionado, setItemSeleccionado] = useState<Product | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [costoInput, setCostoInput] = useState(0);
  const [loteTemporal, setLoteTemporal] = useState<PurchaseItemTemp[]>([]);

  // Cálculos de Totales
  const totalUSD = loteTemporal.reduce((acc, item) => acc + item.subtotalUSD, 0);
  const totalBS = totalUSD * tasaCompra;

  // Lógica de actualización de montos según condición
  useEffect(() => {
    if (condicion === 'contado') {
      setMontoPagadoUSD(totalUSD);
      setMontoPagadoBS(totalUSD * tasaCompra);
    } else if (condicion === 'credito') {
      setMontoPagadoUSD(0);
      setMontoPagadoBS(0);
    }
  }, [condicion, totalUSD, tasaCompra]);

  const saldoPendienteUSD = Math.max(0, totalUSD - montoPagadoUSD);

  // Manejo de cambios en Mixto
  const handlePaidUsdChange = (val: number) => {
    setMontoPagadoUSD(val);
    setMontoPagadoBS(Utils.round(val * tasaCompra));
  };

  const handlePaidBsChange = (val: number) => {
    setMontoPagadoBS(val);
    setMontoPagadoUSD(Utils.round(val / tasaCompra));
  };

  // Buscador de productos
  const matches = useMemo(() => {
    if (busqueda.trim().length < 2) return [];
    return state.productos.filter(p => 
      p.activo && 
      (p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.codigo.toLowerCase().includes(busqueda.toLowerCase()))
    ).slice(0, 5);
  }, [busqueda, state.productos]);

  const handleSelectItem = (p: Product) => {
    setItemSeleccionado(p);
    setCostoInput(p.costoUSD);
    setBusqueda('');
  };

  const handleAddTempItem = () => {
    if (!itemSeleccionado || cantidad <= 0 || costoInput <= 0) return;
    
    const nuevo: PurchaseItemTemp = {
      productoId: itemSeleccionado.id,
      nombre: itemSeleccionado.nombre,
      cantidad,
      costoUnitarioUSD: costoInput,
      subtotalUSD: Utils.round(cantidad * costoInput)
    };

    setLoteTemporal([...loteTemporal, nuevo]);
    setItemSeleccionado(null);
    setCantidad(1);
    setCostoInput(0);
  };

  const handleRemoveTempItem = (idx: number) => {
    setLoteTemporal(loteTemporal.filter((_, i) => i !== idx));
  };

  const handleProcessPurchase = () => {
    if (!proveedor) return alert('Seleccione un proveedor');
    if (!numeroFactura) return alert('Ingrese el número de factura');
    if (loteTemporal.length === 0) return alert('Agregue productos a la lista');

    const ahoraStr = Utils.ahora();
    const fechaVencimiento = condicion === 'credito' ? 
      new Date(new Date(fecha).getTime() + (diasPlazo * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10) : 
      fecha;

    // Determinar estado de la factura
    const estado: any = saldoPendienteUSD === 0 ? 'pagada' : 
                    saldoPendienteUSD === totalUSD ? 'pendiente' : 'parcial';

    // 1. Actualizar Productos (Stock y CPP)
    const nuevosProductos = state.productos.map(p => {
      const itemCompra = loteTemporal.find(i => i.productoId === p.id);
      if (itemCompra) {
        const stockActual = p.stock || 0;
        const costoActual = p.costoUSD || 0;
        const nuevaCantidad = itemCompra.cantidad;
        const nuevoCosto = itemCompra.costoUnitarioUSD;
        
        const stockTotal = stockActual + nuevaCantidad;
        // Fórmula CPP: ((S1*C1) + (S2*C2)) / (S1+S2)
        const costoPromedio = Utils.round(((stockActual * costoActual) + (nuevaCantidad * nuevoCosto)) / stockTotal);

        return { ...p, stock: stockTotal, costoUSD: costoPromedio };
      }
      return p;
    });

    // 2. Registrar Movimientos en Kardex
    const nuevosMovimientos: Movimiento[] = loteTemporal.map(item => {
      const p = state.productos.find(prod => prod.id === item.productoId);
      return {
        id: Store.uid(),
        productoId: item.productoId,
        tipo: 'compra',
        cantidad: item.cantidad,
        stockAntes: p?.stock || 0,
        stockDespues: (p?.stock || 0) + item.cantidad,
        fecha: ahoraStr,
        referencia: `COMPRA FACT: ${numeroFactura} - PROV: ${proveedor}`
      };
    });

    // 3. Si es Crédito o Parcial, crear CxP
    const nuevasCxP = [...state.cxp];
    if (saldoPendienteUSD > 0) {
      nuevasCxP.push({
        id: 'CXP-' + Store.uid().slice(0, 6).toUpperCase(),
        fecha: fecha,
        fechaVencimiento,
        proveedor,
        concepto: `FACTURA COMPRA #${numeroFactura}`,
        montoUSD: totalUSD,
        abonadoUSD: montoPagadoUSD,
        saldoUSD: saldoPendienteUSD,
        estado: estado === 'pagada' ? 'pagada' : (montoPagadoUSD > 0 ? 'parcial' : 'pendiente')
      });
    }

    updateState({
      productos: nuevosProductos,
      movimientos: [...state.movimientos, ...nuevosMovimientos],
      cxp: nuevasCxP
    });

    alert('Compra registrada exitosamente. Inventario y costos actualizados.');
    
    // Limpiar Formulario
    setProveedor('');
    setNumeroFactura('');
    setLoteTemporal([]);
    setCondicion('contado');
    setBusqueda('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#c8952e]/10 rounded-lg">
            <ShoppingBag className="w-6 h-6 text-[#c8952e]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-tighter">Entrada por Compra</h1>
            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Suministro de Inventario y Control de Costos</p>
          </div>
        </div>
        <div className="bg-black/40 px-4 py-2 rounded-lg border border-white/10 text-right">
          <p className="text-[9px] text-white/40 font-black uppercase">Tasa del Sistema</p>
          <p className="text-sm font-black text-[#c8952e]">{state.tasa.toFixed(2)} <span className="text-[10px] opacity-60">BS/USD</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA IZQUIERDA: DATOS Y CONDICIONES */}
        <div className="space-y-6">
          {/* DATOS FACTURA */}
          <div className="card">
            <div className="card-head py-3 px-5 border-b border-white/5">
              <h3 className="text-[10px] font-black uppercase text-white tracking-widest flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-[#3a9bdc]" /> Datos de la Factura
              </h3>
            </div>
            <div className="card-body p-5 space-y-4">
              <div className="form-group mb-0">
                <label className="text-[10px] font-black uppercase text-white/40 block mb-1">Proveedor</label>
                <select 
                  className="form-select bg-black border-white/10 h-10 text-xs font-black uppercase" 
                  value={proveedor} 
                  onChange={e => setProveedor(e.target.value)}
                >
                  <option value="">SELECCIONE PROVEEDOR</option>
                  {state.proveedores.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group mb-0">
                  <label className="text-[10px] font-black uppercase text-white/40 block mb-1">N° Factura</label>
                  <input className="form-input h-10 bg-black text-white border-white/10 text-xs font-black uppercase" value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} placeholder="000123" />
                </div>
                <div className="form-group mb-0">
                  <label className="text-[10px] font-black uppercase text-white/40 block mb-1">Tasa Compra</label>
                  <input type="number" className="form-input h-10 bg-black text-[#c8952e] border-[#c8952e]/30 text-xs font-black" value={tasaCompra} onChange={e => setTasaCompra(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="form-group mb-0">
                <label className="text-[10px] font-black uppercase text-white/40 block mb-1">Fecha Emisión</label>
                <input type="date" className="form-input h-10 bg-black text-white border-white/10 text-xs" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
            </div>
          </div>

          {/* CONDICIONES PAGO */}
          <div className="card border-[#c8952e]/20">
            <div className="card-head py-3 px-5 border-b border-white/5">
              <h3 className="text-[10px] font-black uppercase text-white tracking-widest flex items-center gap-2">
                <HandCoins className="w-3.5 h-3.5 text-[#c8952e]" /> Condiciones de Pago
              </h3>
            </div>
            <div className="card-body p-5 space-y-4">
              <div className="flex gap-1">
                {['contado', 'credito', 'mixto'].map(c => (
                  <button 
                    key={c}
                    onClick={() => setCondicion(c as any)}
                    className={`flex-1 h-9 rounded text-[9px] font-black uppercase transition-all ${condicion === c ? 'bg-[#c8952e] text-black' : 'bg-black text-white/40 border border-white/5 hover:bg-white/5'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {condicion === 'credito' && (
                <div className="p-3 bg-black rounded border border-white/10 animate-in slide-in-from-top-2">
                  <label className="text-[9px] font-black uppercase text-white/40 block mb-1">Días de Plazo</label>
                  <input type="number" className="form-input h-9 bg-[#111] text-white border-white/10 text-xs font-black" value={diasPlazo} onChange={e => setDiasPlazo(parseInt(e.target.value) || 0)} />
                </div>
              )}

              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-white/40">TOTAL FACTURA USD:</span>
                  <span className="text-white font-black">{totalUSD.toFixed(4)}</span>
                </div>
                
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-white/40">TOTAL PAGADO USD:</span>
                  {condicion === 'mixto' ? (
                    <input 
                      type="number" 
                      className="w-24 h-7 bg-black border border-[#27ae60]/30 text-[#27ae60] text-right rounded px-2 font-black" 
                      value={montoPagadoUSD}
                      onChange={e => handlePaidUsdChange(parseFloat(e.target.value) || 0)}
                    />
                  ) : (
                    <span className="text-[#27ae60] font-black">{montoPagadoUSD.toFixed(4)}</span>
                  )}
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-white/40">SALDO PENDIENTE USD:</span>
                  <span className="text-[#e04848] font-black">{saldoPendienteUSD.toFixed(4)}</span>
                </div>

                {condicion === 'mixto' && (
                  <div className="pt-3 border-t border-white/5 space-y-2">
                    <label className="text-[8px] font-black uppercase text-[#c8952e] block">Convertidor a Bolívares (Abono)</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        className="flex-1 h-9 bg-black border border-white/10 text-white text-xs font-black px-3 rounded"
                        placeholder="Monto en BS"
                        value={montoPagadoBS}
                        onChange={e => handlePaidBsChange(parseFloat(e.target.value) || 0)}
                      />
                      <span className="text-[10px] font-black text-white/20">BS.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: SELECCIÓN DE PRODUCTOS Y TABLA */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-head py-3 px-5 border-b border-white/5">
              <h3 className="text-[10px] font-black uppercase text-white tracking-widest flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-[#27ae60]" /> Añadir Productos al Lote
              </h3>
            </div>
            <div className="card-body p-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                {/* Buscador */}
                <div className="md:col-span-5 relative">
                  <label className="text-[9px] font-black uppercase text-white/40 block mb-1">Buscar Producto</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/20" />
                    <input 
                      className="form-input h-10 pl-10 bg-black text-white border-white/10 text-xs" 
                      placeholder="Nombre o Código..."
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                    />
                  </div>
                  {matches.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-[#1e1e1e] border border-white/10 rounded-b-lg shadow-2xl z-[100] mt-1 overflow-hidden">
                      {matches.map(p => (
                        <div 
                          key={p.id} 
                          onClick={() => handleSelectItem(p)}
                          className="p-3 border-b border-white/5 hover:bg-[#c8952e]/20 cursor-pointer flex justify-between items-center"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase text-white">{p.nombre}</span>
                            <span className="text-[9px] text-white/40 mono">{p.codigo}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-black text-[#c8952e]">${p.costoUSD.toFixed(2)}</div>
                            <div className="text-[8px] text-white/60 uppercase">Stock: {p.stock}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Formulario Adición */}
                <div className="md:col-span-2">
                  <label className="text-[9px] font-black uppercase text-white/40 block mb-1">Cant.</label>
                  <input type="number" className="form-input h-10 bg-black text-white border-white/10 text-xs font-black" value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 0)} />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[9px] font-black uppercase text-white/40 block mb-1">Costo Unit. $</label>
                  <input type="number" className="form-input h-10 bg-black text-[#c8952e] border-[#c8952e]/30 text-xs font-black" value={costoInput} onChange={e => setCostoInput(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="md:col-span-2">
                  <button 
                    onClick={handleAddTempItem}
                    disabled={!itemSeleccionado}
                    className="btn btn-primary h-10 w-full font-black uppercase text-[10px] flex items-center justify-center gap-2 disabled:opacity-20"
                  >
                    Añadir <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {itemSeleccionado && (
                <div className="mt-3 p-2 bg-[#c8952e]/5 rounded border border-[#c8952e]/20 flex items-center gap-2 animate-in fade-in">
                  <Layers className="w-4 h-4 text-[#c8952e]" />
                  <span className="text-[10px] font-black uppercase text-white">Preparado para añadir: <strong className="text-[#c8952e]">{itemSeleccionado.nombre}</strong></span>
                </div>
              )}
            </div>

            <div className="table-wrap border-t border-white/5">
              <table className="text-[10px]">
                <thead>
                  <tr className="bg-black/40">
                    <th className="py-3 px-5 text-white/40 font-black uppercase">Producto</th>
                    <th className="py-3 text-white/40 font-black uppercase text-center">Cant.</th>
                    <th className="py-3 text-white/40 font-black uppercase text-right">Costo USD</th>
                    <th className="py-3 text-white/40 font-black uppercase text-right">Subtotal USD</th>
                    <th className="py-3 px-5 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {loteTemporal.map((item, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 px-5 font-black uppercase text-white">{item.nombre}</td>
                      <td className="py-2 text-center text-white font-bold">{item.cantidad}</td>
                      <td className="py-2 text-right text-white/60 font-bold">${item.costoUnitarioUSD.toFixed(2)}</td>
                      <td className="py-2 text-right text-[#c8952e] font-black">${item.subtotalUSD.toFixed(2)}</td>
                      <td className="py-2 px-5 text-center">
                        <button onClick={() => handleRemoveTempItem(idx)} className="text-white/20 hover:text-[#e04848] transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {loteTemporal.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-white/20 font-black uppercase italic tracking-widest">
                        No hay productos en la lista temporal
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card-foot p-5 bg-black/40 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                <div className="bg-[#111] p-3 rounded-lg border border-white/10 min-w-[140px]">
                  <p className="text-[8px] text-white/40 font-black uppercase mb-1">Total en Bolívares</p>
                  <p className="text-lg font-black text-white">{Utils.fmtBS(totalBS)}</p>
                </div>
                <div className="bg-[#111] p-3 rounded-lg border border-[#c8952e]/20 min-w-[140px]">
                  <p className="text-[8px] text-[#c8952e]/60 font-black uppercase mb-1">Total Factura USD</p>
                  <p className="text-lg font-black text-[#c8952e]">{Utils.fmtUSD(totalUSD)}</p>
                </div>
              </div>
              <button 
                onClick={handleProcessPurchase}
                disabled={loteTemporal.length === 0}
                className="btn btn-primary h-14 w-full md:w-64 font-black uppercase text-xs flex items-center justify-center gap-3 shadow-xl shadow-[#c8952e]/10 disabled:opacity-20 transition-all"
              >
                Registrar Compra <CheckCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
