"use client";

import { AppState } from './types';
import { rtdb } from './firebase';
import { ref, set, onValue, off } from "firebase/database";

const STORAGE_KEY = 'licoreriaPOS_v2_cache';
const RTDB_PATH = 'pos_system_data';

export const initialState: AppState = {
  tasa: 36.50,
  pinDevolucion: '000000',
  productos: [],
  ventas: [],
  cxc: [],
  cxp: [],
  clientes: [],
  devoluciones: [],
  movimientos: [],
  carrito: [],
  reportesZ: [],
  ultimoZ: 0,
  proximoRecibo: 1,
  proximaDevolucion: 1,
  acumuladoHistorico: 0,
  empresa: { 
    nombre: 'NOMBRE DE SU NEGOCIO', 
    rif: 'J-00000000-0', 
    direccion: 'DIRECCIÓN FISCAL', 
    telefono: '0000-0000000' 
  },
  departamentos: ['Licores', 'Viveres', 'Otros'],
  categorias: ['Ron', 'Vino', 'Cerveza', 'Whisky', 'Refrescos', 'Otros'],
  marcas: ['Genérica'],
  presentaciones: ['750ml', '1L', 'Unidad', 'Caja'],
  proveedores: ['Distribuidor General']
};

export const Store = {
  // Suscribirse a cambios en tiempo real
  subscribe(callback: (state: Partial<AppState>) => void) {
    const dataRef = ref(rtdb, RTDB_PATH);
    onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        // Combinar con initialState para asegurar que todos los campos existan
        const merged = { ...initialState, ...val };
        // El carrito NO se sincroniza, es local por pestaña
        delete (merged as any).carrito; 
        callback(merged);
        // Guardar cache local
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } else {
        // Si la DB está vacía, inicializar con el estado base
        // Solo en el primer arranque del sistema
        const local = localStorage.getItem(STORAGE_KEY);
        const data = local ? JSON.parse(local) : initialState;
        // Omitimos carrito para la DB
        const { carrito, ...toPersist } = data;
        set(dataRef, toPersist);
        callback(toPersist);
      }
    }, (error) => {
      console.error("RTDB Sync Error:", error);
    });
    return () => off(dataRef);
  },

  get(): AppState {
    if (typeof window === 'undefined') return initialState;
    const d = localStorage.getItem(STORAGE_KEY);
    if (!d) return initialState;
    try {
      return JSON.parse(d);
    } catch {
      return initialState;
    }
  },

  set(state: AppState) {
    if (typeof window === 'undefined') return;
    
    // Definimos qué datos son globales y deben persistir en la nube
    const dataToPersist = {
      tasa: state.tasa,
      pinDevolucion: state.pinDevolucion,
      productos: state.productos || [],
      ventas: state.ventas || [],
      cxc: state.cxc || [],
      cxp: state.cxp || [],
      clientes: state.clientes || [],
      devoluciones: state.devoluciones || [],
      movimientos: state.movimientos || [],
      empresa: state.empresa,
      departamentos: state.departamentos,
      categorias: state.categorias,
      marcas: state.marcas,
      presentaciones: state.presentaciones,
      proveedores: state.proveedores,
      reportesZ: state.reportesZ || [],
      ultimoZ: state.ultimoZ || 0,
      proximoRecibo: state.proximoRecibo || 1,
      proximaDevolucion: state.proximaDevolucion || 1,
      acumuladoHistorico: state.acumuladoHistorico || 0
    };

    // Persistencia local
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToPersist));
    
    // Persistencia en la nube (RTDB)
    const dataRef = ref(rtdb, RTDB_PATH);
    set(dataRef, dataToPersist).catch(err => console.error("Error RTDB Write:", err));
  },

  uid(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }
};

export const Utils = {
  getVzlaDate: () => {
    const d = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
  },
  hoy: () => Utils.getVzlaDate().slice(0, 10),
  ahora: () => Utils.getVzlaDate(),
  round: (v: any) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : Math.round((n + Number.EPSILON) * 100) / 100;
  },
  fmtUSD: (v: number) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  fmtBS: (v: number) => 'Bs. ' + Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  fmtFecha: (f: string) => {
    if (!f) return '-';
    const datePart = f.includes('T') ? f.split('T')[0] : f;
    const p = datePart.split('-');
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