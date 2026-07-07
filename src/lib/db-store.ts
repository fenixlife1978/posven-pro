
"use client";

import { AppState } from './types';

const STORAGE_KEY = 'licoreriaPOS_v2';

export const initialState: AppState = {
  tasa: 36.50,
  productos: [],
  ventas: [],
  cxc: [],
  cxp: [],
  devoluciones: [],
  movimientos: [],
  carrito: [],
  empresa: { 
    nombre: 'Licorería El Buen Beber', 
    rif: 'J-12345678-9', 
    direccion: 'Av. Principal, Local 5', 
    telefono: '0412-1234567' 
  },
  departamentos: ['Licores', 'Viveres', 'Charcuteria', 'Tabaco', 'Snacks', 'Limpieza', 'Otros'],
  categorias: ['Whisky', 'Ron', 'Vino', 'Cerveza', 'Tequila', 'Champagne', 'Vodka', 'Gin', 'Licores', 'Cerveza Artesanal', 'Sin Alcohol', 'Otros'],
  marcas: ['Johnnie Walker', 'Santa Teresa', 'Pampero', 'Polar', 'Regional', 'Casillero del Diablo', 'Chivas Regal', 'Jack Daniel\'s']
};

export const Store = {
  get(): AppState {
    if (typeof window === 'undefined') return initialState;
    const d = localStorage.getItem(STORAGE_KEY);
    if (!d) return initialState;
    try {
      const parsed = JSON.parse(d);
      return { 
        ...initialState, 
        ...parsed,
        departamentos: parsed.departamentos || initialState.departamentos,
        categorias: parsed.categorias || initialState.categorias,
        marcas: parsed.marcas || initialState.marcas
      };
    } catch {
      return initialState;
    }
  },

  set(state: AppState) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  uid(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }
};

export const Utils = {
  hoy: () => new Date().toISOString().slice(0, 10),
  ahora: () => new Date().toISOString(),
  fmtUSD: (v: number) => '$' + Number(v).toFixed(2),
  fmtBS: (v: number) => 'Bs. ' + Number(v).toFixed(2),
  fmtFecha: (f: string) => {
    if (!f) return '-';
    const p = f.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  },
  metodoLabel: (m: string) => {
    const map: Record<string, string> = { 
      efectivo_usd: 'Efectivo USD', 
      efectivo_bs: 'Efectivo Bs.', 
      punto_venta: 'Punto de Venta', 
      biopago: 'Biopago',
      pagomovil: 'PagoMovil',
      zelle: 'Zelle',
      credito: 'Crédito', 
      mixto: 'Mixto' 
    };
    return map[m] || m;
  }
};
