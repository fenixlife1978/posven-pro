
"use client";

import React, { useState, useEffect } from 'react';
import { 
  Wine, 
  PieChart, 
  Package, 
  ShoppingCart, 
  HandCoins, 
  FileText, 
  RotateCcw, 
  BarChart, 
  Settings,
  Menu
} from 'lucide-react';
import { Store, Utils, initialState } from '@/lib/db-store';
import { AppState } from '@/lib/types';
import DashboardModule from '@/components/modules/DashboardModule';
import InventoryModule from '@/components/modules/InventoryModule';
import SalesModule from '@/components/modules/SalesModule';
import CxCModule from '@/components/modules/CxCModule';
import CxPModule from '@/components/modules/CxPModule';
import ReturnsModule from '@/components/modules/ReturnsModule';
import ReportsModule from '@/components/modules/ReportsModule';
import ConfigModule from '@/components/modules/ConfigModule';

export default function LicoreriaPOS() {
  const [state, setState] = useState<AppState>(initialState);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const loadedState = Store.get();
    
    // Initial data if empty
    if (loadedState.productos.length === 0) {
      const demoData = generateDemoData();
      Store.set(demoData);
      setState(demoData);
    } else {
      setState(loadedState);
    }
  }, []);

  const updateState = (newState: Partial<AppState>) => {
    const updated = { ...state, ...newState };
    setState(updated);
    Store.set(updated);
  };

  const generateDemoData = (): AppState => {
    const hoy = Utils.hoy();
    const products = [
      { id: Store.uid(), codigo: 'WH-001', nombre: 'Johnnie Walker Black Label', categoria: 'Whisky', cantidad: '750ml', marca: 'Johnnie Walker', costoUSD: 28, precioUSD: 48, stock: 12, stockMinimo: 3, proveedor: 'Distribuidora Nacional', fechaCreacion: hoy, activo: true },
      { id: Store.uid(), codigo: 'RN-001', nombre: 'Santa Teresa 1796', categoria: 'Ron', cantidad: '750ml', marca: 'Santa Teresa', costoUSD: 30, precioUSD: 52, stock: 10, stockMinimo: 3, proveedor: 'Licorera Central', fechaCreacion: hoy, activo: true },
      { id: Store.uid(), codigo: 'VN-001', nombre: 'Casillero del Diablo Reserva', categoria: 'Vino', cantidad: '750ml', marca: 'Casillero del Diablo', costoUSD: 8, precioUSD: 16, stock: 20, stockMinimo: 6, proveedor: 'Bodegas del Sur', fechaCreacion: hoy, activo: true },
    ];
    return { ...initialState, productos: products };
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <DashboardModule state={state} />;
      case 'inventario': return <InventoryModule state={state} updateState={updateState} />;
      case 'ventas': return <SalesModule state={state} updateState={updateState} />;
      case 'cxc': return <CxCModule state={state} updateState={updateState} />;
      case 'cxp': return <CxPModule state={state} updateState={updateState} />;
      case 'devoluciones': return <ReturnsModule state={state} updateState={updateState} />;
      case 'reportes': return <ReportsModule state={state} />;
      case 'config': return <ConfigModule state={state} updateState={updateState} />;
      default: return <DashboardModule state={state} />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
    { type: 'sep' },
    { id: 'cxc', label: 'Cuentas por Cobrar', icon: HandCoins },
    { id: 'cxp', label: 'Cuentas por Pagar', icon: FileText },
    { id: 'devoluciones', label: 'Devoluciones', icon: RotateCcw },
    { type: 'sep' },
    { id: 'reportes', label: 'Reportes', icon: BarChart },
    { id: 'config', label: 'Configuracion', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#0b0b0b] text-[#ece7df]">
      {/* SIDEBAR */}
      <aside className={`fixed top-0 left-0 w-[260px] h-screen bg-[#131313] border-r border-[#2a2a2a] flex flex-col z-[100] transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-[#2a2a2a]">
          <h1 className="flex items-center gap-2 font-display text-xl font-bold text-[#c8952e] tracking-tighter">
            <Wine className="w-6 h-6" /> LicoreriaPOS
          </h1>
          <p className="text-[0.75rem] text-[#5a5650] mt-1">Sistema de punto de venta</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item, idx) => {
            if (item.type === 'sep') return <div key={idx} className="h-[1px] bg-[#2a2a2a] my-2 mx-3" />;
            const Icon = item.icon!;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveModule(item.id!); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-md text-sm font-medium transition-all relative ${active ? 'text-[#c8952e] bg-[rgba(200,149,46,0.08)]' : 'text-[#8a847c] hover:bg-[#181818] hover:text-[#ece7df]'}`}
              >
                {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#c8952e] rounded-r" />}
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-[#2a2a2a] text-[0.8rem] text-[#5a5650]">
          Tasa: <span className="text-[#c8952e] font-bold font-display">{state.tasa.toFixed(2)}</span> BS/USD
        </div>
      </aside>

      {/* OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-[90] md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 md:ml-[260px] flex flex-col min-h-screen">
        <header className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#131313] sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 text-[#8a847c] hover:text-[#ece7df]" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-display text-lg font-semibold capitalize">{activeModule}</h2>
          </div>
          <span className="text-[0.78rem] text-[#5a5650]">
            {mounted ? new Date().toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
          </span>
        </header>
        
        <div className="p-6 md:p-8 flex-1 animate-in fade-in duration-300">
          {mounted ? renderModule() : null}
        </div>
      </main>
    </div>
  );
}
