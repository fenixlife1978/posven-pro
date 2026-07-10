
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AppState, SaleItem, Sale, PaymentMethod, ReportZ, Movimiento, PagoRealizado, Customer, Return, ReturnItem } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Receipt, 
  Barcode, 
  Wallet, 
  X, 
  CheckCircle2, 
  FileText,
  RotateCcw,
  History,
  ClipboardList,
  ArrowLeft,
  Eye,
  Clock,
  Printer,
  Zap,
  Share2,
  UserPlus,
  User,
  AlertTriangle,
  Undo2,
  Lock
} from 'lucide-react';

// ✅ Declarar el tipo de electronAPI en Window para soporte de impresión nativa
declare global {
  interface Window {
    electronAPI?: {
      printTicket: (data: any) => Promise<void>;
    };
  }
}

export default function SalesModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const ahora = Utils.ahora();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'pos' | 'history' | 'credits' | 'returns'>('pos');
  const [showReport, setShowReport] = useState<'Y' | 'Z' | null>(null);
  const [cliente, setCliente] = useState('Consumidor final');
  
  const [pagos, setPagos] = useState<PagoRealizado[]>([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [metodoActual, setMetodoActual] = useState<PaymentMethod>('efectivo_usd');
  const [montoInput, setMontoInput] = useState('');
  
  const [showAbonoModal, setShowAbonoModal] = useState<string | null>(null);
  const [abonoPagos, setAbonoPagos] = useState<PagoRealizado[]>([]);
  const [showAbonoMultiModal, setShowAbonoMultiModal] = useState(false);
  
  const [showDetailsModal, setShowDetailsModal] = useState<any | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<any | null>(null);
  
  const [lastProcessedSale, setLastProcessedSale] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Estados para Carga de Crédito
  const [isCreditView, setIsCreditView] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', cedula: 'V-', phone: '', address: '' });

  // Estados para Devoluciones (Trasladados de ReturnsModule)
  const [returnView, setReturnView] = useState<'list' | 'create'>('list');
  const [returnSaleSearch, setReturnSaleSearch] = useState('');
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'EFECTIVO' | 'MISMO_METODO' | 'CREDITO_TIENDA'>('EFECTIVO');
  const [returnReason, setReturnReason] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const reportPrintRef = useRef<HTMLDivElement | null>(null);

  // Funciones de Devolución
  const buscarVentaParaDevolucion = () => {
    const sale = state.ventas.find(v => v.id === returnSaleSearch || v.id.endsWith(returnSaleSearch));
    if (!sale) return alert('Venta no encontrada');
    setSelectedSaleForReturn(sale);
    setReturnItems([]);
  };

  const handleAddReturnItem = (productoId: string, nombre: string, precioUnitUSD: number, maxQty: number) => {
    const alreadyReturned = (state.devoluciones || [])
      .filter(d => d.ventaId === selectedSaleForReturn?.id)
      .flatMap(d => d.items)
      .filter(i => i.productoId === productoId)
      .reduce((sum, i) => sum + i.cantidad, 0);

    const availableToReturn = maxQty - alreadyReturned;
    if (availableToReturn <= 0) return alert('Este producto ya ha sido devuelto en su totalidad.');

    const qtyStr = prompt(`Cantidad a devolver (Máx: ${availableToReturn}):`, '1');
    if (qtyStr === null) return;
    const qty = parseInt(qtyStr || '0');
    if (isNaN(qty) || qty <= 0 || qty > availableToReturn) return alert('Cantidad no válida');

    const condition = confirm('¿El producto se encuentra APTO para la venta? (OK: Vuelve a stock, CANCEL: Va a merma/daño)') 
      ? 'REINTEGRADO_STOCK' 
      : 'MERMA_DANADO';

    setReturnItems([...returnItems, {
      productoId,
      nombre,
      cantidad: qty,
      precioUnitUSD,
      estadoProducto: condition as any
    }]);
  };

  const procesarDevolucionPOS = () => {
    if (!selectedSaleForReturn || returnItems.length === 0) return;
    if (!returnReason.trim()) return alert('Por favor indique el motivo de la devolución');

    // VERIFICACIÓN DE PIN DE AUTORIZACIÓN
    const pinIngresado = prompt('AUTORIZACIÓN REQUERIDA: Ingrese el PIN de 6 dígitos para autorizar esta devolución:');
    if (pinIngresado !== state.pinDevolucion) {
      alert('PIN DE AUTORIZACIÓN INCORRECTO. La devolución ha sido cancelada.');
      return;
    }

    const totalDevuelto = returnItems.reduce((s, i) => s + (i.cantidad * i.precioUnitUSD), 0);
    const idDev = 'DEV-' + String(state.proximaDevolucion).padStart(6, '0');
    const ahoraStr = Utils.ahora();

    const nuevaDevolucion: Return = {
      id: idDev,
      ventaId: selectedSaleForReturn.id,
      fecha: ahoraStr,
      items: [...returnItems],
      totalUSD: totalDevuelto,
      metodoReembolso: refundMethod,
      motivo: returnReason
    };

    const nuevosProductos = [...state.productos];
    const nuevosMovimientos: Movimiento[] = [];

    returnItems.forEach(item => {
      const pIdx = nuevosProductos.findIndex(p => p.id === item.productoId);
      if (pIdx >= 0) {
        const p = nuevosProductos[pIdx];
        const stockAntes = p.stock;
        if (item.estadoProducto === 'REINTEGRADO_STOCK') {
          nuevosProductos[pIdx] = { ...p, stock: p.stock + item.cantidad };
        }
        nuevosMovimientos.push({
          id: Store.uid(),
          productoId: item.productoId,
          tipo: 'devolucion',
          cantidad: item.cantidad,
          stockAntes,
          stockDespues: nuevosProductos[pIdx].stock,
          fecha: ahoraStr,
          referencia: `DEVOLUCIÓN ${idDev} - REF VENTA ${selectedSaleForReturn.id}`
        });
      }
    });

    const nuevasVentas = state.ventas.map(v => {
      if (v.id === selectedSaleForReturn.id) {
        return { ...v, estado: 'parcialmente_devuelta' as any };
      }
      return v;
    });

    updateState({
      productos: nuevosProductos,
      devoluciones: [nuevaDevolucion, ...(state.devoluciones || [])],
      movimientos: [...state.movimientos, ...nuevosMovimientos],
      ventas: nuevasVentas,
      proximaDevolucion: state.proximaDevolucion + 1
    });

    alert(`Devolución ${idDev} procesada con éxito`);
    setReturnView('list');
    setSelectedSaleForReturn(null);
    setReturnItems([]);
    setReturnReason('');
  };

  // Cálculos para el abono dinámico
  const deudaInicialUSD = showAbonoModal ? state.cxc.filter((d: any) => d.cliente === showAbonoModal && d.estado !== 'pagada').reduce((s: number, d: any) => s + d.saldoUSD, 0) : 0;
  const pagosUSD_Abono = abonoPagos.filter(p => p.metodo === 'efectivo_usd' || p.metodo === 'zelle').reduce((s, p) => s + p.montoUSD, 0);
  const pagosBS_Abono = abonoPagos.filter(p => p.metodo !== 'efectivo_usd' && p.metodo !== 'zelle').reduce((s, p) => s + p.montoBS, 0);
  
  const deudaVisualUSD = Math.max(0, deudaInicialUSD - pagosUSD_Abono);
  const totalAPagarBS = deudaVisualUSD * state.tasa;

  const subtotalUSD = state.carrito.reduce((s, i) => s + i.subtotalUSD, 0);
  const totalBS = subtotalUSD * state.tasa;
  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  const saldoRestanteUSD = Math.max(0, subtotalUSD - totalPagadoUSD);
  const saldoRestanteBS = saldoRestanteUSD * state.tasa;

  const matches = search.trim().length > 0 
    ? state.productos
        .filter(p => p.activo && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())))
        .sort((a, b) => {
          const s = search.toLowerCase();
          if (a.codigo.toLowerCase() === s) return -1;
          if (a.codigo.toLowerCase().startsWith(s)) return -1;
          return 0;
        }).slice(0, 8)
    : [];

  const filteredClients = clientSearch.trim().length > 0
    ? (state.clientes || []).filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.cedula.includes(clientSearch))
    : [];

  const agregar = (pid: string) => {
    const p = state.productos.find(x => x.id === pid);
    if (!p || p.stock <= 0) return;
    const nuevoCarrito = [...state.carrito];
    const idx = nuevoCarrito.findIndex(i => i.productoId === pid);
    if (idx >= 0) {
      if (nuevoCarrito[idx].cantidad >= p.stock) return;
      nuevoCarrito[idx].cantidad++;
      nuevoCarrito[idx].subtotalUSD = nuevoCarrito[idx].cantidad * nuevoCarrito[idx].precioUnitUSD;
    } else {
      nuevoCarrito.push({ productoId: pid, nombre: p.nombre, precioUnitUSD: p.precioUSD, cantidad: 1, subtotalUSD: p.precioUSD });
    }
    updateState({ carrito: nuevoCarrito });
    setSearch('');
    setPagos([]);
    searchInputRef.current?.focus();
  };

  const updateQty = (idx: number, delta: number) => {
    const nuevo = [...state.carrito];
    const item = nuevo[idx];
    const p = state.productos.find(x => x.id === item.productoId);
    const n = item.cantidad + delta;
    if (n <= 0) nuevo.splice(idx, 1);
    else if (p && n <= p.stock) {
      item.cantidad = n;
      item.subtotalUSD = n * item.precioUnitUSD;
    }
    updateState({ carrito: nuevo });
    setPagos([]);
  };

  const addPago = (isAbono: boolean = false) => {
    let monto = parseFloat(montoInput);
    if (isNaN(monto) || monto <= 0) {
      alert("El monto debe ser mayor a cero");
      return;
    }

    let montoUSD = (metodoActual.includes('usd') || metodoActual === 'zelle') ? monto : monto / state.tasa;
    let montoBS = (metodoActual.includes('usd') || metodoActual === 'zelle') ? monto * state.tasa : monto;
    
    if (isAbono) {
      setAbonoPagos([...abonoPagos, { metodo: metodoActual, montoUSD, montoBS }]);
      setShowAbonoMultiModal(false);
    } else {
      if (montoUSD > (saldoRestanteUSD + 0.01)) return alert("Excede el saldo");
      setPagos([...pagos, { metodo: metodoActual, montoUSD, montoBS }]);
      setShowMultiModal(false);
    }
    setMontoInput('');
  };

  const removeAbonoPago = (idx: number) => {
    setAbonoPagos(abonoPagos.filter((_, i) => i !== idx));
  };

  const ejecutarVenta = () => {
    if (state.carrito.length === 0 || saldoRestanteUSD > 0.01) return;
    
    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahoraStr = Utils.ahora();
    
    const nuevosProductos = state.productos.map(p => {
      const item = state.carrito.find(i => i.productoId === p.id);
      return item ? { ...p, stock: p.stock - item.cantidad } : p;
    });

    const nuevosMovimientos: Movimiento[] = state.carrito.map(item => {
      const p = state.productos.find(prod => prod.id === item.productoId);
      return {
        id: Store.uid(),
        productoId: item.productoId,
        tipo: 'venta',
        cantidad: -Math.abs(item.cantidad),
        stockAntes: p?.stock || 0,
        stockDespues: (p?.stock || 0) - item.cantidad,
        fecha: ahoraStr,
        referencia: `VENTA ${reciboId}`
      };
    });

    const nuevaVenta: Sale & { payments?: PagoRealizado[] } = {
      id: reciboId,
      fecha: ahoraStr,
      cliente,
      items: [...state.carrito],
      subtotalUSD,
      descuentoUSD: 0,
      totalUSD: subtotalUSD,
      totalBS,
      metodoPago: pagos.length > 1 ? 'mixto' : (pagos[0]?.metodo || 'efectivo_usd'),
      estado: 'completada',
      type: 'VENTA',
      received: totalPagadoUSD,
      change: Math.max(0, totalPagadoUSD - subtotalUSD),
      payments: [...pagos]
    };

    updateState({
      productos: nuevosProductos,
      ventas: [...state.ventas, nuevaVenta],
      movimientos: [...state.movimientos, ...nuevosMovimientos],
      carrito: [],
      proximoRecibo: state.proximoRecibo + 1,
      acumuladoHistorico: state.acumuladoHistorico + subtotalUSD
    });
    
    setLastProcessedSale(nuevaVenta);
    setShowReceiptModal(true);
    setPagos([]);
    setCliente('Consumidor final');
  };

  const ejecutarVentaACredito = () => {
    let finalClient = selectedClient;
    
    if (showNewClientForm) {
      if (!newClient.name || !newClient.cedula) return alert('Nombre y Cédula requeridos');
      const nc: Customer = {
        id: Store.uid(),
        name: newClient.name,
        cedula: newClient.cedula,
        phone: newClient.phone,
        address: newClient.address,
        debt: subtotalUSD
      };
      updateState({ clientes: [...(state.clientes || []), nc] });
      finalClient = nc;
    }

    if (!finalClient) return alert('Seleccione un cliente');

    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahoraStr = Utils.ahora();
    
    const nuevosProductos = state.productos.map(p => {
      const item = state.carrito.find(i => i.productoId === p.id);
      return item ? { ...p, stock: p.stock - item.cantidad } : p;
    });

    const nuevosMovimientos: Movimiento[] = state.carrito.map(item => {
      const p = state.productos.find(prod => prod.id === item.productoId);
      return {
        id: Store.uid(),
        productoId: item.productoId,
        tipo: 'venta',
        cantidad: -Math.abs(item.cantidad),
        stockAntes: p?.stock || 0,
        stockDespues: (p?.stock || 0) - item.cantidad,
        fecha: ahoraStr,
        referencia: `CRÉDITO ${reciboId}`
      };
    });

    const nuevaVenta: Sale = {
      id: reciboId,
      fecha: ahoraStr,
      cliente: finalClient.name,
      items: [...state.carrito],
      subtotalUSD,
      descuentoUSD: 0,
      totalUSD: subtotalUSD,
      totalBS,
      metodoPago: 'credito',
      estado: 'pendiente',
      type: 'VENTA',
      received: 0,
      change: 0
    };

    const nuevaCxC = {
      id: reciboId,
      fecha: Utils.hoy(),
      fechaVencimiento: '2099-12-31',
      cliente: finalClient.name,
      montoUSD: subtotalUSD,
      abonadoUSD: 0,
      saldoUSD: subtotalUSD,
      estado: 'pendiente',
      ventaId: reciboId
    };

    updateState({
      productos: nuevosProductos,
      ventas: [...state.ventas, nuevaVenta],
      cxc: [...state.cxc, nuevaCxC],
      movimientos: [...state.movimientos, ...nuevosMovimientos],
      carrito: [],
      proximoRecibo: state.proximoRecibo + 1,
      clientes: (state.clientes || []).map(c => c.id === finalClient?.id ? { ...c, debt: (c.debt || 0) + subtotalUSD } : c)
    });

    setLastProcessedSale(nuevaVenta);
    setShowReceiptModal(true);
    setShowMultiModal(false);
    setIsCreditView(false);
    setSelectedClient(null);
    setShowNewClientForm(false);
    setNewClient({ name: '', cedula: 'V-', phone: '', address: '' });
  };

  const procesarAbonoCascada = () => {
    if (abonoPagos.length === 0 || !showAbonoModal) return;
    
    const totalAbonoUSD = abonoPagos.reduce((s, p) => s + p.montoUSD, 0);
    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahoraStr = Utils.ahora();
    let restante = totalAbonoUSD;
    const nuevasDeudas = [...state.cxc].sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
    
    const actualizadas = nuevasDeudas.map((d: any) => {
      if (d.cliente === showAbonoModal && d.estado !== 'pagada' && restante > 0) {
        const abonoAplicado = Math.min(restante, d.saldoUSD);
        restante -= abonoAplicado;
        
        const historialPagos = d.historialPagos || [];
        historialPagos.push({
          fecha: ahoraStr,
          montoUSD: abonoAplicado,
          montoBS: abonoAplicado * state.tasa,
          reciboId
        });

        const nuevoSaldo = d.saldoUSD - abonoAplicado;
        return { 
          ...d, 
          abonadoUSD: d.abonadoUSD + abonoAplicado, 
          saldoUSD: nuevoSaldo, 
          estado: nuevoSaldo <= 0 ? 'pagada' : 'parcial',
          historialPagos
        };
      }
      return d;
    });

    const registroAbono: Sale & { payments?: PagoRealizado[] } = {
      id: reciboId,
      fecha: ahoraStr,
      cliente: showAbonoModal,
      items: [{ productoId: 'ABONO', nombre: 'ABONO A CUENTA', precioUnitUSD: totalAbonoUSD, cantidad: 1, subtotalUSD: totalAbonoUSD }],
      subtotalUSD: totalAbonoUSD,
      descuentoUSD: 0,
      totalUSD: totalAbonoUSD,
      totalBS: totalAbonoUSD * state.tasa,
      metodoPago: abonoPagos.length > 1 ? 'mixto' : abonoPagos[0].metodo,
      estado: 'completada',
      type: 'COBRO DEUDA',
      received: totalAbonoUSD,
      change: 0,
      payments: [...abonoPagos]
    };

    updateState({ 
      cxc: actualizadas, 
      ventas: [...state.ventas, registroAbono],
      proximoRecibo: state.proximoRecibo + 1,
      clientes: (state.clientes || []).map(c => c.name === showAbonoModal ? { ...c, debt: Math.max(0, (c.debt || 0) - totalAbonoUSD) } : c)
    });

    setLastProcessedSale(registroAbono);
    setShowReceiptModal(true);
    setShowAbonoModal(null);
    setAbonoPagos([]);
  };

  const getReportSummary = () => {
    const hoy = Utils.hoy();
    const ventasHoy = state.ventas.filter(v => v.fecha.startsWith(hoy));
    
    const breakdown: Record<string, { usd: number, bs: number }> = {};
    let totalBS = 0;
    let totalUSD = 0;

    ventasHoy.forEach(v => {
      const payments = v.payments && v.payments.length > 0 ? v.payments : [{ metodo: v.metodoPago, montoUSD: v.totalUSD, montoBS: v.totalBS }];
      payments.forEach((p: PagoRealizado) => {
        const metodo = p.metodo;
        if (!breakdown[metodo]) breakdown[metodo] = { usd: 0, bs: 0 };
        breakdown[metodo].usd += p.montoUSD;
        breakdown[metodo].bs += p.montoBS;
        
        if (metodo === 'efectivo_usd' || metodo === 'zelle') {
          totalUSD += p.montoUSD;
        } else if (metodo !== 'credito') {
          totalBS += p.montoBS;
        }
      });
    });

    return { breakdown, totalBS, totalUSD, ventasHoy };
  };

  const handlePrint = (ref: React.RefObject<HTMLDivElement | null>) => {
    const printContent = ref.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank') as any;
    printWindow?.document.write(`
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: 'Courier New', Courier, monospace; width: 72mm; margin: 0; padding: 4mm; font-size: 11px; color: #000; background: #fff; line-height: 1.2; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .header { margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed #000; }
            .total-grand { font-size: 13px; font-weight: bold; margin: 6px 0; padding: 4px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            th { border-bottom: 1px dashed #000; border-top: 1px dashed #000; font-weight: bold; padding: 4px 0; font-size: 10px; }
            td { padding: 4px 0; vertical-align: top; font-size: 10px; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };
          <\/script>
        </body>
      </html>
    `);
    printWindow?.document.close();
  };

  const handleNativePrint = async (sale: any) => {
    if (!sale) return;
    
    if (!window.electronAPI) {
      handlePrint(printRef);
      return;
    }

    const title = sale.type === 'COBRO DEUDA' ? 'INFORME' : 'RECIBO';
    const printData = [
      { type: 'text', value: state.empresa.nombre.toUpperCase(), style: { fontWeight: "700", textAlign: 'center', fontSize: "16px" } },
      { type: 'text', value: `RIF: ${state.empresa.rif}`, style: { textAlign: 'center', fontSize: "10px" } },
      { type: 'text', value: state.empresa.direccion, style: { textAlign: 'center', fontSize: "10px" } },
      { type: 'text', value: '--------------------------------', style: { textAlign: 'center' } },
      { type: 'text', value: title, style: { textAlign: 'center', fontWeight: "700", fontSize: "14px" } },
      { type: 'text', value: '--------------------------------', style: { textAlign: 'center' } },
      { type: 'text', value: `${title} N: ${sale.id}`, style: { textAlign: 'left', fontSize: "10px" } },
      { type: 'text', value: `FECHA: ${Utils.fmtFecha(sale.fecha)}`, style: { textAlign: 'left', fontSize: "10px" } },
      { type: 'text', value: `CLIENTE: ${sale.cliente.toUpperCase()}`, style: { textAlign: 'left', fontSize: "10px" } },
      { type: 'text', value: '--------------------------------', style: { textAlign: 'center' } }
    ];

    sale.items.forEach((item: any) => {
      printData.push({
        type: 'text',
        value: `${item.cantidad}x ${item.nombre.toUpperCase().slice(0, 20)}`,
        style: { fontWeight: "700", textAlign: 'left', fontSize: "10px" }
      });
      printData.push({
        type: 'text',
        value: `    Ref: ${Utils.fmtUSD(item.precioUnitUSD)} | Total: ${Utils.fmtUSD(item.subtotalUSD)}`,
        style: { fontSize: "10px", textAlign: 'left' }
      });
    });

    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });
    printData.push({ type: 'text', value: `TOTAL BS: ${Utils.fmtBS(sale.totalBS)}`, style: { textAlign: 'right', fontWeight: "700", fontSize: "14px" } });
    printData.push({ type: 'text', value: `REF USD: ${Utils.fmtUSD(sale.totalUSD)}`, style: { textAlign: 'right', fontSize: "12px" } });

    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });
    printData.push({ type: 'text', value: '¡GRACIAS POR SU PREFERENCIA!', style: { textAlign: 'center', fontWeight: "700", fontSize: "12px" } });

    try {
      await window.electronAPI.printTicket(printData);
    } catch (e) {
      handlePrint(printRef);
    }
  };

  const handleNativeReportPrint = async (type: 'Y' | 'Z') => {
    if (!window.electronAPI) {
      handlePrint(reportPrintRef);
      return;
    }

    const { breakdown, totalBS, totalUSD, ventasHoy } = getReportSummary();
    const hoy = Utils.hoy();
    const ahoraReport = Utils.ahora();
    const vDirectas = ventasHoy.filter(v => v.type === 'VENTA').reduce((s, v) => s + v.totalUSD, 0);
    const vCobros = ventasHoy.filter(v => v.type === 'COBRO DEUDA').reduce((s, v) => s + v.totalUSD, 0);

    const printData = [
      { type: 'text', value: state.empresa.nombre.toUpperCase(), style: { fontWeight: "700", textAlign: 'center', fontSize: "16px" } },
      { type: 'text', value: `RIF: ${state.empresa.rif}`, style: { textAlign: 'center', fontSize: "10px" } },
      { type: 'text', value: state.empresa.direccion, style: { textAlign: 'center', fontSize: "10px" } },
      { type: 'text', value: '--------------------------------', style: { textAlign: 'center' } },
      { type: 'text', value: `REPORTE "${type}"`, style: { textAlign: 'center', fontWeight: "700", fontSize: "14px" } },
      { type: 'text', value: '--------------------------------', style: { textAlign: 'center' } },
      { type: 'text', value: `FECHA: ${Utils.fmtFecha(hoy)}`, style: { textAlign: 'left', fontSize: "10px" } },
      { type: 'text', value: `HORA: ${ahoraReport.split('T')[1].slice(0, 8)}`, style: { textAlign: 'left', fontSize: "10px" } }
    ];

    if (type === 'Z') {
      const z = state.reportesZ[state.reportesZ.length - 1];
      printData.push({ type: 'text', value: `REPORTE Z #: ${String(z.numeroZ).padStart(4, '0')}`, style: { textAlign: 'left', fontSize: "10px", fontWeight: "700" } });
    }

    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });
    printData.push({ type: 'text', value: 'RESUMEN POR OPERACIÓN:', style: { textAlign: 'left', fontSize: "10px", fontWeight: "700" } });
    printData.push({ type: 'text', value: `VENTAS DIRECTAS:      ${Utils.fmtUSD(vDirectas)}`, style: { textAlign: 'left', fontSize: "10px" } });
    printData.push({ type: 'text', value: `COBROS DEUDA:         ${Utils.fmtUSD(vCobros)}`, style: { textAlign: 'left', fontSize: "10px" } });
    
    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });
    printData.push({ type: 'text', value: 'DESGLOSE POR MÉTODO:', style: { textAlign: 'left', fontSize: "10px", fontWeight: "700" } });
    
    Object.entries(breakdown).forEach(([metodo, montos]) => {
      const isUSD = metodo === 'efectivo_usd' || metodo === 'zelle';
      const label = Utils.metodoLabel(metodo).toUpperCase();
      const val = isUSD ? Utils.fmtUSD(montos.usd) : Utils.fmtBS(montos.bs);
      printData.push({ type: 'text', value: `${label.padEnd(20)} ${val}`, style: { textAlign: 'left', fontSize: "9px" } });
    });

    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });
    printData.push({ type: 'text', value: `TOTAL CAJA BS:  ${Utils.fmtBS(totalBS)}`, style: { textAlign: 'left', fontSize: "12px", fontWeight: "700" } });
    printData.push({ type: 'text', value: `TOTAL CAJA USD: ${Utils.fmtUSD(totalUSD)}`, style: { textAlign: 'left', fontSize: "12px", fontWeight: "700" } });

    if (type === 'Z') {
      const z = state.reportesZ[state.reportesZ.length - 1];
      printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });
      printData.push({ type: 'text', value: `ACUMULADO HISTORICO: ${Utils.fmtUSD(z.acumuladoHistoricoUSD)}`, style: { textAlign: 'left', fontSize: "10px", fontWeight: "700" } });
    }

    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center' } });
    printData.push({ type: 'text', value: '*** DOCUMENTO FISCAL ***', style: { textAlign: 'center', fontWeight: "700", fontSize: "10px" } });

    try {
      await window.electronAPI.printTicket(printData);
    } catch (e) {
      handlePrint(reportPrintRef);
    }
  };

  const emitirReporteZ = () => {
    if (!confirm('¿Desea realizar el CIERRE FISCAL Z?')) return;
    const hoy = Utils.hoy();
    const ventasHoy = state.ventas.filter(v => v.fecha.startsWith(hoy));
    const totalHoy = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
    const nuevoZ: ReportZ = {
      id: `Z-${String(state.ultimoZ + 1).padStart(4, '0')}`,
      fecha: hoy,
      numeroZ: state.ultimoZ + 1,
      desdeFactura: ventasHoy[0]?.id || 'N/A',
      hastaFactura: ventasHoy[ventasHoy.length - 1]?.id || 'N/A',
      baseImponibleUSD: totalHoy / 1.16,
      ivaUSD: totalHoy - (totalHoy / 1.16),
      exentoUSD: 0,
      totalBrutoUSD: totalHoy,
      acumuladoHistoricoUSD: state.acumuladoHistorico
    };
    updateState({ reportesZ: [...state.reportesZ, nuevoZ], ultimoZ: state.ultimoZ + 1 });
    setShowReport('Z');
  };

  const handleSharePDF = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Recibo ${lastProcessedSale?.id}`,
          text: `Resumen de recibo correlativo nro ${lastProcessedSale?.id} por un total de ${Utils.fmtBS(lastProcessedSale?.totalBS || 0)}`,
        });
      } catch (err) {
        handlePrint(printRef);
      }
    } else {
      handlePrint(printRef);
    }
  };

  const { breakdown, totalBS: rTotalBS, totalUSD: rTotalUSD, ventasHoy: rVentasHoy } = getReportSummary();
  const rVDirectas = rVentasHoy.filter(v => v.type === 'VENTA').reduce((s, v) => s + v.totalUSD, 0);
  const rVCobros = rVentasHoy.filter(v => v.type === 'COBRO DEUDA').reduce((s, v) => s + v.totalUSD, 0);

  return (
    <div className="flex flex-col gap-2 h-[calc(100vh-100px)] max-w-7xl mx-auto w-full overflow-hidden">
      <div className="flex gap-2 no-print shrink-0 overflow-x-auto pb-1">
        <button onClick={() => setView('pos')} className={`btn btn-sm ${view === 'pos' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><ShoppingCart className="w-3.5 h-3.5"/> Punto de Venta</button>
        <button onClick={() => setView('history')} className={`btn btn-sm ${view === 'history' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><History className="w-3.5 h-3.5"/> Historial</button>
        <button onClick={() => setView('credits')} className={`btn btn-sm ${view === 'credits' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><ClipboardList className="w-3.5 h-3.5"/> Consultar Créditos</button>
        <button onClick={() => setShowReport('Y')} className="btn btn-sm bg-white text-ink font-bold border-line border"><FileText className="w-3.5 h-3.5"/> Reporte Y</button>
        <button onClick={emitirReporteZ} className="btn btn-sm bg-white text-ink font-bold border-line border"><Receipt className="w-3.5 h-3.5"/> Reporte Z</button>
        <button onClick={() => setView('returns')} className={`btn btn-sm ${view === 'returns' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><RotateCcw className="w-3.5 h-3.5"/> Devoluciones</button>
      </div>

      {view === 'pos' ? (
        <div className="flex flex-col gap-2 flex-1 overflow-hidden animate-in fade-in duration-300">
          <div className="relative group shrink-0">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8952e] z-10"><Barcode className="w-5 h-5" /></div>
            <input 
              ref={searchInputRef}
              className="form-input pl-14 py-2 text-base bg-white border-brand-gold/30 text-ink placeholder-ink/40" 
              placeholder="Escanee o busque producto..." value={search} onChange={e => setSearch(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && matches.length >= 1 && agregar(matches[0].id)} autoFocus
            />
            {matches.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-line rounded-b-lg shadow-2xl z-[100] mt-1 overflow-hidden">
                {matches.map(p => (
                  <div key={p.id} onClick={() => agregar(p.id)} className="flex items-center justify-between p-2 hover:bg-brand-gold/10 cursor-pointer border-b border-line">
                    <div className="text-ink text-xs font-bold uppercase">{p.nombre} <span className="text-ink/40 text-[9px] mono ml-2">{p.codigo}</span></div>
                    <div className="text-brand-gold font-black text-sm">{Utils.fmtUSD(p.precioUSD)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-1 gap-3 overflow-hidden">
            <div className="w-1/3 flex flex-col gap-2">
              <div className="card p-3 space-y-3 bg-white border-line h-full flex flex-col">
                <div className="form-group mb-0">
                  <label className="text-ink text-[10px] font-black uppercase block mb-1">IDENTIFICACIÓN CLIENTE</label>
                  <input className="form-input h-8 text-xs bg-surface-soft text-ink border-line font-black uppercase" value={cliente} onChange={e => setCliente(e.target.value)} />
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-ink text-[10px] font-black uppercase block mb-1">MÉTODOS APLICADOS</label>
                  <div className="flex-1 p-2 border border-line bg-surface-soft rounded-lg overflow-y-auto">
                    {pagos.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-[10px] border-b border-line/30 py-1 text-ink font-black uppercase">
                        <span>{Utils.metodoLabel(p.metodo)}</span>
                        <span className="text-brand-gold-deep">{Utils.fmtUSD(p.montoUSD)}</span>
                      </div>
                    ))}
                    {pagos.length === 0 && <div className="text-[10px] text-ink/20 italic py-2 text-center uppercase font-black">Sin abonos</div>}
                  </div>
                </div>
                <div className="p-3 border border-[#3a9bdc]/30 bg-[#3a9bdc]/5 rounded-lg text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <label className="text-ink text-[10px] font-black uppercase">SALDO RESTANTE</label>
                    <button onClick={() => setShowMultiModal(true)} className="btn-icon h-6 w-6 bg-[#c8952e] text-black"><Wallet className="w-3.5 h-3.5"/></button>
                  </div>
                  <div className={`text-2xl font-black ${saldoRestanteUSD <= 0.01 ? 'text-[#27ae60]' : 'text-[#3a9bdc]'}`}>
                    {saldoRestanteUSD <= 0.01 ? 'SALDADO' : Utils.fmtUSD(saldoRestanteUSD)}
                  </div>
                  <div className="bg-ink py-2 rounded-lg border-2 border-line">
                    <label className="text-white text-[9px] font-black uppercase block mb-1">EQUIVALENTE A PAGAR</label>
                    <div className="text-2xl font-black text-white">{Utils.fmtBS(saldoRestanteBS)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-2/3 flex flex-col gap-2 overflow-hidden">
              <div className="card flex-1 flex flex-col overflow-hidden bg-white border-none shadow-xl">
                <div className="grid grid-cols-[1fr_80px_60px_70px_80px_80px_40px] gap-2 px-3 py-3 bg-ink text-white text-[9px] font-black uppercase tracking-[0.15em] rounded-t-lg">
                  <div>Descripción</div><div className="text-center">Cant</div><div className="text-center">U.M.</div><div className="text-right">Precio ($)</div><div className="text-right">Precio (Bs)</div><div className="text-right">Total</div><div className="text-center"></div>
                </div>
                <div className="flex-1 overflow-y-auto p-1 space-y-1">
                  {state.carrito.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-black/10"><ShoppingCart className="w-16 h-16 mb-2"/><p className="font-black uppercase text-[10px] tracking-tighter">Esperando Productos...</p></div>
                  ) : (
                    state.carrito.map((item, i) => {
                      const product = state.productos.find(p => p.id === item.productoId);
                      return (
                        <div key={i} className="grid grid-cols-[1fr_80px_60px_70px_80px_80px_40px] gap-2 items-center px-3 py-3 bg-white border-b border-black/5 text-ink">
                          <div className="flex flex-col min-w-0">
                            <div className="truncate font-black text-[10px] uppercase leading-tight">{item.nombre}</div>
                            <div className="text-[8px] font-bold text-ink/60 mono uppercase mt-0.5">{item.productoId}</div>
                          </div>
                          <div className="flex items-center justify-center gap-1 bg-surface-soft rounded p-0.5 border border-line/30">
                            <button onClick={() => updateQty(i, -1)} className="text-ink font-black text-xs px-1 hover:bg-black/5">-</button>
                            <span className="w-5 text-center text-[10px] font-black">{item.cantidad}</span>
                            <button onClick={() => updateQty(i, 1)} className="text-ink font-black text-xs px-1 hover:bg-black/5">+</button>
                          </div>
                          <div className="text-center text-[9px] font-black uppercase">{product?.cantidad || '-'}</div>
                          <div className="text-right text-[10px] font-black">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                          <div className="text-right text-[10px] font-black">{Utils.fmtBS(item.precioUnitUSD * state.tasa)}</div>
                          <div className="text-right text-[11px] font-black">{Utils.fmtUSD(item.subtotalUSD)}</div>
                          <div className="flex justify-center"><button onClick={() => updateQty(i, -item.cantidad)} className="text-ink/20 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button></div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="p-4 bg-ink border-t border-line/10 flex items-center justify-between rounded-b-lg">
                  <div className="space-y-0">
                    <label className="text-white/60 text-[8px] font-black uppercase block tracking-widest mb-1">TOTAL FACTURA</label>
                    <div className="flex items-baseline gap-3">
                      <div className="text-4xl font-black text-brand-gold">{Utils.fmtUSD(subtotalUSD)}</div>
                      <div className="text-base font-black text-white">{Utils.fmtBS(totalBS)}</div>
                    </div>
                  </div>
                  <button 
                    onClick={ejecutarVenta} 
                    disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01} 
                    className="btn bg-[#2a261c] border border-brand-gold/30 h-12 px-8 font-black uppercase text-[10px] text-brand-gold disabled:opacity-20 flex items-center gap-2 tracking-widest"
                  >
                    <CheckCircle2 className="w-4 h-4"/> PROCESAR VENTA
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : view === 'history' ? (
        <div className="card flex-1 bg-white text-ink flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300 rounded-xl">
          <div className="card-head px-6 py-4 bg-ink border-b border-white/10 flex justify-between items-center">
            <h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2 text-xs">
              <History className="w-5 h-5 text-brand-gold" /> HISTORIAL DE TRANSACCIONES DIARIAS
            </h3>
            <button onClick={() => setView('pos')} className="btn btn-sm bg-white text-ink hover:bg-surface-soft flex items-center gap-2 font-black uppercase text-[10px] rounded-lg border-none px-4">
              <ArrowLeft className="w-3.5 h-3.5"/> Volver al POS
            </button>
          </div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table>
              <thead className="sticky top-0 bg-surface-soft z-10">
                <tr>
                  <th className="text-ink font-black text-[10px] uppercase">Recibo</th>
                  <th className="text-ink font-black text-[10px] uppercase">Hora</th>
                  <th className="text-ink font-black text-[10px] uppercase">Cliente</th>
                  <th className="text-ink font-black text-[10px] uppercase">Tipo</th>
                  <th className="text-ink font-black text-[10px] uppercase text-right">Monto USD</th>
                  <th className="text-ink font-black text-[10px] uppercase">Método Pago</th>
                  <th className="text-ink font-black text-[10px] uppercase text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {getReportSummary().ventasHoy.sort((a,b) => b.fecha.localeCompare(a.fecha)).map(v => (
                  <tr key={v.id} className="border-b border-line/40 hover:bg-surface-warm/20 transition-colors">
                    <td className="text-ink font-black text-xs mono">{v.id}</td>
                    <td className="text-ink font-bold text-xs">{v.fecha.split('T')[1]?.slice(0, 5) || '-'}</td>
                    <td className="text-ink font-black text-xs uppercase truncate max-w-[150px]">{v.cliente}</td>
                    <td className="text-ink font-black text-[9px] uppercase"><span className={`badge ${v.type === 'COBRO DEUDA' ? 'badge-info' : 'badge-neutral'}`}>{v.type || 'VENTA'}</span></td>
                    <td className="text-brand-gold-deep font-black text-xs text-right">{Utils.fmtUSD(v.totalUSD)}</td>
                    <td className="text-ink font-bold text-[10px] uppercase">{Utils.metodoLabel(v.metodoPago)}</td>
                    <td className="text-center"><span className={`badge ${v.estado === 'pendiente' ? 'badge-warn' : 'badge-ok'} font-black text-[9px] uppercase`}>{v.estado}</span></td>
                  </tr>
                ))}
                {getReportSummary().ventasHoy.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-24 text-ink font-black uppercase italic opacity-30">No se registran transacciones para el día de hoy</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === 'credits' ? (
        <div className="card flex-1 bg-white text-ink flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300 rounded-xl">
          <div className="card-head px-6 py-4 bg-ink border-b border-white/10 flex justify-between items-center">
            <h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2 text-xs">
              <ClipboardList className="w-5 h-5 text-brand-gold" /> CONSULTA DE CRÉDITOS ACTIVOS
            </h3>
            <button onClick={() => setView('pos')} className="btn btn-sm bg-white text-ink hover:bg-surface-soft flex items-center gap-2 font-black uppercase text-[10px] rounded-lg border-none px-4">
              <ArrowLeft className="w-3.5 h-3.5"/> Volver al POS
            </button>
          </div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table>
              <thead className="sticky top-0 bg-surface-soft z-10">
                <tr>
                  <th className="text-ink font-black text-[10px] uppercase">Emisión</th>
                  <th className="text-ink font-black text-[10px] uppercase">Vencimiento</th>
                  <th className="text-ink font-black text-[10px] uppercase">Cliente</th>
                  <th className="text-ink font-black text-[10px] uppercase text-right">Monto Orig. USD</th>
                  <th className="text-ink font-black text-[10px] uppercase text-right">Saldo Pend. USD</th>
                  <th className="text-ink font-black text-[10px] uppercase text-right">Saldo en Bs.</th>
                  <th className="text-ink font-black text-[10px] uppercase text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {state.cxc.filter((c: any) => c.estado !== 'pagada').map((c: any) => (
                  <tr key={c.id} className="border-b border-line/40 hover:bg-surface-warm/20 transition-colors">
                    <td className="text-ink font-bold text-xs">{Utils.fmtFecha(c.fecha)}</td>
                    <td className={`text-xs font-bold ${c.fechaVencimiento < Utils.hoy() && c.estado !== 'pagada' ? 'text-status-danger' : 'text-ink'}`}>
                      {c.fechaVencimiento === '2099-12-31' ? 'ABIERTA' : Utils.fmtFecha(c.fechaVencimiento)}
                    </td>
                    <td className="text-ink font-black text-xs uppercase">{c.cliente}</td>
                    <td className="text-ink font-bold text-xs text-right">{Utils.fmtUSD(c.montoUSD)}</td>
                    <td className="text-status-info font-black text-xs text-right">{Utils.fmtUSD(c.saldoUSD)}</td>
                    <td className="text-ink font-bold text-xs text-right">{Utils.fmtBS(c.saldoUSD * state.tasa)}</td>
                    <td className="text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setShowDetailsModal(c)} className="btn-icon h-8 w-8 text-ink hover:text-brand-gold" title="Ver Detalles"><Eye className="w-4 h-4"/></button>
                        <button onClick={() => setShowHistoryModal(c)} className="btn-icon h-8 w-8 text-ink hover:text-status-info" title="Historial de Abonos"><Clock className="w-4 h-4"/></button>
                        <button onClick={() => { setShowAbonoModal(c.cliente); setAbonoPagos([]); }} className="btn btn-sm btn-primary font-black text-[9px] uppercase px-4">Abonar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {state.cxc.filter((c: any) => c.estado !== 'pagada').length === 0 && (
                  <tr><td colSpan={7} className="text-center py-24 text-ink font-black uppercase italic opacity-30">No hay cuentas por cobrar activas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISTA DE DEVOLUCIONES INTEGRADA */
        <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-2 duration-300 flex-1 overflow-y-auto">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-line shadow-sm shrink-0">
            <div>
              <h2 className="text-ink font-black uppercase italic tracking-tighter text-lg flex items-center gap-2">
                <RotateCcw className="text-status-danger w-5 h-5" /> GESTIÓN DE DEVOLUCIONES
              </h2>
              <p className="text-[10px] text-ink font-bold uppercase tracking-widest opacity-60">Auditoría y Reintegro de Mercancía</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { setReturnView('list'); setSelectedSaleForReturn(null); }} 
                className={`btn ${returnView === 'list' ? 'btn-primary' : 'btn-secondary'} h-9 px-6 font-black uppercase text-[10px] flex items-center gap-2 shadow-sm`}
              >
                <History className="w-3.5 h-3.5" /> Ver Historial
              </button>
              <button 
                onClick={() => { setReturnView('create'); setSelectedSaleForReturn(null); }} 
                className={`btn ${returnView === 'create' ? 'btn-primary' : 'btn-secondary'} h-9 px-6 font-black uppercase text-[10px] flex items-center gap-2 shadow-sm`}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Nueva Devolución
              </button>
            </div>
          </div>

          {returnView === 'list' ? (
            <div className="card bg-white border-line shadow-lg overflow-hidden flex flex-col rounded-xl flex-1">
              <div className="card-head bg-ink border-b border-white/10 px-6 py-4">
                <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-brand-gold" /> DEVOLUCIONES DE LA JORNADA (HOY)
                </h3>
              </div>
              <div className="table-wrap flex-1 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-surface-soft z-10">
                    <tr>
                      <th className="text-ink font-black text-[10px] uppercase">ID Devolución</th>
                      <th className="text-ink font-black text-[10px] uppercase">Fecha / Hora</th>
                      <th className="text-ink font-black text-[10px] uppercase">Venta Ref.</th>
                      <th className="text-ink font-black text-[10px] uppercase">Items</th>
                      <th className="text-ink font-black text-[10px] uppercase text-right">Total Devuelto</th>
                      <th className="text-ink font-black text-[10px] uppercase">Reembolso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.devoluciones || []).filter(d => d.fecha.startsWith(Utils.hoy())).length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-24 text-ink font-black uppercase italic opacity-20">No hay devoluciones registradas el día de hoy</td></tr>
                    ) : (
                      (state.devoluciones || []).filter(d => d.fecha.startsWith(Utils.hoy())).map(d => (
                        <tr key={d.id} className="border-b border-line/40 hover:bg-surface-warm/20 transition-colors">
                          <td className="text-status-danger font-black text-xs mono">{d.id}</td>
                          <td className="text-ink font-bold text-xs">{d.fecha.split('T')[1].slice(0, 8)}</td>
                          <td className="text-ink font-black text-xs mono opacity-60">{d.ventaId}</td>
                          <td className="text-ink font-bold text-[10px] uppercase">{d.items.length} productos</td>
                          <td className="text-brand-gold-deep font-black text-xs text-right">{Utils.fmtUSD(d.totalUSD)}</td>
                          <td><span className="badge badge-neutral font-black text-[9px] uppercase">{d.metodoReembolso}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {!selectedSaleForReturn ? (
                /* ETAPA 1: BÚSQUEDA EXCLUSIVA */
                <div className="card p-12 flex-1 flex flex-col items-center justify-center text-center space-y-6 bg-white border-dashed border-2 border-line">
                  <div className="p-5 bg-surface-soft rounded-full"><Search className="w-10 h-10 text-ink/20" /></div>
                  <div className="max-w-xs space-y-2">
                    <h3 className="text-ink font-black uppercase text-sm">Localizar Venta Original</h3>
                    <p className="text-[10px] text-ink font-bold uppercase opacity-60">Ingrese el número de recibo impreso para autorizar el proceso de devolución.</p>
                  </div>
                  <div className="flex gap-2 w-full max-sm:flex-col sm:max-w-sm">
                    <input 
                      className="form-input flex-1 h-11 bg-white border-line text-ink font-black uppercase" 
                      placeholder="Ej: 000000024"
                      value={returnSaleSearch}
                      onChange={e => setReturnSaleSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && buscarVentaParaDevolucion()}
                    />
                    <button onClick={buscarVentaParaDevolucion} className="btn btn-primary h-11 px-6 font-black uppercase text-xs">Localizar Venta</button>
                  </div>
                </div>
              ) : (
                /* ETAPA 2: PROCESAMIENTO (CON SCROLL) */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-y-auto pr-1 animate-in slide-in-from-right-2 duration-300">
                  <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="card bg-white border-status-info/30 flex flex-col min-h-[200px] rounded-xl overflow-hidden shadow-sm">
                      <div className="card-head py-3 px-6 bg-ink border-b border-white/10 flex justify-between items-center shrink-0">
                        <h3 className="text-white font-black uppercase italic text-[10px] tracking-tighter flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-brand-gold" /> VENTA ORIGINAL: {selectedSaleForReturn.id}
                        </h3>
                        <button onClick={() => setSelectedSaleForReturn(null)} className="text-white/60 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr className="bg-surface-soft">
                              <th className="text-[9px] uppercase font-black text-ink">Producto</th>
                              <th className="text-[9px] uppercase text-center font-black text-ink">Cant</th>
                              <th className="text-[9px] uppercase text-right font-black text-ink">Precio</th>
                              <th className="text-[9px] uppercase text-center font-black text-ink">Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSaleForReturn.items.map((item, idx) => (
                              <tr key={idx} className="border-b border-line/30">
                                <td className="text-ink font-bold text-[11px] uppercase">{item.nombre}</td>
                                <td className="text-ink font-black text-[11px] text-center">{item.cantidad}</td>
                                <td className="text-ink font-black text-[11px] text-right">{Utils.fmtUSD(item.precioUnitUSD)}</td>
                                <td className="text-center">
                                  <button onClick={() => handleAddReturnItem(item.productoId, item.nombre, item.precioUnitUSD, item.cantidad)} className="btn btn-sm btn-secondary font-black text-[9px] h-7 px-3">Seleccionar</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="card bg-white border-line shadow-md flex-1 flex flex-col overflow-hidden rounded-xl">
                      <div className="card-head py-3 px-6 bg-ink border-b border-white/10 shrink-0">
                        <h3 className="text-white font-black uppercase italic text-[10px] tracking-tighter flex items-center gap-2">
                          <Undo2 className="w-4 h-4 text-brand-gold"/> LOTE PARA REINTEGRO
                        </h3>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr className="bg-surface-soft">
                              <th className="text-[9px] uppercase font-black text-ink">Producto</th>
                              <th className="text-[9px] uppercase text-center font-black text-ink">Cant</th>
                              <th className="text-[9px] uppercase font-black text-ink">Estado</th>
                              <th className="text-[9px] uppercase text-right font-black text-ink">Total</th>
                              <th className="text-[9px] uppercase text-center"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {returnItems.map((item, idx) => (
                              <tr key={idx} className="border-b border-line/30">
                                <td className="text-ink font-bold text-[11px] uppercase">{item.nombre}</td>
                                <td className="text-status-danger font-black text-[11px] text-center">{item.cantidad}</td>
                                <td><span className={`badge ${item.estadoProducto === 'REINTEGRADO_STOCK' ? 'badge-ok' : 'badge-err'} font-black text-[8px] uppercase`}>{item.estadoProducto.replace('_', ' ')}</span></td>
                                <td className="text-brand-gold-deep font-black text-[11px] text-right">{Utils.fmtUSD(item.cantidad * item.precioUnitUSD)}</td>
                                <td className="text-center">
                                  <button onClick={() => setReturnItems(returnItems.filter((_, i) => i !== idx))} className="text-ink/20 hover:text-status-danger transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                                </td>
                              </tr>
                            ))}
                            {returnItems.length === 0 && (
                              <tr><td colSpan={5} className="text-center py-10 text-ink/20 font-black uppercase italic text-[10px]">Añada productos para continuar</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="card bg-white border-line shadow-lg rounded-xl overflow-hidden sticky top-0">
                      <div className="card-head py-3 px-6 bg-ink border-b border-white/10">
                        <h3 className="text-white font-black uppercase italic text-[10px] tracking-widest">RESUMEN DE OPERACIÓN</h3>
                      </div>
                      <div className="card-body p-5 space-y-5">
                        <div className="bg-surface-soft p-4 rounded-lg text-center border border-line shadow-inner">
                          <p className="text-ink/60 text-[9px] font-black uppercase mb-1">Monto Total a Reembolsar</p>
                          <p className="text-3xl font-black text-status-danger">
                            {Utils.fmtUSD(returnItems.reduce((s, i) => s + (i.cantidad * i.precioUnitUSD), 0))}
                          </p>
                        </div>

                        <div className="form-group">
                          <label className="text-ink text-[10px] font-black uppercase block mb-1">Método de Reembolso</label>
                          <select className="form-select bg-white text-ink h-10 text-xs font-black uppercase border-line" value={refundMethod} onChange={e => setRefundMethod(e.target.value as any)}>
                            <option value="EFECTIVO">Efectivo de Caja</option>
                            <option value="MISMO_METODO">Reverso (Mismo Método)</option>
                            <option value="CREDITO_TIENDA">Nota de Crédito Interna</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="text-ink text-[10px] font-black uppercase block mb-1">Motivo / Observaciones</label>
                          <textarea className="form-input bg-white text-ink text-xs min-h-[80px] border-line py-2" placeholder="Describa el motivo..." value={returnReason} onChange={e => setReturnReason(e.target.value)}></textarea>
                        </div>

                        <div className="p-3 bg-brand-gold-soft/20 border border-brand-gold/10 rounded-lg flex gap-3">
                           <Lock className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" />
                           <p className="text-[9px] text-brand-gold-deep font-bold leading-tight">Se requiere el PIN de autorización para finalizar.</p>
                        </div>

                        <button 
                          disabled={returnItems.length === 0 || !returnReason.trim()}
                          onClick={procesarDevolucionPOS}
                          className="btn btn-primary w-full h-14 font-black uppercase text-xs shadow-xl disabled:opacity-20 flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-5 h-5" /> Finalizar Operación
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL DETALLES CREDITO */}
      {showDetailsModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowDetailsModal(null)}></div>
          <div className="modal-box bg-white border-2 border-line max-w-lg">
            <div className="modal-head py-3 px-4 border-b border-line"><h3 className="text-ink text-xs font-black uppercase">DETALLE DE CRÉDITO - {showDetailsModal.id}</h3><button onClick={() => setShowDetailsModal(null)}><X className="text-ink"/></button></div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-surface-soft p-3 rounded border border-line space-y-1">
                <div className="flex justify-between text-[10px] text-ink/60"><span>CLIENTE:</span><span className="text-ink font-black uppercase">{showDetailsModal.cliente}</span></div>
                <div className="flex justify-between text-[10px] text-ink/60"><span>EMISIÓN:</span><span className="text-ink font-black">{Utils.fmtFecha(showDetailsModal.fecha)}</span></div>
                <div className="flex justify-between text-sm font-black text-brand-gold-deep"><span>TOTAL DEUDA:</span><span>{Utils.fmtUSD(showDetailsModal.montoUSD)}</span></div>
              </div>
              <div className="table-wrap max-h-48 overflow-y-auto">
                <table className="text-[10px]">
                  <thead>
                    <tr className="border-b border-line"><th className="text-ink font-black uppercase">Item</th><th className="text-ink text-center font-black uppercase">Cant</th><th className="text-ink text-right font-black uppercase">Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {state.ventas.find(v => v.id === showDetailsModal.id || v.id === showDetailsModal.ventaId)?.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-line/30">
                        <td className="text-ink font-bold uppercase py-2">{it.nombre}</td>
                        <td className="text-ink text-center">{it.cantidad}</td>
                        <td className="text-brand-gold-deep text-right font-black">{Utils.fmtUSD(it.subtotalUSD)}</td>
                      </tr>
                    )) || (
                      <tr><td colSpan={3} className="text-center py-4 text-ink/20 italic uppercase font-black">Detalle de items no disponible (Deuda Directa)</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE ABONOS */}
      {showHistoryModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowHistoryModal(null)}></div>
          <div className="modal-box bg-white border-2 border-line max-w-lg">
            <div className="modal-head py-3 px-4 border-b border-line"><h3 className="text-ink text-xs font-black uppercase">HISTORIAL DE PAGOS - {showHistoryModal.id}</h3><button onClick={() => setShowHistoryModal(null)}><X className="text-ink"/></button></div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-surface-soft p-3 rounded border border-line space-y-1">
                <div className="flex justify-between text-[10px] text-ink/60"><span>CLIENTE:</span><span className="text-ink font-black uppercase">{showHistoryModal.cliente}</span></div>
                <div className="flex justify-between text-[10px] text-ink/60"><span>SALDO PENDIENTE:</span><span className="text-status-info font-black">{Utils.fmtUSD(showHistoryModal.saldoUSD)}</span></div>
              </div>
              <div className="table-wrap max-h-60 overflow-y-auto">
                <table className="text-[10px]">
                  <thead>
                    <tr className="border-b border-line"><th className="text-ink font-black uppercase">Recibo</th><th className="text-ink font-black uppercase">Fecha / Hora</th><th className="text-ink font-black uppercase text-right">Abono (USD)</th><th className="text-ink font-black uppercase text-right">Abono (BS)</th></tr>
                  </thead>
                  <tbody>
                    {showHistoryModal.historialPagos && showHistoryModal.historialPagos.length > 0 ? (
                      showHistoryModal.historialPagos.map((p: any, idx: number) => (
                        <tr key={idx} className="border-b border-line/30">
                          <td className="text-ink font-black mono py-2">{p.reciboId || '-'}</td>
                          <td className="text-ink font-bold py-2">{p.fecha.replace('T', ' ').slice(0, 16)}</td>
                          <td className="text-status-success text-right font-black">{Utils.fmtUSD(p.montoUSD)}</td>
                          <td className="text-ink text-right font-black">{Utils.fmtBS(p.montoBS)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="text-center py-8 text-ink/20 italic uppercase font-black">No se registran abonos aún</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ABONO GENERAL CON CALCULADORA INTELIGENTE */}
      {showAbonoModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowAbonoModal(null)}></div>
          <div className="modal-box max-w-[420px] bg-white border-2 border-line">
            <div className="modal-head py-3 px-4 border-b border-line">
              <h3 className="text-ink text-xs font-black uppercase">REGISTRAR ABONO - {showAbonoModal}</h3>
              <button onClick={() => setShowAbonoModal(null)}><X className="text-ink"/></button>
            </div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-surface-soft p-4 rounded-lg text-center border border-line shadow-inner">
                <p className="text-ink/60 text-[9px] font-bold uppercase mb-1">DEUDA TOTAL CLIENTE</p>
                <p className="text-3xl font-black text-status-info">{Utils.fmtUSD(deudaVisualUSD)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded border border-line text-center shadow-sm">
                  <p className="text-ink/60 text-[8px] font-black uppercase mb-1">TOTAL A PAGAR BS.</p>
                  <p className="text-lg font-black text-ink">{Utils.fmtBS(totalAPagarBS)}</p>
                </div>
                <div className="bg-white p-3 rounded border border-line text-center shadow-sm">
                  <p className="text-brand-gold-deep/60 text-[8px] font-black uppercase mb-1">TOTAL PAGADO</p>
                  <p className="text-lg font-black text-brand-gold-deep">{Utils.fmtBS(pagosBS_Abono)}</p>
                </div>
              </div>

              <div className="bg-surface-soft p-3 rounded-lg border border-line">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-ink text-[10px] font-black uppercase">MÉTODOS DE PAGO</label>
                  <button onClick={() => setShowAbonoMultiModal(true)} className="btn-icon h-6 w-6 bg-brand-gold text-white rounded hover:bg-brand-gold-deep transition-all shadow-sm">
                    <Plus className="w-4 h-4"/>
                  </button>
                </div>
                
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {abonoPagos.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] text-ink font-bold bg-white p-2 rounded border border-line">
                      <div className="flex items-center gap-3">
                         <button onClick={() => removeAbonoPago(idx)} className="text-status-danger hover:scale-110 transition-transform">
                           <Trash2 className="w-4 h-4" />
                         </button>
                         <span className="uppercase">{Utils.metodoLabel(p.metodo)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-brand-gold-deep font-black">{Utils.fmtUSD(p.montoUSD)}</div>
                        {(p.metodo !== 'efectivo_usd' && p.metodo !== 'zelle') && <div className="text-[8px] text-ink/40 font-bold">{Utils.fmtBS(p.montoBS)}</div>}
                      </div>
                    </div>
                  ))}
                  {abonoPagos.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-[10px] text-ink/20 italic uppercase font-black tracking-widest">Añada métodos de pago para continuar</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-brand-gold-soft/20 p-3 rounded border border-brand-gold/10">
                <p className="text-[9px] text-brand-gold-deep/60 italic uppercase text-center leading-tight font-bold">
                  El abono liquidará facturas automáticamente desde la más antigua.
                </p>
              </div>
              
              <button 
                className="btn btn-primary w-full h-14 font-black uppercase text-xs shadow-xl shadow-brand-gold/10 disabled:opacity-20 transition-all" 
                onClick={procesarAbonoCascada}
                disabled={abonoPagos.length === 0}
              >
                CONFIRMAR COBRO DE DEUDA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Multi-pago POS */}
      {showMultiModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => { setShowMultiModal(false); setIsCreditView(false); }}></div>
          <div className="modal-box max-w-[380px] bg-white border-2 border-line">
            <div className="modal-head py-3 px-4 border-b border-line">
              <h3 className="text-ink text-xs font-black uppercase">{isCreditView ? 'CARGAR CRÉDITO' : 'REGISTRAR PAGO'}</h3>
              <button onClick={() => { setShowMultiModal(false); setIsCreditView(false); }}><X className="text-ink"/></button>
            </div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-surface-soft p-3 rounded-lg text-center border border-line shadow-inner">
                <p className="text-ink/60 text-[9px] font-bold uppercase mb-1">Pendiente</p>
                <p className="text-2xl font-black text-status-info">{Utils.fmtUSD(saldoRestanteUSD)}</p>
                <p className="text-xs text-ink/60 font-bold">{Utils.fmtBS(saldoRestanteBS)}</p>
              </div>
              
              {!isCreditView ? (
                <>
                  <div className="space-y-1"><label className="text-ink text-[10px] font-bold uppercase">MÉTODO</label>
                    <select className="form-select h-10 bg-white text-ink border-line font-black uppercase text-xs shadow-sm" value={metodoActual} onChange={e => setMetodoActual(e.target.value as PaymentMethod)}>
                      <option value="efectivo_usd">Efectivo USD</option><option value="efectivo_bs">Efectivo BS</option><option value="punto_venta">Punto de Venta</option><option value="pagomovil">Pago Movil</option><option value="biopago">Biopago</option><option value="zelle">Zelle</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-ink text-[10px] font-bold uppercase">MONTO ({metodoActual.includes('usd') || metodoActual === 'zelle' ? 'USD' : 'BS'})</label>
                      <button 
                        onClick={() => {
                          const monto = metodoActual.includes('usd') || metodoActual === 'zelle' ? saldoRestanteUSD : saldoRestanteBS;
                          setMontoInput(monto.toFixed(2));
                        }}
                        className="text-[9px] bg-brand-gold-soft text-brand-gold-deep px-2 py-0.5 rounded font-black border border-brand-gold/30 hover:bg-brand-gold hover:text-white transition-colors"
                      >
                        PAGO EXACTO
                      </button>
                    </div>
                    <input type="number" className="form-input h-12 text-lg font-black bg-white text-ink border-line shadow-inner" placeholder={metodoActual.includes('usd') || metodoActual === 'zelle' ? saldoRestanteUSD.toFixed(2) : saldoRestanteBS.toFixed(2)} value={montoInput} onChange={e => setMontoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPago(false)} autoFocus />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button className="btn btn-primary w-full h-12 font-black uppercase text-xs shadow-md" onClick={() => addPago(false)}>CONFIRMAR ABONO</button>
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-line"></div>
                      <span className="text-[9px] text-ink/40 font-black uppercase">Ó TAMBIÉN</span>
                      <div className="flex-1 h-px bg-line"></div>
                    </div>
                    <button 
                      className="btn h-10 border-2 border-status-info text-status-info hover:bg-status-info-soft bg-transparent font-black uppercase text-[10px] w-full"
                      onClick={() => setIsCreditView(true)}
                    >
                      Cargar Crédito
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
                  {!showNewClientForm ? (
                    <div className="space-y-3">
                       <div className="relative">
                         <Search className="absolute left-3 top-2.5 w-4 h-4 text-ink/40" />
                         <input 
                           className="form-input pl-10 h-10 text-xs bg-white text-ink border-line" 
                           placeholder="Buscar por nombre o cédula..." 
                           value={clientSearch}
                           onChange={e => setClientSearch(e.target.value)}
                         />
                       </div>
                       
                       <div className="max-h-[160px] overflow-y-auto border border-line rounded-lg bg-white shadow-inner">
                         {filteredClients.map(c => (
                           <div 
                             key={c.id} 
                             onClick={() => setSelectedClient(c)}
                             className={`p-3 border-b border-line/40 cursor-pointer hover:bg-brand-gold/10 transition-all ${selectedClient?.id === c.id ? 'bg-brand-gold-soft border-l-4 border-l-brand-gold' : ''}`}
                           >
                             <div className="text-xs font-black text-ink uppercase">{c.name}</div>
                             <div className="text-[10px] text-ink/40 mono">{c.cedula}</div>
                           </div>
                         ))}
                         {clientSearch.length > 0 && filteredClients.length === 0 && (
                           <div className="p-4 text-center text-[10px] text-ink/20 uppercase font-black">No se encontraron clientes</div>
                         )}
                         {clientSearch.length === 0 && (
                           <div className="p-4 text-center text-[10px] text-ink/40 uppercase font-black italic">Escriba para buscar...</div>
                         )}
                       </div>

                       <div className="flex flex-col gap-2">
                         <button 
                           className="btn bg-status-info-soft text-status-info border border-status-info/40 hover:bg-status-info/20 font-black uppercase text-[10px] w-full h-10 flex items-center justify-center gap-2"
                           onClick={() => setShowNewClientForm(true)}
                         >
                           <UserPlus className="w-4 h-4" /> Registrar Cliente
                         </button>
                         <button 
                           className="btn btn-primary w-full h-12 font-black uppercase text-xs disabled:opacity-30 shadow-md" 
                           disabled={!selectedClient}
                           onClick={ejecutarVentaACredito}
                         >
                           Cargar Deuda
                         </button>
                         <button className="text-[9px] text-ink/40 uppercase font-black mt-1 hover:text-ink text-center" onClick={() => { setIsCreditView(false); setSelectedClient(null); }}>
                           Cancelar y volver al pago
                         </button>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                       <div className="grid grid-cols-1 gap-2">
                         <div className="space-y-1">
                           <label className="text-[9px] font-black uppercase text-ink/60">Nombre y Apellido</label>
                           <input className="form-input h-9 text-xs bg-white text-ink border-line" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[9px] font-black uppercase text-ink/60">Cédula (V-00.000.000)</label>
                           <input className="form-input h-9 text-xs bg-white text-ink border-line" value={newClient.cedula} onChange={e => setNewClient({...newClient, cedula: e.target.value})} />
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                           <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-ink/60">Teléfono (Op.)</label>
                             <input className="form-input h-9 text-xs bg-white text-ink border-line" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-ink/60">Dirección (Op.)</label>
                             <input className="form-input h-9 text-xs bg-white text-ink border-line" value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})} />
                           </div>
                         </div>
                       </div>
                       
                       <div className="flex flex-col gap-2 pt-2">
                         <button className="btn btn-primary w-full h-12 font-black uppercase text-xs shadow-md" onClick={ejecutarVentaACredito}>
                           Cargar Deuda
                         </button>
                         <button className="text-[9px] text-ink/40 uppercase font-black hover:text-ink text-center" onClick={() => setShowNewClientForm(false)}>
                           Volver a buscar clientes
                         </button>
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL REPORTE Y/Z */}
      {showReport && (
        <div className="modal show">
          <div className="modal-bg" onClick={() => setShowReport(null)}></div>
          <div className="modal-box bg-white max-w-sm border-2 border-line">
            <div className="modal-head py-3 px-4 border-b border-line flex justify-between items-center">
              <h3 className="text-ink text-xs font-black uppercase">REPORTE FISCAL {showReport}</h3>
              <button onClick={() => setShowReport(null)} className="text-ink/40 hover:text-ink"><X className="w-4 h-4"/></button>
            </div>
            <div className="modal-body p-4 space-y-4">
               {/* Contenedor para impresión tradicional */}
               <div ref={reportPrintRef} className="bg-white p-4 font-mono text-[10px] text-black border border-line shadow-inner leading-tight">
                  <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                    <p className="font-bold text-sm">{state.empresa.nombre.toUpperCase()}</p>
                    <p>RIF: {state.empresa.rif}</p>
                    <p className="text-[9px]">{state.empresa.direccion}</p>
                  </div>
                  <div className="text-center font-bold mb-2">REPORTE DE VENTAS "{showReport}"</div>
                  <div className="mb-2">
                    <p>FECHA: {Utils.fmtFecha(Utils.hoy())}</p>
                    <p>HORA: {Utils.ahora().split('T')[1].slice(0, 8)}</p>
                    {showReport === 'Z' && state.reportesZ.length > 0 && (
                      <p className="font-bold">REPORTE Z #: {String(state.reportesZ[state.reportesZ.length-1].numeroZ).padStart(4, '0')}</p>
                    )}
                  </div>
                  <div className="border-t border-dashed border-black pt-1 mb-1">
                    <p className="font-bold">RESUMEN OPERACIONES:</p>
                    <div className="flex justify-between"><span>VENTAS DIRECTAS:</span><span>{Utils.fmtUSD(rVDirectas)}</span></div>
                    <div className="flex justify-between"><span>COBROS DEUDA:</span><span>{Utils.fmtUSD(rVCobros)}</span></div>
                  </div>
                  <div className="border-t border-dashed border-black pt-1 mb-1">
                    <p className="font-bold">DESGLOSE MÉTODOS:</p>
                    {Object.entries(breakdown).map(([metodo, montos]) => (
                      <div key={metodo} className="flex justify-between">
                        <span className="uppercase">{Utils.metodoLabel(metodo)}:</span>
                        <span>{(metodo === 'efectivo_usd' || metodo === 'zelle') ? Utils.fmtUSD(montos.usd) : Utils.fmtBS(montos.bs)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-black pt-1 mt-1 font-bold text-xs">
                    <div className="flex justify-between"><span>TOTAL CAJA BS:</span><span>{Utils.fmtBS(rTotalBS)}</span></div>
                    <div className="flex justify-between"><span>TOTAL CAJA USD:</span><span>{Utils.fmtUSD(rTotalUSD)}</span></div>
                  </div>
                  {showReport === 'Z' && state.reportesZ.length > 0 && (
                    <div className="border-t border-dashed border-black pt-1 mt-1 text-[9px]">
                      <p>ACUMULADO: {Utils.fmtUSD(state.reportesZ[state.reportesZ.length-1].acumuladoHistoricoUSD)}</p>
                    </div>
                  )}
                  <div className="text-center mt-3 border-t border-dashed border-black pt-2">*** DOCUMENTO FISCAL ***</div>
               </div>
            </div>
            <div className="modal-foot p-4 bg-surface-soft border-t border-line flex gap-2">
               <button className="btn btn-secondary flex-1 font-black uppercase text-[10px]" onClick={() => setShowReport(null)}>Cerrar</button>
               <button className="btn btn-primary flex-1 font-black uppercase text-[10px] gap-2" onClick={() => handleNativeReportPrint(showReport)}><Printer className="w-3.5 h-3.5" /> Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Abono Individual (Omitido por brevedad en este bloque, se mantiene igual funcionalmente) */}
    </div>
  );
}
