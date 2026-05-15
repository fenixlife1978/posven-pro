"use client";

import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Package, 
  Users, 
  HandCoins, 
  Vault, 
  BarChart3, 
  Clock, 
  Calendar as CalendarIcon,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store } from '@/lib/db-store';
import { PosModule } from '@/components/pos/PosModule';
import { InventoryModule } from '@/components/inventory/InventoryModule';
import { CustomersModule } from '@/components/customers/CustomersModule';
import { ReceivablesModule } from '@/components/receivables/ReceivablesModule';
import { CashModule } from '@/components/cash/CashModule';
import { ReportsModule } from '@/components/reports/ReportsModule';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { toast } from '@/hooks/use-toast';

type Module = 'pos' | 'inventory' | 'customers' | 'receivables' | 'cash' | 'reports';

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('pos');
  const [isCashOpen, setIsCashOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    Store.init();
    setIsCashOpen(Store.get('isCashOpen', false));
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Universal HID Barcode Listener
  useBarcodeScanner((barcode) => {
    // If we are in POS, we add to cart.
    // In Inventory, we might auto-filter or highlight.
    // For now, let's toast it.
    toast({ 
      title: "Barcode Detectado", 
      description: `Código: ${barcode}`, 
      variant: "default" 
    });
    
    // Custom logic can be injected here or passed down to modules
    window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: barcode }));
  });

  const NavItem = ({ id, label, icon: Icon }: { id: Module, label: string, icon: any }) => (
    <Button 
      variant={activeModule === id ? 'default' : 'ghost'}
      className={`relative h-12 gap-2 px-4 font-semibold transition-all group ${activeModule === id ? 'bg-primary text-white shadow-lg' : 'hover:bg-primary/10'}`}
      onClick={() => setActiveModule(id)}
    >
      <Icon className={`w-5 h-5 ${activeModule === id ? 'text-white' : 'text-primary'}`} />
      <span className="hidden md:inline">{label}</span>
      {activeModule === id && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
      )}
    </Button>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="h-14 shrink-0 bg-secondary border-b flex items-center justify-between px-6 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-black text-white italic">L</div>
          <h1 className="text-xl font-black italic tracking-tighter text-white">LicorPOS <span className="text-primary not-italic">Elite</span></h1>
        </div>

        <div className="hidden lg:flex items-center gap-6 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-3 h-3" />
            {currentTime.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            {currentTime.toLocaleTimeString('es-VE')}
          </div>
          <Badge 
            variant={isCashOpen ? "secondary" : "destructive"} 
            className={`px-3 py-1 animate-pulse ${isCashOpen ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' : ''}`}
          >
            {isCashOpen ? 'Caja Abierta' : 'Caja Cerrada'}
          </Badge>
        </div>
      </header>

      {/* Quick Nav Bar */}
      <nav className="shrink-0 bg-secondary/50 border-b flex items-center justify-center gap-1 p-1 overflow-x-auto no-scrollbar">
        <NavItem id="pos" label="Punto de Venta" icon={ShoppingCart} />
        <NavItem id="inventory" label="Inventario" icon={Package} />
        <NavItem id="customers" label="Clientes" icon={Users} />
        <NavItem id="receivables" label="Cobranzas" icon={HandCoins} />
        <NavItem id="cash" label="Control Caja" icon={Vault} />
        <NavItem id="reports" label="Reportes & AI" icon={BarChart3} />
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeModule === 'pos' && <PosModule />}
        {activeModule === 'inventory' && <InventoryModule />}
        {activeModule === 'customers' && <CustomersModule />}
        {activeModule === 'receivables' && <ReceivablesModule />}
        {activeModule === 'cash' && <CashModule onStatusChange={setIsCashOpen} />}
        {activeModule === 'reports' && <ReportsModule />}
      </main>

      {!isCashOpen && activeModule !== 'cash' && (
        <div className="bg-destructive/10 border-t border-destructive/20 text-destructive text-[10px] py-1.5 px-6 flex items-center justify-center gap-2 font-bold uppercase tracking-widest no-print shrink-0">
          <AlertTriangle className="w-3 h-3" />
          La caja está cerrada. Diríjase al módulo de Control Caja para abrir sesión.
        </div>
      )}
    </div>
  );
}
