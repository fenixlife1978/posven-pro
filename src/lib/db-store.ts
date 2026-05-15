"use client";

import { Product, Customer, Sale, Receivable, CashSession } from './types';

const STORE_PREFIX = 'licorpos_elite_';

export const Store = {
  get<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    const saved = localStorage.getItem(STORE_PREFIX + key);
    if (!saved) return defaultValue;
    try {
      return JSON.parse(saved);
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
  },

  init() {
    const products = this.get<Product[]>('products', []);
    if (products.length === 0) {
      this.set('products', [
        {id:'P001', barcode:'7501000123456', name:'Ron Santa Teresa 1796', category:'Ron', price:850, stock:25, minStock:5, description:'Ron añejo premium'},
        {id:'P002', barcode:'7501000123457', name:'Whisky Johnnie Walker Black', category:'Whisky', price:1200, stock:18, minStock:5, description:'Whisky escocés 12 años'},
        {id:'P003', barcode:'7501000123458', name:'Vino Casillero del Diablo', category:'Vino', price:450, stock:40, minStock:10, description:'Vino tinto Cabernet Sauvignon'},
        {id:'P004', barcode:'7501000123459', name:'Cerveza Polar Pilsen 6pack', category:'Cerveza', price:180, stock:60, minStock:15, description:'Pack 6 cervezas'},
        {id:'P005', barcode:'7501000123460', name:'Vodka Absolut', category:'Vodka', price:650, stock:12, minStock:5, description:'Vodka sueco premium'}
      ]);
    }

    const customers = this.get<Customer[]>('customers', []);
    if (customers.length === 0) {
      this.set('customers', [
        {id:'C001', name:'Carlos Mendoza', cedula:'V-12345678', phone:'0414-1234567', address:'Av. Principal, Caracas', debt:0},
        {id:'C002', name:'María García', cedula:'V-87654321', phone:'0412-7654321', address:'Calle 5, Valencia', debt:1500}
      ]);
    }

    if (this.get('exchangeRate', 0) === 0) this.set('exchangeRate', 36.50);
  }
};
