export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
  description: string;
}

export interface Customer {
  id: string;
  name: string;
  cedula: string;
  phone: string;
  address: string;
  debt: number;
}

export interface CartItem {
  productId: string;
  barcode: string;
  name: string;
  price: number;
  qty: number;
  maxStock: number;
}

export type PaymentMethod = 'EFECTIVO BS' | 'TARJETA' | 'USD EFECTIVO' | 'BIOPAGO' | 'PAGO MÓVIL' | 'ZELLE';

export interface Payment {
  date: string;
  amount: number;
  method: PaymentMethod;
  notes?: string;
}

export interface Sale {
  id: string;
  date: string;
  type: 'CONTADO' | 'CRÉDITO';
  paymentMethod: PaymentMethod | 'CRÉDITO';
  items: CartItem[];
  totalBS: number;
  totalUSD: number;
  received: number;
  change: number;
  customerId?: string | null;
  customerName?: string;
  paid: number;
  balance: number;
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

export interface Receivable extends Omit<Sale, 'received' | 'change'> {
  customerCedula: string;
  status: 'pending' | 'paid' | 'partial';
  payments: Payment[];
}
