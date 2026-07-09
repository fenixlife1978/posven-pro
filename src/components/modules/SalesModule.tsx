"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AppState, SaleItem, Sale, PaymentMethod, ReportZ, Movimiento, PagoRealizado, Customer, Return } from '@/lib/types';
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
  RotateCcw
} from 'lucide-react';
import ReturnsModule from './ReturnsModule';

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
  
  const [showDetailsModal, setShowDetailsModal] = useState<any | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<any | null>(null);
  
  const [lastProcessedSale, setLastProcessedSale] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const [isCreditView, setIsCreditView] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const reportPrintRef = useRef<HTMLDivElement | null>(null);

  const subtotalUSD = state.carrito.reduce((s, i) => s + i.subtotalUSD, 0);
  const totalBS = subtotalUSD * state.tasa;
  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  const saldoRestanteUSD = Math.max(0, subtotalUSD - totalPagadoUSD);
  const saldoRestanteBS = saldoRestanteUSD * state.tasa;
  const cambioUSD = Math.max(0, totalPagadoUSD - subtotalUSD);

  const matches = search.trim().length > 0 
    ? state.productos
        .filter(p => p.activo && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase())))
        .slice(0, 8)
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
  };

  const addPago = () => {
    let monto = parseFloat(montoInput);
    if (isNaN(monto) || monto <= 0) return;
    let montoUSD = metodoActual === 'efectivo_usd' || metodoActual === 'zelle' ? monto : monto / state.tasa;
    let montoBS = metodoActual === 'efectivo_usd' || metodoActual === 'zelle' ? monto * state.tasa : monto;
    setPagos([...pagos, { metodo: metodoActual, montoUSD, montoBS }]);
    setMontoInput('');
  };

  const removePago = (idx: number) => {
    setPagos(pagos.filter((_, i) => i !== idx));
  };

  const ejecutarVenta = () => {
    if (state.carrito.length === 0 || saldoRestanteUSD > 0.01) return;
    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahoraStr = Utils.ahora();
    const nuevaVenta: Sale = {
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
      change: cambioUSD,
      payments: [...pagos]
    };
    updateState({
      productos: state.productos.map(p => {
        const item = state.carrito.find(i => i.productoId === p.id);
        return item ? { ...p, stock: p.stock - item.cantidad } : p;
      }),
      ventas: [...state.ventas, nuevaVenta],
      movimientos: [...state.movimientos, ...state.carrito.map(item => ({
        id: Store.uid(), productoId: item.productoId, tipo: 'venta', cantidad: -item.cantidad,
        stockAntes: state.productos.find(p => p.id === item.productoId)?.stock || 0,
        stockDespues: (state.productos.find(p => p.id === item.productoId)?.stock || 0) - item.cantidad,
        fecha: ahoraStr, referencia: `VENTA ${reciboId}`
      } as Movimiento))],
      carrito: [],
      proximoRecibo: state.proximoRecibo + 1,
      acumuladoHistorico: state.acumuladoHistorico + subtotalUSD
    });
    setLastProcessedSale(nuevaVenta);
    setShowReceiptModal(true);
    setPagos([]);
    setCliente('Consumidor final');
  };

  const ejecutarVentaCredito = () => {
    if (!selectedClient || state.carrito.length === 0) return alert('Seleccione un cliente para el crédito');
    const reciboId = String(state.proximoRecibo).padStart(9, '0');
    const ahoraStr = Utils.ahora();
    
    const nuevaVenta: Sale = {
      id: reciboId,
      fecha: ahoraStr,
      cliente: selectedClient.name,
      items: [...state.carrito],
      subtotalUSD,
      descuentoUSD: 0,
      totalUSD: subtotalUSD,
      totalBS,
      metodoPago: 'credito',
      estado: 'pendiente',
      type: 'VENTA'
    };

    const nuevaCxC = {
      id: 'DEU-' + reciboId,
      ventaId: reciboId,
      fecha: hoy,
      fechaVencimiento: '2099-12-31',
      cliente: selectedClient.name,
      montoUSD: subtotalUSD,
      abonadoUSD: 0,
      saldoUSD: subtotalUSD,
      estado: 'pendiente',
      historialPagos: []
    };

    updateState({
      productos: state.productos.map(p => {
        const item = state.carrito.find(i => i.productoId === p.id);
        return item ? { ...p, stock: p.stock - item.cantidad } : p;
      }),
      ventas: [...state.ventas, nuevaVenta],
      cxc: [...state.cxc, nuevaCxC],
      clientes: state.clientes.map(c => c.id === selectedClient.id ? { ...c, debt: (c.debt || 0) + subtotalUSD } : c),
      movimientos: [...state.movimientos, ...state.carrito.map(item => ({
        id: Store.uid(), productoId: item.productoId, tipo: 'venta', cantidad: -item.cantidad,
        stockAntes: state.productos.find(p => p.id === item.productoId)?.stock || 0,
        stockDespues: (state.productos.find(p => p.id === item.productoId)?.stock || 0) - item.cantidad,
        fecha: ahoraStr, referencia: `CRÉDITO ${reciboId}`
      } as Movimiento))],
      carrito: [],
      proximoRecibo: state.proximoRecibo + 1
    });
    
    alert('Venta a crédito registrada.');
    setIsCreditView(false);
    setSelectedClient(null);
  };

  const abonarCuenta = (cxcId: string) => {
    const cuenta = state.cxc.find(x => x.id === cxcId);
    if (!cuenta) return;
    const montoUSD = abonoPagos.reduce((s, p) => s + p.montoUSD, 0);
    const montoBS = abonoPagos.reduce((s, p) => s + p.montoBS, 0);
    if (montoUSD <= 0) return alert('Ingrese montos de pago');
    if (montoUSD > cuenta.saldoUSD + 0.01) return alert('El abono supera el saldo');

    const reciboId = 'REC-' + Store.uid().toUpperCase().slice(0, 6);
    const ahoraStr = Utils.ahora();

    const nuevasCxC = state.cxc.map(x => {
      if (x.id === cxcId) {
        const nuevoSaldo = Math.max(0, x.saldoUSD - montoUSD);
        return {
          ...x,
          abonadoUSD: x.abonadoUSD + montoUSD,
          saldoUSD: nuevoSaldo,
          estado: nuevoSaldo === 0 ? 'pagada' : 'parcial',
          historialPagos: [...(x.historialPagos || []), {
            reciboId,
            fecha: ahoraStr,
            montoUSD,
            montoBS,
            metodos: abonoPagos.map(p => p.metodo)
          }]
        };
      }
      return x;
    });

    const nuevasVentas = [...state.ventas, {
      id: reciboId,
      fecha: ahoraStr,
      cliente: cuenta.cliente,
      items: [],
      subtotalUSD: 0,
      descuentoUSD: 0,
      totalUSD: montoUSD,
      totalBS: montoBS,
      metodoPago: abonoPagos.length > 1 ? 'mixto' : abonoPagos[0].metodo,
      estado: 'completada',
      type: 'COBRO DEUDA',
      cuentaCobrarId: cuenta.id
    } as Sale];

    updateState({ 
      cxc: nuevasCxC, 
      ventas: nuevasVentas,
      clientes: state.clientes.map(c => c.name === cuenta.cliente ? { ...c, debt: Math.max(0, (c.debt || 0) - montoUSD) } : c)
    });
    
    setShowAbonoModal(null);
    setAbonoPagos([]);
    alert('Abono registrado con éxito');
  };

  const getReportSummary = (tipo: 'Y' | 'Z') => {
    const hoy = Utils.hoy();
    const ventas = state.ventas.filter(v => v.fecha.startsWith(hoy));
    const devoluciones = state.devoluciones.filter(d => d.fecha.startsWith(hoy));
    
    const metodos = ['efectivo_usd', 'efectivo_bs', 'punto_venta', 'biopago', 'pagomovil', 'zelle', 'credito', 'mixto'];
    const summary: Record<string, { usd: number, bs: number, devUsd: number, devBs: number }> = {};
    metodos.forEach(m => summary[m] = { usd: 0, bs: 0, devUsd: 0, devBs: 0 });

    ventas.forEach(v => {
      if (v.metodoPago === 'mixto' && v.payments) {
        v.payments.forEach(p => {
          if (summary[p.metodo]) {
            summary[p.metodo].usd += p.montoUSD;
            summary[p.metodo].bs += p.montoBS;
          }
        });
      } else if (summary[v.metodoPago]) {
        summary[v.metodoPago].usd += v.totalUSD;
        summary[v.metodoPago].bs += v.totalBS;
      }
    });

    devoluciones.forEach(d => {
      const m = d.metodoReembolso.toLowerCase();
      const key = m === 'efectivo' ? 'efectivo_usd' : (m === 'credito_tienda' ? 'credito' : 'efectivo_usd');
      if (summary[key]) {
        summary[key].devUsd += d.totalUSD;
        summary[key].devBs += d.totalUSD * state.tasa;
      }
    });

    const totalBrutoUSD = Object.values(summary).reduce((s, m) => s + m.usd, 0);
    const totalDevUSD = Object.values(summary).reduce((s, m) => s + m.devUsd, 0);
    const totalNetoUSD = totalBrutoUSD - totalDevUSD;

    return { summary, totalBrutoUSD, totalDevUSD, totalNetoUSD, count: ventas.length, devCount: devoluciones.length };
  };

  const imprimirTicketNativo = (div: HTMLDivElement | null) => {
    if (!div) return;
    const printWindow = window.open('', '_blank', 'width=300,height=600') as any;
    if (!printWindow) return;
    printWindow.document.write('<html><head><title>Ticket</title><style>body{margin:0;padding:10px;font-family:monospace;font-size:12px;line-height:1.2;color:black;}table{width:100%;border-collapse:collapse;}th,td{text-align:left;padding:2px 0;}.text-right{text-align:right;}.text-center{text-align:center;}.border-t{border-top:1px dashed black;}.font-bold{font-weight:bold;}</style></head><body>');
    printWindow.document.write(div.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const hoy = Utils.hoy();

  if (view === 'returns') return <ReturnsModule state={state} updateState={updateState} />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 space-y-6">
        <div className="flex gap-2 no-print">
          <button onClick={() => setView('pos')} className={`btn ${view === 'pos' ? 'btn-primary' : 'btn-secondary text-white'} h-10 px-6 font-black uppercase text-xs flex items-center gap-2`}>
            <ShoppingCart className="w-4 h-4" /> Nueva Venta
          </button>
          <button onClick={() => setView('history')} className={`btn ${view === 'history' ? 'btn-primary' : 'btn-secondary text-white'} h-10 px-6 font-black uppercase text-xs flex items-center gap-2`}>
            <History className="w-4 h-4" /> Historial
          </button>
          <button onClick={() => setView('credits')} className={`btn ${view === 'credits' ? 'btn-primary' : 'btn-secondary text-white'} h-10 px-6 font-black uppercase text-xs flex items-center gap-2`}>
            <HandCoins className="w-4 h-4" /> Créditos (CxC)
          </button>
          <button onClick={() => setView('returns')} className={`btn ${view === 'returns' ? 'btn-primary' : 'btn-secondary text-white'} h-10 px-6 font-black uppercase text-xs flex items-center gap-2`}>
            <RotateCcw className="w-4 h-4" /> Devoluciones
          </button>
        </div>

        {view === 'pos' && (
          <>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"><Barcode className="w-6 h-6" /></div>
              <input 
                ref={searchInputRef}
                className="w-full h-16 bg-[#131313] border-2 border-[#2a2a2a] rounded-xl pl-14 pr-6 text-xl font-black text-white focus:border-[#c8952e] outline-none transition-all placeholder:text-white/10"
                placeholder="ESCANEE O BUSQUE PRODUCTO..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if(e.key === 'Enter' && matches[0]) agregar(matches[0].id); }}
                autoFocus
              />
              {matches.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-[#1e1e1e] border-2 border-[#c8952e]/40 rounded-xl mt-2 overflow-hidden shadow-2xl">
                  {matches.map(p => (
                    <div key={p.id} onClick={() => agregar(p.id)} className="p-4 hover:bg-[#c8952e]/10 border-b border-white/5 flex justify-between items-center cursor-pointer transition-colors group">
                      <div className="flex flex-col">
                        <span className="text-white font-black uppercase text-sm group-hover:text-[#c8952e]">{p.nombre}</span>
                        <span className="text-[10px] text-white/40 mono">{p.codigo} • STOCK: {p.stock}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[#c8952e] font-black text-lg">{Utils.fmtUSD(p.precioUSD)}</div>
                        <div className="text-[10px] text-white/40 font-bold">{Utils.fmtBS(p.precioUSD * state.tasa)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-head bg-[#181818] border-b border-[#2a2a2a] px-6 py-4">
                <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#c8952e]" /> Carrito de Compras
                </h3>
                <span className="text-[10px] font-black uppercase text-white/40">{state.carrito.length} Ítems</span>
              </div>
              <div className="table-wrap min-h-[300px]">
                <table>
                  <thead>
                    <tr className="bg-[#0b0b0b]">
                      <th className="text-white font-black text-[10px] uppercase">Producto</th>
                      <th className="text-white font-black text-[10px] uppercase text-center">Cant.</th>
                      <th className="text-white font-black text-[10px] uppercase text-right">Precio USD</th>
                      <th className="text-white font-black text-[10px] uppercase text-right">Subtotal USD</th>
                      <th className="text-white font-black text-[10px] uppercase text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.carrito.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-20 text-white/20 font-black uppercase italic tracking-tighter">Esperando productos...</td></tr>
                    ) : (
                      state.carrito.map((item, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td>
                            <div className="flex flex-col">
                              <span className="text-white font-black text-xs uppercase">{item.nombre}</span>
                              <span className="text-[9px] text-white/40 font-bold">{Utils.fmtBS(item.precioUnitUSD * state.tasa)} x UND</span>
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button onClick={() => updateQty(idx, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-white/5 text-white hover:bg-[#e04848] transition-colors">-</button>
                              <span className="text-white font-black text-xs w-4">{item.cantidad}</span>
                              <button onClick={() => updateQty(idx, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-white/5 text-white hover:bg-[#27ae60] transition-colors">+</button>
                            </div>
                          </td>
                          <td className="text-white font-bold text-xs text-right">{Utils.fmtUSD(item.precioUnitUSD)}</td>
                          <td className="text-[#c8952e] font-black text-xs text-right">{Utils.fmtUSD(item.subtotalUSD)}</td>
                          <td className="text-center">
                            <button onClick={() => updateQty(idx, -999)} className="text-white/20 hover:text-[#e04848] transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {view === 'history' && (
          <div className="card animate-in fade-in slide-in-from-bottom-2">
            <div className="card-head py-4 px-6">
              <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#3a9bdc]" /> Registro de Ventas
              </h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr className="bg-[#0b0b0b]">
                    <th className="text-[10px] uppercase font-black">Recibo</th>
                    <th className="text-[10px] uppercase font-black">Fecha / Hora</th>
                    <th className="text-[10px] uppercase font-black">Cliente</th>
                    <th className="text-[10px] uppercase font-black text-right">Total USD</th>
                    <th className="text-[10px] uppercase font-black">Método</th>
                    <th className="text-[10px] uppercase font-black text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-[#131313]">
                  {[...state.ventas].reverse().map(v => (
                    <tr key={v.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="text-white font-black text-xs mono">{v.id}</td>
                      <td className="text-white font-bold text-[10px]">{v.fecha.replace('T', ' ').slice(0, 16)}</td>
                      <td className="text-white font-black text-xs uppercase">{v.cliente}</td>
                      <td className="text-[#c8952e] font-black text-xs text-right">{Utils.fmtUSD(v.totalUSD)}</td>
                      <td><span className="badge badge-neutral font-black text-[9px] uppercase">{v.type === 'COBRO DEUDA' ? 'ABONO' : Utils.metodoLabel(v.metodoPago)}</span></td>
                      <td className="text-center">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => setShowDetailsModal(v)} className="btn-icon h-7 w-7 text-white hover:text-[#c8952e]"><Eye className="w-3.5 h-3.5"/></button>
                          <button onClick={() => { setLastProcessedSale(v); setShowReceiptModal(true); }} className="btn-icon h-7 w-7 text-white hover:text-[#3a9bdc]"><Printer className="w-3.5 h-3.5"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'credits' && (
          <div className="card animate-in fade-in slide-in-from-bottom-2">
            <div className="card-head py-4 px-6 border-b border-white/5">
              <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-[#e04848]" /> Cuentas por Cobrar Pendientes
              </h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr className="bg-[#0b0b0b]">
                    <th className="text-[10px] uppercase font-black">Ref.</th>
                    <th className="text-[10px] uppercase font-black">Cliente</th>
                    <th className="text-[10px] uppercase font-black text-right">Monto USD</th>
                    <th className="text-[10px] uppercase font-black text-right">Saldo USD</th>
                    <th className="text-[10px] uppercase font-black text-center">Estado</th>
                    <th className="text-[10px] uppercase font-black text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-[#131313]">
                  {state.cxc.filter(x => x.estado !== 'pagada').map(x => (
                    <tr key={x.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="text-white font-black text-xs mono">{x.id}</td>
                      <td className="text-white font-black text-xs uppercase">{x.cliente}</td>
                      <td className="text-white font-bold text-xs text-right">{Utils.fmtUSD(x.montoUSD)}</td>
                      <td className="text-[#e04848] font-black text-xs text-right">{Utils.fmtUSD(x.saldoUSD)}</td>
                      <td className="text-center"><span className="badge badge-err text-[9px] uppercase font-black">{x.estado}</span></td>
                      <td className="text-center">
                        <button onClick={() => setShowAbonoModal(x.id)} className="btn btn-primary h-7 px-3 text-[9px] font-black uppercase">Registrar Abono</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-4 space-y-6">
        <div className="card border-[#c8952e]/30 shadow-2xl shadow-[#c8952e]/5">
          <div className="card-body space-y-6 p-6">
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Total USD</span>
                <span className="text-5xl font-black text-white leading-none">{Utils.fmtUSD(subtotalUSD)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-white/5">
                <span className="text-[10px] font-black text-[#c8952e] uppercase tracking-widest">Total Bolívares</span>
                <span className="text-xl font-black text-[#c8952e]">{Utils.fmtBS(totalBS)}</span>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="form-group mb-0">
                <label className="text-white text-[10px] font-black uppercase block mb-1">Cliente</label>
                <div className="flex gap-2">
                  <input className="form-input h-10 bg-black text-white border-white/10 text-xs font-black uppercase" value={cliente} onChange={e => setCliente(e.target.value)} />
                  <button onClick={() => setIsCreditView(!isCreditView)} className={`btn ${isCreditView ? 'btn-primary' : 'btn-secondary text-white'} h-10 px-3`} title="Venta a Crédito"><HandCoins className="w-4 h-4" /></button>
                </div>
              </div>

              {isCreditView && (
                <div className="p-4 bg-[#e04848]/5 border border-[#e04848]/20 rounded-lg space-y-3 animate-in fade-in">
                  <div className="flex justify-between items-center"><span className="text-[9px] font-black text-[#e04848] uppercase">Modo Crédito Activo</span><X className="w-3 h-3 text-[#e04848] cursor-pointer" onClick={() => setIsCreditView(false)} /></div>
                  <div className="relative">
                    <input className="form-input bg-black border-[#e04848]/30 h-9 text-xs" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                    {clientSearch.length > 1 && (
                      <div className="absolute top-full left-0 right-0 bg-[#1e1e1e] border border-[#e04848]/40 rounded mt-1 z-[100] max-h-40 overflow-y-auto shadow-2xl">
                        {state.clientes.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                          <div key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(''); setCliente(c.name); }} className="p-2 hover:bg-[#e04848]/10 cursor-pointer text-xs border-b border-white/5 flex justify-between">
                            <span className="text-white font-black uppercase">{c.name}</span>
                            <span className="text-[#e04848] font-bold">${c.debt?.toFixed(2)}</span>
                          </div>
                        ))}
                        <div onClick={() => { 
                          const n = prompt('Nombre del nuevo cliente:');
                          if(n){
                            const nc = { id: Store.uid(), name: n, cedula: '', debt: 0 };
                            updateState({ clientes: [...state.clientes, nc] });
                            setSelectedClient(nc);
                            setCliente(nc.name);
                            setClientSearch('');
                          }
                        }} className="p-2 text-[#27ae60] text-[10px] font-black uppercase cursor-pointer">+ CREAR CLIENTE</div>
                      </div>
                    )}
                  </div>
                  {selectedClient && <div className="text-[10px] font-bold text-white/60">CLIENTE SELECCIONADO: <span className="text-white">{selectedClient.name.toUpperCase()}</span></div>}
                  <button onClick={ejecutarVentaCredito} disabled={!selectedClient || state.carrito.length === 0} className="btn btn-danger w-full h-11 font-black uppercase text-[10px] shadow-lg shadow-[#e04848]/10">Registrar Crédito</button>
                </div>
              )}

              {!isCreditView && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-wrap gap-2">
                    {['efectivo_usd', 'efectivo_bs', 'punto_venta', 'pagomovil', 'zelle', 'biopago'].map(m => (
                      <button 
                        key={m} 
                        onClick={() => { setMetodoActual(m as any); searchInputRef.current?.focus(); }}
                        className={`btn ${metodoActual === m ? 'btn-primary' : 'btn-secondary text-white'} h-8 px-3 text-[9px] font-black uppercase`}
                      >
                        {Utils.metodoLabel(m)}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group mb-0">
                      <label className="text-[9px] font-black text-white/40 uppercase mb-1 block">Monto USD</label>
                      <input 
                        type="number" 
                        className="form-input h-12 bg-black text-[#c8952e] border-[#c8952e]/40 text-xl font-black" 
                        value={metodoActual === 'efectivo_usd' || metodoActual === 'zelle' ? montoInput : ''} 
                        onChange={e => { setMetodoActual(metodoActual === 'zelle' ? 'zelle' : 'efectivo_usd'); setMontoInput(e.target.value); }}
                        onKeyDown={e => e.key === 'Enter' && addPago()}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="form-group mb-0">
                      <label className="text-[9px] font-black text-white/40 uppercase mb-1 block">Monto BS</label>
                      <input 
                        type="number" 
                        className="form-input h-12 bg-black text-white border-white/10 text-xl font-black" 
                        value={metodoActual !== 'efectivo_usd' && metodoActual !== 'zelle' ? montoInput : ''} 
                        onChange={e => { if (metodoActual === 'efectivo_usd' || metodoActual === 'zelle') setMetodoActual('efectivo_bs'); setMontoInput(e.target.value); }}
                        onKeyDown={e => e.key === 'Enter' && addPago()}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {pagos.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto bg-black/40 p-3 rounded border border-white/5">
                      {pagos.map((p, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] group">
                          <span className="text-white/40 font-black uppercase">{Utils.metodoLabel(p.metodo)}: <strong className="text-white ml-1">{Utils.fmtUSD(p.montoUSD)}</strong></span>
                          <button onClick={() => removePago(i)} className="text-[#e04848] opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-black/60 p-4 rounded-lg space-y-2 border border-white/5">
                    <div className="flex justify-between items-center text-xs font-black uppercase">
                      <span className="text-white/40">Pagado:</span>
                      <span className="text-[#27ae60]">{Utils.fmtUSD(totalPagadoUSD)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-black uppercase">
                      <span className="text-white/40">Restante:</span>
                      <span className={saldoRestanteUSD > 0.01 ? 'text-[#e04848]' : 'text-white'}>{Utils.fmtUSD(saldoRestanteUSD)}</span>
                    </div>
                    {cambioUSD > 0.01 && (
                      <div className="flex justify-between items-center text-xs font-black uppercase pt-2 border-t border-white/5">
                        <span className="text-[#c8952e]">CAMBIO USD:</span>
                        <span className="text-[#c8952e] text-lg">{Utils.fmtUSD(cambioUSD)}</span>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={ejecutarVenta}
                    disabled={state.carrito.length === 0 || saldoRestanteUSD > 0.01}
                    className="btn btn-primary w-full h-14 font-black uppercase text-xs shadow-xl shadow-[#c8952e]/20 disabled:opacity-20 flex items-center justify-center gap-3"
                  >
                    Procesar Venta <CheckCircle2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 no-print">
          <button onClick={() => setShowReport('Y')} className="btn btn-secondary text-white h-12 font-black uppercase text-[10px] flex items-center justify-center gap-2">
            <Receipt className="w-4 h-4" /> Corte X (Parcial)
          </button>
          <button onClick={() => setShowReport('Z')} className="btn btn-secondary text-white h-12 font-black uppercase text-[10px] flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" /> Corte Z (Cierre)
          </button>
        </div>
      </div>

      {/* MODALES REUTILIZADOS */}
      {showReceiptModal && lastProcessedSale && (
        <div className="modal show">
          <div className="modal-bg" onClick={() => setShowReceiptModal(false)}></div>
          <div className="modal-box max-w-sm bg-[#1e1e1e] border-2 border-[#c8952e]/30 overflow-hidden">
            <div className="modal-head py-3 px-5 border-b border-white/10">
              <h3 className="text-white font-black uppercase text-xs">Venta Exitosa</h3>
              <button onClick={() => setShowReceiptModal(false)} className="text-white/40 hover:text-white"><X className="w-4 h-4"/></button>
            </div>
            <div className="modal-body p-6 flex flex-col items-center gap-6">
              <div ref={printRef} className="bg-white p-8 shadow-sm text-black font-mono text-[10px] w-[72mm]">
                <div className="text-center mb-4 pb-4 border-b border-dashed border-black">
                  <h1 className="font-bold text-lg">{state.empresa.nombre.toUpperCase()}</h1>
                  <p className="text-[8px]">{state.empresa.direccion}</p>
                  <p className="text-[8px]">RIF: {state.empresa.rif}</p>
                </div>
                <div className="flex justify-between mb-4"><span>RECIBO N°: {lastProcessedSale.id}</span></div>
                <table className="w-full mb-4">
                  <thead><tr className="border-y border-dashed border-black"><th>Cant</th><th className="text-left">Item</th><th className="text-right">Total</th></tr></thead>
                  <tbody>
                    {lastProcessedSale.items.map((it: any, idx: number) => (
                      <tr key={idx}><td>{it.cantidad}x</td><td>{it.nombre.toUpperCase().slice(0,15)}</td><td className="text-right">{Utils.fmtUSD(it.subtotalUSD)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-black pt-2 space-y-1">
                  <div className="flex justify-between font-bold text-sm"><span>TOTAL BS:</span><span>{Utils.fmtBS(lastProcessedSale.totalBS)}</span></div>
                  <div className="flex justify-between"><span>REF USD:</span><span>{Utils.fmtUSD(lastProcessedSale.totalUSD)}</span></div>
                  {lastProcessedSale.received && <div className="flex justify-between pt-2"><span>RECIBIDO:</span><span>{Utils.fmtUSD(lastProcessedSale.received)}</span></div>}
                  {lastProcessedSale.change && <div className="flex justify-between"><span>CAMBIO:</span><span>{Utils.fmtUSD(lastProcessedSale.change)}</span></div>}
                </div>
                <p className="text-center mt-6 pt-4 border-t border-dashed border-black uppercase text-[8px]">¡GRACIAS POR SU COMPRA!</p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <button onClick={() => imprimirTicketNativo(printRef.current)} className="btn btn-primary h-12 w-full font-black uppercase text-xs flex items-center justify-center gap-2"><Printer className="w-4 h-4"/> Imprimir Ticket</button>
                <button className="btn btn-secondary text-white h-12 w-full font-black uppercase text-xs flex items-center justify-center gap-2"><Share2 className="w-4 h-4"/> Compartir PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <div className="modal show">
          <div className="modal-bg" onClick={() => setShowReport(null)}></div>
          <div className="modal-box max-w-md bg-[#1e1e1e] border-2 border-[#3a9bdc]/30">
            <div className="modal-head py-3 px-5 border-b border-white/10">
              <h3 className="text-white font-black uppercase text-xs">REPORTE {showReport} - {Utils.fmtFecha(hoy)}</h3>
              <button onClick={() => setShowReport(null)} className="text-white/40 hover:text-white"><X className="w-4 h-4"/></button>
            </div>
            <div className="modal-body p-6 space-y-6">
              <div ref={reportPrintRef} className="bg-white p-8 text-black font-mono text-[10px] w-full max-w-[72mm] mx-auto shadow-2xl">
                 <div className="text-center border-b border-dashed border-black pb-4 mb-4">
                    <h2 className="font-bold text-sm">REPORTE {showReport}</h2>
                    <p>{state.empresa.nombre}</p>
                    <p>RIF: {state.empresa.rif}</p>
                    <p>FECHA: {new Date().toLocaleString()}</p>
                 </div>
                 <div className="space-y-1 mb-4">
                   <p className="font-bold">RESUMEN POR MÉTODOS (NETO):</p>
                   {Object.entries(getReportSummary(showReport).summary).map(([m, montos]: any) => (
                     <div key={m} className="flex flex-col border-b border-black/10 py-1">
                        <div className="flex justify-between">
                          <span>{Utils.metodoLabel(m)}:</span>
                          <span className="font-bold">{Utils.fmtUSD(montos.usd - montos.devUsd)}</span>
                        </div>
                        {montos.devUsd > 0 && (
                          <div className="flex justify-between text-[8px] opacity-60">
                            <span>Ventas: {Utils.fmtUSD(montos.usd)}</span>
                            <span>Devs: -{Utils.fmtUSD(montos.devUsd)}</span>
                          </div>
                        )}
                     </div>
                   ))}
                 </div>
                 <div className="border-t-2 border-black pt-2 space-y-1">
                    <div className="flex justify-between font-bold"><span>VENTAS BRUTAS:</span><span>{Utils.fmtUSD(getReportSummary(showReport).totalBrutoUSD)}</span></div>
                    <div className="flex justify-between font-bold text-[#e04848]"><span>DEVOLUCIONES:</span><span>-{Utils.fmtUSD(getReportSummary(showReport).totalDevUSD)}</span></div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-dashed border-black"><span>TOTAL NETO:</span><span>{Utils.fmtUSD(getReportSummary(showReport).totalNetoUSD)}</span></div>
                 </div>
                 <div className="mt-4 pt-4 border-t border-dashed border-black">
                    <p>TRANSACCIONES: {getReportSummary(showReport).count}</p>
                    <p>DEVOLUCIONES: {getReportSummary(showReport).devCount}</p>
                 </div>
              </div>
              <button onClick={() => imprimirTicketNativo(reportPrintRef.current)} className="btn btn-primary w-full h-12 font-black uppercase text-xs flex items-center justify-center gap-2"><Printer className="w-4 h-4"/> Imprimir Reporte</button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowDetailsModal(null)}></div>
          <div className="modal-box bg-[#1e1e1e] border-2 border-white/20 max-w-lg">
            <div className="modal-head py-3 px-4 border-b border-white/10"><h3 className="text-white text-xs font-black uppercase">Detalle Transacción - {showDetailsModal.id}</h3><button onClick={() => setShowDetailsModal(null)} className="text-white"><X className="w-4 h-4"/></button></div>
            <div className="modal-body p-4">
              <div className="bg-black/40 p-3 rounded space-y-1 mb-4">
                <div className="flex justify-between text-[10px] text-white/60"><span>CLIENTE:</span><span className="text-white font-black uppercase">{showDetailsModal.cliente}</span></div>
                <div className="flex justify-between text-[10px] text-white/60"><span>FECHA:</span><span className="text-white font-black">{showDetailsModal.fecha}</span></div>
                <div className="flex justify-between text-sm font-black text-[#c8952e] pt-1"><span>TOTAL USD:</span><span>{Utils.fmtUSD(showDetailsModal.totalUSD)}</span></div>
              </div>
              <div className="table-wrap max-h-48 overflow-y-auto">
                <table>
                  <thead><tr className="border-b border-white/10"><th className="text-white/40">Ítem</th><th className="text-white/40 text-center">Cant</th><th className="text-white/40 text-right">Monto</th></tr></thead>
                  <tbody>
                    {showDetailsModal.items.map((it: any, idx: number) => (
                      <tr key={idx} className="border-b border-white/5">
                        <td className="text-white font-bold text-[10px] uppercase py-2">{it.nombre}</td>
                        <td className="text-white text-center text-xs font-black">{it.cantidad}</td>
                        <td className="text-[#c8952e] text-right font-black text-xs">{Utils.fmtUSD(it.subtotalUSD)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAbonoModal && (
        <div className="modal show"><div className="modal-bg" onClick={() => setShowAbonoModal(null)}></div>
          <div className="modal-box bg-[#1e1e1e] border-2 border-[#27ae60]/40 max-w-sm">
            <div className="modal-head py-3 px-5 border-b border-white/10"><h3 className="text-white font-black uppercase text-xs">Registrar Abono</h3><button onClick={() => setShowAbonoModal(null)} className="text-white/40"><X className="w-4 h-4"/></button></div>
            <div className="modal-body p-6 space-y-4">
               <div className="p-3 bg-black rounded border border-[#27ae60]/20"><div className="text-[10px] text-white/40 uppercase mb-1">Saldo Pendiente</div><div className="text-2xl font-black text-white">{Utils.fmtUSD(state.cxc.find(x => x.id === showAbonoModal)?.saldoUSD || 0)}</div></div>
               <div className="flex gap-1 flex-wrap">
                 {['efectivo_usd', 'efectivo_bs', 'punto_venta', 'pagomovil', 'zelle', 'biopago'].map(m => (
                   <button key={m} onClick={() => setMetodoActual(m as any)} className={`btn ${metodoActual === m ? 'btn-primary' : 'btn-secondary text-white'} h-7 px-2 text-[8px] font-black uppercase`}>{Utils.metodoLabel(m)}</button>
                 ))}
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div><label className="text-[9px] text-white/40 font-black block mb-1">Monto USD</label><input type="number" className="form-input bg-black border-white/10" value={metodoActual === 'efectivo_usd' || metodoActual === 'zelle' ? montoInput : ''} onChange={e => { setMetodoActual('efectivo_usd'); setMontoInput(e.target.value); }} onKeyDown={e => e.key === 'Enter' && addPago()} /></div>
                 <div><label className="text-[9px] text-white/40 font-black block mb-1">Monto BS</label><input type="number" className="form-input bg-black border-white/10" value={metodoActual !== 'efectivo_usd' && metodoActual !== 'zelle' ? montoInput : ''} onChange={e => { setMetodoActual('efectivo_bs'); setMontoInput(e.target.value); }} onKeyDown={e => e.key === 'Enter' && addPago()} /></div>
               </div>
               {abonoPagos.length > 0 && <div className="p-2 bg-black rounded border border-white/5 space-y-1">{abonoPagos.map((p, i) => (<div key={i} className="flex justify-between text-[9px] font-black"><span>{Utils.metodoLabel(p.metodo)}</span><span>{Utils.fmtUSD(p.montoUSD)}</span></div>))}</div>}
               <button onClick={() => abonarCuenta(showAbonoModal)} className="btn btn-primary w-full h-11 font-black uppercase text-xs shadow-lg shadow-[#27ae60]/10">Confirmar Abono</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}