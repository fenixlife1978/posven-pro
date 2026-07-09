"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  PieChart, 
  Package, 
  ShoppingCart, 
  HandCoins, 
  FileText, 
  BarChart, 
  Settings,
  Menu,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Bell
} from 'lucide-react';
import { Store, Utils, initialState } from '@/lib/db-store';
import { AppState } from '@/lib/types';
import DashboardModule from '@/components/modules/DashboardModule';
import InventoryModule from '@/components/modules/InventoryModule';
import SalesModule from '@/components/modules/SalesModule';
import CxCModule from '@/components/modules/CxCModule';
import CxPModule from '@/components/modules/CxPModule';
import ConfigModule from '@/components/modules/ConfigModule';

export default function LicoreriaPOS() {
  const [state, setState] = useState<AppState>(initialState);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  
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

    const updateTime = () => {
      const now = new Date();
      setCurrentTime(new Intl.DateTimeFormat('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(now).toUpperCase());
    };
    
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const updateState = (newState: Partial<AppState>) => {
    const updated = { ...state, ...newState };
    setState(updated);
    Store.set(updated);
  };

  const generateDemoData = (): AppState => {
    const hoyStr = Utils.hoy();
    const products = [
      { id: Store.uid(), codigo: 'WH-001', nombre: 'Johnnie Walker Black Label', categoria: 'Whisky', departamento: 'Licores', cantidad: '750ml', marca: 'Johnnie Walker', costoUSD: 28, precioUSD: 48, margen: 20, stock: 12, stockMinimo: 3, proveedor: 'Distribuidora Nacional', fechaCreacion: hoyStr, activo: true },
      { id: Store.uid(), codigo: 'RN-001', nombre: 'Santa Teresa 1796', categoria: 'Ron', departamento: 'Licores', cantidad: '750ml', marca: 'Santa Teresa', costoUSD: 30, precioUSD: 52, margen: 22, stock: 10, stockMinimo: 3, proveedor: 'Licorera Central', fechaCreacion: hoyStr, activo: true },
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
      case 'config': return <ConfigModule state={state} updateState={updateState} />;
      default: return <DashboardModule state={state} />;
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const menuGroups = [
    {
      id: 'operaciones',
      label: 'Operaciones',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: PieChart },
        { id: 'inventario', label: 'Inventario', icon: Package },
        { id: 'ventas', label: 'Ventas y Devoluciones', icon: ShoppingCart },
      ]
    },
    {
      id: 'finanzas',
      label: 'Finanzas',
      items: [
        { id: 'cxc', label: 'Cuentas por Cobrar', icon: HandCoins },
        { id: 'cxp', label: 'Cuentas por Pagar', icon: FileText },
      ]
    },
    {
      id: 'sistema',
      label: 'Sistema',
      items: [
        { id: 'config', label: 'Configuración', icon: Settings },
      ]
    }
  ];

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-[#0b0b0b] text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 w-[260px] h-screen bg-[#131313] border-r border-[#2a2a2a] flex flex-col z-[100] transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
        <div className="p-6 border-b border-[#2a2a2a] flex flex-col items-center">
          <div className="w-full relative mb-1 flex justify-center">
            <Image 
              src="https://picsum.photos/seed/posvenpro/200/80" 
              alt="PosVEN pro" 
              width={160}
              height={50}
              className="w-auto h-auto max-h-[45px] object-contain brightness-0 invert"
              priority
              data-ai-hint="posven logo"
            />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c8952e] mt-2">Professional POS</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-4">
          {menuGroups.map((group) => (
            <div key={group.id} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/40 hover:text-[#c8952e] transition-colors"
              >
                {group.label}
                {expandedGroups[group.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              
              <div className={`space-y-1 overflow-hidden transition-all ${expandedGroups[group.id] ? 'max-h-[500px]' : 'max-h-0'}`}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { 
                        setActiveModule(item.id); 
                        if(window.innerWidth < 1024) setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${active ? 'bg-[#c8952e] text-[#0b0b0b] shadow-lg shadow-[#c8952e]/20' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="p-6 border-t border-[#2a2a2a] bg-black/20">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] font-black text-white/40 uppercase">Tasa BCV</span>
            <span className="px-2 py-1 bg-[#c8952e]/10 border border-[#c8952e]/30 text-[#c8952e] text-[10px] font-black rounded">
              {state.tasa.toFixed(2)} BS
            </span>
          </div>
          <button className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-[#e04848] hover:bg-[#e04848]/10 rounded-lg transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 bg-[#131313] border-b border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-white/60 hover:bg-white/5 rounded-full" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">{activeModule}</h2>
              <p className="text-[9px] text-white/40 uppercase font-bold">{currentTime}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-[#2a2a2a] rounded-full">
               <div className="w-1.5 h-1.5 rounded-full bg-[#27ae60] animate-pulse" />
               <span className="text-[9px] font-black text-white/60 uppercase">Terminal Activo</span>
             </div>
             <button className="p-2 text-white/40 hover:bg-white/5 rounded-full relative">
               <Bell className="w-5 h-5" />
               <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#e04848] rounded-full" />
             </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {renderModule()}
        </div>
      </main>
    </div>
  );
}