
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  RefreshCw,
  Wifi,
  WifiOff,
  Clock as ClockIcon,
  ShoppingBag,
  LogOut,
  Bell,
  ShieldCheck
} from 'lucide-react';
import { Store, Utils, initialState } from '@/lib/db-store';
import { AppState } from '@/lib/types';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import DashboardModule from '@/components/modules/DashboardModule';
import InventoryModule from '@/components/modules/InventoryModule';
import SalesModule from '@/components/modules/SalesModule';
import PurchaseModule from '@/components/modules/PurchaseModule';
import CxCModule from '@/components/modules/CxCModule';
import CxPModule from '@/components/modules/CxPModule';
import ReportsModule from '@/components/modules/ReportsModule';
import ConfigModule from '@/components/modules/ConfigModule';
import UsersModule from '@/components/modules/UsersModule';
import GlobalControlModule from '@/components/modules/GlobalControlModule';

export default function LicoreriaPOS() {
  const router = useRouter();
  const [state, setState] = useState<AppState>(initialState);
  
  // Persistencia de módulo activo
  const [activeModule, setActiveModule] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('posven_active_module') || '';
    }
    return '';
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Persistencia de estado de apertura
  const [showApertura, setShowApertura] = useState(false);
  const [aperturaData, setAperturaData] = useState({ bs: '0', usd: '0' });

  useEffect(() => {
    setMounted(true);
    let unsubscribeProfile: any = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
      } else {
        try {
          const userDocId = currentUser.email!.replace(/\W/g, '_');
          
          unsubscribeProfile = onSnapshot(doc(db, 'users', userDocId), async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              
              if (data.accesoBloqueado) {
                await signOut(auth);
                router.push('/login');
                return;
              }

              // Lógica de recuperación de sesión
              const savedModule = localStorage.getItem('posven_active_module');
              const aperturaConfirmada = localStorage.getItem('posven_apertura_done');

              if (data.rol === 'cajero') {
                 const configSnap = await getDoc(doc(db, 'pos_system_data', 'state'));
                 const terminals = configSnap.data()?.terminales || [];
                 const terminalsArr = Array.isArray(terminals) ? terminals : Object.values(terminals);
                 const hasTerminal = terminalsArr.some((t: any) => t.usuarioId === userDocId);
                 
                 if (!hasTerminal) {
                    await signOut(auth);
                    alert("ACCESO RESTRINGIDO: Su usuario no tiene un terminal de venta asignado.");
                    router.push('/login');
                    return;
                 }
                 
                 if (!savedModule) setActiveModule('ventas');
                 setShowApertura(!aperturaConfirmada);
              } else {
                 if (!savedModule) setActiveModule('dashboard');
                 setShowApertura(false);
              }

              setUserRole(data.rol);
              setUserProfile(data);
              setUser(currentUser);
              setLoading(false);
            } else {
              setUserRole('administrador');
              if (!activeModule) setActiveModule('dashboard');
              setLoading(false);
            }
          }, (err) => {
            console.error("Error en tiempo real de perfil:", err);
            setLoading(false);
          });

        } catch (error) {
          console.error("Error fetching role:", error);
          setLoading(false);
        }
      }
    });

    const unsubscribeStore = Store.subscribe((dbUpdate) => {
      setState(prev => ({ ...prev, ...dbUpdate }));
    });

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeStore();
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [router]);

  // Efecto para guardar módulo activo en cada cambio
  useEffect(() => {
    if (activeModule) {
      localStorage.setItem('posven_active_module', activeModule);
    }
  }, [activeModule]);

  const handleLogout = async () => {
    if (confirm('¿Cerrar sesión del sistema?')) {
      // Limpiar rastro de sesión UI
      localStorage.removeItem('posven_active_module');
      localStorage.removeItem('posven_apertura_done');
      
      if (userRole === 'cajero' && user) {
        try {
          const userDocId = user.email.replace(/\W/g, '_');
          await updateDoc(doc(db, 'users', userDocId), { accesoBloqueado: true });
        } catch (e) {
          console.error("Error al activar bloqueo de seguridad:", e);
        }
      }
      await signOut(auth);
      router.push('/login');
    }
  };

  const updateState = (newState: Partial<AppState>) => {
    setState(prev => {
      const updated = { ...prev, ...newState };
      Store.set(updated);
      return updated;
    });
  };

  const handleModuleChange = (moduleId: string) => {
    if (userRole === 'cajero' && moduleId !== 'ventas') return;
    setActiveModule(moduleId);
    setIsSidebarOpen(false);
  };

  const menuGroups = [
    {
      id: 'operaciones',
      label: 'Operaciones',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'inventario', label: 'Inventario', icon: Package, count: state.productos.length },
        { id: 'compras', label: 'Entradas (Compras)', icon: ShoppingBag },
      ]
    },
    {
      id: 'finanzas',
      label: 'Finanzas',
      items: [
        { id: 'cxc', label: 'Cuentas por Cobrar', icon: HandCoins, count: state.cxc.filter(x => x.estado !== 'pagada').length },
        { id: 'cxp', label: 'Cuentas por Pagar', icon: FileText },
      ]
    },
    {
      id: 'sistema',
      label: 'Sistema',
      items: [
        { id: 'reportes', label: 'Reportes', icon: BarChart3 },
        { id: 'config', label: 'Configuración', icon: Settings },
        { id: 'usuarios', label: 'Usuarios', icon: Users },
        { id: 'global_control', label: 'Global Control', icon: ShieldCheck },
      ]
    }
  ];

  const renderModule = () => {
    if (!mounted || loading || !activeModule) return null;
    switch (activeModule) {
      case 'dashboard': return <DashboardModule state={state} />;
      case 'inventario': return <InventoryModule state={state} updateState={updateState} />;
      case 'ventas': return <SalesModule state={state} updateState={updateState} />;
      case 'compras': return <PurchaseModule state={state} updateState={updateState} />;
      case 'cxc': return <CxCModule state={state} updateState={updateState} />;
      case 'cxp': return <CxPModule state={state} updateState={updateState} />;
      case 'reportes': return <ReportsModule state={state} />;
      case 'config': return <ConfigModule state={state} updateState={updateState} />;
      case 'usuarios': return <UsersModule />;
      case 'global_control': return <GlobalControlModule state={state} updateState={updateState} />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-warm flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-gold/20 border-t-brand-gold rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ink/40">Sincronizando con la nube...</p>
        </div>
      </div>
    );
  }

  const timeStr = mounted ? currentTime.toLocaleTimeString('es-VE', { 
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/Caracas' 
  }) : '--:--:--';

  const dateStr = mounted ? currentTime.toLocaleDateString('es-VE', { 
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Caracas'
  }) : '...';

  const isCajero = userRole === 'cajero';

  return (
    <div className="flex min-h-screen bg-surface-warm text-ink">
      
      {showApertura && isCajero && (
        <div className="fixed inset-0 z-[100] bg-surface-warm flex items-center justify-center p-4 no-print">
           <div className="w-full max-w-md bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-6 space-y-4 animate-in fade-in zoom-in duration-500 border border-line">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <div className="w-9 h-9 bg-brand-gold rounded-lg flex items-center justify-center text-black font-black text-xl shadow-lg">P</div>
                  <div className="font-display font-black text-xl text-ink tracking-tighter uppercase">
                    Pos<span className="text-brand-gold">VEN</span> Pro
                  </div>
                </div>
                <div className="h-0.5 w-10 bg-brand-gold rounded-full mx-auto mb-2"></div>
                <h1 className="text-lg font-extrabold text-ink tracking-tight uppercase italic">Apertura de Jornada</h1>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-surface-soft rounded-xl border border-line">
                    <label className="text-[8px] font-black uppercase text-ink/50 block mb-0.5">Responsable</label>
                    <p className="text-[10px] font-black text-ink uppercase truncate">{userProfile?.nombre || 'Operador'}</p>
                  </div>
                  <div className="p-2.5 bg-surface-soft rounded-xl border border-line">
                    <label className="text-[8px] font-black uppercase text-ink/50 block mb-0.5">Recibo Inicio</label>
                    <p className="text-[10px] font-black text-brand-gold-deep"># {String(state.proximoRecibo).padStart(9, '0')}</p>
                  </div>
                </div>

                <div className="p-2.5 bg-ink text-white rounded-xl flex justify-between items-center">
                  <div className="space-y-0">
                    <label className="text-7px font-bold uppercase opacity-50 block tracking-widest">Fecha</label>
                    <p className="text-9px font-black uppercase">{dateStr}</p>
                  </div>
                  <div className="text-right space-y-0">
                    <label className="text-7px font-bold uppercase opacity-50 block tracking-widest">Hora</label>
                    <p className="text-9px font-black uppercase">{timeStr}</p>
                  </div>
                </div>

                <div className="space-y-3">
                   <div className="form-group">
                      <label className="text-ink text-[9px] font-black uppercase block mb-1 ml-1 opacity-70">Fondo Efectivo Bs.</label>
                      <input 
                        type="text" 
                        className="form-input h-10 text-lg font-black text-center text-ink bg-surface-soft/40 border-line" 
                        value={aperturaData.bs} 
                        onChange={e => setAperturaData({...aperturaData, bs: e.target.value.replace(/[^0-9.]/g, '')})}
                      />
                   </div>
                   <div className="form-group">
                      <label className="text-ink text-[9px] font-black uppercase block mb-1 ml-1 opacity-70">Fondo Efectivo USD</label>
                      <input 
                        type="text" 
                        className="form-input h-10 text-lg font-black text-center text-brand-gold-deep bg-surface-soft/40 border-line" 
                        value={aperturaData.usd} 
                        onChange={e => setAperturaData({...aperturaData, usd: e.target.value.replace(/[^0-9.]/g, '')})}
                      />
                   </div>
                </div>

                <button 
                  disabled={aperturaData.bs === '' || aperturaData.usd === ''}
                  onClick={() => {
                    localStorage.setItem('posven_apertura_done', 'true');
                    setShowApertura(false);
                  }}
                  className="w-full h-12 bg-brand-gold text-ink font-black text-sm rounded-xl shadow-xl shadow-brand-gold/10 hover:bg-brand-gold-deep hover:text-white transition-all uppercase tracking-widest"
                >
                  Confirmar Apertura
                </button>
              </div>
           </div>
        </div>
      )}

      {!isCajero && (
        <aside className={`fixed lg:sticky top-0 left-0 w-[260px] h-screen bg-white border-line flex flex-col z-50 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} border-r`}>
          <div className="p-6 border-b border-line flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-ink border border-brand-gold rounded-[10px] flex items-center justify-center font-black text-brand-gold text-lg shadow-sm">
                P
              </div>
              <div>
                <div className="font-display font-[800] text-lg leading-none text-ink">
                  Pos<span className="text-brand-gold">VEN</span> Pro
                </div>
                <div className="text-[0.68rem] font-bold text-ink uppercase tracking-widest mt-1">
                  Soluciones Venezuela
                </div>
              </div>
            </div>
          </div>
          
          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            {menuGroups.map((group) => (
              <div key={group.id} className="space-y-1">
                <div className="px-2.5 mb-2 text-[0.66rem] font-bold text-ink uppercase tracking-[0.18em]">
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
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-[10px] text-[0.9rem] font-bold transition-all group relative ${active ? 'bg-brand-gold-soft text-brand-gold-deep' : 'text-ink hover:bg-surface-soft hover:text-ink'}`}
                      >
                        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-gold rounded-r-full" />}
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${active ? 'text-brand-gold-deep' : 'text-ink group-hover:text-ink'}`} />
                          {item.label}
                        </div>
                        {item.count !== undefined && (
                          <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-black ${active ? 'bg-brand-gold text-white' : 'bg-surface-soft text-ink'}`}>
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
          
          <div className="p-4 border-t border-line bg-surface-warm/50 flex flex-col gap-2">
            <div className="bg-brand-gold-soft border border-[#EFD9A4] rounded-lg p-3 flex items-center gap-3 shadow-sm">
              <div className="w-7 h-7 rounded-full bg-gradient-to-b from-[#FFD700] via-[#003893] to-[#CF142B] border border-white/20 shadow-inner flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-white/10" />
              </div>
              <div className="flex-1">
                <div className="text-[0.62rem] font-bold text-brand-gold-deep uppercase tracking-widest leading-none mb-1">Tasa BCV</div>
                <div className="font-display font-[800] text-sm text-ink">{state.tasa.toFixed(2)} <span className="text-[0.7rem] font-black opacity-60">Bs/USD</span></div>
              </div>
              <button className="text-brand-gold-deep hover:rotate-180 transition-transform duration-500">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[0.8rem] font-black text-status-danger hover:bg-status-danger-soft transition-all uppercase tracking-widest"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sistema
            </button>
          </div>
        </aside>
      )}

      <main className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <header className="sticky top-0 z-30 bg-surface-warm/85 backdrop-blur-md border-b border-line px-7 py-3.5 flex items-center gap-6 no-print">
          {!isCajero && (
            <button className="lg:hidden p-2 -ml-2 text-ink" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-[18px] h-[18px]" />
            </button>
          )}
          
          <div className="shrink-0">
            <h2 className="font-display text-lg font-[800] text-ink leading-tight">
              Pos<span className="text-brand-gold">VEN</span> pro
            </h2>
            <p className="text-[0.7rem] text-ink uppercase font-bold tracking-widest">
              {isCajero ? 'Terminal de Punto de Venta' : 'Soluciones Venezuela'}
            </p>
          </div>

          <div className="hidden md:flex items-center gap-4 mx-auto">
            <div className="flex items-center gap-2.5 px-4 py-2 bg-white/70 rounded-xl border border-line shadow-sm min-w-[160px]">
              <div className="w-8 h-8 bg-brand-gold-soft rounded-lg flex items-center justify-center">
                <ClockIcon className="w-4 h-4 text-brand-gold-deep" />
              </div>
              <div className="flex flex-col">
                <span className="text-[0.65rem] font-black uppercase text-ink opacity-50 leading-none mb-0.5">{dateStr}</span>
                <span className="text-[0.88rem] font-black text-ink leading-none tabular-nums">{timeStr}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-4 py-2 bg-white/70 rounded-xl border border-line shadow-sm">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mounted && isOnline ? 'bg-status-success-soft' : 'bg-status-danger-soft'}`}>
                {mounted && isOnline ? <Wifi className="w-4 h-4 text-status-success" /> : <WifiOff className="w-4 h-4 text-status-danger" />}
              </div>
              <div className="flex flex-col">
                <span className="text-[0.65rem] font-black uppercase text-ink opacity-50 leading-none mb-0.5">Cloud Sync</span>
                <div className="flex items-center gap-1.5 leading-none">
                  <div className={`w-1.5 h-1.5 rounded-full ${mounted ? (isOnline ? 'bg-status-success animate-pulse' : 'bg-status-danger') : 'bg-ink/20'}`} />
                  <span className={`text-[0.74rem] font-black uppercase ${mounted ? (isOnline ? 'text-status-success' : 'text-status-danger') : 'text-ink/20'}`}>
                    {mounted ? (isOnline ? 'Conectado' : 'Offline') : 'Conectando...'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {!isCajero && (
              <button className="relative w-[38px] h-[38px] rounded-[10px] bg-white border border-line flex items-center justify-center text-ink hover:text-brand-gold transition-colors shadow-sm-card">
                <Bell className="w-4 h-4" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-status-danger rounded-full border-2 border-background" />
              </button>
            )}
            
            <div className="flex items-center gap-2.5 pl-3 border-l border-line ml-1">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-ink leading-none">{userProfile?.nombre || 'Usuario'}</div>
                <div className="text-[0.66rem] font-bold text-ink opacity-60 uppercase mt-1 tracking-wider">{userRole === 'administrador' ? 'Panel Control' : 'Modo Operativo'}</div>
              </div>
              <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-brand-gold to-[#E7B857] flex items-center justify-center text-white font-black text-xs border border-white/20 shadow-sm uppercase">
                {userProfile?.nombre?.charAt(0) || 'U'}
              </div>
            </div>
            
            {isCajero && (
               <button 
                onClick={handleLogout}
                className="w-10 h-10 bg-status-danger-soft text-status-danger rounded-xl flex items-center justify-center hover:bg-status-danger hover:text-white transition-all shadow-sm"
                title="Cerrar Sistema"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>
        
        <div className="p-7 flex-1">
          {renderModule()}
        </div>

        <footer className="px-8 py-6 border-t border-line text-[0.76rem] font-black text-ink flex flex-col sm:flex-row justify-between gap-4 no-print bg-surface-warm/30">
          <div>© 2026 PosVEN Pro · Datos persistidos en la nube</div>
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" /> Nube Activa</span>
            <span className="px-2 py-0.5 bg-white border border-line rounded text-[0.65rem] font-black">v2.5.0-secure</span>
          </div>
        </footer>
      </main>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-[45] backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  );
}
