"use client";

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  HandCoins, 
  FileText, 
  RotateCcw, 
  BarChart3, 
  Settings,
  Users,
  Menu,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar as CalendarIcon,
  Bell,
  RefreshCw,
  Plus
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
    finanzas: true,
    sistema: true
  });

  useEffect(() => {
    setMounted(true);
    const loadedState = Store.get();
    setState(loadedState);
  }, []);

  const updateState = (newState: Partial<AppState>) => {
    const updated = { ...state, ...newState };
    setState(updated);
    Store.set(updated);
  };

  const handleModuleChange = (moduleId: string) => {
    setActiveModule(moduleId);
    setIsSidebarOpen(false); // Ocultar sidebar después de seleccionar
  };

  const menuGroups = [
    {
      id: 'operaciones',
      label: 'Operaciones',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'inventario', label: 'Inventario', icon: Package, count: state.productos.length },
        { id: 'ventas', label: 'Ventas', icon: ShoppingCart, count: state.ventas.filter(v => v.fecha.startsWith(Utils.hoy())).length },
      ]
    },
    {
      id: 'finanzas',
      label: 'Finanzas',
      items: [
        { id: 'cxc', label: 'Cuentas por Cobrar', icon: HandCoins, count: state.cxc.filter(x => x.estado !== 'pagada').length },
        { id: 'cxp', label: 'Cuentas por Pagar', icon: FileText },
        { id: 'devoluciones', label: 'Devoluciones', icon: RotateCcw },
      ]
    },
    {
      id: 'sistema',
      label: 'Sistema',
      items: [
        { id: 'reportes', label: 'Reportes', icon: BarChart3 },
        { id: 'config', label: 'Configuración', icon: Settings },
        { id: 'usuarios', label: 'Usuarios', icon: Users },
      ]
    }
  ];

  const renderModule = () => {
    if (!mounted) return null;
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

  return (
    <div className="flex min-h-screen bg-surface-warm text-ink">
      {/* SIDEBAR */}
      <aside className={`fixed lg:sticky top-0 left-0 w-[260px] h-screen bg-white border-r border-line flex flex-col z-50 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-line flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-ink border border-brand-gold rounded-[10px] flex items-center justify-center font-black text-brand-gold text-lg shadow-sm">
              P
            </div>
            <div>
              <div className="font-display font-[800] text-lg leading-none">
                Pos<span className="text-brand-gold">VEN</span> Pro
              </div>
              <div className="text-[0.68rem] font-bold text-ink-subtle uppercase tracking-widest mt-1">
                Soluciones Venezuela
              </div>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {menuGroups.map((group) => (
            <div key={group.id} className="space-y-1">
              <div className="px-2.5 mb-2 text-[0.66rem] font-bold text-ink-subtle uppercase tracking-[0.18em]">
                {group.label}
              </div>
              
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleModuleChange(item.id)}
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-[10px] text-[0.9rem] font-semibold transition-all group relative ${active ? 'bg-brand-gold-soft text-brand-gold-deep' : 'text-ink-muted hover:bg-surface-soft hover:text-ink'}`}
                    >
                      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-gold rounded-r-full" />}
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${active ? 'text-brand-gold-deep' : 'text-ink-subtle group-hover:text-ink'}`} />
                        {item.label}
                      </div>
                      {item.count !== undefined && (
                        <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-bold ${active ? 'bg-brand-gold text-white' : 'bg-surface-soft text-ink-muted'}`}>
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="p-4 border-t border-line bg-surface-warm/50">
          <div className="bg-brand-gold-soft border border-[#EFD9A4] rounded-lg p-3 flex items-center gap-3 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-gradient-to-b from-[#FFD700] via-[#003893] to-[#CF142B] border border-white/20 shadow-inner flex items-center justify-center overflow-hidden">
              <div className="w-full h-full bg-white/10" />
            </div>
            <div className="flex-1">
              <div className="text-[0.62rem] font-bold text-brand-gold-deep uppercase tracking-widest leading-none mb-1">Tasa BCV</div>
              <div className="font-display font-[800] text-sm text-ink">{state.tasa.toFixed(2)} <span className="text-[0.7rem] font-bold opacity-60">Bs/USD</span></div>
            </div>
            <button className="text-brand-gold-deep hover:rotate-180 transition-transform duration-500">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        {/* TOPBAR */}
        <header className="sticky top-0 z-30 bg-surface-warm/85 backdrop-blur-md border-b border-line px-7 py-3.5 flex items-center gap-6 no-print">
          <button className="lg:hidden p-2 -ml-2 text-ink" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="w-[18px] h-[18px]" />
          </button>
          
          <div className="hidden sm:block">
            <h2 className="font-display text-lg font-[800] text-ink leading-tight capitalize">
              {activeModule === 'dashboard' ? 'Dashboard' : activeModule}
            </h2>
            <p className="text-[0.7rem] text-ink-subtle uppercase font-bold tracking-widest">
              Resumen general del negocio
            </p>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button className="relative w-[38px] h-[38px] rounded-[10px] bg-white border border-line flex items-center justify-center text-ink-muted hover:text-brand-gold transition-colors shadow-sm-card">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-status-danger rounded-full border-2 border-white" />
            </button>

            <div className="flex items-center gap-2.5 pl-3 border-l border-line ml-1">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-ink leading-none">Mariana R.</div>
                <div className="text-[0.66rem] font-bold text-ink-subtle uppercase mt-1 tracking-wider">Administrador</div>
              </div>
              <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-brand-gold to-[#E7B857] flex items-center justify-center text-white font-black text-xs border border-white shadow-sm">
                MR
              </div>
            </div>
          </div>
        </header>
        
        {/* MODULE CONTAINER */}
        <div className="p-7 flex-1">
          {renderModule()}
        </div>

        {/* FOOTER */}
        <footer className="px-8 py-6 border-t border-line text-[0.76rem] font-bold text-ink-subtle flex flex-col sm:flex-row justify-between gap-4 no-print bg-surface-warm/30">
          <div>© 2026 PosVEN Pro · Sistema administrativo para Venezuela</div>
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" /> SENIAT Conectado</span>
            <span className="px-2 py-0.5 bg-surface-soft rounded text-[0.65rem]">v2.4.0</span>
          </div>
        </footer>
      </main>

      {/* MOBILE DRAWER OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-ink/40 z-[45] backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  );
}