"use client";

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Trash2, 
  Search,
  AlertCircle,
  CheckCircle,
  HandCoins
} from 'lucide-react';
import { Store, Utils } from '@/lib/db-store';
import { AppState, Product } from '@/lib/types';

interface PurchaseProduct {
  productoId: string;
  nombre: string;
  cantidad: number;
  costoUnitarioUSD: number;
  subtotalUSD: number;
}

interface Purchase {
  id: string;
  proveedor: string;
  numeroFactura: string;
  fecha: string;
  tasaBCV: number;
  condicionesPago: 'contado' | 'credito' | 'mixto';
  productos: PurchaseProduct[];
  totalUSD: number;
  totalBS: number;
  totalPagadoUSD: number;
  saldoPendienteUSD: number;
  estado: 'pagado' | 'pendiente' | 'parcial';
  fechaCreacion: string;
}

interface PurchaseModuleProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
}

export default function PurchaseModule({ state, updateState }: PurchaseModuleProps) {
  // Estado del formulario
  const [proveedor, setProveedor] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [fecha, setFecha] = useState(Utils.hoy());
  const [condicionesPago, setCondicionesPago] = useState<'contado' | 'credito' | 'mixto'>('contado');
  const [productosSeleccionados, setProductosSeleccionados] = useState<PurchaseProduct[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [costoUnitario, setCostoUnitario] = useState(0);
  const [totalPagadoUSD, setTotalPagadoUSD] = useState(0);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [comprasRecientes, setComprasRecientes] = useState<Purchase[]>([]);

  // Cargar compras guardadas
  useEffect(() => {
    const savedPurchases = localStorage.getItem('posven_purchases');
    if (savedPurchases) {
      setComprasRecientes(JSON.parse(savedPurchases));
    }
  }, []);

  // Calcular totales
  const totalUSD = productosSeleccionados.reduce((sum, p) => sum + p.subtotalUSD, 0);
  const totalBS = totalUSD * state.tasa;

  // Actualizar total pagado según condiciones
  useEffect(() => {
    if (condicionesPago === 'contado') {
      setTotalPagadoUSD(totalUSD);
    } else if (condicionesPago === 'credito') {
      setTotalPagadoUSD(0);
    }
  }, [condicionesPago, totalUSD]);

  const saldoPendiente = totalUSD - totalPagadoUSD;

  // Agregar producto a la lista
  const agregarProducto = () => {
    if (!productoSeleccionado || cantidad <= 0 || costoUnitario <= 0) {
      alert('Selecciona un producto, cantidad y costo válidos');
      return;
    }

    const producto = state.productos.find(p => p.id === productoSeleccionado);
    if (!producto) return;

    // Verificar si el producto ya está en la lista
    const existe = productosSeleccionados.find(p => p.productoId === productoSeleccionado);
    if (existe) {
      alert('El producto ya está en la lista. Si necesitas más cantidad, edita la fila existente.');
      return;
    }

    const nuevoProducto: PurchaseProduct = {
      productoId: producto.id,
      nombre: producto.nombre,
      cantidad: cantidad,
      costoUnitarioUSD: costoUnitario,
      subtotalUSD: cantidad * costoUnitario
    };

    setProductosSeleccionados([...productosSeleccionados, nuevoProducto]);
    setProductoSeleccionado('');
    setCantidad(1);
    setCostoUnitario(0);
  };

  // Eliminar producto de la lista
  const eliminarProducto = (productoId: string) => {
    setProductosSeleccionados(productosSeleccionados.filter(p => p.productoId !== productoId));
  };

  // Registrar compra
  const registrarCompra = () => {
    // Validaciones
    if (!proveedor.trim()) {
      alert('Ingresa el nombre del proveedor');
      return;
    }
    if (!numeroFactura.trim()) {
      alert('Ingresa el número de factura');
      return;
    }
    if (productosSeleccionados.length === 0) {
      alert('Agrega al menos un producto');
      return;
    }

    // Verificar que la factura no esté duplicada
    const facturaDuplicada = comprasRecientes.some(c => c.numeroFactura === numeroFactura);
    if (facturaDuplicada) {
      alert('El número de factura ya existe');
      return;
    }

    // Crear objeto de compra
    const nuevaCompra: Purchase = {
      id: Store.uid(),
      proveedor,
      numeroFactura,
      fecha,
      tasaBCV: state.tasa,
      condicionesPago,
      productos: productosSeleccionados,
      totalUSD,
      totalBS,
      totalPagadoUSD,
      saldoPendienteUSD: saldoPendiente,
      estado: saldoPendiente === 0 ? 'pagado' : saldoPendiente === totalUSD ? 'pendiente' : 'parcial',
      fechaCreacion: Utils.hoy()
    };

    // Actualizar stock de productos
    const productosActualizados = state.productos.map(producto => {
      const compraProducto = productosSeleccionados.find(p => p.productoId === producto.id);
      if (compraProducto) {
        return {
          ...producto,
          stock: producto.stock + compraProducto.cantidad
        };
      }
      return producto;
    });

    // Actualizar estado
    const nuevasCompras = [...comprasRecientes, nuevaCompra];
    setComprasRecientes(nuevasCompras);
    localStorage.setItem('posven_purchases', JSON.stringify(nuevasCompras));

    updateState({
      productos: productosActualizados
    });

    // Limpiar formulario
    setProveedor('');
    setNumeroFactura('');
    setFecha(Utils.hoy());
    setProductosSeleccionados([]);
    setTotalPagadoUSD(0);
    setCondicionesPago('contado');

    alert('Compra registrada exitosamente!');
  };

  // Filtrar productos para el selector
  const productosDisponibles = state.productos
    .filter(p => p.activo)
    .filter(p => 
      p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
      p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-[#c8952e]" />
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">
            Entrada por Compra
          </h1>
        </div>
        <div className="text-sm text-white/50">
          Tasa BCV: <span className="text-[#c8952e] font-bold">{state.tasa.toFixed(2)} Bs/USD</span>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-[#131313] rounded-lg border border-[#2a2a2a] p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Proveedor */}
            <div>
              <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-1">
                Proveedor
              </label>
              <input
                type="text"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-[#c8952e]"
                placeholder="Nombre del proveedor"
              />
            </div>

            {/* Número de Factura */}
            <div>
              <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-1">
                Número de Factura
              </label>
              <input
                type="text"
                value={numeroFactura}
                onChange={(e) => setNumeroFactura(e.target.value)}
                className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-[#c8952e]"
                placeholder="Factura #"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-[#c8952e]"
              />
            </div>
          </div>

          {/* Condiciones de Pago Reestilizado */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <HandCoins className="w-4 h-4 text-white/70" />
              <label className="block text-xs font-black text-white uppercase tracking-wider">
                Condiciones de Pago
              </label>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4 shadow-xl">
              <div className="flex gap-2">
                {['contado', 'credito', 'mixto'].map((cond) => (
                  <button
                    key={cond}
                    onClick={() => setCondicionesPago(cond as any)}
                    className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all border ${
                      condicionesPago === cond
                        ? 'bg-[#c8952e] text-[#0b0b0b] border-[#c8952e]'
                        : 'bg-transparent text-white/70 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {cond === 'contado' ? 'Contado' : cond === 'credito' ? 'Crédito' : 'Mixto'}
                  </button>
                ))}
              </div>

              <div className="bg-black/30 rounded-lg p-4 space-y-2 border border-white/5">
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-white/70">Total factura USD:</span>
                  <span className="text-white">USD ${totalUSD.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-white/70">Total pagado USD:</span>
                  {condicionesPago === 'mixto' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500">USD $</span>
                      <input 
                        type="number"
                        value={totalPagadoUSD}
                        onChange={(e) => setTotalPagadoUSD(Number(e.target.value))}
                        className="bg-black/40 border border-white/10 rounded px-2 py-0.5 w-24 text-right text-emerald-500 focus:outline-none focus:border-[#c8952e]"
                        step="0.01"
                      />
                    </div>
                  ) : (
                    <span className="text-emerald-500">USD ${totalPagadoUSD.toFixed(2)}</span>
                  )}
                </div>
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-white/70">Saldo pendiente USD:</span>
                  <span className="text-emerald-500">USD ${saldoPendiente.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agregar Productos */}
      <div className="bg-[#131313] rounded-lg border border-[#2a2a2a] p-6">
        <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Plus className="w-3 h-3 text-[#c8952e]" /> Añadir Productos al Lote
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          {/* Buscador de Productos */}
          <div className="relative">
            <input
              type="text"
              value={busquedaProducto}
              onChange={(e) => setBusquedaProducto(e.target.value)}
              className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-[#c8952e]"
              placeholder="Buscar producto..."
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-white/30" />
          </div>

          {/* Selector de Producto */}
          <div>
            <select
              value={productoSeleccionado}
              onChange={(e) => {
                setProductoSeleccionado(e.target.value);
                const producto = state.productos.find(p => p.id === e.target.value);
                if (producto) {
                  setCostoUnitario(producto.costoUSD || 0);
                }
              }}
              className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-[#c8952e]"
            >
              <option value="">Seleccionar producto</option>
              {productosDisponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} - {p.nombre} (Stock: {p.stock})
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad */}
          <div>
            <input
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-[#c8952e]"
              placeholder="Cantidad"
              min="1"
            />
          </div>

          {/* Costo Unitario */}
          <div>
            <input
              type="number"
              value={costoUnitario}
              onChange={(e) => setCostoUnitario(Number(e.target.value))}
              className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-[#c8952e]"
              placeholder="Costo Unitario USD"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <button
          onClick={agregarProducto}
          className="flex items-center gap-2 px-4 py-2 bg-[#c8952e] text-[#0b0b0b] rounded-md font-black text-[10px] uppercase hover:bg-[#d9a540] transition-colors shadow-lg shadow-[#c8952e]/10"
        >
          <Plus className="w-4 h-4" />
          Agregar Producto
        </button>

        {/* Tabla de Productos */}
        {productosSeleccionados.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left py-2 text-[10px] font-bold text-white/50 uppercase tracking-wider">Producto</th>
                  <th className="text-right py-2 text-[10px] font-bold text-white/50 uppercase tracking-wider">Cantidad</th>
                  <th className="text-right py-2 text-[10px] font-bold text-white/50 uppercase tracking-wider">Costo Unitario</th>
                  <th className="text-right py-2 text-[10px] font-bold text-white/50 uppercase tracking-wider">Subtotal</th>
                  <th className="text-right py-2 text-[10px] font-bold text-white/50 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody>
                {productosSeleccionados.map((p) => (
                  <tr key={p.productoId} className="border-b border-[#1a1a1a]">
                    <td className="py-2 text-white font-bold text-xs uppercase">{p.nombre}</td>
                    <td className="py-2 text-right text-white text-xs">{p.cantidad}</td>
                    <td className="py-2 text-right text-white text-xs">${p.costoUnitarioUSD.toFixed(2)}</td>
                    <td className="py-2 text-right text-[#c8952e] font-bold text-xs">${p.subtotalUSD.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => eliminarProducto(p.productoId)}
                        className="text-red-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totales Inferiores */}
      <div className="bg-[#131313] rounded-lg border border-[#2a2a2a] p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0b0b0b] rounded-md p-4 border border-white/5">
            <p className="text-[10px] text-white/50 uppercase tracking-wider font-black">Total en Bolívares</p>
            <p className="text-2xl font-black text-white">{Utils.fmtBS(totalBS)}</p>
          </div>
          <button
            onClick={registrarCompra}
            disabled={productosSeleccionados.length === 0 || !proveedor || !numeroFactura}
            className="w-full py-3 bg-[#c8952e] text-[#0b0b0b] rounded-md font-black text-lg uppercase tracking-wider hover:bg-[#d9a540] transition-colors disabled:opacity-20 flex items-center justify-center gap-3 shadow-xl shadow-[#c8952e]/10"
          >
            <CheckCircle className="w-6 h-6" /> Registrar Compra
          </button>
        </div>
      </div>

      {/* Compras Recientes */}
      {comprasRecientes.length > 0 && (
        <div className="bg-[#131313] rounded-lg border border-[#2a2a2a] p-6">
          <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShoppingBag className="w-3 h-3 text-[#3a9bdc]" /> Historial Reciente de Compras
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left py-2 text-[9px] font-bold text-white/40 uppercase tracking-wider">Factura</th>
                  <th className="text-left py-2 text-[9px] font-bold text-white/40 uppercase tracking-wider">Proveedor</th>
                  <th className="text-left py-2 text-[9px] font-bold text-white/40 uppercase tracking-wider">Fecha</th>
                  <th className="text-right py-2 text-[9px] font-bold text-white/40 uppercase tracking-wider">Total USD</th>
                  <th className="text-right py-2 text-[9px] font-bold text-white/40 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {comprasRecientes.slice(-5).reverse().map((compra) => (
                  <tr key={compra.id} className="border-b border-[#1a1a1a] hover:bg-white/5 transition-colors">
                    <td className="py-2 text-white text-xs font-bold mono">{compra.numeroFactura}</td>
                    <td className="py-2 text-white/70 text-xs uppercase">{compra.proveedor}</td>
                    <td className="py-2 text-white/70 text-xs">{compra.fecha}</td>
                    <td className="py-2 text-right text-[#c8952e] font-bold text-xs">${compra.totalUSD.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                        compra.estado === 'pagado' ? 'bg-green-500/20 text-green-500' :
                        compra.estado === 'pendiente' ? 'bg-red-500/20 text-red-500' :
                        'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {compra.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
