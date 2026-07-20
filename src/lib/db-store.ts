'use client';

import { AppState } from './types';
import { db } from './firebase';
import { doc, setDoc, onSnapshot } from "firebase/firestore";

const STORAGE_KEY = 'posven_pro_session_data_cache';
const COLLECTION = 'pos_system_data';
const DOC_ID = 'state';

export const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  tasa: 36.50,
  pinDevolucion: '000000',
  isInitialized: false,
  productos: [],
  ventas: [],
  cxc: [],
  cxp: [],
  clientes: [],
  devoluciones: [],
  anulaciones: [],
  movimientos: [],
  libroDiario: [],
  carrito: [],
  terminales: [],
  reportesZ: [],
  ultimoZ: 0,
  proximoRecibo: 1,
  proximaDevolucion: 1,
  proximaAnulacion: 1,
  acumuladoHistorico: 0,
  fechaUltimoZ: '',
  fondoCajaHoyUSD: 0,
  fondoCajaHoyBS: 0,
  empresa: { 
    nombre: 'NOMBRE DE SU NEGOCIO', 
    rif: 'J-00000000-0', 
    direccion: 'DIRECCIÓN FISCAL', 
    telefono: '0000-0000000' 
  },
  // DEPARTAMENTOS Y CATEGORÍAS EXISTENTES
  departamentos: ['Licores', 'Viveres', 'Otros'],
  categorias: ['Ron', 'Vino', 'Cerveza', 'Whisky', 'Refrescos', 'Otros'],
  marcas: ['Genérica'],
  presentaciones: ['750ml', '1L', 'Unidad', 'Caja'],
  proveedores: [],
  
  // ========== NUEVAS PROPIEDADES PARA ProductForm ==========
  // Configuración general
  config: {
    exchangeRate: 36.50,
    ivaRate: 16,
    igtfRate: 3
  },
  
  // Listas para el formulario de productos
  productCategories: ['Repuesto', 'Lubricante', 'Filtro', 'Químico', 'Accesorio', 'Batería', 'Caucho', 'Freno', 'Suspensión', 'Motor', 'Eléctrico', 'Transmisión', 'Servicio'],
  productUnits: ['unidad', 'litro', 'galón', 'cuarto', 'paila', 'kit', 'juego', 'par', 'metro', 'kilogramo', 'gramo', 'tambor'],
  productColors: ['No Aplica', 'Negro', 'Gris', 'Cromo', 'Rojo', 'Azul', 'Blanco', 'Ámbar'],
  productSizes: ['N/A', 'Estándar', '0.10', '0.20', '0.30', '0.40', '0.50', '20', '30', '40', '50', '60'],
  
  // Colecciones para el formulario (con estructura de objetos con id)
  brands: [], // { id: 1, name: 'Toyota' }
  groups: [], // { id: 1, name: 'Tren Delantero' }
  subgroups: [], // { id: 1, name: 'Amortiguadores', groupId: 1 }
  lines: [], // { id: 1, name: 'Línea Pesada' }
  suppliers: [], // { id: 1, name: 'Proveedor XYZ', code: 'RIF-123' }
  
  // Para compatibilidad con código existente que usa arrays de strings
  // Estos se mantienen pero ahora también tenemos las versiones con objetos
  marcasString: ['Genérica'],
  proveedoresString: [],
  
  // Para almacenar los productos con estructura completa
  products: [],
};

export const Store = {
  subscribe(callback: (state: Partial<AppState>) => void) {
    if (typeof window === 'undefined' || !db) return () => {};

    const docRef = doc(db, COLLECTION, DOC_ID);
    
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.data();
        const merged = { ...initialState, ...val };
        delete (merged as any).carrito; 
        callback(merged);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } else {
        const local = Store.get();
        callback(local);
        
        const { carrito, ...toPersist } = initialState;
        if (db) setDoc(docRef, toPersist).catch(e => console.error("Error init firestore:", e));
      }
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.warn("Firestore Sync Warning:", error);
      }
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

  async set(state: AppState) {
    if (typeof window === 'undefined') return;
    
    const dataToPersist = {
      tasa: state.tasa,
      pinDevolucion: state.pinDevolucion,
      isInitialized: state.isInitialized ?? true,
      productos: state.productos || [],
      ventas: state.ventas || [],
      cxc: state.cxc || [],
      cxp: state.cxp || [],
      clientes: state.clientes || [],
      devoluciones: state.devoluciones || [],
      anulaciones: state.anulaciones || [],
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
      proximaAnulacion: state.proximaAnulacion || 1,
      acumuladoHistorico: state.acumuladoHistorico || 0,
      fechaUltimoZ: state.fechaUltimoZ || '',
      fondoCajaHoyUSD: state.fondoCajaHoyUSD || 0,
      fondoCajaHoyBS: state.fondoCajaHoyBS || 0,
      
      // ========== NUEVAS PROPIEDADES PARA ProductForm ==========
      config: state.config || initialState.config,
      productCategories: state.productCategories || initialState.productCategories,
      productUnits: state.productUnits || initialState.productUnits,
      productColors: state.productColors || initialState.productColors,
      productSizes: state.productSizes || initialState.productSizes,
      brands: state.brands || [],
      groups: state.groups || [],
      subgroups: state.subgroups || [],
      lines: state.lines || [],
      suppliers: state.suppliers || [],
      products: state.products || [],
      marcasString: state.marcasString || state.marcas || [],
      proveedoresString: state.proveedoresString || state.proveedores || [],
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, ...dataToPersist }));
    
    if (db) {
      const docRef = doc(db, COLLECTION, DOC_ID);
      return await setDoc(docRef, dataToPersist);
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
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}.${ms}`;
  },
  hoy: () => Utils.getVzlaDate().slice(0, 10),
  ahora: () => Utils.getVzlaDate(),
  round: (v: any) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : Math.round((n + Number.EPSILON) * 100) / 100;
  },
  fmtUSD: (v: number) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  fmtBS: (v: number, symbol = true) => (symbol ? 'Bs. ' : '') + Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  fmtMono: (v: number, prefix = false) => (prefix ? '$' : '') + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
      nota_credito: 'Vale / Nota Crédito',
      otros: 'Otros'
    };
    return map[m] || m;
  }
};