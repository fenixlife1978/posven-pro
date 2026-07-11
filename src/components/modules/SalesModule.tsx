
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AppState, SaleItem, Sale, PaymentMethod, ReportZ, Movimiento, PagoRealizado, Customer, Return, ReturnItem, Product } from '@/lib/types';
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
  Lock,
  RefreshCw,
  Check,
  RotateCcw
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ✅ Soporte para impresión nativa
declare global {
  interface Window {
    electronAPI?: {
      printTicket: (data: any) => Promise<void>;
    };
  }
}

export default function SalesModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
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
  
  const [lastProcessedSale, setLastProcessedSale] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Estados para Carga de Crédito
  const [isCreditView, setIsCreditView] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', cedula: 'V-', phone: '', address: '' });

  // Estados para Devoluciones
  const [returnView, setReturnView] = useState<'list' | 'create'>('list');
  const [returnSaleSearch, setReturnSaleSearch] = useState('');
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'EFECTIVO' | 'MISMO_METODO' | 'CREDITO_TIENDA'>('EFECTIVO');
  const [returnReason, setReturnReason] = useState('');

  // Estados para Tasa BCV
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [nuevaTasa, setNuevaTasa] = useState(state.tasa.toString());

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cálculos para el Modal de Abono (Deuda que disminuye en tiempo real)
  const totalDeudaAbonoUSD = showAbonoModal 
    ? state.cxc.filter(c => c.cliente === showAbonoModal && c.estado !== 'pagada').reduce((s, c) => s + c.saldoUSD, 0)
    : 0;
  const totalAbonadoEnModalUSD = abonoPagos.reduce((s, p) => s + p.montoUSD, 0);
  const deudaRestanteAbonoUSD = Math.max(0, totalDeudaAbonoUSD - totalAbonadoEnModalUSD);
  const deudaRestanteAbonoBS = deudaRestanteAbonoUSD * state.tasa;

  // Helper: Cálculo de Stock Real (Considerando Kits dinámicos)
  const getStockDisponible = (p: Product) => {
    let avail = p.stock || 0;
    if (p.isKit && p.kitType === 'stock_componentes' && p.kitItems) {
      let compPossible = Infinity;
      p.kitItems.forEach(ki => {
        const cp = state.productos.find(c => c.id === ki.productoId);
        if (cp) {
          const possible = Math.floor((cp.stock || 0) / ki.cantidad);
          compPossible = Math.min(compPossible, possible);
        } else {
          compPossible = 0;
        }
      });
      if (compPossible !== Infinity) avail += compPossible;
    }
    return avail;
  };

  const agregar = (pid: string) => {
    const p = state.productos.find(x => x.id === pid);
    if (!p) return;
    
    const stockAvail = getStockDisponible(p);
    if (stockAvail <= 0) return;

    const nuevoCarrito = [...state.carrito];
    const idx = nuevoCarrito.findIndex(i => i.productoId === pid);
    if (idx >= 0) {
      if (nuevoCarrito[idx].cantidad >= stockAvail) return;
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
    if (!p) return;

    const stockAvail = getStockDisponible(p);
    const n = item.cantidad + delta;
    
    if (n <= 0) nuevo.splice(idx, 1);
    else if (n <= stockAvail) {
      item.cantidad = n;
      item.subtotalUSD = n * item.precioUnitUSD;
    }
    updateState({ carrito: nuevo });
    setPagos([]);
  };

  const subtotalUSD = state.carrito.reduce((s, i) => s + i.subtotalUSD, 0);
  const totalBS = subtotalUSD * state.tasa;
  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  const saldoRestanteUSD = Math.max(0, subtotalUSD - totalPagadoUSD);
  const saldoRestanteBS = saldoRestanteUSD * state.tasa;

  const matches = search.trim().length > 0 
    ? state.productos
        .filter(p => p.activo && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())))
        .slice(0, 8)
    : [];

  const filteredClients = clientSearch.trim().length > 0
    ? (state.clientes || []).filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.cedula.includes(clientSearch))
    : [];

  const getCurrentTerminal = () => {
    const currentUserId = auth.currentUser?.email?.replace(/\W/g, '_');
    return state.terminales.find(t => t.usuarioId === currentUserId);
  };

  const guardarNuevaTasa = () => {
    const n = parseFloat(nuevaTasa);
    if (isNaN(n) || n <= 0) return alert('Tasa inválida');
    updateState({ tasa: n });
    setEditandoTasa(false);
    setNuevaTasa(n.toString());
  };

  const ejecutarVenta = () => {
    if (state.carrito.length === 0 || saldoRestanteUSD > 0.01) return;
    
    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahoraStr = Utils.ahora();
    const terminal = getCurrentTerminal();
    
    let prodsActualizados = [...state.productos];
    let nuevosMovimientos: Movimiento[] = [];

    state.carrito.forEach(item => {
      const pIdx = prodsActualizados.findIndex(x => x.id === item.productoId);
      if (pIdx === -1) return;
      
      const p = { ...prodsActualizados[pIdx] };
      
      if (p.isKit && p.kitType === 'stock_componentes' && p.kitItems) {
        p.kitItems.forEach(ki => {
          const cpIdx = prodsActualizados.findIndex(cp => cp.id === ki.productoId);
          if (cpIdx !== -1) {
            const cp = { ...prodsActualizados[cpIdx] };
            const cantidadADescontar = item.cantidad * ki.cantidad;
            const stockAntes = cp.stock;
            cp.stock -= cantidadADescontar;
            
            nuevosMovimientos.push({
              id: Store.uid(),
              productoId: cp.id,
              tipo: 'venta',
              cantidad: -Math.abs(cantidadADescontar),
              stockAntes,
              stockDespues: cp.stock,
              fecha: ahoraStr,
              referencia: `COMPONENTE DE KIT: ${p.nombre} - VENTA ${reciboId}`
            });
            prodsActualizados[cpIdx] = cp;
          }
        });
        nuevosMovimientos.push({
          id: Store.uid(),
          productoId: p.id,
          tipo: 'venta',
          cantidad: -Math.abs(item.cantidad),
          stockAntes: p.stock,
          stockDespues: p.stock,
          fecha: ahoraStr,
          referencia: `VENTA KIT VIRTUAL ${reciboId}`
        });
      } else {
        const stockAntes = p.stock;
        p.stock -= item.cantidad;
        
        nuevosMovimientos.push({
          id: Store.uid(),
          productoId: p.id,
          tipo: 'venta',
          cantidad: -Math.abs(item.cantidad),
          stockAntes,
          stockDespues: p.stock,
          fecha: ahoraStr,
          referencia: `VENTA ${reciboId} - TERM: ${terminal?.nombre || 'Gral'}`
        });
      }
      prodsActualizados[pIdx] = p;
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
      payments: [...pagos],
      terminalId: terminal?.id,
      cajeroId: auth.currentUser?.email?.replace(/\W/g, '_')
    };

    updateState({
      productos: prodsActualizados,
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
    const terminal = getCurrentTerminal();
    
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
    
    let prodsActualizados = [...state.productos];
    let nuevosMovimientos: Movimiento[] = [];

    state.carrito.forEach(item => {
      const pIdx = prodsActualizados.findIndex(x => x.id === item.productoId);
      if (pIdx === -1) return;
      const p = { ...prodsActualizados[pIdx] };
      
      if (p.isKit && p.kitType === 'stock_componentes' && p.kitItems) {
        p.kitItems.forEach(ki => {
          const cpIdx = prodsActualizados.findIndex(cp => cp.id === ki.productoId);
          if (cpIdx !== -1) {
            const cp = { ...prodsActualizados[cpIdx] };
            const cantidadADescontar = item.cantidad * ki.cantidad;
            const stockAntes = cp.stock;
            cp.stock -= cantidadADescontar;
            
            nuevosMovimientos.push({
              id: Store.uid(),
              productoId: cp.id,
              tipo: 'venta',
              cantidad: -Math.abs(cantidadADescontar),
              stockAntes,
              stockDespues: cp.stock,
              fecha: ahoraStr,
              referencia: `COMPONENTE DE KIT (CREDITO): ${p.nombre} - VENTA ${reciboId}`
            });
            prodsActualizados[cpIdx] = cp;
          }
        });
        nuevosMovimientos.push({
          id: Store.uid(),
          productoId: p.id,
          tipo: 'venta',
          cantidad: -Math.abs(item.cantidad),
          stockAntes: p.stock,
          stockDespues: p.stock,
          fecha: ahoraStr,
          referencia: `VENTA KIT VIRTUAL (CREDITO) ${reciboId}`
        });
      } else {
        const stockAntes = p.stock;
        p.stock -= item.cantidad;
        
        nuevosMovimientos.push({
          id: Store.uid(),
          productoId: p.id,
          tipo: 'venta',
          cantidad: -Math.abs(item.cantidad),
          stockAntes,
          stockDespues: p.stock,
          fecha: ahoraStr,
          referencia: `CRÉDITO ${reciboId} - TERM: ${terminal?.nombre || 'Gral'}`
        });
      }
      prodsActualizados[pIdx] = p;
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
      change: 0,
      terminalId: terminal?.id,
      cajeroId: auth.currentUser?.email?.replace(/\W/g, '_')
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
      ventaId: reciboId,
      historialPagos: []
    };

    updateState({
      productos: prodsActualizados,
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
  };

  const addPago = (isAbono: boolean = false) => {
    let monto = parseFloat(montoInput);
    if (isNaN(monto) || monto <= 0) return alert("Ingrese monto válido");

    let montoUSD = (metodoActual.includes('usd') || metodoActual === 'zelle') ? monto : monto / state.tasa;
    let montoBS = (metodoActual.includes('usd') || metodoActual === 'zelle') ? monto * state.tasa : monto;
    
    if (isAbono) {
      setAbonoPagos([...abonoPagos, { metodo: metodoActual, montoUSD, montoBS }]);
      setShowAbonoMultiModal(false);
    } else {
      const nuevosPagos = [...pagos, { metodo: metodoActual, montoUSD, montoBS }];
      setPagos(nuevosPagos);
      const totalPagadoLocal = nuevosPagos.reduce((s, p) => s + p.montoUSD, 0);
      if (totalPagadoLocal >= (subtotalUSD - 0.01)) {
        setShowMultiModal(false);
      }
    }
    setMontoInput('');
  };

  const procesarAbonoCascada = () => {
    if (abonoPagos.length === 0 || !showAbonoModal) return;
    
    const totalAbonoUSD = abonoPagos.reduce((s, p) => s + p.montoUSD, 0);
    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahoraStr = Utils.ahora();
    const terminal = getCurrentTerminal();
    let restante = totalAbonoUSD;
    
    const nuevasDeudas = [...state.cxc].sort((a, b) => a.fecha.localeCompare(b.fecha));
    
    const actualizadas = nuevasDeudas.map(d => {
      if (d.cliente === showAbonoModal && d.estado !== 'pagada' && restante > 0) {
        const abonoAplicado = Math.min(restante, d.saldoUSD);
        restante -= abonoAplicado;
        
        const historialPagos = d.historialPagos || [];
        historialPagos.push({ 
          fecha: ahoraStr, 
          montoUSD: abonoAplicado, 
          montoBS: abonoAplicado * state.tasa, 
          reciboId,
          metodo: abonoPagos.length > 1 ? 'mixto' : abonoPagos[0].metodo 
        });
        
        const nuevoSaldo = d.saldoUSD - abonoAplicado;
        return { 
          ...d, 
          abonadoUSD: (d.abonadoUSD || 0) + abonoAplicado, 
          saldoUSD: nuevoSaldo, 
          estado: nuevoSaldo <= 0.01 ? 'pagada' : 'parcial', 
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
      payments: [...abonoPagos],
      terminalId: terminal?.id,
      cajeroId: auth.currentUser?.email?.replace(/\W/g, '_')
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
    let totalBS = 0; let totalUSD = 0; let totalCreditosUSD = 0;

    ventasHoy.forEach(v => {
      const payments = v.payments && v.payments.length > 0 ? v.payments : [{ metodo: v.metodoPago, montoUSD: v.totalUSD, montoBS: v.totalBS }];
      payments.forEach((p: PagoRealizado) => {
        const m = p.metodo;
        if (!breakdown[m]) breakdown[m] = { usd: 0, bs: 0 };
        breakdown[m].usd += p.montoUSD; breakdown[m].bs += p.montoBS;
        if (m === 'efectivo_usd' || m === 'zelle') totalUSD += p.montoUSD;
        else if (m === 'credito') totalCreditosUSD += p.montoUSD;
        else totalBS += p.montoBS;
      });
    });
    return { breakdown, totalBS, totalUSD, totalCreditosUSD, ventasHoy };
  };

  const emitirReporteZ = () => {
    if (!confirm('¿Desea realizar el CIERRE FISCAL Z?')) return;
    const hoy = Utils.hoy();
    const ventasHoy = state.ventas.filter(v => v.fecha.startsWith(hoy));
    const totalHoy = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
    const nuevoZ: ReportZ = {
      id: `Z-${String(state.ultimoZ + 1).padStart(4, '0')}`,
      fecha: hoy, numeroZ: state.ultimoZ + 1,
      desdeFactura: ventasHoy[0]?.id || '000000000',
      hastaFactura: ventasHoy[ventasHoy.length - 1]?.id || '000000000',
      baseImponibleUSD: totalHoy / 1.16, ivaUSD: totalHoy - (totalHoy / 1.16),
      exentoUSD: 0, totalBrutoUSD: totalHoy, acumuladoHistoricoUSD: state.acumuladoHistorico
    };
    updateState({ reportesZ: [...state.reportesZ, nuevoZ], ultimoZ: state.ultimoZ + 1 });
    setShowReport('Z');
  };

  const { breakdown, totalBS: rTotalBS, totalUSD: rTotalUSD, totalCreditosUSD, ventasHoy: rVentasHoy } = getReportSummary();

  const buscarVentaParaDevolucion = () => {
    const sale = state.ventas.find(v => v.id === returnSaleSearch || v.id.endsWith(returnSaleSearch));
    if (!sale) return alert('Venta no encontrada');
    setSelectedSaleForReturn(sale);
    setReturnItems([]);
  };

  const handleAddReturnItem = (productoId: string, nombre: string, precioUnitUSD: number, maxQty: number) => {
    const alreadyReturned = (state.devoluciones || []).filter(d => d.ventaId === selectedSaleForReturn?.id).flatMap(d => d.items).filter(i => i.productoId === productoId).reduce((sum, i) => sum + i.cantidad, 0);
    const available = maxQty - alreadyReturned;
    if (available <= 0) return alert('Ya devuelto');
    const qty = parseInt(prompt(`Cantidad (Máx: ${available}):`, '1') || '0');
    if (isNaN(qty) || qty <= 0 || qty > available) return;
    const cond = confirm('¿Reintegrar al stock?') ? 'REINTEGRADO_STOCK' : 'MERMA_DANADO';
    setReturnItems([...returnItems, { productoId, nombre, cantidad: qty, precioUnitUSD, estadoProducto: cond as any }]);
  };

  const procesarDevolucionPOS = () => {
    if (!selectedSaleForReturn || returnItems.length === 0 || !returnReason.trim()) return;
    if (prompt('PIN de autorización:') !== state.pinDevolucion) return alert('PIN incorrecto');
    const totalDev = returnItems.reduce((s, i) => s + (i.cantidad * i.precioUnitUSD), 0);
    const idDev = 'DEV-' + String(state.proximaDevolucion).padStart(6, '0');
    const ahoraStr = Utils.ahora();
    const nuevosProds = [...state.productos];
    const nuevosMovs: Movimiento[] = [];
    returnItems.forEach(it => {
      const pIdx = nuevosProds.findIndex(p => p.id === it.productoId);
      if (pIdx >= 0) {
        const p = nuevosProds[pIdx];
        if (it.estadoProducto === 'REINTEGRADO_STOCK') p.stock += it.cantidad;
        nuevosMovs.push({ id: Store.uid(), productoId: it.productoId, tipo: 'devolucion', cantidad: it.cantidad, stockAntes: p.stock - it.cantidad, stockDespues: p.stock, fecha: ahoraStr, referencia: `DEV ${idDev}` });
      }
    });
    updateState({ productos: nuevosProds, devoluciones: [{ id: idDev, ventaId: selectedSaleForReturn.id, fecha: ahoraStr, items: [...returnItems], totalUSD: totalDev, metodoReembolso: refundMethod, motivo: returnReason }, ...(state.devoluciones || [])], movimientos: [...state.movimientos, ...nuevosMovs], proximaDevolucion: state.proximaDevolucion + 1 });
    alert('Procesada'); setReturnView('list'); setSelectedSaleForReturn(null);
  };

  const zReportData = showReport === 'Z' ? state.reportesZ[state.reportesZ.length - 1] : null;

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
                <div className="bg-brand-gold-soft/30 border border-brand-gold/30 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-ink text-[9px] font-black uppercase tracking-wider">TASA BCV</label>
                    <div className="flex items-center gap-1">
                      {!editandoTasa ? (
                        <><span className="text-ink font-black text-sm">{state.tasa.toFixed(2)}</span><button onClick={() => { setEditandoTasa(true); setNuevaTasa(state.tasa.toString()); }} className="text-ink/40 hover:text-brand-gold p-0.5"><RefreshCw className="w-3.5 h-3.5" /></button></>
                      ) : (
                        <><input type="text" value={nuevaTasa} onChange={e => setNuevaTasa(e.target.value.replace(/[^0-9.]/g, ''))} className="w-16 bg-white border border-brand-gold rounded px-1 py-0.5 text-ink font-black text-sm text-right" autoFocus /><button onClick={guardarNuevaTasa} className="text-green-600 p-0.5"><Check className="w-3.5 h-3.5" /></button><button onClick={() => setEditandoTasa(false)} className="text-red-500 p-0.5"><X className="w-3.5 h-3.5" /></button></>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-ink text-[10px] font-black uppercase block mb-1">MÉTODOS APLICADOS</label>
                  <div className="flex-1 p-2 border border-line bg-surface-soft rounded-lg overflow-y-auto">
                    {pagos.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-[10px] border-b border-line/30 py-1 text-ink font-black uppercase">
                        <span>{Utils.metodoLabel(p.metodo)}</span><span className="text-brand-gold-deep">{Utils.fmtUSD(p.montoUSD)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 border border-[#3a9bdc]/30 bg-[#3a9bdc]/5 rounded-lg text-center space-y-2">
                  <label className="text-ink text-[10px] font-black uppercase block">SALDO RESTANTE</label>
                  <div className="flex items-center justify-center gap-4">
                    <div className={`text-2xl font-black ${saldoRestanteUSD <= 0.01 ? 'text-[#27ae60]' : 'text-[#3a9bdc]'}`}>{saldoRestanteUSD <= 0.01 ? 'SALDADO' : Utils.fmtUSD(saldoRestanteUSD)}</div>
                    <button onClick={() => setShowMultiModal(true)} className="w-11 h-11 bg-[#c8952e] text-black rounded-xl shadow-lg flex items-center justify-center hover:bg-[#d9a540] transition-all transform hover:scale-105 active:scale-95"><Wallet className="w-6 h-6" /></button>
                  </div>
                  <div className="bg-ink py-2 rounded-lg border-2 border-line mt-2">
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
                  {state.carrito.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_60px_70px_80px_80px_40px] gap-2 items-center px-3 py-3 bg-white border-b border-black/5 text-ink">
                      <div className="truncate font-black text-[10px] uppercase leading-tight">{item.nombre}</div>
                      <div className="flex items-center justify-center gap-1 bg-surface-soft rounded p-0.5 border border-line/30">
                        <button onClick={() => updateQty(i, -1)} className="text-ink font-black text-xs px-1">-</button>
                        <span className="w-5 text-center text-[10px] font-black">{item.cantidad}</span>
                        <button onClick={() => updateQty(i, 1)} className="text-ink font-black text-xs px-1">+</button>
                      </div>
                      <div className="text-center text-[9px] font-black uppercase">{state.productos.find(p => p.id === item.productoId)?.cantidad || '-'}</div>
                      <div className="text-right text-[10px] font-black">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                      <div className="text-right text-[10px] font-black">{Utils.fmtBS(item.precioUnitUSD * state.tasa)}</div>
                      <div className="text-right text-[11px] font-black">{Utils.fmtUSD(item.subtotalUSD)}</div>
                      <div className="flex justify-center"><button onClick={() => updateQty(i, -item.cantidad)} className="text-ink/20 hover:text-red-600"><Trash2 className="w-3.5 h-3.5"/></button></div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-ink border-t border-line/10 flex items-center justify-between rounded-b-lg">
                  <div className="space-y-0">
                    <label className="text-white/60 text-[8px] font-black uppercase block tracking-widest mb-1">TOTAL FACTURA</label>
                    <div className="flex items-baseline gap-3"><div className="text-4xl font-black text-brand-gold">{Utils.fmtUSD(subtotalUSD)}</div><div className="text-base font-black text-white">{Utils.fmtBS(totalBS)}</div></div>
                  </div>
                  <button onClick={ejecutarVenta} disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01} className="btn bg-[#2a261c] border border-brand-gold/30 h-12 px-8 font-black uppercase text-[10px] text-brand-gold disabled:opacity-20 flex items-center gap-2 tracking-widest"><CheckCircle2 className="w-4 h-4"/> PROCESAR VENTA</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : view === 'history' ? (
        <div className="card flex-1 bg-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300 rounded-xl">
          <div className="card-head px-6 py-4 bg-ink border-b border-white/10 flex justify-between items-center"><h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2 text-xs"><History className="w-5 h-5 text-brand-gold" /> HISTORIAL TRANSACCIONES</h3><button onClick={() => setView('pos')} className="btn btn-sm bg-white text-ink hover:bg-surface-soft flex items-center gap-2 font-black uppercase text-[10px] rounded-lg border-none px-4"><ArrowLeft className="w-3.5 h-3.5"/> Volver al POS</button></div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table>
              <thead><tr><th>Recibo</th><th>Hora</th><th>Terminal</th><th>Cliente</th><th>Tipo</th><th className="text-right">Monto USD</th><th>Método</th><th className="text-center">Estado</th></tr></thead>
              <tbody>
                {getReportSummary().ventasHoy.sort((a,b) => b.fecha.localeCompare(a.fecha)).map(v => (
                  <tr key={v.id} className="border-b border-line/40 hover:bg-surface-warm/20"><td className="text-ink font-black text-xs mono">{v.id}</td><td className="text-ink font-bold text-xs">{v.fecha.split('T')[1]?.slice(0, 5)}</td><td className="text-ink font-black text-[10px] uppercase">{state.terminales.find(t => t.id === v.terminalId)?.nombre || '-'}</td><td className="text-ink font-black text-xs uppercase truncate max-w-[150px]">{v.cliente}</td><td className="text-ink font-black text-[9px] uppercase"><span className={`badge ${v.type === 'COBRO DEUDA' ? 'badge-info' : 'badge-neutral'}`}>{v.type || 'VENTA'}</span></td><td className="text-brand-gold-deep font-black text-xs text-right">{Utils.fmtUSD(v.totalUSD)}</td><td className="text-ink font-bold text-[10px] uppercase">{Utils.metodoLabel(v.metodoPago)}</td><td className="text-center"><span className={`badge ${v.estado === 'pendiente' ? 'badge-warn' : 'badge-ok'} font-black text-[9px] uppercase`}>{v.estado}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === 'credits' ? (
        <div className="card flex-1 bg-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300 rounded-xl">
          <div className="card-head px-6 py-4 bg-ink border-b border-white/10 flex justify-between items-center"><h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2 text-xs"><ClipboardList className="w-5 h-5 text-brand-gold" /> CONSULTA CRÉDITOS Y COBRANZA</h3><button onClick={() => setView('pos')} className="btn btn-sm bg-white text-ink hover:bg-surface-soft flex items-center gap-2 font-black uppercase text-[10px] rounded-lg border-none px-4"><ArrowLeft className="w-3.5 h-3.5"/> Volver al POS</button></div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table>
              <thead><tr><th>Emisión</th><th>Vencimiento</th><th>Cliente</th><th className="text-right">Monto USD</th><th className="text-right">Saldo USD</th><th className="text-right">Saldo Bs</th><th className="text-center">Acciones</th></tr></thead>
              <tbody>
                {state.cxc.filter(c => c.estado !== 'pagada').map(c => (
                  <tr key={c.id} className="border-b border-line/40 hover:bg-surface-warm/20">
                    <td className="text-ink font-bold text-xs">{Utils.fmtFecha(c.fecha)}</td>
                    <td className={`text-xs font-bold ${c.fechaVencimiento < Utils.hoy() && c.estado !== 'pagada' ? 'text-status-danger' : 'text-ink'}`}>{c.fechaVencimiento === '2099-12-31' ? 'ABIERTA' : Utils.fmtFecha(c.fechaVencimiento)}</td>
                    <td className="text-ink font-black text-xs uppercase">{c.cliente}</td>
                    <td className="text-ink font-bold text-xs text-right">{Utils.fmtUSD(c.montoUSD)}</td>
                    <td className="text-status-info font-black text-xs text-right">{Utils.fmtUSD(c.saldoUSD)}</td>
                    <td className="text-ink font-bold text-xs text-right">{Utils.fmtBS(c.saldoUSD * state.tasa)}</td>
                    <td className="text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setShowDetailsModal(c)} className="btn-icon h-8 w-8 text-ink hover:text-brand-gold" title="Ver Historial Detallado"><Eye className="w-4 h-4"/></button>
                        <button onClick={() => { setShowAbonoModal(c.cliente); setAbonoPagos([]); }} className="btn btn-sm btn-primary font-black text-[9px] uppercase px-4">Abonar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-2 duration-300 flex-1 overflow-y-auto">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-line shadow-sm shrink-0">
            <div><h2 className="text-ink font-black uppercase italic tracking-tighter text-lg flex items-center gap-2"><RotateCcw className="text-status-danger w-5 h-5" /> GESTIÓN DE DEVOLUCIONES</h2></div>
            <div className="flex gap-2"><button onClick={() => setReturnView('list')} className={`btn ${returnView === 'list' ? 'btn-primary' : 'btn-secondary'} h-9 px-6 font-black uppercase text-[10px]`}>Historial</button><button onClick={() => { setReturnView('create'); setSelectedSaleForReturn(null); }} className={`btn ${returnView === 'create' ? 'btn-primary' : 'btn-secondary'} h-9 px-6 font-black uppercase text-[10px]`}>Nueva Devolución</button></div>
          </div>
          {returnView === 'list' ? (
            <div className="card bg-white border-line shadow-lg overflow-hidden flex flex-col rounded-xl flex-1">
              <div className="card-head bg-ink border-b border-white/10 px-6 py-4"><h3 className="text-white font-black text-xs uppercase italic tracking-tighter">DEVOLUCIONES DE HOY</h3></div>
              <div className="table-wrap flex-1 overflow-y-auto">
                <table>
                  <thead><tr><th>ID</th><th>Hora</th><th>Venta</th><th>Items</th><th className="text-right">Total</th><th>Reembolso</th></tr></thead>
                  <tbody>
                    {(state.devoluciones || []).filter(d => d.fecha.startsWith(Utils.hoy())).map(d => (
                      <tr key={d.id} className="border-b border-line/40"><td className="text-status-danger font-black text-xs mono">{d.id}</td><td className="text-ink font-bold text-xs">{d.fecha.split('T')[1].slice(0, 8)}</td><td className="text-ink font-black text-xs mono opacity-60">{d.ventaId}</td><td className="text-ink font-bold text-[10px] uppercase">{d.items.length} productos</td><td className="text-brand-gold-deep font-black text-xs text-right">{Utils.fmtUSD(d.totalUSD)}</td><td><span className="badge badge-neutral font-black text-[9px] uppercase">{d.metodoReembolso}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {!selectedSaleForReturn ? (
                <div className="card p-12 flex-1 flex flex-col items-center justify-center text-center space-y-6 bg-white border-dashed border-2 border-line"><div className="p-5 bg-surface-soft rounded-full"><Search className="w-10 h-10 text-ink/20" /></div><h3 className="text-ink font-black uppercase text-sm">Localizar Venta Original</h3><div className="flex gap-2 w-full sm:max-w-sm"><input className="form-input flex-1 h-11 bg-white border-line text-ink font-black uppercase" placeholder="Ej: 000000024" value={returnSaleSearch} onChange={e => setReturnSaleSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarVentaParaDevolucion()} /><button onClick={buscarVentaParaDevolucion} className="btn btn-primary h-11 px-6 font-black uppercase text-xs">Buscar</button></div></div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-y-auto pr-1">
                  <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="card bg-white border-status-info/30 rounded-xl overflow-hidden shadow-sm"><div className="card-head py-3 px-6 bg-ink border-b border-white/10 flex justify-between"><h3 className="text-white font-black uppercase italic text-[10px]">VENTA: {selectedSaleForReturn.id}</h3><button onClick={() => setSelectedSaleForReturn(null)}><X className="w-4 h-4 text-white"/></button></div><div className="table-wrap"><table><thead><tr className="bg-surface-soft"><th>Producto</th><th className="text-center">Cant</th><th className="text-right">Precio</th><th className="text-center">Acción</th></tr></thead><tbody>{selectedSaleForReturn.items.map((it, idx) => (<tr key={idx} className="border-b border-line/30"><td className="text-ink font-bold text-[11px] uppercase">{it.nombre}</td><td className="text-center text-ink font-black">{it.cantidad}</td><td className="text-right text-ink font-black">{Utils.fmtUSD(it.precioUnitUSD)}</td><td className="text-center"><button onClick={() => handleAddReturnItem(it.productoId, it.nombre, it.precioUnitUSD, it.cantidad)} className="btn btn-sm btn-secondary h-7 px-3 text-[9px] font-black uppercase">Seleccionar</button></td></tr>))}</tbody></table></div></div>
                    <div className="card bg-white border-line shadow-md rounded-xl overflow-hidden"><div className="card-head py-3 px-6 bg-ink border-b border-white/10"><h3 className="text-white font-black uppercase italic text-[10px]">REINTEGRO</h3></div><div className="table-wrap"><table><thead><tr className="bg-surface-soft"><th>Producto</th><th className="text-center">Cant</th><th>Estado</th><th className="text-right">Total</th><th></th></tr></thead><tbody>{returnItems.map((it, idx) => (<tr key={idx} className="border-b border-line/30"><td className="text-ink font-bold text-[11px] uppercase">{it.nombre}</td><td className="text-status-danger font-black text-center">{it.cantidad}</td><td><span className="badge badge-neutral text-[8px] font-black">{it.estadoProducto}</span></td><td className="text-brand-gold-deep font-black text-right">{Utils.fmtUSD(it.cantidad * it.precioUnitUSD)}</td><td className="text-center"><button onClick={() => setReturnItems(returnItems.filter((_,i)=>i!==idx))}><Trash2 className="w-4 h-4 text-ink/20"/></button></td></tr>))}</tbody></table></div></div>
                  </div>
                  <div className="space-y-4">
                    <div className="card bg-white border-line shadow-lg rounded-xl overflow-hidden p-5 space-y-5"><div className="bg-surface-soft p-4 rounded-lg text-center border border-line shadow-inner"><p className="text-ink/60 text-[9px] font-black uppercase mb-1">TOTAL REEMBOLSO</p><p className="text-3xl font-black text-status-danger">{Utils.fmtUSD(returnItems.reduce((s, i) => s + (i.cantidad * i.precioUnitUSD), 0))}</p></div><div className="form-group"><label className="text-[10px] font-black uppercase block mb-1">Método</label><select className="form-select h-10 text-xs font-black uppercase" value={refundMethod} onChange={e=>setRefundMethod(e.target.value as any)}><option value="EFECTIVO">Efectivo</option><option value="MISMO_METODO">Reverso</option><option value="CREDITO_TIENDA">Nota Crédito</option></select></div><div className="form-group"><label className="text-[10px] font-black uppercase block mb-1">Motivo</label><textarea className="form-input text-xs min-h-[80px]" value={returnReason} onChange={e=>setReturnReason(e.target.value)}></textarea></div><button disabled={returnItems.length === 0 || !returnReason.trim()} onClick={procesarDevolucionPOS} className="btn btn-primary w-full h-14 font-black uppercase text-xs shadow-xl"><CheckCircle2 className="w-5 h-5 mr-2" /> Finalizar</button></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* DIALOG DE AUDITORIA Y/Z CON SCROLL Y BOTÓN ROCCIA */}
      <Dialog open={!!showReport} onOpenChange={() => setShowReport(null)}>
        <DialogContent className="sm:max-w-xs p-0 bg-transparent border-none overflow-visible shadow-none no-print">
          <DialogHeader className="sr-only"><DialogTitle>Informe Auditoría {showReport}</DialogTitle></DialogHeader>
          
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <div className="bg-white text-black p-6 font-mono text-[11px] leading-tight rounded-sm shadow-2xl relative">
              <button className="absolute -top-4 -right-4 bg-brand-gold text-black rounded-full p-1.5 shadow-lg no-print hover:bg-brand-gold-deep hover:text-white transition-colors" onClick={() => setShowReport(null)}><X className="w-4 h-4" /></button>
              <div className="text-center space-y-1"><p className="font-black text-sm uppercase">{state.empresa.nombre}</p><p className="text-[10px]">RIF: {state.empresa.rif}</p><p className="text-[10px]">{state.empresa.direccion}</p><div className="border-t border-dashed border-black/30 my-2"></div><p className="font-black text-[11px] uppercase tracking-tighter">REPORTE DE VENTAS ({showReport})</p><p className="text-[10px] uppercase font-bold">{Utils.fmtFecha(Utils.hoy())}</p></div>
              <div className="space-y-1 text-[10px] border-b border-dashed border-black/30 pb-3 mt-4">
                {showReport === 'Z' && <div className="flex justify-between font-black"><span>REPORTE Z NÚMERO:</span><span>{String(state.ultimoZ).padStart(4, '0')}</span></div>}
                <div className="flex justify-between"><span>HORA EMISIÓN:</span><span>{Utils.ahora().split('T')[1].slice(0, 8)}</span></div>
                <div className="flex justify-between"><span>TERMINAL:</span><span>{getCurrentTerminal()?.nombre || 'S/T'}</span></div>
                <div className="flex justify-between"><span>TASA BCV:</span><span>{state.tasa.toFixed(2)}</span></div>
                {showReport === 'Z' && zReportData && (<><div className="flex justify-between"><span>DESDE FACTURA:</span><span>{zReportData.desdeFactura}</span></div><div className="flex justify-between"><span>HASTA FACTURA:</span><span>{zReportData.hastaFactura}</span></div></>)}
              </div>
              <div className="space-y-2 mt-4">
                <p className="font-black text-center mb-2 uppercase tracking-tighter border-b border-dashed border-black/10 pb-1">Ventas por Método de Pago</p>
                {Object.entries(breakdown).map(([m, val]: any) => {
                  const isUSD = m === 'efectivo_usd' || m === 'zelle' || m === 'credito';
                  return (<div key={m} className="flex justify-between items-end gap-2 uppercase"><span className="truncate">{Utils.metodoLabel(m)}</span><span className="shrink-0 font-bold">{isUSD ? Utils.fmtUSD(val.usd) : Utils.fmtBS(val.bs)}</span></div>);
                })}
              </div>
              {showReport === 'Z' && zReportData && (<div className="border-t border-dashed border-black/30 pt-3 space-y-1 text-[10px] mt-4"><div className="flex justify-between"><span>VENTA EXENTA:</span><span>{Utils.fmtUSD(0)}</span></div><div className="flex justify-between"><span>BASE IMPONIBLE:</span><span>{Utils.fmtUSD(zReportData.baseImponibleUSD)}</span></div><div className="flex justify-between"><span>IVA (16%):</span><span>{Utils.fmtUSD(zReportData.ivaUSD)}</span></div></div>)}
              <div className="border-t border-dashed border-black/30 pt-3 space-y-1.5 mt-4">
                <div className="flex justify-between font-black text-[12px]"><span>TOTAL EN BOLÍVARES:</span><span>{Utils.fmtBS(rTotalBS)}</span></div>
                <div className="flex justify-between font-black text-[12px]"><span>TOTAL EN USD:</span><span>{Utils.fmtUSD(rTotalUSD)}</span></div>
                <div className="flex justify-between font-black text-[12px]"><span>TOTAL CRÉDITOS (USD):</span><span>{Utils.fmtUSD(totalCreditosUSD)}</span></div>
              </div>
              {showReport === 'Z' && (<div className="pt-3 border-t border-dashed border-black/30 mt-4"><div className="flex justify-between font-black text-[10px] uppercase"><span>ACUMULADO HISTÓRICO:</span><span>{Utils.fmtUSD(state.acumuladoHistorico)}</span></div></div>)}
              <div className="pt-6 space-y-1 opacity-60 text-center italic border-t border-dashed border-black/30 mt-4"><p>FIN DEL DOCUMENTO</p><p className="text-[8px] uppercase tracking-widest">PosVEN Pro Cloud Sync · v2.5.0</p></div>
            </div>
          </div>

          <div className="flex gap-2 mt-4 no-print">
            <button onClick={() => window.print()} className="flex-1 bg-white text-ink border border-line h-11 rounded-lg font-black uppercase text-[10px] shadow-sm flex items-center justify-center gap-2 hover:bg-surface-soft transition-all">
              <Printer className="w-4 h-4" /> Imprimir USB (Roccia 80mm)
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALLES DE CREDITO CON HISTORIAL DE ABONOS */}
      {showDetailsModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowDetailsModal(null)}></div>
          <div className="modal-box max-w-[600px] bg-white border-2 border-line rounded-xl overflow-hidden shadow-2xl">
            <div className="modal-head py-4 px-6 border-b border-line bg-ink flex justify-between items-center"><h3 className="text-white font-black text-xs uppercase italic tracking-tighter">HISTORIAL DETALLADO: {showDetailsModal.id}</h3><button onClick={() => setShowDetailsModal(null)} className="text-white/40 hover:text-white"><X className="w-5 h-5"/></button></div>
            <div className="modal-body p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-3 bg-surface-soft rounded-lg border border-line">
                    <label className="text-[8px] font-black uppercase text-ink/50 block mb-1">Monto Original</label>
                    <p className="text-lg font-black text-ink">{Utils.fmtUSD(showDetailsModal.montoUSD)}</p>
                 </div>
                 <div className="p-3 bg-brand-gold-soft border border-brand-gold/20 rounded-lg">
                    <label className="text-[8px] font-black uppercase text-brand-gold-deep block mb-1">Saldo Actual</label>
                    <p className="text-lg font-black text-brand-gold-deep">{Utils.fmtUSD(showDetailsModal.saldoUSD)}</p>
                 </div>
              </div>

              {/* DETALLE DE VENTA ORIGINAL */}
              {(() => {
                const sale = state.ventas.find(v => v.id === showDetailsModal.ventaId || v.id === showDetailsModal.id);
                if (!sale) return null;
                return (
                  <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center border-b border-line pb-2">
                       <h4 className="text-[10px] font-black uppercase text-ink/40 tracking-[0.2em]">DETALLE DE COMPRA ORIGINAL</h4>
                       <span className="text-[9px] font-black text-ink/60 uppercase">{Utils.fmtFecha(sale.fecha)} - {sale.fecha.split('T')[1]?.slice(0,5)}</span>
                    </div>
                    <div className="bg-surface-soft/50 rounded-lg overflow-hidden border border-line/30">
                       <table className="w-full">
                          <thead>
                            <tr className="bg-ink/5">
                               <th className="text-[8px] font-black uppercase p-2 text-left">Cant</th>
                               <th className="text-[8px] font-black uppercase p-2 text-left">Descripción</th>
                               <th className="text-[8px] font-black uppercase p-2 text-right">P. Unit</th>
                               <th className="text-[8px] font-black uppercase p-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sale.items.map((it: any, idx: number) => (
                              <tr key={idx} className="border-b border-line/20">
                                 <td className="text-[9px] font-bold p-2 text-ink">{it.cantidad}</td>
                                 <td className="text-[9px] font-black uppercase p-2 text-ink truncate max-w-[180px]">{it.nombre}</td>
                                 <td className="text-[9px] font-bold p-2 text-right text-ink">{Utils.fmtUSD(it.precioUnitUSD)}</td>
                                 <td className="text-[9px] font-black p-2 text-right text-brand-gold-deep">{Utils.fmtUSD(it.subtotalUSD)}</td>
                              </tr>
                            ))}
                          </tbody>
                       </table>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3">
                 <h4 className="text-[10px] font-black uppercase text-ink/40 tracking-[0.2em] border-b border-line pb-2">CRONOLOGÍA DE ABONOS</h4>
                 <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                    {(!showDetailsModal.historialPagos || showDetailsModal.historialPagos.length === 0) ? (
                      <div className="py-10 text-center text-ink/20 font-black uppercase italic text-[10px]">No se han registrado abonos aún</div>
                    ) : (
                      showDetailsModal.historialPagos.map((p: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-surface-soft border border-line rounded-lg">
                           <div className="space-y-0.5">
                              <p className="text-[10px] font-black text-ink uppercase">{Utils.fmtFecha(p.fecha)} - {p.fecha.split('T')[1]?.slice(0,5)}</p>
                              <p className="text-[8px] font-bold text-ink/40 mono">REF RECIBO: {p.reciboId}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-xs font-black text-status-success">+{Utils.fmtUSD(p.montoUSD)}</p>
                              <p className="text-[8px] font-black text-ink/40 uppercase">{Utils.metodoLabel(p.metodo || 'otros')}</p>
                           </div>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            </div>
            <div className="modal-foot p-4 bg-surface-soft border-t border-line text-right">
               <button onClick={() => setShowDetailsModal(null)} className="btn btn-primary px-8 font-black uppercase text-[10px] rounded-lg">Cerrar Ficha</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ABONO UNIFICADO (SEGÚN IMAGEN) */}
      {showAbonoModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowAbonoModal(null)}></div>
          <div className="modal-box max-w-[500px] bg-white border-none rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="modal-head py-5 px-8 border-b border-line flex justify-between items-center">
              <h3 className="text-ink text-xs font-black uppercase tracking-widest">ABONAR - {showAbonoModal}</h3>
              <button onClick={() => setShowAbonoModal(null)} className="text-ink hover:text-brand-gold transition-colors"><X className="w-6 h-6"/></button>
            </div>
            <div className="modal-body p-8 space-y-6">
              <div className="bg-surface-soft p-8 rounded-[20px] text-center border border-line shadow-inner">
                <p className="text-ink/40 text-[9px] font-black uppercase tracking-[0.2em] mb-2">DEUDA PENDIENTE</p>
                <p className="text-5xl font-black text-status-info tracking-tighter">
                  {Utils.fmtUSD(deudaRestanteAbonoUSD)}
                </p>
                <p className="text-xl font-bold text-ink/60 mt-2">
                  {Utils.fmtBS(deudaRestanteAbonoBS)}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-line pb-2">
                  <label className="text-ink text-[10px] font-black uppercase tracking-widest">MÉTODOS PAGO</label>
                  <button onClick={() => setShowAbonoMultiModal(true)} className="w-8 h-8 bg-brand-gold text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-2 min-h-[100px] max-h-[180px] overflow-y-auto pr-1">
                  {abonoPagos.length === 0 ? (
                    <div className="py-8 text-center text-ink/10 flex flex-col items-center gap-2">
                      <Wallet className="w-8 h-8 opacity-20" />
                      <p className="text-[10px] font-black uppercase">Sin métodos añadidos</p>
                    </div>
                  ) : (
                    abonoPagos.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-line text-[10px] font-bold shadow-sm animate-in slide-in-from-right-2">
                        <div className="flex items-center gap-3">
                           <button onClick={() => setAbonoPagos(abonoPagos.filter((_,i)=>i!==idx))} className="text-status-danger hover:scale-125 transition-transform"><Trash2 className="w-4 h-4" /></button>
                           <span className="uppercase text-ink font-black">{Utils.metodoLabel(p.metodo)}</span>
                        </div>
                        <span className="text-brand-gold-deep font-black text-sm">{Utils.fmtUSD(p.montoUSD)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button 
                className="btn btn-primary w-full h-16 font-black uppercase text-sm shadow-xl shadow-brand-gold/20 rounded-2xl" 
                onClick={procesarAbonoCascada} 
                disabled={abonoPagos.length === 0}
              >
                CONFIRMAR COBRO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA AÑADIR MÉTODO AL ABONO */}
      {showAbonoMultiModal && (
        <div className="modal show" style={{zIndex: 110}}><div className="modal-bg" onClick={() => setShowAbonoMultiModal(false)}></div>
          <div className="modal-box max-w-sm bg-white border-2 border-line">
            <div className="modal-head py-3 px-4 border-b border-line"><h3 className="text-ink text-xs font-black uppercase">Añadir Pago</h3></div>
            <div className="modal-body p-5 space-y-4">
               <div className="space-y-1"><label className="text-[10px] font-bold uppercase">MÉTODO</label><select className="form-select h-10 text-xs font-black uppercase" value={metodoActual} onChange={e => setMetodoActual(e.target.value as PaymentMethod)}><option value="efectivo_usd">Efectivo USD</option><option value="efectivo_bs">Efectivo BS</option><option value="punto_venta">Punto de Venta</option><option value="pagomovil">Pago Movil</option><option value="biopago">Biopago</option><option value="zelle">Zelle</option></select></div>
               <div className="space-y-1"><label className="text-[10px] font-bold uppercase">MONTO ({metodoActual.includes('usd') || metodoActual === 'zelle' ? 'USD' : 'BS'})</label><input type="number" className="form-input h-12 text-lg font-black" value={montoInput} onChange={e => setMontoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPago(true)} autoFocus /></div>
               <button className="btn btn-primary w-full h-12 font-black uppercase text-xs" onClick={() => addPago(true)}>Agregar al Cobro</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO PAGO POS (CARRITO) */}
      {showMultiModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => { setShowMultiModal(false); setIsCreditView(false); }}></div>
          <div className="modal-box max-w-[380px] bg-white border-2 border-line">
            <div className="modal-head py-3 px-4 border-b border-line"><h3 className="text-ink text-xs font-black uppercase">{isCreditView ? 'CARGAR CRÉDITO' : 'REGISTRAR PAGO'}</h3><button onClick={() => { setShowMultiModal(false); setIsCreditView(false); }}><X className="text-ink"/></button></div>
            <div className="modal-body p-4 space-y-4">
              {!isCreditView ? (
                <>
                  <div className="bg-surface-soft p-3 rounded-lg text-center border border-line"><p className="text-ink/60 text-[9px] font-bold mb-1">Pendiente</p><p className="text-2xl font-black text-status-info">{Utils.fmtUSD(saldoRestanteUSD)}</p><p className="text-xs text-ink/60 font-bold">{Utils.fmtBS(saldoRestanteBS)}</p></div>
                  <div className="space-y-1"><label className="text-[10px] font-bold uppercase">MÉTODO</label><select className="form-select h-10 bg-white text-ink text-xs font-black uppercase border-line shadow-sm" value={metodoActual} onChange={e => setMetodoActual(e.target.value as PaymentMethod)}><option value="efectivo_usd">Efectivo USD</option><option value="efectivo_bs">Efectivo BS</option><option value="punto_venta">Punto de Venta</option><option value="pagomovil">Pago Movil</option><option value="biopago">Biopago</option><option value="zelle">Zelle</option></select></div>
                  <div className="space-y-1"><div className="flex justify-between items-center mb-1"><label className="text-[10px] font-bold uppercase">MONTO ({metodoActual.includes('usd') || metodoActual === 'zelle' ? 'USD' : 'BS'})</label><button onClick={() => setMontoInput((metodoActual.includes('usd') || metodoActual === 'zelle' ? saldoRestanteUSD : saldoRestanteBS).toFixed(2))} className="text-[9px] bg-brand-gold-soft text-brand-gold-deep px-2 rounded font-black border border-brand-gold/30">EXACTO</button></div><input type="number" className="form-input h-12 text-lg font-black bg-white border-line shadow-inner" value={montoInput} onChange={e => setMontoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPago(false)} autoFocus /></div>
                  <button className="btn btn-primary w-full h-12 font-black uppercase text-xs" onClick={() => addPago(false)}>CONFIRMAR ABONO</button>
                  <button className="btn h-10 border-2 border-status-info text-status-info hover:bg-status-info-soft font-black uppercase text-[10px] w-full" onClick={() => setIsCreditView(true)}>Cargar Crédito</button>
                </>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
                  {!showNewClientForm ? (
                    <div className="space-y-3">
                       <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-ink/40" /><input className="form-input pl-10 h-10 text-xs" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} /></div>
                       <div className="max-h-[160px] overflow-y-auto border border-line rounded-lg bg-white shadow-inner">
                         {filteredClients.map(c => (<div key={c.id} onClick={() => setSelectedClient(c)} className={`p-3 border-b border-line/40 cursor-pointer hover:bg-brand-gold/10 ${selectedClient?.id === c.id ? 'bg-brand-gold-soft border-l-4 border-l-brand-gold' : ''}`}><div className="text-xs font-black text-ink uppercase">{c.name}</div><div className="text-[10px] text-ink/40 mono">{c.cedula}</div></div>))}
                       </div>
                       <div className="flex flex-col gap-2">
                         <button className="btn bg-status-info-soft text-status-info border border-status-info/40 font-black uppercase text-[10px] h-10 flex items-center justify-center gap-2" onClick={() => setShowNewClientForm(true)}><UserPlus className="w-4 h-4" /> Registrar</button>
                         <button className="btn btn-primary w-full h-12 font-black uppercase text-xs shadow-md" disabled={!selectedClient} onClick={ejecutarVentaACredito}>Cargar Deuda</button>
                         <button className="text-[9px] text-ink/40 uppercase font-black text-center" onClick={() => setIsCreditView(false)}>Volver al Pago</button>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                       <div className="space-y-2">
                         <div className="space-y-1"><label className="text-[9px] font-black uppercase text-ink/60">Nombre</label><input className="form-input h-9 text-xs" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} /></div>
                         <div className="space-y-1"><label className="text-[9px] font-black uppercase text-ink/60">Cédula</label><input className="form-input h-9 text-xs" value={newClient.cedula} onChange={e => setNewClient({...newClient, cedula: e.target.value})} /></div>
                       </div>
                       <button className="btn btn-primary w-full h-12 font-black uppercase text-xs" onClick={ejecutarVentaACredito}>Cargar Deuda</button>
                       <button className="text-[9px] text-ink/40 uppercase font-black text-center w-full" onClick={() => setShowNewClientForm(false)}>Volver a buscar</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && lastProcessedSale && (
        <ReceiptModal 
          isOpen={showReceiptModal} 
          onClose={() => setShowReceiptModal(false)} 
          sale={{
            ...lastProcessedSale, 
            date: lastProcessedSale.fecha || lastProcessedSale.date, 
            customerName: lastProcessedSale.cliente || lastProcessedSale.customerName, 
            paymentMethod: Utils.metodoLabel(lastProcessedSale.metodoPago || lastProcessedSale.paymentMethod), 
            items: (lastProcessedSale.items || []).map((it: any) => ({
              ...it, 
              name: it.nombre,
              qty: it.cantidad || it.qty, 
              price: it.precioUnitUSD || it.price
            })), 
            type: lastProcessedSale.type || (lastProcessedSale.metodoPago !== 'credito' ? 'CONTADO' : 'CRÉDITO')
          }} 
        />
      )}
    </div>
  );
}
