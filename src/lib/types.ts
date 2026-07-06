
export type PaymentMethod = 'efectivo_usd' | 'efectivo_bs' | 'punto_venta' | 'transferencia' | 'credito' | 'mixto';
export type EntityStatus = 'completada' | 'cancelada' | 'pendiente' | 'parcial' | 'pagada' | 'parcialmente_devuelta' | 'totalmente_devuelta' | 'procesada';

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
  stock: number;
  stockMinimo: number;
  proveedor: string;
  fechaCreacion: string;
  activo: boolean;
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
  cuentaCobrarId?: string | null;
}

export interface Abono {
  fecha: string;
  montoUSD: number;
  montoBS: number;
  metodo: string;
}

export interface CxC {
  id: string;
  ventaId: string | null;
  cliente: string;
  montoUSD: number;
  montoBS: number;
  abonadoUSD: number;
  saldoUSD: number;
  fecha: string;
  fechaVencimiento: string;
  estado: EntityStatus;
  abonos: Abono[];
  notas: string;
}

export interface CxP {
  id: string;
  proveedor: string;
  concepto: string;
  montoUSD: number;
  montoBS: number;
  abonadoUSD: number;
  saldoUSD: number;
  fecha: string;
  fechaVencimiento: string;
  estado: EntityStatus;
  abonos: Abono[];
}

export interface Devolucion {
  id: string;
  ventaId: string;
  fecha: string;
  items: SaleItem[];
  totalUSD: number;
  totalBS: number;
  motivo: string;
  estado: EntityStatus;
}

export interface Movimiento {
  id: string;
  productoId: string;
  tipo: 'compra' | 'venta' | 'devolucion' | 'ajuste_entrada' | 'ajuste_salida' | 'consumo' | 'colaboracion';
  cantidad: number;
  stockAntes: number;
  stockDespues: number;
  fecha: string;
  referencia: string;
}

export interface AppState {
  tasa: number;
  productos: Product[];
  ventas: Sale[];
  cxc: CxC[];
  cxp: CxP[];
  devoluciones: Devolucion[];
  movimientos: Movimiento[];
  carrito: SaleItem[];
  empresa: {
    nombre: string;
    rif: string;
    direccion: string;
    telefono: string;
  };
}
