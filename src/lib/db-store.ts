
"use client";

import { AppState } from './types';
import { db } from './firebase';
import { doc, setDoc, onSnapshot } from "firebase/firestore";

const STORAGE_KEY = 'posven_pro_session_data_cache';
const COLLECTION = 'pos_system_data';
const DOC_ID = 'state';

/**
 * Estado inicial del sistema.
 * Al resetear, el sistema volverá exactamente a estos valores.
 */
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
  libroDiario: [],
  carrito: [],
  terminales: [],
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
  proveedores: []
};

export const Store = {
  /**
   * Suscribe los componentes a los cambios en Firestore.
   * Si el documento no existe, lo inicializa con los valores por defecto.
   */
  subscribe(callback: (state: Partial<AppState>) => void) {
    if (typeof window === 'undefined' || !db) return () => {};

    const docRef = doc(db, COLLECTION, DOC_ID);
    
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.data();
        const merged = { ...initialState, ...val };
        // El carrito no se sincroniza en la nube por terminal, es local por sesión
        delete (merged as any).carrito; 
        callback(merged);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } else {
        // Si no existe en la nube, usamos el local o el inicial
        const local = Store.get();
        callback(local);
        
        // Inicializamos la nube si está vacía
        const { carrito, ...toPersist } = initialState;
        if (db) setDoc(docRef, toPersist).catch(e => console.error("Error init firestore:", e));
      }
    }, (error) => {
      console.warn("Firestore Sync Warning (Normal if Offline):", error);
      callback(Store.get());
    });
  },

  get(): AppState {
    if (typeof window === 'undefined') return initialState;
    const d = sessionStorage.getItem(STORAGE_KEY);
    if (!d) return initialState;
    try {
      const parsed = JSON.parse(d);
      return { ...initialState, ...parsed };
    } catch {
      return initialState;
    }
  },

  set(state: AppState) {
    if (typeof window === 'undefined') return;
    
    // Filtramos solo los datos que deben persistir en Firestore
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
      libroDiario: state.libroDiario || [],
      terminales: state.terminales || [],
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

    // Actualizamos cache local para velocidad inmediata
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, ...dataToPersist }));
    
    // Persistimos en Firestore (Asíncrono)
    if (db) {
      const docRef = doc(db, COLLECTION, DOC_ID);
      setDoc(docRef, dataToPersist).catch(err => {
          console.error("Firestore Write Error:", err);
      });
    }
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
      mixto: 'Mixto',
      otros: 'Otros'
    };
    return map[m] || m;
  }
};
