
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
  precioUSD: number;
  margen: number;
  stock: number;
  stockMinimo: number;
  proveedor: string;
  fechaCreacion: string;
  activo: boolean;
  isKit?: boolean;
  kitType?: 'stock_propio' | 'stock_componentes';
  kitItems?: KitItem[];
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
  phone: string;
  address: string;
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
  devoluciones: any[];
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
  reportesZ: ReportZ[];
  ultimoZ: number;
  proximoRecibo: number;
  acumuladoHistorico: number;
}
