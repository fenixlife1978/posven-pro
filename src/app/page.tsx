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
  Menu,
  ChevronDown,
  ChevronRight,
  LayoutDashboard
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
  
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    operaciones: true,
    finanzas: false,
    sistema: false
  });

  useEffect(() => {
    setMounted(true);
    const loadedState = Store.get();
    
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
    const hoyStr = Utils.hoy();
    const products = [
      { id: Store.uid(), codigo: 'WH-001', nombre: 'Johnnie Walker Black Label', categoria: 'Whisky', cantidad: '750ml', marca: 'Johnnie Walker', costoUSD: 28, precioUSD: 48, stock: 12, stockMinimo: 3, proveedor: 'Distribuidora Nacional', fechaCreacion: hoyStr, activo: true },
      { id: Store.uid(), codigo: 'RN-001', nombre: 'Santa Teresa 1796', categoria: 'Ron', cantidad: '750ml', marca: 'Santa Teresa', costoUSD: 30, precioUSD: 52, stock: 10, stockMinimo: 3, proveedor: 'Licorera Central', fechaCreacion: hoyStr, activo: true },
      { id: Store.uid(), codigo: 'VN-001', nombre: 'Casillero del Diablo Reserva', categoria: 'Vino', cantidad: '750ml', marca: 'Casillero del Diablo', costoUSD: 8, precioUSD: 16, stock: 20, stockMinimo: 6, proveedor: 'Bodegas del Sur', fechaCreacion: hoyStr, activo: true },
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

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const menuGroups = [
    {
      id: 'operaciones',
      label: 'Operaciones',
      icon: LayoutDashboard,
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: PieChart },
        { id: 'inventario', label: 'Inventario', icon: Package },
        { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
      ]
    },
    {
      id: 'finanzas',
      label: 'Finanzas',
      icon: HandCoins,
      items: [
        { id: 'cxc', label: 'Cuentas por Cobrar', icon: HandCoins },
        { id: 'cxp', label: 'Cuentas por Pagar', icon: FileText },
        { id: 'devoluciones', label: 'Devoluciones', icon: RotateCcw },
      ]
    },
    {
      id: 'sistema',
      label: 'Sistema',
      icon: Settings,
      items: [
        { id: 'reportes', label: 'Reportes', icon: BarChart },
        { id: 'config', label: 'Configuración', icon: Settings },
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-[#0b0b0b] text-[#ece7df] overflow-hidden">
      <aside className={`fixed top-0 left-0 w-[260px] h-screen bg-[#131313] border-r border-[#2a2a2a] flex flex-col z-[100] transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-6 border-b border-[#2a2a2a]">
          <h1 className="flex items-center gap-2 font-display text-xl font-bold text-[#c8952e] tracking-tighter">
            <Wine className="w-6 h-6" /> LicoreriaPOS
          </h1>
          <p className="text-[0.75rem] text-[#5a5650] mt-1">Sistema de punto de venta</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-3 space-y-2">
          {menuGroups.map((group) => (
            <div key={group.id} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between p-2 rounded-md text-[0.7rem] font-bold uppercase tracking-widest text-[#5a5650] hover:text-[#8a847c] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <group.icon className="w-3.5 h-3.5" />
                  {group.label}
                </span>
                {expandedGroups[group.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedGroups[group.id] ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="space-y-1 mt-1 pl-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeModule === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { 
                          setActiveModule(item.id); 
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-md text-sm font-medium transition-all relative ${active ? 'text-[#c8952e] bg-[rgba(200,149,46,0.08)]' : 'text-[#8a847c] hover:bg-[#181818] hover:text-[#ece7df]'}`}
                      >
                        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#c8952e] rounded-r" />}
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </nav>
        
        <div className="p-4 border-t border-[#2a2a2a] text-[0.8rem] text-[#5a5650]">
          Tasa: <span className="text-[#c8952e] font-bold font-display">{state.tasa.toFixed(2)}</span> BS/USD
        </div>
      </aside>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main className="flex-1 flex flex-col h-screen overflow-hidden md:ml-[260px]">
        <header className="flex items-center justify-between p-3 border-b border-[#2a2a2a] bg-[#131313] shrink-0">
          <div className="flex items-center gap-3">
            <button className="p-2 text-[#8a847c] hover:text-[#ece7df] md:hidden" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-display text-base font-semibold capitalize text-[#c8952e] tracking-widest">{activeModule}</h2>
          </div>
          <span className="text-[0.7rem] text-[#5a5650] uppercase font-bold tracking-tighter">
            {mounted ? new Date().toLocaleDateString('es', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : ''}
          </span>
        </header>
        
        <div className="p-3 md:p-4 flex-1 overflow-y-auto">
          {mounted ? renderModule() : null}
        </div>
      </main>
    </div>
  );
}
