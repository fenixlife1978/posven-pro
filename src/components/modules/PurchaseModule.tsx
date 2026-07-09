"use client";

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Trash2, 
  Search,
  AlertCircle,
  CheckCircle
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Proveedor */}
          <div>
            <label className="block text-sm font-bold text-white/70 uppercase tracking-wider mb-1">
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
            <label className="block text-sm font-bold text-white/70 uppercase tracking-wider mb-1">
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
            <label className="block text-sm font-bold text-white/70 uppercase tracking-wider mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-[#c8952e]"
            />
          </div>

          {/* Tasa BCV */}
          <div>
            <label className="block text-sm font-bold text-white/70 uppercase tracking-wider mb-1">
              Tasa BCV Aplicada (Bs/$)
            </label>
            <input
              type="text"
              value={state.tasa.toFixed(2)}
              disabled
              className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-md px-3 py-2 text-[#c8952e] font-bold focus:outline-none cursor-not-allowed opacity-70"
            />
          </div>

          {/* Condiciones de Pago */}
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-bold text-white/70 uppercase tracking-wider mb-1">
              Condiciones de Pago
            </label>
            <div className="flex gap-3">
              {['contado', 'credito', 'mixto'].map((cond) => (
                <button
                  key={cond}
                  onClick={() => setCondicionesPago(cond as any)}
                  className={`px-4 py-2 rounded-md text-sm font-bold uppercase transition-all ${
                    condicionesPago === cond
                      ? 'bg-[#c8952e] text-[#0b0b0b]'
                      : 'bg-[#0b0b0b] text-white/70 hover:bg-[#1a1a1a]'
                  }`}
                >
                  {cond === 'contado' ? 'Contado' : cond === 'credito' ? 'Crédito' : 'Mixto'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Agregar Productos */}
      <div className="bg-[#131313] rounded-lg border border-[#2a2a2a] p-6">
        <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-4">
          Añadir Productos al Lote
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
          className="flex items-center gap-2 px-4 py-2 bg-[#c8952e] text-[#0b0b0b] rounded-md font-bold hover:bg-[#d9a540] transition-colors"
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
                  <th className="text-left py-2 text-sm font-bold text-white/50 uppercase tracking-wider">Producto</th>
                  <th className="text-right py-2 text-sm font-bold text-white/50 uppercase tracking-wider">Cantidad</th>
                  <th className="text-right py-2 text-sm font-bold text-white/50 uppercase tracking-wider">Costo Unitario</th>
                  <th className="text-right py-2 text-sm font-bold text-white/50 uppercase tracking-wider">Subtotal</th>
                  <th className="text-right py-2 text-sm font-bold text-white/50 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody>
                {productosSeleccionados.map((p) => (
                  <tr key={p.productoId} className="border-b border-[#1a1a1a]">
                    <td className="py-2 text-white font-bold">{p.nombre}</td>
                    <td className="py-2 text-right text-white">{p.cantidad}</td>
                    <td className="py-2 text-right text-white">${p.costoUnitarioUSD.toFixed(2)}</td>
                    <td className="py-2 text-right text-[#c8952e] font-bold">${p.subtotalUSD.toFixed(2)}</td>
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

      {/* Totales */}
      <div className="bg-[#131313] rounded-lg border border-[#2a2a2a] p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0b0b0b] rounded-md p-4">
            <p className="text-xs text-white/50 uppercase tracking-wider font-bold">Total en Bolívares</p>
            <p className="text-2xl font-black text-white">Bs. {totalBS.toFixed(2)}</p>
          </div>
          <div className="bg-[#0b0b0b] rounded-md p-4">
            <p className="text-xs text-white/50 uppercase tracking-wider font-bold">Total Factura USD</p>
            <p className="text-2xl font-black text-[#c8952e]">${totalUSD.toFixed(4)}</p>
          </div>
          <div className="bg-[#0b0b0b] rounded-md p-4">
            <p className="text-xs text-white/50 uppercase tracking-wider font-bold">Total Pagado USD</p>
            <input
              type="number"
              value={totalPagadoUSD}
              onChange={(e) => {
                if (condicionesPago === 'mixto') {
                  setTotalPagadoUSD(Number(e.target.value));
                }
              }}
              disabled={condicionesPago !== 'mixto'}
              className={`w-full bg-transparent text-2xl font-black text-[#c8952e] border-0 focus:outline-none ${
                condicionesPago !== 'mixto' ? 'cursor-not-allowed opacity-70' : ''
              }`}
              step="0.01"
              min="0"
              max={totalUSD}
            />
          </div>
          <div className="bg-[#0b0b0b] rounded-md p-4">
            <p className="text-xs text-white/50 uppercase tracking-wider font-bold">Saldo Pendiente USD</p>
            <p className={`text-2xl font-black ${saldoPendiente > 0 ? 'text-red-500' : 'text-green-500'}`}>
              ${saldoPendiente.toFixed(4)}
            </p>
          </div>
        </div>

        {/* Botón Registrar */}
        <button
          onClick={registrarCompra}
          className="w-full mt-4 py-3 bg-[#c8952e] text-[#0b0b0b] rounded-md font-black text-lg uppercase tracking-wider hover:bg-[#d9a540] transition-colors"
        >
          Registrar Compra
        </button>
      </div>

      {/* Compras Recientes */}
      {comprasRecientes.length > 0 && (
        <div className="bg-[#131313] rounded-lg border border-[#2a2a2a] p-6">
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-4">
            Compras Recientes
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Factura</th>
                  <th className="text-left py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Proveedor</th>
                  <th className="text-left py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Fecha</th>
                  <th className="text-right py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Total USD</th>
                  <th className="text-right py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {comprasRecientes.slice(-5).reverse().map((compra) => (
                  <tr key={compra.id} className="border-b border-[#1a1a1a]">
                    <td className="py-2 text-white">{compra.numeroFactura}</td>
                    <td className="py-2 text-white/70">{compra.proveedor}</td>
                    <td className="py-2 text-white/70">{compra.fecha}</td>
                    <td className="py-2 text-right text-[#c8952e] font-bold">${compra.totalUSD.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        compra.estado === 'pagado' ? 'bg-green-500/20 text-green-500' :
                        compra.estado === 'pendiente' ? 'bg-red-500/20 text-red-500' :
                        'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {compra.estado === 'pagado' ? 'Pagado' :
                         compra.estado === 'pendiente' ? 'Pendiente' : 'Parcial'}
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