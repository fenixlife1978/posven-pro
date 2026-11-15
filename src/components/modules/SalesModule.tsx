"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  RotateCcw,
  HandCoins,
  Calculator,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Contact,
  Maximize2,
  Minimize2,
  Tag,
  Loader2,
  Hash,
  Settings2
} from 'lucide-react';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import CashZArqueoModal from '@/components/pos/CashZArqueoModal';
import { CreditModal } from '@/components/pos/CreditSaleModal';
import FloatingPaymentModal from '@/components/pos/FloatingPaymentModal';
import { toast } from '@/hooks/use-toast';
import { AppState, SaleItem, Sale, PaymentMethod, ReportZ, PagoRealizado, Customer, Return, ReturnItem, Product, Debt, Movimiento, LibroDiarioEntry } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import ReturnsModule from '@/components/modules/ReturnsModule';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

// ============================================================
// UTILIDADES DE NORMALIZACIÓN DE CÉDULA (integradas)
// ============================================================

/**
 * Normaliza una cédula según el tipo de documento
 * - Para V- y E-: formato con puntos (XX.XXX.XXX)
 * - Para J-, G-, P-: solo dígitos sin formato
 */
function normalizeCedula(cedula: string, docType?: string): string {
  if (!cedula) return '';
  
  let type = docType || '';
  let number = cedula;
  
  const match = cedula.match(/^([A-Z]-?)?(.*)/);
  if (match) {
    if (match[1] && !docType) {
      type = match[1].replace('-', '').trim() + '-';
    }
    number = match[2] || '';
  }
  
  const cleanNumber = number.replace(/[^0-9]/g, '');
  
  if (!type) type = 'V-';
  
  if (type === 'V-' || type === 'E-') {
    const digits = cleanNumber;
    if (digits.length <= 2) return `${type}${digits}`;
    if (digits.length <= 5) return `${type}${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${type}${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    return `${type}${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}`;
  }
  
  return `${type}${cleanNumber}`;
}

/**
 * Obtiene solo el número de cédula sin puntos ni tipo
 */
function getRawCedula(cedula: string): string {
  if (!cedula) return '';
  return cedula.replace(/[^0-9]/g, '');
}

/**
 * Busca un cliente por cédula normalizada, ignorando formato
 */
function findCustomerByCedula(customers: any[], cedula: string): any | null {
  const raw = getRawCedula(cedula);
  if (!raw || raw.length === 0) return null;
  return customers.find(c => {
    const cRaw = getRawCedula(c?.cedula || '');
    return cRaw.length > 0 && cRaw === raw;
  }) || null;
}

/**
 * Busca deudas por cédula del cliente (en el campo cliente)
 */
function findDebtsByCedula(deudas: any[], cedula: string): any[] {
  const raw = getRawCedula(cedula);
  if (!raw || raw.length === 0) return [];
  return deudas.filter(d => {
    if (!d.cliente) return false;
    const match = d.cliente.match(/^(.*?)\s*\[(.*?)\]$/);
    if (match && match[2]) {
      const dRaw = getRawCedula(match[2]);
      return dRaw.length > 0 && dRaw === raw;
    }
    return false;
  });
}

/**
 * Extrae el tipo de documento (V-, J-, etc.) de una cédula
 */
function extractDocType(cedula: string): string {
  const match = cedula.match(/^([A-Z]-?)/);
  return match ? match[1].replace('-', '').trim() + '-' : 'V-';
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function SalesModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'pos' | 'history' | 'credits' | 'returns'>('pos');
  const [histPage, setHistPage] = useState(1);
  const [showReportType, setShowReportType] = useState<'REPORT_X' | 'REPORT_Z' | null>(null);
  const [reportSnapshot, setReportSnapshot] = useState<any>(null);
  const [reportLoadingType, setReportLoadingType] = useState<'REPORT_X' | 'REPORT_Z' | null>(null);
  const [isClosingZ, setIsClosingZ] = useState(false);
  const [showZArqueo, setShowZArqueo] = useState(false);
  const [arqueoMode, setArqueoMode] = useState<'X' | 'Z'>('X');
  const [globalCreditCustomer, setGlobalCreditCustomer] = useState<{ name: string; cedula?: string; totalUSD: number; totalBS: number } | null>(null);
  const [cliente, setCliente] = useState('Consumidor final');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [pagos, setPagos] = useState<PagoRealizado[]>([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  
  const [showAbonoModal, setShowAbonoModal] = useState<Debt | null>(null);
  
  const [showDetails, setShowDetails] = useState<any | null>(null);
  const [showSaleDetail, setShowSaleDetail] = useState<any | null>(null);
  const [lastProcessedSale, setLastProcessedSale] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedProductDisplay, setSelectedProductDisplay] = useState<Product | null>(null);
  const [stockEdit, setStockEdit] = useState<Product | null>(null);
  const [stockEditValue, setStockEditValue] = useState('');
  const [showPosAdjustment, setShowPosAdjustment] = useState(false);
  const [adjustmentSearch, setAdjustmentSearch] = useState('');
  const [adjustmentProductId, setAdjustmentProductId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'consumo' | 'colaboracion' | 'ajuste_entrada' | 'ajuste_salida'>('consumo');
  const [adjustmentQty, setAdjustmentQty] = useState('1');
  const [adjustmentDetail, setAdjustmentDetail] = useState('');
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  
  const [priceSelectorItem, setPriceSelectorItem] = useState<{ index: number, product: Product } | null>(null);

  // ===== ESTADOS PARA CREDIT MODAL =====
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', tipoDoc: 'V', cedula: '', phone: '', address: '' });

  const [editandoTasa, setEditandoTasa] = useState(false);
  const [nuevaTasa, setNuevaTasa] = useState(state.tasa.toString());

  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [showClientHistory, setShowClientHistory] = useState<string | null>(null);

  useEffect(() => {
    setHistPage(1);
  }, [view]);

  const currentTerminal = useMemo(() => {
    const appUser: any = (state as any).user || null;
    const explicitTerminalId = String(appUser?.terminalId || '').trim();
    if (explicitTerminalId) {
      return state.terminales.find(t => String(t.id) === explicitTerminalId) || null;
    }
    const ids = [appUser?.id, appUser?.uid].filter(Boolean).map(String);
    return ids.length
      ? state.terminales.find(t => ids.includes(String(t.usuarioId || ''))) || null
      : null;
  }, [state.terminales, (state as any).user]);

  const histVentas = useMemo(() => {
    const tc = Utils.getTerminalCash(currentTerminal);
    return (state.ventas || [])
      .filter(v => v.terminalId === currentTerminal?.id && v.fecha > (tc.fechaUltimoZ || ''))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [state.ventas, currentTerminal?.id]);

  const histPageSize = 10;
  const histTotalPages = Math.max(1, Math.ceil(histVentas.length / histPageSize));
  const histSafePage = Math.min(histPage, histTotalPages);
  const histPageVentas = histVentas.slice((histSafePage - 1) * histPageSize, histSafePage * histPageSize);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // ===== CORREGIDO: Formato de cédula según tipo =====
  const formatCedulaByType = (val: string, type: string) => {
    if (type !== 'V' && type !== 'E') {
      return val.replace(/\D/g, '');
    }
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return digits.slice(0, 2) + '.' + digits.slice(2);
    if (digits.length <= 8) return digits.slice(0, 2) + '.' + digits.slice(2, 5) + '.' + digits.slice(5);
    return digits.slice(0, 2) + '.' + digits.slice(2, 5) + '.' + digits.slice(5, 8);
  };

  const handleNewClientCedulaChange = (val: string) => {
    const formatted = formatCedulaByType(val, newClient.tipoDoc);
    setNewClient({ ...newClient, cedula: formatted });
  };

  const handleNewClientTipoDocChange = (tipo: string) => {
    const cleanNumber = newClient.cedula.replace(/\./g, '');
    const formatted = formatCedulaByType(cleanNumber, tipo);
    setNewClient({ ...newClient, tipoDoc: tipo, cedula: formatted });
  };

  const getFreshReportData = () => {
    const freshState = Store.get();
    const termId = String(currentTerminal?.id || "GLOBAL");
    const terminal = (freshState.terminales || []).find((t:any) => String(t.id) === termId) || currentTerminal;
    const tc = Utils.getTerminalCash(terminal);
    const since = tc.fechaUltimoZ || "";
    const inWindow = (date: string) => String(date || "") > since;
    const allSales = freshState.ventas || [];
    const allReturns = freshState.devoluciones || [];
    const allCancellations = freshState.anulaciones || [];
    const allJournal = freshState.libroDiario || [];
    const isDebtCollection = (v:any) => ["COBRO DEUDA","ABONO DEUDA","COBRO_DEUDA"].includes(String(v?.type || "").trim().toUpperCase());

    const activeSales = allSales.filter((v:any) => inWindow(v.fecha) && v.estado !== "anulada" && String(v.terminalId || "") === termId && !isDebtCollection(v));
    const canceledSales = allSales.filter((v:any) => inWindow(v.fecha) && v.estado === "anulada" && String(v.terminalId || "") === termId && !isDebtCollection(v));
    const returns = allReturns.filter((d:any) => inWindow(d.fecha) && String(allSales.find((v:any) => v.id === d.ventaId)?.terminalId || "") === termId);
    const cancellations = allCancellations.filter((a:any) => inWindow(a.fecha) && String(allSales.find((v:any) => v.id === a.ventaId)?.terminalId || "") === termId);

    const grossUSD = activeSales.reduce((sum:number,v:any) => sum + (Number(v.totalUSD) || 0), 0);
    const returnUSD = returns.reduce((sum:number,d:any) => sum + (Number(d.totalUSD) || 0), 0);
    const cancellationUSD = cancellations.reduce((sum:number,a:any) => sum + (Number(a.totalUSD) || 0), 0);
    const canceledWithoutDocument = canceledSales.filter((v:any) => !cancellations.some((a:any) => String(a.ventaId) === String(v.id)));
    const canceledFallbackUSD = canceledWithoutDocument.reduce((sum:number,v:any) => sum + (Number(v.totalUSD) || 0), 0);
    const refundsUSD = returnUSD + cancellationUSD + canceledFallbackUSD;
    const discountsUSD = activeSales.reduce((sum:number,v:any) => sum + (Number(v.descuentoUSD) || 0), 0);
    const netUSD = grossUSD - refundsUSD - discountsUSD;
    const baseImponibleUSD = activeSales.reduce((sum:number,v:any) => sum + (Number(v.baseImponibleUSD) || 0), 0);
    const ivaUSD = activeSales.reduce((sum:number,v:any) => sum + (Number(v.ivaUSD) || 0), 0);
    const exentoUSD = activeSales.reduce((sum:number,v:any) => sum + (Number(v.exentoUSD) || 0), 0);
    const igtfUSD = activeSales.reduce((sum:number,v:any) => sum + (Number(v.igtfUSD) || 0), 0);
    const rate = Number(freshState.tasa) || 1;

    const normalizeMethod = (method:any) => {
      const key = String(method || "otros").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
      if (["punto_venta","punto_de_venta","punto_pago","punto_de_pago","tarjeta_debito","tarjeta_credito"].includes(key)) return "tarjeta";
      if (["pago_movil", "pago_movil_bs"].includes(key)) return "pagomovil";
      if (["efectivo", "efectivo_bs", "efectivo_bolivares", "bs", "bolivares"].includes(key)) return "efectivo_bs";
      if (["efectivo_usd", "efectivo_usd_dolares", "usd", "dolar", "dolares", "efectivo_dolares"].includes(key)) return "efectivo_usd";
      if (["transferencia", "transferencia_bs", "transferencia_bolivares"].includes(key)) return "transferencia_bs";
      if (["transferencia_usd", "transferencia_dolares"].includes(key)) return "transferencia_usd";
      if (["punto_venta", "punto_de_venta", "punto_pago", "punto_de_pago", "tarjeta_debito", "tarjeta_credito"].includes(key)) return "tarjeta";
      if (key === "mixto") return "mixto";
      return key;
    };
    const isUsdMethod = (method:string) => ["efectivo_usd","zelle","transferencia_usd"].includes(normalizeMethod(method));
    const arqueoMap:Record<string,any> = {};
    const ensureRow = (method:string) => {
      if (!arqueoMap[method]) arqueoMap[method] = { metodo:method, ventasBS:0, ventasUSD:0, cobrosBS:0, cobrosUSD:0, devBS:0, devUSD:0, movPlusBS:0, movPlusUSD:0, movMinusBS:0, movMinusUSD:0 };
      return arqueoMap[method];
    };
    const paymentParts = (record:any) => Array.isArray(record?.payments) && record.payments.length
      ? record.payments
      : [{ metodo:record?.metodoPago || "otros", montoUSD:record?.totalUSD || 0, montoBS:record?.totalBS || 0 }];
    const readPayment = (payment:any) => {
      const method = normalizeMethod(payment?.metodo || payment?.method || "otros");
      const usd = Number(payment?.montoUSD ?? payment?.usdAmount ?? 0) || 0;
      const bs = Number(payment?.montoBS ?? payment?.amountBS ?? payment?.totalBS ?? 0) || (isUsdMethod(method) ? 0 : Number(payment?.amount) || usd * rate);
      return { method, usd, bs };
    };
    const addPayment = (payment:any, bucket:"ventas"|"cobros"|"dev", factor=1) => {
      const p = readPayment(payment);
      // Un registro mixto sin detalle de pagos no permite saber cuánto entró
      // en cada moneda/método. Se muestra como incidencia y nunca se inventa
      // una distribución en Bs. o USD.
      if (p.method === "credito" || p.method === "mixto") return;
      const row = ensureRow(p.method);
      if (isUsdMethod(p.method)) row[bucket + "USD"] += p.usd * factor;
      else row[bucket + "BS"] += p.bs * factor;
    };

    activeSales.forEach((sale:any) => paymentParts(sale).forEach((p:any) => addPayment(p,"ventas")));
    const debtSales = allSales.filter((v:any) => inWindow(v.fecha) && String(v.terminalId || "") === termId && isDebtCollection(v));
    debtSales.forEach((sale:any) => paymentParts(sale).forEach((p:any) => addPayment(p,"cobros")));

    const relevantJournal = allJournal.filter((entry:any) => inWindow(entry.fecha) && String(entry.terminalId || "") === termId);
    const debtJournal = relevantJournal.filter((entry:any) => String(entry.categoria || "").toUpperCase() === "COBRO_DEUDA");
    const debtSaleIds = new Set(debtSales.map((sale:any) => String(sale.id)));
    const uniqueDebtJournal = debtJournal.filter((entry:any) => !debtSaleIds.has(String(entry.referencia || entry.id)));
    uniqueDebtJournal.forEach((entry:any) => {
      addPayment({ metodo:entry.metodo, montoUSD:entry.montoUSD, montoBS:entry.montoBS }, "cobros");
    });

    const applyRefund = (document:any, kind:"devolucion"|"anulacion") => {
      const sale = allSales.find((v:any) => String(v.id) === String(document.ventaId));
      const explicit = Array.isArray(document.refundPayments) && document.refundPayments.length ? document.refundPayments : null;
      const pays = explicit || paymentParts(sale || {});
      const saleTotal = Math.max(Number(sale?.totalUSD) || 0.000001, 0.000001);
      const factor = explicit || !sale ? 1 : (Number(document.totalUSD) || 0) / saleTotal;
      pays.forEach((p:any) => addPayment(p,"dev",factor));
    };
    returns.forEach((d:any) => applyRefund(d,"devolucion"));
    cancellations.forEach((a:any) => applyRefund(a,"anulacion"));
    canceledWithoutDocument.forEach((sale:any) => paymentParts(sale).forEach((p:any) => addPayment(p,"dev")));

    const cashMovements = relevantJournal.filter((entry:any) => {
      const category = String(entry.categoria || "").trim().toUpperCase().replace(/Á/g,"A");
      return !["VENTA", "COBRO_DEUDA", "DEVOLUCION", "ANULACION"].includes(category)
        && ["ingreso","egreso"].includes(String(entry.tipo));
    });
    cashMovements.forEach((entry:any) => {
      const method = normalizeMethod(entry.metodo || "otros");
      const row = ensureRow(method);
      if (isUsdMethod(method)) {
        if (entry.tipo === "ingreso") row.movPlusUSD += Number(entry.montoUSD) || 0;
        else row.movMinusUSD += Number(entry.montoUSD) || 0;
      } else {
        if (entry.tipo === "ingreso") row.movPlusBS += Number(entry.montoBS) || 0;
        else row.movMinusBS += Number(entry.montoBS) || 0;
      }
    });

    ["efectivo_bs","efectivo_usd","zelle","pagomovil","biopago","transferencia_bs","transferencia_usd","tarjeta","credito"].forEach(ensureRow);
    const metodosArqueo = Object.values(arqueoMap).map((row:any) => ({ ...row, moneda:isUsdMethod(row.metodo) ? "USD" : "BS" }));
    const arqueoWarnings = allSales
      .filter((sale:any) => inWindow(sale.fecha) && String(sale.terminalId || "") === termId
        && String(sale.estado || "").toLowerCase() !== "anulada"
        && normalizeMethod(sale.metodoPago) === "mixto"
        && !(Array.isArray(sale.payments) && sale.payments.length))
      .map((sale:any) => String(sale.id));
    const methods:Record<string,number> = {};
    activeSales.forEach((sale:any) => paymentParts(sale).forEach((p:any) => {
      const parsed = readPayment(p);
      methods[parsed.method] = (methods[parsed.method] || 0) + parsed.usd;
    }));
    const sortedSales = [...activeSales].sort((a:any,b:any) => String(a.fecha).localeCompare(String(b.fecha)));
    const sortedReturns = [...returns].sort((a:any,b:any) => String(a.fecha).localeCompare(String(b.fecha)));
    const manualMovements = relevantJournal.filter((entry:any) => !["VENTA","COBRO_DEUDA"].includes(String(entry.categoria || "").toUpperCase()));
    const manualSalidas = manualMovements.filter((e:any) => e.tipo === "egreso").reduce((s:number,e:any) => s + (Number(e.montoUSD)||0),0);
    const manualEntradas = manualMovements.filter((e:any) => e.tipo === "ingreso").reduce((s:number,e:any) => s + (Number(e.montoUSD)||0),0);
    const manualSalidasBS = cashMovements.filter((e:any) => e.tipo === "egreso" && normalizeMethod(e.metodo) === "efectivo_bs").reduce((s:number,e:any)=>s+(Number(e.montoBS)||0),0);
    const manualSalidasUSD = cashMovements.filter((e:any) => e.tipo === "egreso" && normalizeMethod(e.metodo) === "efectivo_usd").reduce((s:number,e:any)=>s+(Number(e.montoUSD)||0),0);
    const manualEntradasBS = cashMovements.filter((e:any) => e.tipo === "ingreso" && normalizeMethod(e.metodo) === "efectivo_bs").reduce((s:number,e:any)=>s+(Number(e.montoBS)||0),0);
    const manualEntradasUSD = cashMovements.filter((e:any) => e.tipo === "ingreso" && normalizeMethod(e.metodo) === "efectivo_usd").reduce((s:number,e:any)=>s+(Number(e.montoUSD)||0),0);
    const cobrosDeudaUSD = debtSales.reduce((s:number,v:any)=>s+(Number(v.totalUSD)||0),0) + uniqueDebtJournal.reduce((s:number,e:any)=>s+(Number(e.montoUSD)||0),0);
    const cobrosDeudaBS = debtSales.reduce((s:number,v:any)=>s+(Number(v.totalBS)||0),0) + uniqueDebtJournal.reduce((s:number,e:any)=>s+(Number(e.montoBS)||0),0);
    const fondoAperturaBS = Number(tc.fondoCajaHoyBS) || 0;
    const fondoAperturaUSD = Number(tc.fondoCajaHoyUSD) || 0;
    const cashBs = ensureRow("efectivo_bs");
    const cashUsd = ensureRow("efectivo_usd");
    const totalNetoEfectivoBS = fondoAperturaBS + cashBs.ventasBS + cashBs.cobrosBS - cashBs.devBS + cashBs.movPlusBS - cashBs.movMinusBS;
    const totalNetoEfectivoUSD = fondoAperturaUSD + cashUsd.ventasUSD + cashUsd.cobrosUSD - cashUsd.devUSD + cashUsd.movPlusUSD - cashUsd.movMinusUSD;
    const terminalName = terminal?.nombre || "CAJA NO IDENTIFICADA";
    const totalUSD = grossUSD;
    return {
      brUSD:grossUSD, devUSD:refundsUSD, descUSD:discountsUSD, netUSD, igtfUSD, ivaUSD, baseImponibleUSD, exentoUSD,
      paymentMethods:methods, metodosArqueo, arqueoWarnings, manualSalidas, manualEntradas, manualSalidasBS, manualSalidasUSD,
      manualEntradasBS, manualEntradasUSD, cobrosDeudaUSD, cobrosDeudaBS, fondoAperturaUSD, fondoAperturaBS,
      desdeFactura:sortedSales[0]?.id || "N/A", hastaFactura:sortedSales[sortedSales.length-1]?.id || "N/A",
      desdeNC:sortedReturns[0]?.id || "N/A", hastaNC:sortedReturns[sortedReturns.length-1]?.id || "N/A",
      stats:{ facturas:activeSales.length, devoluciones:returns.length, anulaciones:cancellations.length + canceledWithoutDocument.length, ticketPromedio:activeSales.length ? netUSD/activeSales.length : 0 },
      fecha:Utils.ahora(), terminalName, terminalId:termId, numeroZ:Number(tc.ultimoZ || 0)+1,
      acumuladoHistoricoUSD:(Number(tc.acumuladoHistorico)||0)+netUSD, totalVentasUSD:totalUSD, tasaBCV:rate,
      estimadoEfectivoBS:{entradas:manualEntradasBS,egresos:manualSalidasBS,total:totalNetoEfectivoBS},
      estimadoEfectivoUSD:{entradas:manualEntradasUSD,egresos:manualSalidasUSD,total:totalNetoEfectivoUSD},
      totalNetoEfectivoBS,totalNetoEfectivoUSD,
    };
  };

  const handleOpenReport = async (type: 'REPORT_X' | 'REPORT_Z') => {
    if (showReportType || showZArqueo || reportLoadingType) return;
    setReportLoadingType(type);
    try {
      const openingState = Utils.getTerminalCash(currentTerminal);
      if (type === 'REPORT_Z' && (!currentTerminal?.id || !openingState.isCashOpen || !openingState.cashData?.openDate || openingState.cashData?.closeDate)) {
        throw new Error('No existe una apertura de caja vigente. Abra la caja antes de ejecutar un nuevo Corte Z.');
      }
      await Store.ensureReportData(currentTerminal?.id || 'GLOBAL', openingState.fechaUltimoZ || new Date().toISOString().split('T')[0]);
      const data = getFreshReportData();
      setReportSnapshot(data);
      setArqueoMode(type === 'REPORT_Z' ? 'Z' : 'X');
      setShowZArqueo(true);
    } catch (error:any) {
      console.error('Error abriendo arqueo X/Z:', error);
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'No se pudieron cargar los datos del arqueo.' });
    } finally {
      setReportLoadingType(null);
    }
  };

  const ejecutarCierreZ = async (real: Record<string,string>, diff: {bs:number;usd:number}) => {
    const data = reportSnapshot;
    if (!data || isClosingZ) return;
    const liveState = Store.get();
    const terminal = (liveState.terminales || []).find((t:any) => String(t.id) === String(currentTerminal?.id));
    const tc = Utils.getTerminalCash(terminal || currentTerminal);
    if (!terminal?.id || !tc.isCashOpen || !tc.cashData?.openDate || tc.cashData?.closeDate) {
      toast({ variant: 'destructive', title: 'Corte Z rechazado', description: 'La caja no tiene una apertura vigente. No se generó ningún cierre.' });
      return;
    }
    const rows = Array.isArray(data.metodosArqueo) ? data.metodosArqueo : [];
    const missing = rows.some((row:any) => {
      const raw = String(real[row.metodo] ?? '').trim().replace(',', '.');
      return raw === '' || !Number.isFinite(Number(raw)) || Number(raw) < 0;
    });
    if (missing) {
      toast({ variant: 'destructive', title: 'Arqueo incompleto', description: 'Registre el monto real de cada método de pago, incluso cuando sea cero.' });
      return;
    }

    setIsClosingZ(true);
    try {
      const ahora = Utils.ahora();
      const numeroZ = Number(tc.ultimoZ || 0) + 1;
      const termId = terminal.id;
      const metodosArqueo = rows.map((row:any) => {
        const method = String(row.metodo);
        const currency = ['efectivo_usd','zelle','transferencia_usd'].includes(method) ? 'USD' : 'BS';
        const opening = method === 'efectivo_bs' ? Number(data.fondoAperturaBS || 0) : method === 'efectivo_usd' ? Number(data.fondoAperturaUSD || 0) : 0;
        const sales = currency === 'BS' ? Number(row.ventasBS || 0) : Number(row.ventasUSD || 0);
        const cxc = currency === 'BS' ? Number(row.cobrosBS || 0) : Number(row.cobrosUSD || 0);
        const returns = currency === 'BS' ? Number(row.devBS || 0) : Number(row.devUSD || 0);
        const plus = currency === 'BS' ? Number(row.movPlusBS || 0) : Number(row.movPlusUSD || 0);
        const minus = currency === 'BS' ? Number(row.movMinusBS || 0) : Number(row.movMinusUSD || 0);
        const system = Number((opening + sales + cxc - returns + plus - minus).toFixed(2));
        const amountReal = Number(String(real[method]).replace(',', '.'));
        return { ...row, montoSistema:system, montoReal:amountReal, diferencia:Number((amountReal-system).toFixed(2)), moneda:currency };
      });
      const realBs = Number(String(real.efectivo_bs || '0').replace(',', '.')) || 0;
      const realUSD = Number(String(real.efectivo_usd || '0').replace(',', '.')) || 0;
      const nuevoZ: ReportZ = {
        id: 'Z-' + String(numeroZ).padStart(6, '0'), fecha: ahora, numeroZ, terminalId: termId, terminalName: data.terminalName,
        desdeFactura: data.desdeFactura, hastaFactura: data.hastaFactura, desdeNotaCredito: data.desdeNC, hastaNotaCredito: data.hastaNC,
        cantidadAnuladas: data.stats.anulaciones, ventaBrutaUSD: data.brUSD, descuentoUSD: data.descUSD, devolucionesUSD: data.devUSD,
        ventaNetaUSD: data.netUSD, baseImponibleUSD: data.baseImponibleUSD, ivaUSD: data.ivaUSD, exentoUSD: data.exentoUSD,
        igtfUSD: data.igtfUSD, metodosPago: { ...data.paymentMethods }, metodosArqueo,
        salidasCajaUSD: data.manualSalidas, entradasCajaUSD: data.manualEntradas,
        fondoAperturaUSD: data.fondoAperturaUSD, fondoAperturaBS: data.fondoAperturaBS,
        acumuladoHistoricoUSD: data.acumuladoHistoricoUSD, stats: { ...data.stats },
        cobrosDeudaUSD: data.cobrosDeudaUSD, cobrosDeudaBS: data.cobrosDeudaBS,
        manualSalidasBS: data.manualSalidasBS, manualSalidasUSD: data.manualSalidasUSD,
        manualEntradasBS: data.manualEntradasBS, manualEntradasUSD: data.manualEntradasUSD,
        totalNetoEfectivoBS: realBs, totalNetoEfectivoUSD: realUSD,
        differenceBs: diff.bs, differenceUSD: diff.usd,
        tasaBCV: data.tasaBCV, empresa: liveState.empresa,
      } as ReportZ;
      const closedSession = {
        ...tc.cashData, closeDate: ahora, closeAmount: null,
        closeAmountBs: realBs, closeAmountUsd: realUSD,
        closeNotes: 'Cierre de caja realizado mediante Corte Z ' + nuevoZ.id,
      };
      const terminales = (liveState.terminales || []).map((t:any) => t.id === termId ? {
        ...t, ultimoZ: numeroZ, fechaUltimoZ: ahora, acumuladoHistorico: data.acumuladoHistoricoUSD,
        fondoCajaHoyBS: 0, fondoCajaHoyUSD: 0, isCashOpen: false, cashData: null,
        cashHistory: [closedSession, ...(t.cashHistory || [])],
      } : t);
      await Store.set({ reportesZ: [...(liveState.reportesZ || []), nuevoZ], terminales });
      if (typeof localStorage !== 'undefined') localStorage.removeItem('posven_apertura_done');
      setShowZArqueo(false);
      setShowReportType('REPORT_Z');
      setReportSnapshot({ ...data, ...nuevoZ, numeroZ, empresa: liveState.empresa, generatedAt: ahora, closedAt: ahora, openedAt: tc.cashData?.openDate, closedBy: data.cajeroNombre, differenceBs: diff.bs, differenceUSD: diff.usd });
      toast({ title: 'Corte Z confirmado', description: 'El arqueo y el cierre de caja quedaron guardados. Para otro Z debe realizar una nueva apertura.' });
    } catch (error:any) {
      toast({ variant: 'destructive', title: 'No se pudo ejecutar el Corte Z', description: error?.message || 'Turso no confirmó el cierre. La caja permanece abierta.' });
    } finally {
      setIsClosingZ(false);
    }
  };

  const handleOpenGlobalCreditPayment = (clientName: string, debts: Debt[]) => {
    const activeDebts = debts
      .filter(d => d.estado !== 'pagada' && (Number(d.saldoUSD) || 0) > 0.001)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
    if (activeDebts.length <= 1) return;
    const totalUSD = activeDebts.reduce((sum, d) => sum + (Number(d.saldoUSD) || 0), 0);
    if (totalUSD <= 0.001) return;
    const cedulaMatch = String(activeDebts[0]?.cliente || '').match(/\[([^\]]+)\]\s*$/);
    setGlobalCreditCustomer({
      name: clientName,
      cedula: cedulaMatch?.[1]?.trim(),
      totalUSD,
      totalBS: totalUSD * state.tasa
    });
  };

  const handleProcessGlobalCreditPayment = async (payments: any[]) => {
    if (!globalCreditCustomer || isProcessing || !payments?.length) return;
    const totalUSD = payments.reduce((s, p) => s + (Number(p.usdAmount) || (Number(p.amount) || 0) / state.tasa), 0);
    const totalBS = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (totalUSD <= 0 || totalBS <= 0) return;
    setIsProcessing(true);
    try {
      const terminal = currentTerminal;
      const operationId = 'PAGO-GLOBAL-CXC-' + Store.uid();
      const receiptId = 'PEND-CXC-' + Store.uid().toUpperCase().slice(0, 8);
      const payment = {
        id: receiptId, reciboId: receiptId, fecha: Utils.ahora(),
        montoUSD: totalUSD, montoBS: totalBS,
        metodo: payments.length > 1 ? 'mixto' : payments[0].method,
        tasaAplicada: state.tasa, terminalId: terminal?.id
      };
      const result = await Store.applyGlobalCustomerPaymentTransaction({
        operationId,
        customerName: globalCreditCustomer.name,
        customerCedula: globalCreditCustomer.cedula,
        amountUSD: totalUSD,
        amountBS: totalBS,
        payment,
        journal: {
          id: 'JD-' + Store.uid(), fecha: Utils.ahora(), tipo: 'ingreso',
          categoria: 'COBRO_DEUDA', montoUSD: totalUSD, montoBS: totalBS,
          descripcion: 'PAGO GLOBAL CxC', terminalId: terminal?.id
        },
        terminalId: terminal?.id
      });
      if (!result) throw new Error('No se pudo registrar el Pago Global.');
      toast({ title: 'Pago Global registrado', description: `Aplicado: ${Utils.fmtUSD(result.appliedUSD)} · ${Utils.fmtBS(result.appliedBS)}` });
      setGlobalCreditCustomer(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Pago Global no registrado', description: err?.message || 'No se pudo registrar el cobro.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const groupedCredits = useMemo(() => {
    const groups: Record<string, { totalUSD: number; debts: Debt[] }> = {};
    (state.cxc || []).filter(x => x.estado !== 'pagada' && (x.saldoUSD || 0) > 0.001).forEach(debt => {
      const name = debt.cliente || 'DESCONOCIDO';
      if (!groups[name]) groups[name] = { totalUSD: 0, debts: [] };
      groups[name].totalUSD += debt.saldoUSD;
      groups[name].debts.push(debt);
    });
    return groups;
  }, [state.cxc]);

  const getStockDisponible = (p: Product) => {
    let avail = p.stock || 0;
    if (p.isKit && p.kitType === 'stock_componentes' && p.kitItems) {
      let compPossible = Infinity;
      p.kitItems.forEach(ki => {
        const cp = state.productos.find(c => c.id === ki.productoId);
        if (cp) compPossible = Math.min(compPossible, Math.floor((cp.stock || 0) / ki.cantidad));
        else compPossible = 0;
      });
      if (compPossible !== Infinity) avail = compPossible;
    }
    return avail;
  };

  const agregar = (pid: string) => {
    const p = state.productos.find(x => x.id === pid);
    if (!p) return;
    const stockAvail = getStockDisponible(p);
    if (stockAvail <= 0) {
      toast({ variant: "destructive", title: "Sin Stock" });
      return;
    }
    setSelectedProductDisplay(p);
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
    setSelectedProductDisplay(p);
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

  const handlePriceChange = (index: number, newPrice: number) => {
    const nuevo = [...state.carrito];
    nuevo[index].precioUnitUSD = newPrice;
    nuevo[index].subtotalUSD = nuevo[index].cantidad * newPrice;
    updateState({ carrito: nuevo });
    setPriceSelectorItem(null);
    toast({ title: "Precio Actualizado", description: `Nuevo precio: ${Utils.fmtUSD(newPrice)}` });
  };

  // Ajuste manual de stock desde el POS (respaldado en la colección de productos)
  const guardarStockManual = async () => {
    if (!stockEdit) return;
    const nuevoStock = Math.max(0, parseFloat(stockEditValue) || 0);
    const delta = Utils.round(nuevoStock - (stockEdit.stock || 0));
    if (Math.abs(delta) < 0.000001) {
      setStockEdit(null);
      return;
    }

    const operationId = 'AJUSTE-MANUAL-POS-' + Store.uid();
    const mov: Movimiento = {
      id: Store.uid(),
      productoId: stockEdit.id,
      tipo: delta >= 0 ? 'ajuste_entrada' : 'ajuste_salida',
      cantidad: delta,
      stockAntes: stockEdit.stock || 0,
      stockDespues: nuevoStock,
      fecha: Utils.ahora(),
      referencia: 'AJUSTE MANUAL POS',
      terminalId: getCurrentTerminal()?.id || 'GLOBAL'
    };

    try {
      await Store.applyInventoryMovementsTransaction({
        operationId,
        operationType: 'AJUSTE-INVENTARIO-POS',
        movements: [mov]
      });
      // No actualizamos productos/movimientos desde el estado local:
      // Firestore/RTDB emite el estado autoritativo a todas las cajas.
      setStockEdit(null);
      toast({ title: "Stock Actualizado", description: stockEdit.nombre + ": ajuste de " + (delta > 0 ? "+" : "") + delta + " Und." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "No se pudo actualizar el stock",
        description: e?.message || "Otro terminal modificó el producto. Actualice e intente nuevamente."
      });
    }
  };
  const subtotalUSD = state.carrito.reduce((s, i) => s + i.subtotalUSD, 0);
  const totalBS = subtotalUSD * state.tasa;
  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  const saldoRestanteUSD = Math.max(0, subtotalUSD - totalPagadoUSD);

  const matches = search.trim().length > 0 
    ? state.productos.filter(p => p.activo && ((p.nombre || '').toLowerCase().includes(search.toLowerCase()) || (p.codigo || '').toLowerCase().includes(search.toLowerCase()))).slice(0, 8)
    : [];

  const filteredClients = useMemo(() => {
    if (clientSearch.trim().length === 0) return [];
    const searchLower = clientSearch.toLowerCase();
    const searchNumeric = clientSearch.replace(/\D/g, '');

    return (state.clientes || []).filter(c => {
      const nameMatch = (c.name || '').toLowerCase().includes(searchLower);
      const cedulaExactMatch = (c.cedula || '').toLowerCase().includes(searchLower);
      const cedulaNumericMatch = searchNumeric.length > 0 && (c.cedula || '').replace(/\D/g, '').includes(searchNumeric);

      return nameMatch || cedulaExactMatch || cedulaNumericMatch;
    });
  }, [clientSearch, state.clientes]);

  const getCurrentTerminal = () => currentTerminal;

  const guardarNuevaTasa = () => {
    const n = parseFloat(nuevaTasa);
    if (isNaN(n) || n <= 0) return alert('Tasa inválida');
    updateState({ tasa: n });
    setEditandoTasa(false);
  };

  const ejecutarVenta = async (pagosFinales?: PagoRealizado[]) => {
    if (state.carrito.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const listadoPagos = pagosFinales || pagos;
      const totalPagadoRecibido = listadoPagos.reduce((s, p) => s + p.montoUSD, 0);
      const terminal = getCurrentTerminal();
      const nextNum = terminal?.proximoRecibo || state.proximoRecibo;
      const prefijo = Utils.prefijoCaja(terminal, state.terminales);
      const reciboId = prefijo + '-' + String(nextNum).padStart(9, '0');
      const ahoraStr = Utils.ahora();
      
      let vExento = 0, vBase = 0, vIVA = 0;
      let prodsActualizados = [...state.productos], nuevosMovimientos: Movimiento[] = [];

      state.carrito.forEach(item => {
        const pIdx = prodsActualizados.findIndex(x => x.id === item.productoId);
        if (pIdx === -1) return;
        const p = { ...prodsActualizados[pIdx] };
        if (p.aplicaIVA) { const base = item.subtotalUSD / 1.16; vBase += base; vIVA += (item.subtotalUSD - base); } else { vExento += item.subtotalUSD; }
        if (p.isKit && p.kitType === 'stock_componentes' && p.kitItems) {
          p.kitItems.forEach(ki => {
            const cpIdx = prodsActualizados.findIndex(cp => cp.id === ki.productoId);
            if (cpIdx !== -1) {
              const cp = { ...prodsActualizados[cpIdx] };
              const qty = item.cantidad * ki.cantidad, stockAntes = cp.stock;
              cp.stock -= qty;
              nuevosMovimientos.push({ id: Store.uid(), productoId: cp.id, tipo: 'venta', cantidad: -qty, stockAntes, stockDespues: cp.stock, fecha: ahoraStr, referencia: `KIT: ${p.nombre} - VENTA ${reciboId}`, terminalId: terminal?.id || 'GLOBAL' });
              prodsActualizados[cpIdx] = cp;
            }
          });
        } else {
          const stockAntes = p.stock;
          p.stock -= item.cantidad;
          nuevosMovimientos.push({ id: Store.uid(), productoId: item.productoId, tipo: 'venta', cantidad: -item.cantidad, stockAntes, stockDespues: p.stock, fecha: ahoraStr, referencia: `VENTA ${reciboId}`, terminalId: terminal?.id || 'GLOBAL' });
          prodsActualizados[pIdx] = p;
        }
      });

      const vIgtf = listadoPagos.filter(p => p.metodo === 'efectivo_usd' || p.metodo === 'zelle').reduce((acc, p) => acc + (p.montoUSD * 0.03), 0);
      
      const nuevaVenta: Sale = { 
        id: reciboId, 
        fecha: ahoraStr, 
        cliente, 
        items: [...state.carrito], 
        subtotalUSD, 
        descuentoUSD: 0, 
        totalUSD: subtotalUSD, 
        totalBS, 
        metodoPago: listadoPagos.length > 1 ? 'mixto' : (listadoPagos[0]?.metodo || 'efectivo_usd'), 
        estado: 'completada', 
        type: 'VENTA', 
        received: totalPagadoRecibido, 
        change: Math.max(0, totalPagadoRecibido - subtotalUSD), 
        payments: [...listadoPagos], 
        terminalId: terminal?.id, 
        terminalName: terminal?.nombre || 'SISTEMA GLOBAL', 
        cajeroId: ((state as any).user?.id || (state as any).user?.uid || ''), 
        baseImponibleUSD: Utils.round(vBase), 
        ivaUSD: Utils.round(vIVA), 
        exentoUSD: Utils.round(vExento), 
        igtfUSD: Utils.round(vIgtf),
        tasa: state.tasa
      };
      
      const nuevasEntradasDiario: LibroDiarioEntry[] = listadoPagos.map(p => ({ 
        id: 'ACC-' + Store.uid().toUpperCase().slice(0, 5), 
        fecha: ahoraStr, 
        tipo: 'ingreso', 
        categoria: 'VENTA', 
        concepto: `VENTA #${reciboId} - CLIENTE: ${cliente.toUpperCase()}`, 
        montoUSD: p.montoUSD, 
        montoBS: p.montoBS, 
        metodo: p.metodo, 
        referencia: reciboId + '-' + (terminal?.id || 'GLOBAL'),
        terminalId: terminal?.id || 'GLOBAL',
        terminalName: terminal?.nombre || 'SISTEMA GLOBAL'
      }));
      
      await updateState({ 
        productos: prodsActualizados, 
        ventas: [...state.ventas, nuevaVenta], 
        movimientos: [...state.movimientos, ...nuevosMovimientos], 
        libroDiario: [...nuevasEntradasDiario, ...(state.libroDiario || [])], 
        carrito: [], 
        proximoRecibo: state.proximoRecibo + 1, 
        terminales: state.terminales.map(t => t.id === terminal?.id ? { ...t, proximoRecibo: t.proximoRecibo + 1 } : t) 
      });
      if (typeof window !== 'undefined') sessionStorage.removeItem('posven_current_cart');
      
      setLastProcessedSale(nuevaVenta); 
      setShowReceiptModal(true); 
      setPagos([]); 
      setCliente('Consumidor final'); 
      setSelectedProductDisplay(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const ejecutarAbono = async (pagosAbono: PagoRealizado[]) => {
    if (!showAbonoModal || isProcessing) return;
    setIsProcessing(true);
    try {
      const totalAbonado = pagosAbono.reduce((s, p) => s + p.montoUSD, 0);
      if (totalAbonado <= 0) return;

      // La deuda histórica puede conservar un nombre antiguo. La identidad
      // operativa se resuelve por la cédula embebida en "cliente" y se contrasta
      // con el catálogo actual de clientes antes de generar el cobro.
      const clienteRaw = showAbonoModal.cliente || '';
      const cedulaMatch = clienteRaw.match(/\[([^\]]+)\]\s*$/);
      const cedulaDeuda = cedulaMatch?.[1]?.trim();
      const clienteActual = cedulaDeuda
        ? (state.clientes || []).find(c => c.cedula === cedulaDeuda || c.cedula.replace(/[^0-9A-Za-z]/g, '') === cedulaDeuda.replace(/[^0-9A-Za-z]/g, ''))
        : undefined;
      const nombreClienteCanonico = clienteActual?.name || (cedulaMatch ? clienteRaw.replace(/\s*\[[^\]]+\]\s*$/, '').trim() : clienteRaw) || 'CLIENTE';
      const ahoraStr = Utils.ahora(), terminal = getCurrentTerminal();
      const reciboProvisional = 'PEND-CXC-' + Store.uid().toUpperCase().slice(0, 8);
      const pagoAtomic = {
        fecha: ahoraStr,
        montoUSD: totalAbonado,
        montoBS: totalAbonado * state.tasa,
        metodo: pagosAbono.length > 1 ? 'mixto' : pagosAbono[0].metodo,
        reciboId: reciboProvisional
      };

      const nuevasEntradasDiario: LibroDiarioEntry[] = pagosAbono.map(p => ({ id: 'ACC-' + Store.uid().toUpperCase().slice(0, 5), fecha: ahoraStr, tipo: 'ingreso', categoria: 'COBRO_DEUDA', concepto: `ABONO DEUDA #${showAbonoModal.id} - CLIENTE: ${nombreClienteCanonico.toUpperCase()}`, montoUSD: p.montoUSD, montoBS: p.montoBS, metodo: p.metodo, referencia: reciboProvisional, terminalId: terminal?.id, terminalName: terminal?.nombre }));

      const saleAbono: Sale = {
        id: reciboProvisional, fecha: ahoraStr, cliente: nombreClienteCanonico,
        items: [{ productoId: 'ABONO', nombre: `ABONO A FACTURA #${showAbonoModal.id}`, cantidad: 1, precioUnitUSD: totalAbonado, subtotalUSD: totalAbonado }],
        subtotalUSD: totalAbonado, descuentoUSD: 0, totalUSD: totalAbonado, totalBS: totalAbonado * state.tasa,
        metodoPago: pagosAbono.length > 1 ? 'mixto' : pagosAbono[0].metodo,
        estado: 'completada', type: 'COBRO DEUDA', payments: [...pagosAbono],
        terminalId: terminal?.id, terminalName: terminal?.nombre || 'SISTEMA GLOBAL', tasa: state.tasa
      };

      const clienteCedula = cedulaDeuda;
      const resultadoPago = await Store.applyDebtPaymentTransaction({
        collection: 'cxc',
        debtId: showAbonoModal.id,
        amountUSD: totalAbonado,
        payment: pagoAtomic,
        journal: nuevasEntradasDiario,
        sale: saleAbono,
        customerCedula: clienteCedula,
        terminalId: terminal?.id
      });
      if (!resultadoPago) throw new Error('No se pudo registrar el abono.');
      const appliedUSD = Number(resultadoPago.appliedUSD) || totalAbonado;
      if (Math.abs(appliedUSD - totalAbonado) > 0.001) throw new Error('El saldo cambió mientras se registraba el abono. La operación fue limitada al saldo real.');

      const saleFinal = resultadoPago.sale || { ...saleAbono, id: resultadoPago.receiptId || saleAbono.id };
      setLastProcessedSale(saleFinal); 
      setShowReceiptModal(true); 
      setShowAbonoModal(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // ===== CORREGIDO: FUNCIÓN PARA EJECUTAR VENTA A CRÉDITO CON CLIENTE =====
  const ejecutarVentaACredito = async (customer: Customer) => {
    if (state.carrito.length === 0 || isProcessing) return;
    if (!customer) return alert("Seleccione un cliente.");
    
    setIsProcessing(true);
    try {
      const terminal = getCurrentTerminal();
      const nextNum = terminal?.proximoRecibo || state.proximoRecibo;
      const prefijo = Utils.prefijoCaja(terminal, state.terminales);
      const reciboId = prefijo + '-' + String(nextNum).padStart(9, '0');
      const ahoraStr = Utils.ahora();
      
      let vExento = 0, vBase = 0, vIVA = 0;
      let prodsActualizados = [...state.productos], nuevosMovimientos: Movimiento[] = [];
      
      state.carrito.forEach(item => {
        const pIdx = prodsActualizados.findIndex(x => x.id === item.productoId);
        if (pIdx === -1) return;
        const p = { ...prodsActualizados[pIdx] };
        if (p.aplicaIVA) { const base = item.subtotalUSD / 1.16; vBase += base; vIVA += (item.subtotalUSD - base); } else { vExento += item.subtotalUSD; }
        if (p.isKit && p.kitType === 'stock_componentes' && p.kitItems) {
          p.kitItems.forEach(ki => {
            const cpIdx = prodsActualizados.findIndex(cp => cp.id === ki.productoId);
            if (cpIdx !== -1) {
              const cp = { ...prodsActualizados[cpIdx] };
              const qty = item.cantidad * ki.cantidad, stockAntes = cp.stock;
              cp.stock -= qty;
              nuevosMovimientos.push({ id: Store.uid(), productoId: cp.id, tipo: 'venta', cantidad: -qty, stockAntes, stockDespues: cp.stock, fecha: ahoraStr, referencia: `KIT: ${p.nombre} - CRÉDITO ${reciboId}`, terminalId: terminal?.id || 'GLOBAL' });
              prodsActualizados[cpIdx] = cp;
            }
          });
        } else {
          const stockAntes = p.stock;
          p.stock -= item.cantidad;
          nuevosMovimientos.push({ id: Store.uid(), productoId: item.productoId, tipo: 'venta', cantidad: -item.cantidad, stockAntes, stockDespues: p.stock, fecha: ahoraStr, referencia: `CRÉDITO ${reciboId}`, terminalId: terminal?.id || 'GLOBAL' });
          prodsActualizados[pIdx] = p;
        }
      });
      
      const nuevaVenta: Sale = { 
        id: reciboId, 
        fecha: ahoraStr, 
        cliente: customer.name, 
        items: [...state.carrito], 
        subtotalUSD, 
        descuentoUSD: 0, 
        totalUSD: subtotalUSD, 
        totalBS, 
        metodoPago: 'credito', 
        estado: 'completada', 
        type: 'VENTA CRÉDITO', 
        received: 0, 
        change: 0, 
        terminalId: terminal?.id, 
        terminalName: terminal?.nombre || 'SISTEMA GLOBAL', 
        cajeroId: ((state as any).user?.id || (state as any).user?.uid || ''), 
        baseImponibleUSD: Utils.round(vBase), 
        ivaUSD: Utils.round(vIVA), 
        exentoUSD: Utils.round(vExento), 
        igtfUSD: 0,
        tasa: state.tasa
      };
      
      // Normalizar cédula para la deuda (asegurar formato correcto)
      const cedulaNormalizada = normalizeCedula(customer.cedula, extractDocType(customer.cedula));
      const nombreCliente = customer.name;
      
      const nuevaDeuda: Debt = { 
        id: 'CRD-' + reciboId.slice(-6), 
        fecha: ahoraStr.slice(0, 10), 
        fechaVencimiento: '2099-12-31', 
        cliente: `${nombreCliente} [${cedulaNormalizada}]`, 
        montoUSD: subtotalUSD, 
        abonadoUSD: 0, 
        saldoUSD: subtotalUSD, 
        estado: 'pendiente' as 'pendiente', 
        historialPagos: [], 
        ventaId: reciboId 
      };
      
      // Asegurar que el cliente quede registrado en la cartera (upsert) y su saldo
      // refleje la nueva deuda, para que persista en todos los usuarios/dispositivos.
      const clientesBase = state.clientes || [];
      const clienteIdx = clientesBase.findIndex(c => c.id === customer.id);
      const clientesActualizados = clienteIdx >= 0
        ? clientesBase.map(c => c.id === customer.id ? { ...c, debt: (c.debt || 0) + subtotalUSD } : c)
        : [...clientesBase, {
            id: customer.id,
            name: nombreCliente,
            cedula: cedulaNormalizada,
            phone: customer.phone || '',
            address: customer.address || '',
            debt: subtotalUSD
          }];

      await updateState({ 
        productos: prodsActualizados, 
        ventas: [...state.ventas, nuevaVenta], 
        movimientos: [...state.movimientos, ...nuevosMovimientos], 
        cxc: [...state.cxc, nuevaDeuda], 
        clientes: clientesActualizados, 
        proximoRecibo: state.proximoRecibo + 1, 
        terminales: state.terminales.map(t => t.id === terminal?.id ? { ...t, proximoRecibo: t.proximoRecibo + 1 } : t), 
        carrito: [] 
      });
      if (typeof window !== 'undefined') sessionStorage.removeItem('posven_current_cart');
      
      setLastProcessedSale(nuevaVenta); 
      setShowReceiptModal(true); 
      setIsCreditModalOpen(false); 
      setSelectedClient(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // ===== HANDLER PARA EL CREDIT MODAL =====
  const handleCreditModalConfirm = (customer: Customer, amount: number) => {
    if (!customer) return;
    const rawCed = getRawCedula(customer.cedula || '');
    if (rawCed.length > 0) {
      const customers = state.clientes || [];
      const exists = findCustomerByCedula(customers, customer.cedula);
      if (exists) {
        setSelectedClient(exists);
        setIsCreditModalOpen(false);
        setTimeout(() => ejecutarVentaACredito(exists), 100);
        return;
      }
      customer.cedula = normalizeCedula(customer.cedula, extractDocType(customer.cedula));
    }
    setSelectedClient(customer);
    setIsCreditModalOpen(false);
    setTimeout(() => ejecutarVentaACredito(customer), 100);
  };

  return (
    <div className="flex flex-col gap-2 h-[calc(100vh-100px)] max-w-7xl mx-auto w-full overflow-hidden">
      <div className="flex gap-2 no-print shrink-0 overflow-x-auto pb-1 items-center">
        <button onClick={() => setView('pos')} className={`btn btn-sm ${view === 'pos' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><ShoppingCart className="w-3.5 h-3.5"/> Punto de Venta</button>
        <button onClick={() => setView('history')} className={`btn btn-sm ${view === 'history' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><History className="w-3.5 h-3.5"/> Historial</button>
        <button onClick={() => setView('credits')} className={`btn btn-sm ${view === 'credits' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><ClipboardList className="w-3.5 h-3.5"/> Consultar Créditos</button>
        <button onClick={() => handleOpenReport('REPORT_X')} disabled={!!reportLoadingType} className="btn btn-sm bg-white text-ink font-bold border-line border disabled:opacity-50"><FileText className="w-3.5 h-3.5"/> {reportLoadingType === 'REPORT_X' ? 'Cargando…' : 'Reporte X'}</button>
        <button onClick={() => handleOpenReport('REPORT_Z')} disabled={!!reportLoadingType} className="btn btn-sm bg-white text-ink font-bold border-line border disabled:opacity-50"><Receipt className="w-3.5 h-3.5"/> {reportLoadingType === 'REPORT_Z' ? 'Cargando…' : 'Reporte Z'}</button>
        <button onClick={() => setView('returns')} className={`btn btn-sm ${view === 'returns' ? 'btn-primary shadow-md' : 'bg-white text-ink font-bold border-line border'}`}><RotateCcw className="w-3.5 h-3.5"/> Devoluciones y Anulaciones</button>
        {view === 'pos' && (
          <button
            onClick={() => { setAdjustmentSearch(''); setAdjustmentProductId(''); setAdjustmentType('consumo'); setAdjustmentQty('1'); setAdjustmentDetail(''); setShowPosAdjustment(true); }}
            className="btn btn-sm bg-white text-ink font-bold border border-brand-gold/40 hover:bg-brand-gold-soft transition-colors"
            title="Registrar consumo, colaboración o ajuste de inventario"
            aria-label="Ajustes de inventario"
          ><Settings2 className="w-3.5 h-3.5 text-brand-gold-deep"/> Ajustes</button>
        )}
        
        
        {view === 'pos' && (
          <button 
            onClick={() => setIsFullScreen(!isFullScreen)} 
            className="btn btn-sm bg-white text-ink font-bold border-line border ml-auto hover:bg-brand-gold-soft transition-colors"
            title={isFullScreen ? "Minimizar" : "Expandir Pantalla Completa"}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {view === 'pos' ? (
        <div className={cn(
          "flex flex-col gap-2 flex-1 overflow-hidden animate-in fade-in duration-300",
          isFullScreen && "fixed inset-0 z-[100] bg-surface-warm p-6 overflow-hidden flex flex-col"
        )}>
          <div className="flex items-center gap-3 shrink-0 mb-1">
            <div className="relative group flex-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8952e] z-10"><Barcode className="w-5 h-5" /></div>
              <input ref={searchInputRef} className="form-input pl-14 py-2 text-base bg-white border-brand-gold/30 text-ink font-black placeholder-ink/40" placeholder="Escanee o busque producto..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && matches.length >= 1) agregar(matches[0].id); else if (e.key === 'Escape') setSearch(''); }} autoFocus />
              {matches.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-line rounded-b-lg shadow-2xl z-[100] mt-1 overflow-hidden">
                  {matches.map(p => (
                    <div key={p.id} onClick={() => agregar(p.id)} className="flex items-center justify-between p-3 hover:bg-brand-gold/10 cursor-pointer border-b border-line group">
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-ink text-sm font-black uppercase truncate group-hover:text-brand-gold-deep transition-colors">{p.nombre}</span>
                        <span className="text-ink/60 text-[10px] mono font-bold">{p.codigo}</span>
                      </div>
                      <div className="flex items-center gap-10 shrink-0 ml-4">
                         <div className="flex flex-col items-end min-w-[70px]"><span className="text-[9px] font-black uppercase text-ink/40 mb-0.5">Stock</span><span className={`text-lg font-black leading-none ${p.stock <= (p.stockMinimo || 3) ? 'text-red-600' : p.stock <= (p.stockMinimo || 3) * 2 ? 'text-amber-500' : 'text-green-600'}`}>{p.stock} <span className="text-[10px] opacity-60">Und.</span></span></div>
                         <div className="flex items-center gap-2"><div className="flex flex-col items-end min-w-[90px]"><span className="text-[9px] font-black uppercase text-ink/40 mb-0.5">Precio USD</span><span className="text-lg font-black leading-none text-ink">{Utils.fmtUSD(p.precioUSD)}</span></div><div className="flex flex-col items-end min-w-[110px]"><span className="text-[9px] font-black uppercase text-ink/40 mb-0.5">Equiv. BS</span><span className="text-lg font-black leading-none text-brand-gold-deep">{Utils.fmtBS(p.precioUSD * state.tasa)}</span></div></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-brand-gold/30 shadow-sm shrink-0">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-line shrink-0"><img src="/bcv-logo.png" alt="BCV" className="w-full h-full object-cover" /></div>
              <div className="flex items-center gap-1.5">{!editandoTasa ? (<><span className="text-ink font-black text-sm tabular-nums">{state.tasa.toFixed(2)}</span><button onClick={() => { setEditandoTasa(true); setNuevaTasa(state.tasa.toString()); }} className="text-brand-gold hover:text-brand-gold-deep p-0.5 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button></>) : (<><input type="text" value={nuevaTasa} onChange={e => setNuevaTasa(e.target.value.replace(/[^0-9.]/g, ''))} className="w-16 bg-surface-soft border border-brand-gold rounded px-1.5 py-0.5 text-ink font-black text-sm text-right outline-none" autoFocus /><button onClick={guardarNuevaTasa} className="text-status-success p-0.5"><Check className="w-4 h-4" /></button><button onClick={() => setEditandoTasa(false)} className="text-status-danger p-0.5"><X className="w-4 h-4" /></button></>)}</div>
            </div>
          </div>

          <div className="flex flex-1 gap-3 overflow-hidden">
            <div className="w-1/4 flex flex-col gap-2">
              <div className="card p-3 space-y-3 bg-white border-line h-full flex flex-col">
                <div className="form-group mb-0">
                  <label className="text-ink text-[10px] font-black uppercase block mb-1">IDENTIFICACIÓN CLIENTE</label>
                  <input className="form-input h-8 text-xs bg-surface-soft text-ink border-line font-black uppercase" value={cliente} onChange={e => setCliente(e.target.value)} />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pt-2 border-t border-line/10">
                  {selectedProductDisplay && (
                    <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                       <div className="p-3 bg-surface-soft border border-line rounded-xl text-center relative"><span className="text-[9px] font-black uppercase text-ink opacity-40 block mb-1">STOCK DISPONIBLE</span><span className={`text-2xl font-black ${selectedProductDisplay.stock <= (selectedProductDisplay.stockMinimo || 3) ? 'text-status-danger' : selectedProductDisplay.stock <= (selectedProductDisplay.stockMinimo || 3) * 2 ? 'text-status-warn' : 'text-status-success'}`}>{selectedProductDisplay.stock} <span className="text-xs">UND</span></span><button onClick={() => { setStockEdit(selectedProductDisplay); setStockEditValue(String(selectedProductDisplay.stock || 0)); }} title="Ajustar stock manualmente" className="absolute top-1 right-1 p-1 text-ink/30 hover:text-brand-gold-deep transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button></div>
                       <div className="p-3 bg-surface-soft border border-line rounded-xl text-center"><span className="text-[9px] font-black uppercase text-ink opacity-40 block mb-1">PRECIO UNITARIO USD</span><span className="text-2xl font-black text-ink">{Utils.fmtUSD(selectedProductDisplay.precioUSD)}</span></div>
                       <div className="p-3 bg-brand-gold-soft/30 border border-brand-gold-soft/30 rounded-xl text-center"><span className="text-[9px] font-black uppercase text-brand-gold-deep block mb-1">EQUIVALENTE EN BOLÍVARES</span><span className="text-2xl font-black text-brand-gold-deep">{Utils.fmtBS(selectedProductDisplay.precioUSD * state.tasa)}</span></div>
                    </div>
                  )}
                  {state.carrito.length > 0 && (
                    <button onClick={() => setIsCreditModalOpen(true)} className="w-full h-10 border-2 border-status-info text-status-info hover:bg-status-info-soft font-black uppercase text-[10px] rounded-xl transition-all mt-4">Cargar a Crédito</button>
                  )}
                </div>
              </div>
            </div>

            <div className="w-3/4 flex flex-col gap-2 overflow-hidden">
              <div className="card flex-1 flex flex-col overflow-hidden bg-white border-none shadow-xl">
                <div className="grid grid-cols-[1fr_80px_70px_35px_80px_80px_80px_35px] gap-1 px-3 py-3 bg-ink text-white text-[10px] font-black uppercase tracking-[0.12em] rounded-t-lg">
                  <div>Descripción</div><div className="text-center">Cant</div><div className="text-center">U.M.</div><div /> <div className="text-right">Precio ($)</div><div className="text-right">Precio (Bs)</div><div className="text-right">Total</div><div className="text-center"></div>
                </div>
                <div className="flex-1 overflow-y-auto p-1 space-y-1">
                  {state.carrito.map((item, i) => {
                    const prod = state.productos.find(p => p.id === item.productoId);
                    return (
                      <div key={i} className="grid grid-cols-[1fr_80px_70px_35px_80px_80px_80px_35px] gap-1 items-center px-3 py-3 bg-white border-b border-black/5 text-ink">
                        <div className="truncate font-black text-xs uppercase leading-tight">{item.nombre}</div>
                        <div className="flex items-center justify-center gap-1 bg-surface-soft rounded p-0.5 border border-line/30"><button onClick={() => updateQty(i, -1)} className="text-ink font-black text-sm px-1.5">-</button><span className="w-5 text-center text-xs font-black">{item.cantidad}</span><button onClick={() => updateQty(i, 1)} className="text-ink font-black text-sm px-1.5">+</button></div>
                        <div className="text-center text-[10px] font-black uppercase">{prod?.cantidad || '-'}</div>
                        <div className="flex justify-center">
                          <button 
                            onClick={() => prod && setPriceSelectorItem({ index: i, product: prod })}
                            className="text-brand-gold hover:text-brand-gold-deep transition-colors p-1 bg-brand-gold-soft/20 rounded-md"
                            title="Cambiar Precio (Alternativos)"
                          >
                            <Tag className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right text-xs font-black">{Utils.fmtUSD(item.precioUnitUSD)}</div>
                        <div className="text-right text-xs font-black">{Utils.fmtBS(item.precioUnitUSD * state.tasa)}</div>
                        <div className="text-right text-sm font-black">{Utils.fmtUSD(item.subtotalUSD)}</div>
                        <div className="flex justify-center"><button onClick={() => updateQty(i, -item.cantidad)} className="text-ink/20 hover:text-red-600"><Trash2 className="w-4 h-4"/></button></div>
                      </div>
                    );
                  })}
                </div>
                <div className="p-4 bg-ink border-t border-line/10 flex items-center justify-between rounded-b-lg gap-6">
                  <div className="space-y-0 shrink-0"><label className="text-white/60 text-[8px] font-black uppercase block tracking-widest mb-1">TOTAL FACTURA</label><div className="text-4xl font-black text-brand-gold leading-none">{Utils.fmtUSD(subtotalUSD)}</div></div>
                  <div className="flex-1 flex justify-end items-center pr-4"><div className="text-4xl font-black text-white">{Utils.fmtBS(totalBS)}</div></div>
                  
                  <div className="flex items-center gap-3">
                    {isFullScreen && (
                      <button 
                        onClick={() => setIsFullScreen(false)} 
                        className="w-14 h-14 bg-white/10 border-2 border-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all transform hover:scale-105"
                        title="Minimizar (ESC)"
                      >
                        <Minimize2 className="w-6 h-6" />
                      </button>
                    )}
                    <button onClick={() => saldoRestanteUSD <= 0.01 && state.carrito.length > 0 ? ejecutarVenta() : setShowMultiModal(true)} disabled={state.carrito.length === 0 || isProcessing} className="w-14 h-14 bg-[#c8952e] text-black rounded-full shadow-lg flex items-center justify-center hover:bg-[#d9a540] transition-all transform hover:scale-105 active:scale-95 disabled:opacity-20 shrink-0">
                      {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : (saldoRestanteUSD <= 0.01 && state.carrito.length > 0 ? <Check className="w-8 h-8" /> : <Wallet className="w-8 h-8" />)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : view === 'history' ? (
        <div className="card flex-1 bg-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300 rounded-xl">
          <div className="card-head px-6 py-4 bg-ink border-b border-white/10 flex justify-between items-center"><h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2 text-xs"><History className="w-5 h-5 text-brand-gold" /> HISTORIAL TERMINAL: {currentTerminal?.nombre || 'S/T'}</h3><button onClick={() => setView('pos')} className="btn btn-sm bg-white text-ink hover:bg-surface-soft flex items-center gap-2 font-black uppercase text-[10px] rounded-lg border-none px-4"><ArrowLeft className="w-3.5 h-3.5"/> Volver al POS</button></div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table>
              <thead><tr><th>Recibo</th><th>Hora</th><th>Terminal</th><th>Cliente</th><th>Tipo</th><th className="text-right">Monto USD</th><th>Método</th><th className="text-center">Estado</th><th className="text-center">Acciones</th></tr></thead>
              <tbody>
                {histPageVentas.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-20 text-ink/20 font-black italic uppercase">Sin ventas registradas en esta terminal</td></tr>
                ) : histPageVentas.map(v => (
                  <tr key={v.id} className="border-b border-line/40 hover:bg-surface-warm/20"><td className="text-ink font-black text-xs mono">{v.id}</td><td className="text-ink font-bold text-xs">{v.fecha.split('T')[1]?.slice(0, 5)}</td><td className="text-ink font-black text-[10px] uppercase">{v.terminalName || state.terminales.find(t => t.id === v.terminalId)?.nombre || '-'}</td><td className="text-ink font-black text-xs uppercase truncate max-w-[150px]">{v.cliente}</td><td className="text-ink font-black text-[9px] uppercase"><span className={`badge ${v.type === 'COBRO DEUDA' ? 'badge-info' : 'badge-neutral'}`}>{v.type || 'VENTA'}</span></td><td className="text-brand-gold-deep font-black text-xs text-right">{Utils.fmtUSD(v.totalUSD)}</td><td className="text-ink font-bold text-[10px] uppercase">{Utils.metodoLabel(v.metodoPago)}</td><td className="text-center"><span className={`badge ${v.estado === 'pendiente' ? 'badge-warn' : (v.estado === 'anulada' ? 'badge-err' : 'badge-ok')} font-black text-[9px] uppercase`}>{v.estado}</span></td><td className="text-center"><button onClick={() => setShowSaleDetail(v)} className="w-7 h-7 rounded-full flex items-center justify-center text-status-success hover:bg-status-success/10 transition-colors" title="Ver ítems y detalle de venta"><Eye className="w-4 h-4" /></button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={histSafePage} totalPages={histTotalPages} total={histVentas.length} pageSize={histPageSize} onPageChange={setHistPage} />
        </div>
      ) : view === 'credits' ? (
        <div className="card flex-1 bg-white flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300 rounded-xl">
          <div className="card-head px-6 py-4 bg-ink border-b border-white/10 flex justify-between items-center"><h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2 text-xs"><ClipboardList className="w-5 h-5 text-brand-gold" /> CONSULTA CRÉDITOS Y COBRANZA (GLOBAL)</h3><button onClick={() => setView('pos')} className="btn btn-sm bg-white text-ink hover:bg-surface-soft flex items-center gap-2 font-black uppercase text-[10px] rounded-lg border-none px-4"><ArrowLeft className="w-3.5 h-3.5"/> Volver al POS</button></div>
          <div className="table-wrap flex-1 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-soft">
                  <th className="px-6 py-3"></th>
                  <th className="text-ink font-black text-[10px] uppercase">Cliente / Identificación</th>
                  <th className="text-ink font-black text-[10px] uppercase text-right">Documentos</th>
                  <th className="text-ink font-black text-[10px] uppercase text-right">Saldo USD</th>
                  <th className="text-ink font-black text-[10px] uppercase text-right">Saldo BS</th>
                  <th className="text-ink font-black text-[10px] uppercase text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedCredits).length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-20 text-ink font-black uppercase italic">No hay deudas registradas</td></tr>
                ) : (
                  Object.entries(groupedCredits).map(([clientName, group]) => (
                    <React.Fragment key={clientName}>
                      <tr className="border-b border-line hover:bg-surface-warm/20 transition-colors">
                        <td className="px-6 py-4">
                           <button onClick={() => setExpandedClient(expandedClient === clientName ? null : clientName)} className="text-brand-gold hover:scale-110 transition-transform">{expandedClient === clientName ? <ChevronUp /> : <ChevronDown />}</button>
                        </td>
                        <td className="py-4"><div className="text-ink font-black text-sm uppercase">{clientName}</div></td>
                        <td className="text-right py-4 font-black text-ink">{group.debts.length} Facturas</td>
                        <td className="text-right py-4 font-black text-status-info text-base">{Utils.fmtUSD(group.totalUSD)}</td>
                        <td className="text-right py-4 font-black text-ink">{Utils.fmtBS(group.totalUSD * state.tasa)}</td>
                        <td className="text-center py-4"><div className="flex items-center justify-center gap-2">
                          {group.debts.length > 1 && (
                            <button onClick={() => handleOpenGlobalCreditPayment(clientName, group.debts)} className="h-10 px-3 rounded-full flex items-center justify-center gap-1.5 bg-brand-gold text-black border-2 border-brand-gold hover:bg-brand-gold-deep transition-all shadow-md font-black text-[9px] uppercase whitespace-nowrap" title="PAGO GLOBAL" aria-label="PAGO GLOBAL">
                              <HandCoins className="w-4 h-4" /><span>PAGO GLOBAL</span>
                            </button>
                          )}
                          <button onClick={() => setShowClientHistory(clientName)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-status-success border-2 border-status-success/20 hover:bg-status-success hover:text-white transition-all shadow-md"><Eye className="w-5 h-5" /></button>
                        </div></td>
                      </tr>
                      {expandedClient === clientName && (
                        <tr className="bg-surface-soft/40 animate-in slide-in-from-top-1 duration-200">
                           <td colSpan={6} className="px-12 py-4">
                              <div className="card border-line bg-white shadow-inner rounded-xl overflow-hidden">
                                 <table className="w-full">
                                    <thead className="bg-ink/5"><tr><th className="text-[9px] font-black uppercase p-2 text-left">Emisión</th><th className="text-[9px] font-black uppercase p-2 text-left">Vencimiento</th><th className="text-[9px] font-black uppercase p-2 text-right">Saldo USD</th><th className="text-[9px] font-black uppercase p-2 text-center">Acciones</th></tr></thead>
                                    <tbody>{group.debts.map(d => (<tr key={d.id} className="border-b border-line/20"><td className="text-[10px] font-black p-2">{Utils.fmtFecha(d.fecha)}</td><td className={`text-[10px] font-black p-2 ${d.saldoUSD > 0.001 && d.fechaVencimiento < Utils.hoy() ? 'text-status-danger' : 'text-ink'}`}>{d.fechaVencimiento === '2099-12-31' ? 'ABIERTA' : Utils.fmtFecha(d.fechaVencimiento)}</td><td className="text-[10px] font-black p-2 text-right text-brand-gold-deep">{Utils.fmtUSD(d.saldoUSD)}</td><td className="p-2 text-center"><div className="flex justify-center gap-2"><button onClick={() => setShowDetails(d)} className="w-8 h-8 rounded-full flex items-center justify-center text-status-success hover:bg-status-success/10"><Eye className="w-4 h-4"/></button><button onClick={() => { setShowAbonoModal(d); }} className="btn btn-sm btn-primary h-7 px-3 text-[8px] uppercase">Abonar</button></div></td></tr>))}</tbody>
                                 </table>
                              </div>
                           </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <ReturnsModule state={state} updateState={updateState} onBackToPOS={() => setView('pos')} terminalId={currentTerminal?.id} />
      )}

      {priceSelectorItem && (
        <div className="modal show" style={{ zIndex: 120 }}><div className="modal-bg" onClick={() => setPriceSelectorItem(null)}></div>
          <div className="modal-box max-w-sm bg-white border-2 border-line rounded-2xl overflow-hidden shadow-2xl">
            <div className="modal-head py-3 px-5 border-b border-line bg-ink text-white flex justify-between items-center">
              <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                <Tag className="w-4 h-4 text-brand-gold" /> Selección de Tarifa
              </h3>
              <button onClick={() => setPriceSelectorItem(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-body p-6 space-y-4">
               <p className="text-[10px] font-black uppercase text-ink/40 text-center tracking-tighter">{priceSelectorItem.product.nombre}</p>
               
               <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => handlePriceChange(priceSelectorItem.index, priceSelectorItem.product.precioUSD)} className="flex justify-between items-center p-4 bg-surface-soft border border-line rounded-xl hover:border-brand-gold transition-all group">
                    <span className="text-xs font-black text-ink uppercase">Precio Estándar</span>
                    <span className="text-sm font-black text-ink group-hover:text-brand-gold-deep">{Utils.fmtUSD(priceSelectorItem.product.precioUSD)}</span>
                  </button>
                  
                  {priceSelectorItem.product.precioMayorUSD && priceSelectorItem.product.precioMayorUSD > 0 && (
                    <button onClick={() => handlePriceChange(priceSelectorItem.index, priceSelectorItem.product.precioMayorUSD!)} className="flex justify-between items-center p-4 bg-brand-gold-soft/20 border border-brand-gold/20 rounded-xl hover:border-brand-gold transition-all group">
                      <span className="text-xs font-black text-brand-gold-deep uppercase">Precio al Mayor</span>
                      <span className="text-sm font-black text-brand-gold-deep">{Utils.fmtUSD(priceSelectorItem.product.precioMayorUSD)}</span>
                    </button>
                  )}

                  {priceSelectorItem.product.precioOfertaUSD && priceSelectorItem.product.precioOfertaUSD > 0 && (
                    <button onClick={() => handlePriceChange(priceSelectorItem.index, priceSelectorItem.product.precioOfertaUSD!)} className="flex justify-between items-center p-4 bg-status-success-soft/20 border border-status-success/20 rounded-xl hover:border-status-success transition-all group">
                      <span className="text-xs font-black text-status-success uppercase">Precio Oferta</span>
                      <span className="text-sm font-black text-status-success">{Utils.fmtUSD(priceSelectorItem.product.precioOfertaUSD)}</span>
                    </button>
                  )}

                  {priceSelectorItem.product.precioPromoUSD && priceSelectorItem.product.precioPromoUSD > 0 && (
                    <button onClick={() => handlePriceChange(priceSelectorItem.index, priceSelectorItem.product.precioPromoUSD!)} className="flex justify-between items-center p-4 bg-status-info-soft/20 border border-status-info/20 rounded-xl hover:border-status-info transition-all group">
                      <span className="text-xs font-black text-status-info uppercase">Precio Promoción</span>
                      <span className="text-sm font-black text-status-info">{Utils.fmtUSD(priceSelectorItem.product.precioPromoUSD)}</span>
                    </button>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {globalCreditCustomer && (
        <FloatingPaymentModal
          total={globalCreditCustomer.totalBS}
          totalCents={Math.round(globalCreditCustomer.totalBS * 100)}
          exchangeRate={state.tasa}
          allowPartial={true}
          onClose={() => setGlobalCreditCustomer(null)}
          onConfirm={(data) => { void handleProcessGlobalCreditPayment(data.payments); }}
        />
      )}
      {showReceiptModal && (
        <ReceiptModal 
          isOpen={showReceiptModal} 
          onClose={() => { 
            setShowReceiptModal(false); 
            setLastProcessedSale(null); 
          }} 
          saleData={lastProcessedSale} 
          type="SALE" 
        />
      )}
      
      {showReportType && reportSnapshot && (
        <ReceiptModal
          isOpen={!!showReportType}
          onClose={() => { setShowReportType(null); setReportSnapshot(null); }}
          reportData={reportSnapshot}
          type={showReportType}
        />
      )}
      {showZArqueo && reportSnapshot && (
        <CashZArqueoModal
          open={showZArqueo}
          mode={arqueoMode}
          report={reportSnapshot}
          busy={isClosingZ}
          onCancel={() => { setShowZArqueo(false); setReportSnapshot(null); }}
          onConfirm={(real, diff) => { void ejecutarCierreZ(real, diff); }}
        />
      )}
      
      {showMultiModal && (
        <FloatingPaymentModal 
          total={totalBS} 
          totalCents={Math.round(totalBS * 100)} 
          exchangeRate={state.tasa} 
          onClose={() => setShowMultiModal(false)} 
          onConfirm={(data) => { 
            ejecutarVenta(data.payments.map(p => ({ 
              metodo: p.method as PaymentMethod, 
              montoUSD: p.usdAmount || (p.amount / state.tasa), 
              montoBS: p.amount 
            }))); 
            setShowMultiModal(false); 
          }} 
        />
      )}
      
      {showAbonoModal && (
        <FloatingPaymentModal 
          total={showAbonoModal.saldoUSD * state.tasa} 
          totalCents={Math.round(showAbonoModal.saldoUSD * state.tasa * 100)} 
          exchangeRate={state.tasa} 
          onClose={() => setShowAbonoModal(null)} 
          allowPartial={true} 
          onConfirm={(data) => { 
            ejecutarAbono(data.payments.map(p => ({ 
              metodo: p.method as PaymentMethod, 
              montoUSD: p.usdAmount || (p.amount / state.tasa), 
              montoBS: p.amount 
            }))); 
          }} 
        />
      )}

      {showSaleDetail && (
        <div className="modal show" style={{ zIndex: 115 }}><div className="modal-bg" onClick={() => setShowSaleDetail(null)}></div>
          <div className="modal-box max-w-[620px] bg-white border-2 border-line rounded-xl overflow-hidden shadow-2xl">
            <div className="modal-head py-4 px-6 border-b border-line bg-ink flex justify-between items-center text-white">
              <h3 className="font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
                <Receipt className="w-5 h-5 text-brand-gold" /> AUDITORÍA DE VENTA: {showSaleDetail.id}
              </h3>
              <button onClick={() => setShowSaleDetail(null)} className="text-white hover:text-brand-gold"><X className="w-5 h-5"/></button>
            </div>
            <div className="modal-body p-6 space-y-5 max-h-[75vh] overflow-y-auto bg-white">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-surface-soft rounded-lg border border-line">
                  <label className="text-[8px] font-black uppercase text-ink block mb-1">Fecha</label>
                  <p className="text-sm font-black text-ink">{Utils.fmtFecha(showSaleDetail.fecha)}</p>
                </div>
                <div className="p-3 bg-surface-soft rounded-lg border border-line">
                  <label className="text-[8px] font-black uppercase text-ink block mb-1">Cliente</label>
                  <p className="text-sm font-black text-ink uppercase truncate">{showSaleDetail.cliente || 'Consumidor final'}</p>
                </div>
                <div className="p-3 bg-brand-gold-soft border border-brand-gold/20 rounded-lg">
                  <label className="text-[8px] font-black uppercase text-brand-gold-deep block mb-1">Total USD</label>
                  <p className="text-lg font-black text-brand-gold-deep">{Utils.fmtUSD(showSaleDetail.totalUSD)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-surface-soft rounded-lg border border-line">
                  <label className="text-[8px] font-black uppercase text-ink block mb-1">Tipo</label>
                  <p className="text-[10px] font-black text-ink uppercase">{showSaleDetail.type || 'VENTA'}</p>
                </div>
                <div className="p-3 bg-surface-soft rounded-lg border border-line">
                  <label className="text-[8px] font-black uppercase text-ink block mb-1">Método</label>
                  <p className="text-[10px] font-black text-ink uppercase">{Utils.metodoLabel(showSaleDetail.metodoPago)}</p>
                </div>
                <div className="p-3 bg-surface-soft rounded-lg border border-line">
                  <label className="text-[8px] font-black uppercase text-ink block mb-1">Estado</label>
                  <p className="text-[10px] font-black uppercase"><span className={`badge ${showSaleDetail.estado === 'pendiente' ? 'badge-warn' : (showSaleDetail.estado === 'anulada' ? 'badge-err' : 'badge-ok')} font-black text-[9px] uppercase`}>{showSaleDetail.estado}</span></p>
                </div>
              </div>

              <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                <div className="flex justify-between items-center border-b border-line pb-2">
                  <h4 className="text-[10px] font-black uppercase text-ink tracking-[0.2em]">DESGLOSE DE ÍTEMS</h4>
                  <span className="text-[9px] font-black text-ink uppercase">{showSaleDetail.items?.length || 0} ítems</span>
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
                      {(!showSaleDetail.items || showSaleDetail.items.length === 0) ? (
                        <tr><td colSpan={4} className="text-center py-10 text-ink font-black uppercase italic text-[10px]">Sin desglose de ítems disponible para esta referencia</td></tr>
                      ) : showSaleDetail.items.map((it: any, idx: number) => (
                        <tr key={idx} className="border-b border-line/20">
                          <td className="text-[9px] font-black p-2">{it.cantidad}</td>
                          <td className="text-[9px] font-black uppercase p-2 truncate max-w-[220px]">{it.nombre}</td>
                          <td className="text-[9px] font-black p-2 text-right">{Utils.fmtUSD(it.precioUnitUSD)}</td>
                          <td className="text-[9px] font-black p-2 text-right text-brand-gold-deep">{Utils.fmtUSD(it.subtotalUSD)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-foot p-4 bg-surface-soft border-t border-line text-right">
              <button onClick={() => setShowSaleDetail(null)} className="btn btn-primary px-8 font-black uppercase text-[10px] rounded-lg shadow-md">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showDetails && (
        <div className="modal show" style={{ zIndex: 110 }}><div className="modal-bg" onClick={() => setShowDetails(null)}></div>
          <div className="modal-box max-w-[600px] bg-white border-2 border-line rounded-xl overflow-hidden shadow-2xl">
            <div className="modal-head py-4 px-6 border-b border-line bg-ink flex justify-between items-center text-white">
              <h3 className="font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
                <Receipt className="w-5 h-5 text-brand-gold" /> HISTORIAL DETALLADO: {showDetails.id}
              </h3>
              <button onClick={() => setShowDetails(null)} className="text-white hover:text-brand-gold"><X className="w-5 h-5"/></button>
            </div>
            <div className="modal-body p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-white">
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-3 bg-surface-soft rounded-lg border border-line">
                    <label className="text-[8px] font-black uppercase text-ink block mb-1">Monto Original</label>
                    <p className="text-lg font-black text-ink">{Utils.fmtUSD(showDetails.montoUSD)}</p>
                 </div>
                 <div className="p-3 bg-brand-gold-soft border border-brand-gold/20 rounded-lg">
                    <label className="text-[8px] font-black uppercase text-brand-gold-deep block mb-1">Saldo Actual</label>
                    <p className="text-lg font-black text-brand-gold-deep">{Utils.fmtUSD(showDetails.saldoUSD)}</p>
                 </div>
              </div>

              {(() => {
                const sale = state.ventas.find(v => v.id === showDetails.ventaId || v.id === showDetails.id);
                if (!sale) return null;
                return (
                  <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center border-b border-line pb-2">
                       <h4 className="text-[10px] font-black uppercase text-ink tracking-[0.2em]">DETALLE DE COMPRA ORIGINAL</h4>
                       <span className="text-[9px] font-black text-ink uppercase">{Utils.fmtFecha(sale.fecha)}</span>
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
                                 <td className="text-[9px] font-black p-2">{it.cantidad}</td>
                                 <td className="text-[9px] font-black uppercase p-2 truncate max-w-[180px]">{it.nombre}</td>
                                 <td className="text-[9px] font-black p-2 text-right">{Utils.fmtUSD(it.precioUnitUSD)}</td>
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
                 <h4 className="text-[10px] font-black uppercase text-ink tracking-[0.2em] border-b border-line pb-2">CRONOLOGÍA DE ABONOS</h4>
                 <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                    {(!showDetails.historialPagos || showDetails.historialPagos.length === 0) ? (
                      <div className="py-10 text-center text-ink font-black uppercase italic text-[10px]">No se han registrado abonos aún</div>
                    ) : (
                      showDetails.historialPagos.map((p: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-surface-soft border border-line rounded-lg">
                           <div className="space-y-0.5">
                              <p className="text-[10px] font-black text-ink uppercase">{Utils.fmtFecha(p.fecha)}</p>
                              <p className="text-[8px] font-black text-ink mono">REF: {p.reciboId}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-xs font-black text-status-success">+{Utils.fmtUSD(p.montoUSD)}</p>
                              <p className="text-[8px] font-black text-ink uppercase">{Utils.metodoLabel(p.metodo || 'otros')}</p>
                           </div>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            </div>
            <div className="modal-foot p-4 bg-surface-soft border-t border-line text-right">
               <button onClick={() => setShowDetails(null)} className="btn btn-primary px-8 font-black uppercase text-[10px] rounded-lg shadow-md">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showClientHistory && (
        <div className="modal show" style={{ zIndex: 105 }}><div className="modal-bg" onClick={() => setShowClientHistory(null)}></div>
          <div className={`modal-box max-w-4xl bg-white border-2 border-line rounded-xl overflow-hidden shadow-2xl transition-all ${showDetails ? 'blur-sm scale-95 opacity-40 pointer-events-none' : ''}`}>
            <div className="modal-head py-4 px-6 border-b border-line bg-ink flex justify-between items-center text-white">
              <h3 className="font-black uppercase italic tracking-tighter text-xs flex items-center gap-2">
                <Contact className="w-5 h-5 text-brand-gold" /> ESTADO DE CUENTA MAESTRO: {showClientHistory}
              </h3>
              <button onClick={() => setShowClientHistory(null)} className="text-white hover:text-brand-gold"><X className="w-5 h-5"/></button>
            </div>
            <div className="modal-body p-0 max-h-[70vh] overflow-y-auto bg-white">
               <div className="table-wrap">
                  <table className="w-full">
                    <thead className="bg-surface-soft sticky top-0 z-10">
                      <tr>
                        <th className="text-[9px] font-black uppercase p-4 text-left">Fecha</th>
                        <th className="text-[9px] font-black uppercase p-4 text-left">ID Documento</th>
                        <th className="text-[9px] font-black uppercase p-4 text-right">Monto Total</th>
                        <th className="text-[9px] font-black uppercase p-4 text-right">Abonado</th>
                        <th className="text-[9px] font-black uppercase p-4 text-right">Saldo Pend.</th>
                        <th className="text-[9px] font-black uppercase p-4 text-center">Estado</th>
                        <th className="text-[9px] font-black uppercase p-4 text-center">Auditoría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.cxc.filter(d => d.cliente === showClientHistory).sort((a,b) => b.fecha.localeCompare(a.fecha)).map(d => (
                        <tr key={d.id} className="border-b border-line/30 hover:bg-surface-warm/20 transition-colors">
                          <td className="p-4 text-xs font-black">{Utils.fmtFecha(d.fecha)}</td>
                          <td className="p-4 text-xs font-black mono">{d.id}</td>
                          <td className="p-4 text-right text-xs font-black">{Utils.fmtUSD(d.montoUSD)}</td>
                          <td className="p-4 text-right text-xs font-black text-status-success">{Utils.fmtUSD(d.abonadoUSD)}</td>
                          <td className="p-4 text-right text-sm font-black text-brand-gold-deep">{Utils.fmtUSD(d.saldoUSD)}</td>
                          <td className="p-4 text-center">
                            <span className={`badge ${d.estado === 'pagada' ? 'badge-ok' : (d.estado === 'parcial' ? 'badge-info' : 'badge-warn')} font-black text-[8px] uppercase px-3`}>
                              {d.estado}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                             <button onClick={() => setShowDetails(d)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-status-success border-2 border-status-success/20 hover:bg-status-success hover:text-white transition-all shadow-md"><Eye className="w-5 h-5"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
            <div className="modal-foot p-4 bg-surface-soft border-t border-line text-right">
               <button onClick={() => setShowClientHistory(null)} className="btn btn-primary px-8 font-black uppercase text-[10px] rounded-lg shadow-md">Cerrar Historial</button>
            </div>
          </div>
        </div>
      )}

      {showPosAdjustment && (
        <div className="fixed inset-0 z-[170] bg-black/60 flex items-center justify-center p-4 animate-in fade-in-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-line">
            <div className="px-5 py-4 bg-surface-soft border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase text-ink">Ajustar inventario</h3>
                <p className="text-[9px] text-ink/50 font-bold uppercase mt-1">{currentTerminal?.nombre || 'Caja activa'}</p>
              </div>
              <button onClick={() => setShowPosAdjustment(false)} disabled={savingAdjustment} className="p-1 text-ink/60 hover:text-ink"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-black uppercase text-ink/60 block mb-1">Buscar producto</label>
                <input value={adjustmentSearch} onChange={e => { setAdjustmentSearch(e.target.value); setAdjustmentProductId(''); }} className="w-full h-11 px-4 bg-white border border-line rounded-xl text-sm font-bold outline-none focus:border-brand-gold" placeholder="Nombre, código o código de barras"/>
                <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-line divide-y divide-line">
                  {(state.productos || []).filter(p => p.activo && adjustmentSearch.trim().length > 0 && [p.nombre, p.codigo, p.barcode, p.internalCode, p.alternateCode, p.supplierCode].some(value => String(value || '').toLocaleLowerCase('es').includes(adjustmentSearch.trim().toLocaleLowerCase('es')))).slice(0,8).map(p => (
                    <button type="button" key={p.id} onClick={() => { setAdjustmentProductId(p.id); setAdjustmentSearch(p.nombre); }} className={`w-full p-3 text-left flex justify-between items-center hover:bg-brand-gold-soft ${adjustmentProductId === p.id ? 'bg-brand-gold-soft' : 'bg-white'}`}>
                      <span className="text-xs font-black uppercase text-ink min-w-0 truncate">{p.nombre}<span className="block text-[9px] text-ink/50">{p.codigo || p.barcode || p.internalCode || 'Sin código'}</span></span>
                      <span className="text-xs font-bold text-ink/60 shrink-0 ml-2">Stock: {p.stock}</span>
                    </button>
                  ))}
                </div>
                {adjustmentProductId && <p className="text-[10px] font-bold text-status-success mt-1">Seleccionado · Existencia: {state.productos.find(p => p.id === adjustmentProductId)?.stock ?? '—'}</p>}
                {adjustmentSearch.trim().length > 0 && !adjustmentProductId && !(state.productos || []).some(p => p.activo && [p.nombre, p.codigo, p.barcode, p.internalCode, p.alternateCode, p.supplierCode].some(value => String(value || '').toLocaleLowerCase('es').includes(adjustmentSearch.trim().toLocaleLowerCase('es')))) && <p className="text-[10px] text-status-danger mt-1">No se encontraron productos activos.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-ink/60 block mb-1">Tipo / motivo</label>
                  <select value={adjustmentType} onChange={e => setAdjustmentType(e.target.value as any)} className="form-select h-11 w-full text-xs font-bold">
                    <option value="consumo">Consumo propio</option>
                    <option value="colaboracion">Colaboración</option>
                    <option value="ajuste_salida">Salida (−)</option>
                    <option value="ajuste_entrada">Entrada (+)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-ink/60 block mb-1">Cantidad</label>
                  <input inputMode="decimal" value={adjustmentQty} onChange={e => setAdjustmentQty(e.target.value.replace(/[^0-9.,]/g,''))} className="w-full h-11 px-3 border border-line rounded-xl text-center font-black"/>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-ink/60 block mb-1">Detalle del motivo</label>
                <input value={adjustmentDetail} onChange={e => setAdjustmentDetail(e.target.value)} className="w-full h-11 px-4 border border-line rounded-xl text-xs font-bold uppercase" placeholder="Ej.: consumo de administración, colaboración..."/>
              </div>
              <button disabled={savingAdjustment || !adjustmentProductId || !(Number(String(adjustmentQty).replace(',','.')) > 0) || !adjustmentDetail.trim()} onClick={async () => {
                const product = (state.productos || []).find(p => p.id === adjustmentProductId);
                const qty = Number(String(adjustmentQty).replace(',','.'));
                if (!product || !currentTerminal?.id || !Utils.getTerminalCash(currentTerminal).isCashOpen || !Number.isFinite(qty) || qty <= 0) {
                  toast({ variant: 'destructive', title: 'Caja no disponible', description: 'Debe existir una caja identificada y abierta para registrar el ajuste.' });
                  return;
                }
                const signedQty = adjustmentType === 'ajuste_entrada' ? qty : -qty;
                if (signedQty < 0 && Number(product.stock) < qty) {
                  toast({ variant: 'destructive', title: 'Existencia insuficiente', description: 'No se puede registrar una salida superior al stock disponible.' });
                  return;
                }
                setSavingAdjustment(true);
                try {
                  const movement: Movimiento = {
                    id: Store.uid(), productoId: product.id, tipo: adjustmentType,
                    cantidad: signedQty, stockAntes: Number(product.stock) || 0,
                    stockDespues: (Number(product.stock) || 0) + signedQty,
                    fecha: Utils.ahora(),
                    referencia: (adjustmentType === 'consumo' ? 'CONSUMO PROPIO | ' : adjustmentType === 'colaboracion' ? 'COLABORACION | ' : 'AJUSTE | ') + adjustmentDetail.trim().toUpperCase(),
                    terminalId: currentTerminal.id
                  };
                  await Store.applyInventoryMovementsTransaction({
                    operationId: 'POS-AJUSTE-' + Store.uid(),
                    operationType: 'AJUSTE-INVENTARIO-POS',
                    movements: [movement],
                    productPatches: {}
                  });
                  toast({ title: 'Ajuste registrado', description: 'El movimiento quedó guardado en el inventario.' });
                  setShowPosAdjustment(false);
                  setAdjustmentProductId('');
                  setAdjustmentSearch('');
                  setAdjustmentDetail('');
                } catch (e: any) {
                  toast({ variant: 'destructive', title: 'No se pudo registrar el ajuste', description: e?.message || 'Turso no confirmó la operación.' });
                } finally {
                  setSavingAdjustment(false);
                }
              }} className="w-full h-12 rounded-xl bg-brand-gold text-ink font-black uppercase text-xs shadow-md disabled:opacity-50">{savingAdjustment ? 'Guardando…' : 'Procesar ajuste'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* AJUSTE MANUAL DE STOCK (POS) */}
      {/* ============================================================ */}
      {stockEdit && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 animate-in fade-in-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Ajustar Stock Manual</p>
              <p className="font-black text-sm text-ink uppercase leading-tight truncate">{stockEdit.nombre}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={stockEditValue}
                onChange={e => setStockEditValue(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && guardarStockManual()}
                className="flex-1 h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl font-black focus:ring-2 focus:ring-[#D4A017] outline-none text-center text-lg"
                autoFocus
              />
              <span className="text-[10px] font-black text-gray-400 uppercase">Und.</span>
            </div>
            <p className="text-[9px] font-bold text-gray-400 uppercase leading-tight">Stock actual: <b className="text-ink">{stockEdit.stock || 0}</b> Und.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStockEdit(null)} className="px-4 py-2 text-gray-400 font-bold hover:text-gray-600 transition-colors text-xs uppercase">Cancelar</button>
              <button onClick={guardarStockManual} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase hover:bg-blue-700 transition-all"><Check className="w-3.5 h-3.5 inline mr-1" />Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL DE CRÉDITO - AHORA RECIBE CLIENTES Y DEUDAS PARA MOSTRAR SALDO */}
      {/* ============================================================ */}
      <CreditModal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        onConfirm={handleCreditModalConfirm}
        totalAmount={subtotalUSD}
        {...({ 
          clients: state.clientes || [], 
          debts: state.cxc || [], 
          initialClientName: cliente 
        } as any)}
      />
    </div>
  );
}