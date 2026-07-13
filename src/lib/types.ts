export interface Product {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  departamento: string;
  cantidad: string;
  marca: string;
  costoUSD: number;
  precioUSD: number;
  precioEstandarUSD?: number;
  precioMayorUSD?: number;
  precioOfertaUSD?: number;
  precioPromoUSD?: number;
  tipoPrecioPrincipal?: 'estandar' | 'mayor' | 'oferta' | 'promo';
  margen: number;
  stock: number;
  stockMinimo: number;
  fechaCreacion: string;
  activo: boolean;
  aplicaIVA?: boolean;
  isKit?: boolean;
  kitType?: 'stock_propio' | 'stock_componentes';
  kitItems?: KitItem[];
  proveedor?: string;
}

export interface KitItem {
  productoId: string;
  nombre: string;
  cantidad: number;
}

export interface Movimiento {
  id: string;
  productoId: string;
  tipo: 'ajuste_entrada' | 'ajuste_salida' | 'consumo' | 'colaboracion' | 'compra' | 'venta' | 'devolucion' | 'cobro_deuda' | 'inicial';
  cantidad: number;
  stockAntes: number;
  stockDespues: number;
  fecha: string;
  referencia: string;
  terminalId?: string;
}

export interface SaleItem {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitUSD: number;
  subtotalUSD: number;
}

export interface PagoRealizado {
  metodo: PaymentMethod;
  montoUSD: number;
  montoBS: number;
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
  metodoPago: string;
  estado: string;
  type?: string;
  received?: number;
  change?: number;
  terminalId?: string;
  cajeroId?: string;
  payments?: PagoRealizado[];
}

export interface Customer {
  id: string;
  name: string;
  cedula: string;
  phone: string;
  address: string;
  debt: number;
}

export interface Debt {
  id: string;
  fecha: string;
  fechaVencimiento: string;
  cliente?: string;
  proveedor?: string;
  numeroFactura?: string;
  montoUSD: number;
  abonadoUSD: number;
  saldoUSD: number;
  estado: 'pendiente' | 'parcial' | 'pagada';
  historialPagos: Array<{
    fecha: string;
    montoUSD: number;
    montoBS: number;
    metodo: string;
    reciboId: string;
  }>;
  ventaId?: string;
  items?: any[];
  concepto?: string;
}

export interface LibroDiarioEntry {
  id: string;
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  categoria: string;
  concepto: string;
  montoUSD: number;
  montoBS: number;
  metodo: string;
  referencia: string;
}

export interface Terminal {
  id: string;
  nombre: string;
  usuarioId: string | null;
  activo: boolean;
  proximoRecibo: number;
}

export interface Supplier {
  id: string;
  nombre: string;
  rif: string;
  contacto: string;
  direccion: string;
  telefono: string;
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
  metodoReembolso: string;
  motivo: string;
}

export interface ReportZ {
  id: string;
  fecha: string;
  numeroZ: number;
  desdeFactura: string;
  hastaFactura: string;
  baseImponibleUSD: number;
  ivaUSD: number;
  exentoUSD: number;
  totalBrutoUSD: number;
  acumuladoHistoricoUSD: number;
}

export interface AppState {
  tasa: number;
  pinDevolucion: string;
  isInitialized?: boolean;
  productos: Product[];
  ventas: Sale[];
  cxc: Debt[];
  cxp: Debt[];
  clientes: Customer[];
  devoluciones: Return[];
  movimientos: Movimiento[];
  libroDiario: LibroDiarioEntry[];
  carrito: SaleItem[];
  terminales: Terminal[];
  reportesZ: ReportZ[];
  ultimoZ: number;
  proximoRecibo: number;
  proximaDevolucion: number;
  acumuladoHistorico: number;
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
  proveedores: Supplier[];
}

export type PaymentMethod = 'efectivo_usd' | 'efectivo_bs' | 'punto_venta' | 'biopago' | 'pagomovil' | 'zelle' | 'transferencia' | 'credito' | 'mixto' | 'otros' | 'nota_credito';

export function getProductBarcode(product: Product | any): string {
  return product?.codigo || product?.barcode || product?.sku || '';
}

export function getProductPrice(product: Product | any): number {
  return product?.precioUSD || product?.price || product?.precio || 0;
}
