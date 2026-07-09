export type PaymentMethod = 'efectivo_usd' | 'efectivo_bs' | 'punto_venta' | 'biopago' | 'pagomovil' | 'zelle' | 'credito' | 'mixto';
export type EntityStatus = 'completada' | 'cancelada' | 'pendiente' | 'parcial' | 'pagada' | 'parcialmente_devuelta' | 'totalmente_devuelta' | 'procesada';

export interface KitItem {
  productoId: string;
  nombre: string;
  cantidad: number;
}

export interface Movimiento {
  id: string;
  productoId: string;
  tipo: 'compra' | 'venta' | 'devolucion' | 'ajuste_entrada' | 'ajuste_salida' | 'consumo' | 'colaboracion' | 'cobro_deuda';
  cantidad: number;
  stockAntes: number;
  stockDespues: number;
  fecha: string;
  referencia: string;
}

export interface Product {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  departamento: string;
  cantidad: string;
  marca: string;
  costoUSD: number;
  precioUSD: number; // Precio activo para el POS
  precioEstandarUSD?: number;
  precioMayorUSD?: number;
  precioOfertaUSD?: number;
  precioPromoUSD?: number;
  tipoPrecioPrincipal?: 'estandar' | 'mayor' | 'oferta' | 'promo';
  margen: number;
  stock: number;
  stockMinimo: number;
  proveedor: string;
  fechaCreacion: string;
  activo: boolean;
  aplicaIVA?: boolean;
  isKit?: boolean;
  kitType?: 'stock_propio' | 'stock_componentes';
  kitItems?: KitItem[];
  // Alias para compatibilidad con código existente
  codigoBarras?: string;
  precio?: number;
}

export interface PagoRealizado {
  metodo: PaymentMethod;
  montoUSD: number;
  montoBS: number;
}

export interface SaleItem {
  productoId: string;
  nombre: string;
  precioUnitUSD: number;
  cantidad: number;
  subtotalUSD: number;
}

export interface Sale {
  id: string;
  fecha: string;
  cliente: string;
  items: SaleItem[];
  subtotalUSD: number;
  descuentoUSD: number;
  totalUSD: number;
  totalBS: number;
  metodoPago: PaymentMethod;
  estado: EntityStatus;
  type?: 'VENTA' | 'COBRO DEUDA' | 'DEVOLUCION';
  received?: number;
  change?: number;
  customerName?: string;
  cuentaCobrarId?: string | null;
  payments?: PagoRealizado[]; 
}

export interface ReturnItem {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitUSD: number;
  estadoProducto: 'REINTEGRADO_STOCK' | 'MERMA_DANADO';
}

export interface Return {
  id: string;
  ventaId: string;
  fecha: string;
  items: ReturnItem[];
  totalUSD: number;
  metodoReembolso: 'EFECTIVO' | 'MISMO_METODO' | 'CREDITO_TIENDA';
  motivo: string;
}

export interface ReportZ {
  id: string;
  fecha: string;
  numeroZ: number;
  desdeFactura: string;
  hastaFactura: string;
  baseImponibleUSD: number;
  exentoUSD: number;
  ivaUSD: number;
  totalBrutoUSD: number;
  acumuladoHistoricoUSD: number;
}

export interface Customer {
  id: string;
  name: string;
  cedula: string;
  phone?: string;
  address?: string;
  debt: number;
}

export interface CashSession {
  openDate: string;
  openAmount: number;
  openNotes: string;
  closeDate: string | null;
  closeAmount: number | null;
  closeNotes: string | null;
  totalSales: number;
  totalCollections: number;
  saleCount: number;
  difference?: number;
}

export interface AppState {
  tasa: number;
  productos: Product[];
  ventas: Sale[];
  cxc: any[];
  cxp: any[];
  clientes: Customer[];
  devoluciones: Return[];
  movimientos: Movimiento[];
  carrito: SaleItem[];
  empresa: {
    nombre: string;
    rif: string;
    direccion: string;
    telefono: string;
  };
  departamentos: string[];
  categorias: string[];
  marcas: string[];
  presentaciones: string[];
  proveedores: string[];
  reportesZ: ReportZ[];
  ultimoZ: number;
  proximoRecibo: number;
  acumuladoHistorico: number;
}

// Funciones de ayuda para trabajar con Product
export function getProductDisplayName(product: Product): string {
  return product.nombre;
}

export function getProductBarcode(product: Product): string {
  return product.codigoBarras || product.codigo || '';
}

export function getProductPrice(product: Product): number {
  return product.precio || product.precioUSD || 0;
}

export function getProductCategory(product: Product): string {
  return product.categoria;
}

export function getProductMinStock(product: Product): number {
  return product.stockMinimo || 0;
}

export function getProductStock(product: Product): number {
  return product.stock || 0;
}

// Helper para convertir Product a formato esperado por el PDF
export function normalizeProductForPDF(product: Product): {
  id: string;
  nombre: string;
  codigoBarras: string;
  categoria: string;
  precio: number;
  stock: number;
  stockMinimo: number;
} {
  return {
    id: product.id,
    nombre: product.nombre,
    codigoBarras: getProductBarcode(product),
    categoria: product.categoria,
    precio: getProductPrice(product),
    stock: product.stock || 0,
    stockMinimo: product.stockMinimo || 0,
  };
}

// Función helper para obtener el label del método de pago
export function getMetodoLabel(metodo: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    'efectivo_usd': 'Efectivo USD',
    'efectivo_bs': 'Efectivo BS',
    'punto_venta': 'Punto de Venta',
    'biopago': 'Biopago',
    'pagomovil': 'Pago Móvil',
    'zelle': 'Zelle',
    'credito': 'Crédito',
    'mixto': 'Mixto'
  };
  return labels[metodo] || metodo;
}

// Función helper para formatear moneda
export function fmtUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function fmtBS(amount: number): string {
  return `Bs. ${amount.toFixed(2)}`;
}

export function fmtFecha(fecha: string): string {
  if (!fecha) return '';
  const d = new Date(fecha);
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Funciones de utilidad para fechas
export function hoy(): string {
  return new Date().toISOString().split('T')[0];
}

export function ahora(): string {
  return new Date().toISOString();
}