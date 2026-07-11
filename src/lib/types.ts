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
}

export interface Sale {
  id: string;
  fecha: string;
  cliente: string;
  items: Array<{
    productoId: string;
    nombre: string;
    cantidad: number;
    precioUnitUSD: number;
    subtotalUSD: number;
  }>;
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
  items?: any[];
}

export type PaymentMethod = 'efectivo_usd' | 'efectivo_bs' | 'punto_venta' | 'biopago' | 'pagomovil' | 'zelle' | 'transferencia';
