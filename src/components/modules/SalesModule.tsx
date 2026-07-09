"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AppState, SaleItem, Sale, PaymentMethod, ReportZ, Movimiento, PagoRealizado, Customer } from '@/lib/types';
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
  User
} from 'lucide-react';
import ReturnsModule from './ReturnsModule';

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

  const searchInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const reportPrintRef = useRef<HTMLDivElement | null>(null);

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
        <button onClick={() => setView('pos')} className={`btn btn-sm ${view === 'pos' ? 'btn-primary' : 'btn-secondary text-white font-bold'}`}><ShoppingCart className="w-3.5 h-3.5"/> Punto de Venta</button>
        <button onClick={() => setView('history')} className={`btn btn-sm ${view === 'history' ? 'btn-primary' : 'btn-secondary text-white font-bold'}`}><History className="w-3.5 h-3.5"/> Historial</button>
        <button onClick={() => setView('credits')} className={`btn btn-sm ${view === 'credits' ? 'btn-primary' : 'btn-secondary text-white font-bold'}`}><ClipboardList className="w-3.5 h-3.5"/> Consultar Créditos</button>
        <button onClick={() => setShowReport('Y')} className="btn btn-sm btn-secondary text-white font-bold"><FileText className="w-3.5 h-3.5"/> Reporte Y</button>
        <button onClick={emitirReporteZ} className="btn btn-sm btn-secondary text-white font-bold"><Receipt className="w-3.5 h-3.5"/> Reporte Z</button>
        <button onClick={() => setView('returns')} className={`btn btn-sm ${view === 'returns' ? 'btn-primary' : 'btn-secondary text-white font-bold'}`}><RotateCcw className="w-3.5 h-3.5"/> Devoluciones</button>
      </div>

      {view === 'pos' ? (
        <div className="flex flex-col gap-2 flex-1 overflow-hidden animate-in fade-in duration-300">
          <div className="relative group shrink-0">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8952e] z-10"><Barcode className="w-5 h-5" /></div>
            <input 
              ref={searchInputRef}
              className="form-input pl-14 py-2 text-base bg-[#131313] border-[#c8952e]/30 text-white placeholder-white/40" 
              placeholder="Escanee o busque producto..." value={search} onChange={e => setSearch(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && matches.length >= 1 && agregar(matches[0].id)} autoFocus
            />
            {matches.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-[#1e1e1e] border border-[#2a2a2a] rounded-b-lg shadow-2xl z-[100] mt-1 overflow-hidden">
                {matches.map(p => (
                  <div key={p.id} onClick={() => agregar(p.id)} className="flex items-center justify-between p-2 hover:bg-[#c8952e]/20 cursor-pointer border-b border-[#2a2a2a]">
                    <div className="text-white text-xs font-bold uppercase">{p.nombre} <span className="text-white/40 text-[9px] mono ml-2">{p.codigo}</span></div>
                    <div className="text-[#c8952e] font-black text-sm">{Utils.fmtUSD(p.precioUSD)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-1 gap-3 overflow-hidden">
            <div className="w-1/3 flex flex-col gap-2">
              <div className="card p-3 space-y-3 bg-[#131313] border-[#2a2a2a] h-full flex flex-col">
                <div className="form-group mb-0">
                  <label className="text-white text-[10px] font-black uppercase block mb-1">IDENTIFICACIÓN CLIENTE</label>
                  <input className="form-input h-8 text-xs bg-[#0b0b0b] text-white border-[#2a2a2a] font-black uppercase" value={cliente} onChange={e => setCliente(e.target.value)} />
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-white text-[10px] font-black uppercase block mb-1">MÉTODOS APLICADOS</label>
                  <div className="flex-1 p-2 border border-white/10 bg-[#181818] rounded-lg overflow-y-auto">
                    {pagos.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-[10px] border-b border-white/5 py-1 text-white font-black uppercase">
                        <span>{Utils.metodoLabel(p.metodo)}</span>
                        <span className="text-[#c8952e]">{Utils.fmtUSD(p.montoUSD)}</span>
                      </div>
                    ))}
                    {pagos.length === 0 && <div className="text-[10px] text-white/20 italic py-2 text-center uppercase font-black">Sin abonos</div>}
                  </div>
                </div>
                <div className="p-3 border border-[#3a9bdc]/30 bg-[#3a9bdc]/5 rounded-lg text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <label className="text-white text-[10px] font-black uppercase">SALDO RESTANTE</label>
                    <button onClick={() => setShowMultiModal(true)} className="btn-icon h-6 w-6 bg-[#c8952e] text-black"><Wallet className="w-3.5 h-3.5"/></button>
                  </div>
                  <div className={`text-2xl font-black ${saldoRestanteUSD <= 0.01 ? 'text-[#27ae60]' : 'text-[#3a9bdc]'}`}>
                    {saldoRestanteUSD <= 0.01 ? 'SALDADO' : Utils.fmtUSD(saldoRestanteUSD)}
                  </div>
                  <div className="bg-black py-2 rounded-lg border-2 border-white/20">
                    <label className="text-white text-[9px] font-black uppercase block mb-1">EQUIVALENTE A PAGAR</label>
                    <div className="text-2xl font-black text-white">{Utils.fmtBS(saldoRestanteBS)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-2/3 flex flex-col gap-2 overflow-hidden">
              <div className="card flex-1 flex flex-col overflow-hidden bg-white border-none shadow-xl">
                <div className="grid grid-cols-[1fr_80px_60px_70px_80px_80px_40px] gap-2 px-3 py-2 bg-[#131313] text-white text-[9px] font-black uppercase tracking-widest">
                  <div>Descripción</div><div className="text-center">Cant</div><div className="text-center">U.M.</div><div className="text-right">Precio ($)</div><div className="text-right">Precio (Bs)</div><div className="text-right">Total</div><div className="text-center"></div>
                </div>
                <div className="flex-1 overflow-y-auto p-1 space-y-1">
                  {state.carrito.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-black/10"><ShoppingCart className="w-16 h-16 mb-2"/><p className="font-black uppercase text-[10px] tracking-tighter">Esperando Productos...</p></div>
                  ) : (
                    state.carrito.map((item, i) => {
                      const product = state.productos.find(p => p.id === item.productoId);
                      return (
                        <div key={i} className="grid grid-cols-[1fr_80px_60px_70px_80px_80px_40px] gap-2 items-center px-2 py-1 bg-white border-b border-black/5 text-black">
                          <div className="flex flex-col min-w-0">
                            <div className="truncate font-black text-[10px] uppercase">{item.nombre}</div>
                            <div className="text-[8px] font-black text-black mono uppercase">{item.productoId}</div>
                          </div>
                          <div className="flex items-center justify-center gap-1 bg-black/5 rounded p-0.5"><button onClick={() => updateQty(i, -1)} className="text-black font-black text-xs px-1 hover:bg-black/10">-</button><span className="w-5 text-center text-[10px] font-black">{item.cantidad}</span><button onClick={() => updateQty(i, 1)} className="text-black font-black text-xs px-1 hover:bg-black/10">+</button></div>
                          <div className="text-center text-[9px] font-black uppercase">{product?.cantidad || '-'}</div>
                          <div className="text-right text-[10px] font-black">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                          <div className="text-right text-[10px] font-black">{Utils.fmtBS(item.precioUnitUSD * state.tasa)}</div>
                          <div className="text-right text-[11px] font-black">{Utils.fmtUSD(item.subtotalUSD)}</div>
                          <div className="flex justify-center"><button onClick={() => updateQty(i, -item.cantidad)} className="text-black/20 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button></div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="p-3 bg-[#131313] border-t border-[#2a2a2a] flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-white text-[10px] font-black uppercase block">TOTAL FACTURA</label>
                    <div className="flex items-baseline gap-2">
                      <div className="text-3xl font-black text-[#c8952e]">{Utils.fmtUSD(subtotalUSD)}</div>
                      <div className="text-sm font-black text-white">{Utils.fmtBS(totalBS)}</div>
                    </div>
                  </div>
                  <button onClick={ejecutarVenta} disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01} className="btn btn-primary h-12 px-8 font-black uppercase text-xs disabled:opacity-20 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5"/> PROCESAR VENTA
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : view === 'history' ? (
        <div className="card flex-1 bg-[#131313] text-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          <div className="card-head px-5 py-4 border-b border-[#2a2a2a] bg-[#181818] flex justify-between items-center">
            <h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2">
              <History className="w-5 h-5 text-[#c8952e]" /> Historial de Transacciones Diarias
            </h3>
            <button onClick={() => setView('pos')} className="btn btn-sm btn-secondary flex items-center gap-2 font-black uppercase text-[10px]">
              <ArrowLeft className="w-3 h-3"/> Volver al POS
            </button>
          </div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table>
              <thead className="sticky top-0 bg-[#0b0b0b] z-10">
                <tr>
                  <th className="text-white font-black text-[10px] uppercase">Recibo</th>
                  <th className="text-white font-black text-[10px] uppercase">Hora</th>
                  <th className="text-white font-black text-[10px] uppercase">Cliente</th>
                  <th className="text-white font-black text-[10px] uppercase">Tipo</th>
                  <th className="text-white font-black text-[10px] uppercase text-right">Monto USD</th>
                  <th className="text-white font-black text-[10px] uppercase">Método Pago</th>
                  <th className="text-white font-black text-[10px] uppercase text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {getReportSummary().ventasHoy.sort((a,b) => b.fecha.localeCompare(a.fecha)).map(v => (
                  <tr key={v.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="text-white font-black text-xs mono">{v.id}</td>
                    <td className="text-white font-bold text-xs">{v.fecha.split('T')[1]?.slice(0, 5) || '-'}</td>
                    <td className="text-white font-black text-xs uppercase truncate max-w-[150px]">{v.cliente}</td>
                    <td className="text-white font-black text-[9px] uppercase"><span className={`badge ${v.type === 'COBRO DEUDA' ? 'badge-info' : 'badge-neutral'}`}>{v.type || 'VENTA'}</span></td>
                    <td className="text-[#c8952e] font-black text-xs text-right">{Utils.fmtUSD(v.totalUSD)}</td>
                    <td className="text-white font-bold text-[10px] uppercase">{Utils.metodoLabel(v.metodoPago)}</td>
                    <td className="text-center"><span className={`badge ${v.estado === 'pendiente' ? 'badge-warn' : 'badge-ok'} font-black text-[9px] uppercase`}>{v.estado}</span></td>
                  </tr>
                ))}
                {getReportSummary().ventasHoy.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-24 text-white font-black uppercase italic opacity-30">No se registran transacciones para el día de hoy</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === 'credits' ? (
        <div className="card flex-1 bg-[#131313] text-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          <div className="card-head px-5 py-4 border-b border-[#2a2a2a] bg-[#181818] flex justify-between items-center">
            <h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#3a9bdc]" /> Consulta de Créditos Activos
            </h3>
            <button onClick={() => setView('pos')} className="btn btn-sm btn-secondary flex items-center gap-2 font-black uppercase text-[10px]">
              <ArrowLeft className="w-3 h-3"/> Volver al POS
            </button>
          </div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table>
              <thead className="sticky top-0 bg-[#0b0b0b] z-10">
                <tr>
                  <th className="text-white font-black text-[10px] uppercase">Emisión</th>
                  <th className="text-white font-black text-[10px] uppercase">Vencimiento</th>
                  <th className="text-white font-black text-[10px] uppercase">Cliente</th>
                  <th className="text-white font-black text-[10px] uppercase text-right">Monto Orig. USD</th>
                  <th className="text-white font-black text-[10px] uppercase text-right">Saldo Pend. USD</th>
                  <th className="text-white font-black text-[10px] uppercase text-right">Saldo en Bs.</th>
                  <th className="text-white font-black text-[10px] uppercase text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {state.cxc.filter((c: any) => c.estado !== 'pagada').map((c: any) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="text-white font-bold text-xs">{Utils.fmtFecha(c.fecha)}</td>
                    <td className={`text-xs font-bold ${c.fechaVencimiento < Utils.hoy() && c.estado !== 'pagada' ? 'text-[#e04848]' : 'text-white'}`}>
                      {c.fechaVencimiento === '2099-12-31' ? 'ABIERTA' : Utils.fmtFecha(c.fechaVencimiento)}
                    </td>
                    <td className="text-white font-black text-xs uppercase">{c.cliente}</td>
                    <td className="text-white font-bold text-xs text-right">{Utils.fmtUSD(c.montoUSD)}</td>
                    <td className="text-[#3a9bdc] font-black text-xs text-right">{Utils.fmtUSD(c.saldoUSD)}</td>
                    <td className="text-white font-bold text-xs text-right">{Utils.fmtBS(c.saldoUSD * state.tasa)}</td>
                    <td className="text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setShowDetailsModal(c)} className="btn-icon h-8 w-8 text-white hover:text-[#c8952e]" title="Ver Detalles"><Eye className="w-4 h-4"/></button>
                        <button onClick={() => setShowHistoryModal(c)} className="btn-icon h-8 w-8 text-white hover:text-[#3a9bdc]" title="Historial de Abonos"><Clock className="w-4 h-4"/></button>
                        <button onClick={() => { setShowAbonoModal(c.cliente); setAbonoPagos([]); }} className="btn btn-sm btn-primary font-black text-[9px] uppercase px-4">Abonar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {state.cxc.filter((c: any) => c.estado !== 'pagada').length === 0 && (
                  <tr><td colSpan={7} className="text-center py-24 text-white font-black uppercase italic opacity-30">No hay cuentas por cobrar activas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          <ReturnsModule state={state} updateState={updateState} />
        </div>
      )}

      {/* MODAL DETALLES CREDITO */}
      {showDetailsModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowDetailsModal(null)}></div>
          <div className="modal-box bg-[#1e1e1e] border-2 border-white/20 max-w-lg">
            <div className="modal-head py-3 px-4 border-b border-white/10"><h3 className="text-white text-xs font-black uppercase">DETALLE DE CRÉDITO - {showDetailsModal.id}</h3><button onClick={() => setShowDetailsModal(null)}><X className="text-white"/></button></div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-black/40 p-3 rounded border border-white/5 space-y-1">
                <div className="flex justify-between text-[10px] text-white/60"><span>CLIENTE:</span><span className="text-white font-black uppercase">{showDetailsModal.cliente}</span></div>
                <div className="flex justify-between text-[10px] text-white/60"><span>EMISIÓN:</span><span className="text-white font-black">{Utils.fmtFecha(showDetailsModal.fecha)}</span></div>
                <div className="flex justify-between text-sm font-black text-[#c8952e]"><span>TOTAL DEUDA:</span><span>{Utils.fmtUSD(showDetailsModal.montoUSD)}</span></div>
              </div>
              <div className="table-wrap max-h-48 overflow-y-auto">
                <table className="text-[10px]">
                  <thead>
                    <tr className="border-b border-white/10"><th className="text-white/40">Item</th><th className="text-white/40 text-center">Cant</th><th className="text-white/40 text-right">Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {state.ventas.find(v => v.id === showDetailsModal.id || v.id === showDetailsModal.ventaId)?.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-white/5">
                        <td className="text-white font-bold uppercase py-2">{it.nombre}</td>
                        <td className="text-white text-center">{it.cantidad}</td>
                        <td className="text-[#c8952e] text-right font-black">{Utils.fmtUSD(it.subtotalUSD)}</td>
                      </tr>
                    )) || (
                      <tr><td colSpan={3} className="text-center py-4 text-white/20 italic uppercase">Detalle de items no disponible (Deuda Directa)</td></tr>
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
          <div className="modal-box bg-[#1e1e1e] border-2 border-white/20 max-w-lg">
            <div className="modal-head py-3 px-4 border-b border-white/10"><h3 className="text-white text-xs font-black uppercase">HISTORIAL DE PAGOS - {showHistoryModal.id}</h3><button onClick={() => setShowHistoryModal(null)}><X className="text-white"/></button></div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-black/40 p-3 rounded border border-white/5 space-y-1">
                <div className="flex justify-between text-[10px] text-white/60"><span>CLIENTE:</span><span className="text-white font-black uppercase">{showHistoryModal.cliente}</span></div>
                <div className="flex justify-between text-[10px] text-white/60"><span>SALDO PENDIENTE:</span><span className="text-[#3a9bdc] font-black">{Utils.fmtUSD(showHistoryModal.saldoUSD)}</span></div>
              </div>
              <div className="table-wrap max-h-60 overflow-y-auto">
                <table className="text-[10px]">
                  <thead>
                    <tr className="border-b border-white/10"><th className="text-white/40">Recibo</th><th className="text-white/40">Fecha / Hora</th><th className="text-white/40 text-right">Abono (USD)</th><th className="text-white/40 text-right">Abono (BS)</th></tr>
                  </thead>
                  <tbody>
                    {showHistoryModal.historialPagos && showHistoryModal.historialPagos.length > 0 ? (
                      showHistoryModal.historialPagos.map((p: any, idx: number) => (
                        <tr key={idx} className="border-b border-white/5">
                          <td className="text-white font-black mono py-2">{p.reciboId || '-'}</td>
                          <td className="text-white font-bold py-2">{p.fecha.replace('T', ' ').slice(0, 16)}</td>
                          <td className="text-[#27ae60] text-right font-black">{Utils.fmtUSD(p.montoUSD)}</td>
                          <td className="text-white text-right font-black">{Utils.fmtBS(p.montoBS)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="text-center py-8 text-white/20 italic uppercase font-black">No se registran abonos aún</td></tr>
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
          <div className="modal-box max-w-[420px] bg-[#1e1e1e] border-2 border-white/20">
            <div className="modal-head py-3 px-4 border-b border-white/10">
              <h3 className="text-white text-xs font-black uppercase">REGISTRAR ABONO - {showAbonoModal}</h3>
              <button onClick={() => setShowAbonoModal(null)}><X className="text-white"/></button>
            </div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-black p-4 rounded-lg text-center border border-white/10">
                <p className="text-white/40 text-[9px] font-bold uppercase mb-1">DEUDA TOTAL CLIENTE</p>
                <p className="text-3xl font-black text-[#3a9bdc]">{Utils.fmtUSD(deudaVisualUSD)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#131313] p-3 rounded border border-white/5 text-center">
                  <p className="text-white/40 text-[8px] font-black uppercase mb-1">TOTAL A PAGAR BS.</p>
                  <p className="text-lg font-black text-white">{Utils.fmtBS(totalAPagarBS)}</p>
                </div>
                <div className="bg-[#131313] p-3 rounded border border-white/5 text-center">
                  <p className="text-[#c8952e]/60 text-[8px] font-black uppercase mb-1">TOTAL PAGADO</p>
                  <p className="text-lg font-black text-[#c8952e]">{Utils.fmtBS(pagosBS_Abono)}</p>
                </div>
              </div>

              <div className="bg-[#181818] p-3 rounded-lg border border-white/10">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-white text-[10px] font-black uppercase">MÉTODOS DE PAGO</label>
                  <button onClick={() => setShowAbonoMultiModal(true)} className="btn-icon h-6 w-6 bg-[#c8952e] text-black rounded hover:bg-[#c8952e]/80 transition-all">
                    <Plus className="w-4 h-4"/>
                  </button>
                </div>
                
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {abonoPagos.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] text-white font-bold bg-black/30 p-2 rounded border border-white/5">
                      <div className="flex items-center gap-3">
                         <button onClick={() => removeAbonoPago(idx)} className="text-[#e04848] hover:scale-110 transition-transform">
                           <Trash2 className="w-4 h-4" />
                         </button>
                         <span className="uppercase">{Utils.metodoLabel(p.metodo)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[#c8952e] font-black">{Utils.fmtUSD(p.montoUSD)}</div>
                        {(p.metodo !== 'efectivo_usd' && p.metodo !== 'zelle') && <div className="text-[8px] text-white/40 font-bold">{Utils.fmtBS(p.montoBS)}</div>}
                      </div>
                    </div>
                  ))}
                  {abonoPagos.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-[10px] text-white/20 italic uppercase font-black tracking-widest">Añada métodos de pago para continuar</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-500/5 p-3 rounded border border-amber-500/10">
                <p className="text-[9px] text-amber-500/60 italic uppercase text-center leading-tight font-bold">
                  El abono liquidará facturas automáticamente desde la más antigua.
                </p>
              </div>
              
              <button 
                className="btn btn-primary w-full h-14 font-black uppercase text-xs shadow-xl shadow-[#c8952e]/20 disabled:opacity-20 transition-all" 
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
          <div className="modal-box max-w-[380px] bg-[#1e1e1e] border-2 border-white/20">
            <div className="modal-head py-3 px-4 border-b border-white/10">
              <h3 className="text-white text-xs font-black uppercase">{isCreditView ? 'CARGAR CRÉDITO' : 'REGISTRAR PAGO'}</h3>
              <button onClick={() => { setShowMultiModal(false); setIsCreditView(false); }}><X className="text-white"/></button>
            </div>
            <div className="modal-body p-4 space-y-4">
              <div className="bg-black p-3 rounded-lg text-center border border-white/10">
                <p className="text-white/40 text-[9px] font-bold uppercase mb-1">Pendiente</p>
                <p className="text-2xl font-black text-[#3a9bdc]">{Utils.fmtUSD(saldoRestanteUSD)}</p>
                <p className="text-xs text-white/60 font-bold">{Utils.fmtBS(saldoRestanteBS)}</p>
              </div>
              
              {!isCreditView ? (
                <>
                  <div className="space-y-1"><label className="text-white text-[10px] font-bold uppercase">MÉTODO</label>
                    <select className="form-select h-10 bg-[#0b0b0b] text-white border-white/20 font-black uppercase text-xs" value={metodoActual} onChange={e => setMetodoActual(e.target.value as PaymentMethod)}>
                      <option value="efectivo_usd">Efectivo USD</option><option value="efectivo_bs">Efectivo BS</option><option value="punto_venta">Punto de Venta</option><option value="pagomovil">Pago Movil</option><option value="biopago">Biopago</option><option value="zelle">Zelle</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-white text-[10px] font-bold uppercase">MONTO ({metodoActual.includes('usd') || metodoActual === 'zelle' ? 'USD' : 'BS'})</label>
                      <button 
                        onClick={() => {
                          const monto = metodoActual.includes('usd') || metodoActual === 'zelle' ? saldoRestanteUSD : saldoRestanteBS;
                          setMontoInput(monto.toFixed(2));
                        }}
                        className="text-[9px] bg-[#c8952e]/20 text-[#c8952e] px-2 py-0.5 rounded font-black border border-[#c8952e]/30 hover:bg-[#c8952e] hover:text-black transition-colors"
                      >
                        PAGO EXACTO
                      </button>
                    </div>
                    <input type="number" className="form-input h-12 text-lg font-black bg-[#0b0b0b] text-white border-white/20" placeholder={metodoActual.includes('usd') || metodoActual === 'zelle' ? saldoRestanteUSD.toFixed(2) : saldoRestanteBS.toFixed(2)} value={montoInput} onChange={e => setMontoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPago(false)} autoFocus />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button className="btn btn-primary w-full h-12 font-black uppercase text-xs" onClick={() => addPago(false)}>CONFIRMAR ABONO</button>
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-white/10"></div>
                      <span className="text-[9px] text-white/40 font-black">Ó TAMBIÉN</span>
                      <div className="flex-1 h-px bg-white/10"></div>
                    </div>
                    <button 
                      className="btn h-10 border-2 border-[#3a9bdc]/40 text-[#3a9bdc] hover:bg-[#3a9bdc]/10 bg-transparent font-black uppercase text-[10px] w-full"
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
                         <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/40" />
                         <input 
                           className="form-input pl-10 h-10 text-xs bg-black text-white border-white/10" 
                           placeholder="Buscar por nombre o cédula..." 
                           value={clientSearch}
                           onChange={e => setClientSearch(e.target.value)}
                         />
                       </div>
                       
                       <div className="max-h-[160px] overflow-y-auto border border-white/10 rounded-lg bg-black/40">
                         {filteredClients.map(c => (
                           <div 
                             key={c.id} 
                             onClick={() => setSelectedClient(c)}
                             className={`p-3 border-b border-white/5 cursor-pointer hover:bg-[#c8952e]/10 transition-all ${selectedClient?.id === c.id ? 'bg-[#c8952e]/20 border-l-4 border-l-[#c8952e]' : ''}`}
                           >
                             <div className="text-xs font-black text-white uppercase">{c.name}</div>
                             <div className="text-[10px] text-white/40 mono">{c.cedula}</div>
                           </div>
                         ))}
                         {clientSearch.length > 0 && filteredClients.length === 0 && (
                           <div className="p-4 text-center text-[10px] text-white/20 uppercase font-black">No se encontraron clientes</div>
                         )}
                         {clientSearch.length === 0 && (
                           <div className="p-4 text-center text-[10px] text-white/40 uppercase font-black italic">Escriba para buscar...</div>
                         )}
                       </div>

                       <div className="flex flex-col gap-2">
                         <button 
                           className="btn bg-[#3a9bdc]/20 text-[#3a9bdc] border border-[#3a9bdc]/40 hover:bg-[#3a9bdc]/30 font-black uppercase text-[10px] w-full h-10 flex items-center justify-center gap-2"
                           onClick={() => setShowNewClientForm(true)}
                         >
                           <UserPlus className="w-4 h-4" /> Registrar Cliente
                         </button>
                         <button 
                           className="btn btn-primary w-full h-12 font-black uppercase text-xs disabled:opacity-30" 
                           disabled={!selectedClient}
                           onClick={ejecutarVentaACredito}
                         >
                           Cargar Deuda
                         </button>
                         <button className="text-[9px] text-white/40 uppercase font-black mt-1 hover:text-white" onClick={() => { setIsCreditView(false); setSelectedClient(null); }}>
                           Cancelar y volver al pago
                         </button>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                       <div className="grid grid-cols-1 gap-2">
                         <div className="space-y-1">
                           <label className="text-[9px] font-black uppercase text-white/60">Nombre y Apellido</label>
                           <input className="form-input h-9 text-xs bg-black text-white border-white/10" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[9px] font-black uppercase text-white/60">Cédula (V-00.000.000)</label>
                           <input className="form-input h-9 text-xs bg-black text-white border-white/10" value={newClient.cedula} onChange={e => setNewClient({...newClient, cedula: e.target.value})} />
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                           <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-white/60">Teléfono (Op.)</label>
                             <input className="form-input h-9 text-xs bg-black text-white border-white/10" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-white/60">Dirección (Op.)</label>
                             <input className="form-input h-9 text-xs bg-black text-white border-white/10" value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})} />
                           </div>
                         </div>
                       </div>
                       
                       <div className="flex flex-col gap-2 pt-2">
                         <button className="btn btn-primary w-full h-12 font-black uppercase text-xs" onClick={ejecutarVentaACredito}>
                           Cargar Deuda
                         </button>
                         <button className="text-[9px] text-white/40 uppercase font-black hover:text-white" onClick={() => setShowNewClientForm(false)}>
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

      {/* Modal Multi-pago Abono */}
      {showAbonoMultiModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowAbonoMultiModal(false)}></div>
          <div className="modal-box max-w-[350px] bg-[#1e1e1e] border-2 border-white/20">
            <div className="modal-head py-3 px-4 border-b border-white/10"><h3 className="text-white text-xs font-black uppercase">AÑADIR MÉTODO DE PAGO</h3><button onClick={() => setShowAbonoMultiModal(false)}><X className="text-white"/></button></div>
            <div className="modal-body p-4 space-y-4">
              <div className="space-y-1"><label className="text-white text-[10px] font-bold uppercase">MÉTODO</label>
                <select className="form-select h-10 bg-[#0b0b0b] text-white border-white/20 font-black uppercase text-xs" value={metodoActual} onChange={e => setMetodoActual(e.target.value as PaymentMethod)}>
                  <option value="efectivo_usd">Efectivo USD</option><option value="efectivo_bs">Efectivo BS</option><option value="punto_venta">Punto de Venta</option><option value="pagomovil">Pago Movil</option><option value="biopago">Biopago</option><option value="zelle">Zelle</option>
                </select>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white text-[10px] font-bold uppercase">MONTO ({metodoActual.includes('usd') || metodoActual === 'zelle' ? 'USD' : 'BS'})</label>
                  <button 
                    onClick={() => {
                      const restanteUSD = Math.max(0, deudaVisualUSD - (pagosBS_Abono / state.tasa));
                      const monto = metodoActual.includes('usd') || metodoActual === 'zelle' ? restanteUSD : restanteUSD * state.tasa;
                      setMontoInput(monto.toFixed(2));
                    }}
                    className="text-[9px] bg-[#c8952e]/20 text-[#c8952e] px-2 py-0.5 rounded font-black border border-[#c8952e]/30 hover:bg-[#c8952e] hover:text-black transition-colors"
                  >
                    PAGO EXACTO
                  </button>
                </div>
                <input type="number" className="form-input h-12 text-lg font-black bg-[#0b0b0b] text-white border-white/20" placeholder="0.00" value={montoInput} onChange={e => setMontoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPago(true)} autoFocus />
              </div>
              <button className="btn btn-primary w-full h-12 font-black uppercase text-xs shadow-lg shadow-[#c8952e]/20" onClick={() => addPago(true)}>AÑADIR AL COBRO</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reportes Y/Z (Formato Recibo 80mm) */}
      {showReport && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowReport(null)}></div>
          <div className="modal-box bg-white text-black max-w-sm rounded shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-[#131313] p-3 flex justify-between items-center border-b border-white/10">
              <h3 className="text-white font-bold text-xs uppercase tracking-widest">Vista Previa Reporte</h3>
              <button onClick={() => setShowReport(null)}><X className="text-white h-4 w-4"/></button>
            </div>
            
            <div className="p-4 max-h-[70vh] overflow-y-auto bg-gray-100 flex justify-center">
              <div 
                ref={reportPrintRef} 
                className="bg-white p-5 shadow-sm text-black font-mono select-none"
                style={{ width: '72mm', boxSizing: 'border-box', color: '#000' }}
              >
                <div className="text-center" style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px dashed #000' }}>
                  <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 2px 0', letterSpacing: '1px' }}>{state.empresa.nombre.toUpperCase()}</h1>
                  <p style={{ fontSize: '10px', margin: '2px 0', fontWeight: 'bold' }}>{state.empresa.direccion}</p>
                  <p style={{ fontSize: '9px', margin: '2px 0' }}>RIF: {state.empresa.rif}</p>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                  <span style={{ background: '#000', color: 'white', padding: '3px 12px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' }}>
                    REPORTE "{showReport}"
                  </span>
                </div>

                <div style={{ margin: '8px 0', fontSize: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span>FECHA:</span><span style={{ fontWeight: 'bold' }}>{Utils.fmtFecha(Utils.hoy())}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span>HORA:</span><span style={{ fontWeight: 'bold' }}>{ahora.split('T')[1].slice(0, 8)}</span>
                  </div>
                  {showReport === 'Z' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                      <span>REPORTE Z #:</span><span style={{ fontWeight: 'bold' }}>{String(state.ultimoZ).padStart(4, '0')}</span>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '6px' }}>RESUMEN POR OPERACIÓN:</div>
                
                <div style={{ fontSize: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>VENTAS DIRECTAS:</span>
                    <span style={{ fontWeight: 'bold' }}>{Utils.fmtUSD(rVDirectas)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>COBROS DEUDA:</span>
                    <span style={{ fontWeight: 'bold' }}>{Utils.fmtUSD(rVCobros)}</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '6px' }}>DESGLOSE POR MÉTODO:</div>
                
                <div style={{ fontSize: '10px', marginBottom: '10px' }}>
                  {Object.entries(breakdown).map(([metodo, montos]) => {
                    const isUSD = metodo === 'efectivo_usd' || metodo === 'zelle';
                    const label = Utils.metodoLabel(metodo).toUpperCase();
                    const valueDisplay = isUSD ? Utils.fmtUSD(montos.usd) : Utils.fmtBS(montos.bs);
                    return (
                      <div key={metodo} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span>{label}:</span>
                        <span style={{ fontWeight: 'bold' }}>{valueDisplay}</span>
                      </div>
                    );
                  })}
                  {Object.keys(breakdown).length === 0 && <div className="text-center italic py-2">Sin movimientos</div>}
                </div>

                <div style={{ borderTop: '1px solid #000', marginTop: '10px', paddingTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                    <span>TOTAL CAJA BS:</span>
                    <span>{Utils.fmtBS(rTotalBS)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                    <span>TOTAL CAJA USD:</span>
                    <span>{Utils.fmtUSD(rTotalUSD)}</span>
                  </div>
                </div>

                {showReport === 'Z' && (
                  <div style={{ marginTop: '12px', borderTop: '1px dashed #000', paddingTop: '8px', fontSize: '9px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
                      <span>ACUMULADO HISTORICO:</span>
                      <span>{Utils.fmtUSD(state.reportesZ[state.reportesZ.length-1]?.acumuladoHistoricoUSD || 0)}</span>
                    </div>
                  </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '6px', borderTop: '1px dashed #000', fontSize: '9px', fontWeight: 'bold' }}>
                  *** DOCUMENTO FISCAL ***
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2">
              <button onClick={() => setShowReport(null)} className="flex-1 py-3 bg-gray-800 text-white font-black text-xs rounded-lg uppercase tracking-wider">Cerrar</button>
              <button onClick={() => handleNativeReportPrint(showReport)} className="flex-1 py-3 bg-[#c8952e] text-black font-black text-xs rounded-lg uppercase tracking-wider flex items-center justify-center gap-2">
                <Printer size={14} /> IMPRIMIR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECIBO DE PAGO (NUEVO FORMATO PROFESIONAL 80MM) */}
      {showReceiptModal && lastProcessedSale && (
        <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col border border-gray-200">
            <div className="bg-black p-3.5 flex justify-between items-center border-b border-gray-700">
              <h3 className="text-white font-bold text-sm flex items-center gap-2 tracking-wide">
                <Printer size={16} className="text-amber-400" /> VISTA PREVIA DEL DOCUMENTO
              </h3>
              <button onClick={() => setShowReceiptModal(false)} className="text-white/70 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 max-h-[65vh] overflow-y-auto bg-gray-100 flex justify-center">
              <div 
                ref={printRef} 
                className="bg-white p-5 shadow-sm text-black font-mono select-none"
                style={{ width: '72mm', boxSizing: 'border-box', color: '#000' }}
              >
                <div className="text-center" style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px dashed #000' }}>
                  <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 2px 0', letterSpacing: '1px' }}>{state.empresa.nombre.toUpperCase()}</h1>
                  <p style={{ fontSize: '10px', margin: '2px 0', fontWeight: 'bold' }}>{state.empresa.direccion}</p>
                  <p style={{ fontSize: '9px', margin: '2px 0' }}>RIF: {state.empresa.rif}</p>
                  <p style={{ fontSize: '9px', margin: '2px 0' }}>TEL: {state.empresa.telefono}</p>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                  <span style={{ 
                    background: lastProcessedSale.estado === 'pendiente' ? '#e04848' : (lastProcessedSale.type === 'COBRO DEUDA' ? '#27ae60' : '#2c3e50'), 
                    color: 'white', 
                    padding: '2px 8px', 
                    fontSize: '9px', 
                    fontWeight: 'bold',
                    display: 'inline-block'
                  }}>
                    {lastProcessedSale.estado === 'pendiente' ? 'VENTA A CRÉDITO' : (lastProcessedSale.type === 'COBRO DEUDA' ? 'INFORME' : 'RECIBO')}
                  </span>
                </div>

                <div style={{ margin: '6px 0', fontSize: '9px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{lastProcessedSale.type === 'COBRO DEUDA' ? 'INFORME N°:' : 'RECIBO N°:'} <span style={{ fontWeight: 'bold' }}>{lastProcessedSale.id}</span></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span>FECHA: {Utils.fmtFecha(lastProcessedSale.fecha)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span>HORA: {lastProcessedSale.fecha.split('T')[1]?.slice(0, 5) || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span>CLIENTE: {lastProcessedSale.cliente.toUpperCase()}</span>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', margin: '6px 0' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px dashed #000', borderTop: '1px dashed #000' }}>
                      <th style={{ textAlign: 'left', padding: '3px 0', fontSize: '9px' }}>CANT</th>
                      <th style={{ textAlign: 'left', padding: '3px 0', fontSize: '9px', paddingLeft: '4px' }}>PRODUCTO</th>
                      <th style={{ textAlign: 'right', padding: '3px 0', fontSize: '9px' }}>TOTAL ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastProcessedSale.items.map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px dotted #eee' }}>
                        <td style={{ padding: '4px 0', fontSize: '9px', fontWeight: 'bold' }}>{(item.qty || item.cantidad)} x</td>
                        <td style={{ padding: '4px 0', paddingLeft: '4px', fontSize: '9px' }}>
                          {item.nombre.toUpperCase().slice(0, 22)}
                          <div style={{ fontSize: '8px', color: '#555' }}>Ref: {Utils.fmtUSD(item.precioUnitUSD)}</div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 0', fontSize: '9px', fontWeight: 'bold' }}>
                          {Utils.fmtUSD(item.subtotalUSD).replace('$', '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ borderTop: '1px dashed #000', paddingTop: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', margin: '5px 0', padding: '3px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span>TOTAL BS:</span>
                      <span>{Utils.fmtBS(lastProcessedSale.totalBS)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#333', fontWeight: 'normal', marginTop: '2px' }}>
                      <span>REF. DIVISAS:</span>
                      <span>{Utils.fmtUSD(lastProcessedSale.totalUSD)}</span>
                    </div>
                  </div>
                </div>

                {lastProcessedSale.payments && lastProcessedSale.payments.length > 0 && (
                  <div style={{ border: '1px solid #000', padding: '4px', margin: '8px 0' }}>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10px', marginBottom: '4px' }}>DETALLE DE PAGOS</div>
                    {lastProcessedSale.payments.map((p: PagoRealizado, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', margin: '2px 0' }}>
                        <span>{Utils.metodoLabel(p.metodo).toUpperCase()}</span>
                        <span style={{ fontWeight: 'bold' }}>{p.metodo.includes('usd') || p.metodo === 'zelle' ? Utils.fmtUSD(p.montoUSD) : Utils.fmtBS(p.montoBS)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '12px', paddingTop: '6px', borderTop: '1px dashed #000', fontSize: '8px' }}>
                  <p style={{ margin: '2px 0', fontWeight: 'bold' }}>¡GRACIAS POR SU PREFERENCIA!</p>
                  {lastProcessedSale.estado === 'pendiente' && (
                    <p style={{ margin: '4px 0', fontWeight: 'bold', color: '#000', fontSize: '9px', border: '1px solid #000', padding: '2px' }}>
                      EL MONTO EN BS. CAMBIA SEGUN LA TASA BCV DEL DIA DE PAGO
                    </p>
                  )}
                  <p style={{ margin: '2px 0' }}>CONSERVE ESTE TICKET COMO COMPROBANTE</p>
                  <p style={{ fontSize: '7px', marginTop: '6px', color: '#444' }}>Desarrollado por LicoreriaPOS v2.0</p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-col gap-2">
              <div className="flex gap-2">
                <button onClick={() => setShowReceiptModal(false)} className="flex-1 py-2 bg-gray-200 text-slate-800 font-bold text-xs rounded-lg hover:bg-gray-300 transition-colors uppercase tracking-wider">Cerrar</button>
                <button onClick={handleSharePDF} className="flex-1 py-2 bg-green-600 text-white font-bold text-xs rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 uppercase tracking-wider shadow-sm"><Share2 size={14} /> Compartir</button>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => handlePrint(printRef)} className="flex-1 py-2 bg-gray-800 text-white font-bold text-xs rounded-lg hover:bg-black transition-colors flex items-center justify-center gap-2 uppercase tracking-wider shadow-sm"><Printer size={14} /> Estándar</button>
                 <button onClick={() => handleNativePrint(lastProcessedSale)} className="flex-1 py-2 bg-[#D4A017] text-slate-950 font-black text-xs rounded-lg hover:bg-[#C4940F] transition-colors flex items-center justify-center gap-2 uppercase tracking-wider shadow-sm border-2 border-black/10">
                   <Zap size={14} className="fill-current" /> IMPRESIÓN USB
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
