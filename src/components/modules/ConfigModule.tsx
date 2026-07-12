
'use client';

import React, { useState, useEffect } from 'react';
import { AppState } from '@/lib/types';
import { Save, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Store, initialState } from '@/lib/db-store';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function ConfigModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [tasa, setTasa] = useState<string | number>(state.tasa);
  const [empresa, setEmpresa] = useState(state.empresa);
  const [pinDevolucion, setPinDevolucion] = useState(state.pinDevolucion || '');
  const [isFormatting, setIsFormatting] = useState(false);

  useEffect(() => {
    setTasa(state.tasa);
    setEmpresa(state.empresa);
    setPinDevolucion(state.pinDevolucion || '000000');
  }, [state.tasa, state.empresa, state.pinDevolucion]);

  const guardarTasa = () => {
    const n = parseFloat(tasa.toString());
    if (isNaN(n)) return alert('Tasa inválida');
    updateState({ tasa: n });
    toast({ title: "Sincronizado", description: "Tasa de cambio actualizada en todos los terminales." });
  };

  const guardarEmpresa = () => {
    updateState({ empresa });
    toast({ title: "Perfil Actualizado", description: "Los datos fiscales han sido guardados." });
  };

  const guardarPin = () => {
    if (pinDevolucion.length !== 6) return alert('El PIN debe ser de 6 dígitos exactos');
    updateState({ pinDevolucion });
    toast({ title: "Seguridad Actualizada", description: "PIN de autorización establecido correctamente." });
  };

  /**
   * FORMATEO TOTAL DEL SISTEMA (LIMPIEZA ABSOLUTA)
   */
  const formatearSistema = async () => {
    const confirmMsg = '¿ESTÁ TOTALMENTE SEGURO?\n\nESTA ACCIÓN BORRARÁ:\n1. Todos los productos e inventario.\n2. Todo el historial de ventas y créditos.\n3. TODOS los perfiles de usuario en Firestore.\n4. La configuración de seguridad.\n\nEl sistema volverá al estado de "Primer Uso" y se cerrará su sesión.';
    
    if (confirm(confirmMsg)) {
      setIsFormatting(true);
      try {
        toast({ title: "Limpieza Crítica en Curso", description: "Vaciando base de datos de usuarios..." });

        // 1. ELIMINAR TODOS LOS USUARIOS DE FIRESTORE (OPERACIÓN POR LOTES)
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const deletePromises = usersSnapshot.docs.map(uDoc => deleteDoc(doc(db, 'users', uDoc.id)));
        await Promise.all(deletePromises);

        // 2. REINICIAR ESTADO GLOBAL (INCLUYENDO isInitialized: false)
        // Esto garantiza que el enlace de registro vuelva a aparecer.
        const resetData = {
          ...initialState,
          isInitialized: false
        };
        
        // Guardamos directamente en Firestore el estado de "no inicializado"
        await setDoc(doc(db, 'pos_system_data', 'state'), resetData);
        
        toast({ title: "Firestore Limpio", description: "Finalizando desvinculación de sesión..." });

        // 3. LIMPIAR CACHÉ LOCAL
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.clear();
        }

        // 4. ELIMINAR CUENTA DE AUTH ACTUAL (SI ES POSIBLE) Y SALIR
        if (auth.currentUser) {
          try {
            await auth.currentUser.delete();
          } catch (e) {
            // Si falla por sesión vieja, solo salimos
            await signOut(auth);
          }
        } else {
          await signOut(auth);
        }
        
        // Redirigir al login
        window.location.href = '/login';

      } catch (error: any) {
        console.error("Error en formateo:", error);
        toast({ variant: "destructive", title: "Fallo en Limpieza", description: error.message });
      } finally {
        setIsFormatting(false);
      }
    }
  };

  return (
    <div className="max-w-2xl space-y-6 animate-in fade-in duration-300 pb-20">
      {/* TASA DE CAMBIO */}
      <div className="card shadow-lg border-line">
        <div className="card-head bg-surface-soft border-b border-line px-5 py-4">
          <h3 className="text-ink font-black uppercase text-xs tracking-widest">Tasa de Cambio Oficial</h3>
        </div>
        <div className="card-body p-6 space-y-4 bg-white">
          <div className="form-group">
            <label className="text-ink text-[10px] font-black uppercase block mb-2 opacity-70">VALOR DE REFERENCIA: 1 USD =</label>
            <div className="flex items-center gap-4">
              <input 
                type="number" 
                step="0.01"
                className="form-input flex-1 h-12 text-xl font-black text-brand-gold-deep border-line bg-surface-soft/30 px-4" 
                value={tasa} 
                onChange={e => setTasa(e.target.value)} 
              />
              <span className="text-ink font-black text-sm uppercase tracking-tighter">Bolívares (BS)</span>
            </div>
          </div>
          <button className="btn btn-primary h-12 px-8 font-black uppercase text-xs shadow-md mt-2" onClick={guardarTasa}>
            <Save className="w-4 h-4" /> Guardar Tasa Actualizada
          </button>
        </div>
      </div>

      {/* SEGURIDAD */}
      <div className="card shadow-lg border-line">
        <div className="card-head bg-surface-soft border-b border-line px-5 py-4">
          <h3 className="text-ink font-black uppercase text-xs tracking-widest">Seguridad de Operaciones</h3>
        </div>
        <div className="card-body p-6 bg-white">
          <div className="form-group">
            <label className="text-ink text-[10px] font-black uppercase block mb-2 opacity-70">PIN de Autorización (6 Dígitos)</label>
            <div className="relative">
               <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gold" />
               <input 
                 type="password" 
                 maxLength={6}
                 className="form-input h-14 text-2xl font-black text-brand-gold-deep border-line bg-surface-soft/30 pl-12 text-center tracking-[0.5em]" 
                 value={pinDevolucion} 
                 onChange={e => setPinDevolucion(e.target.value.replace(/\D/g, ''))} 
               />
            </div>
          </div>
          <button className="btn btn-primary h-12 px-8 font-black uppercase text-xs shadow-md mt-4" onClick={guardarPin}>
            <Save className="w-4 h-4" /> Establecer PIN
          </button>
        </div>
      </div>

      {/* EMPRESA */}
      <div className="card shadow-lg border-line">
        <div className="card-head bg-surface-soft border-b border-line px-5 py-4">
          <h3 className="text-ink font-black uppercase text-xs tracking-widest">Datos de Identidad Fiscal</h3>
        </div>
        <div className="card-body p-6 space-y-5 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="form-group">
              <label className="text-ink text-[10px] font-black uppercase block mb-1.5 opacity-70">Nombre del Negocio</label>
              <input className="form-input h-10 font-bold border-line" value={empresa.nombre} onChange={e => setEmpresa({...empresa, nombre: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="text-ink text-[10px] font-black uppercase block mb-1.5 opacity-70">Número de RIF</label>
              <input className="form-input h-10 font-black border-line uppercase" value={empresa.rif} onChange={e => setEmpresa({...empresa, rif: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="text-ink text-[10px] font-black uppercase block mb-1.5 opacity-70">Dirección Fiscal</label>
            <input className="form-input h-10 font-bold border-line" value={empresa.direccion} onChange={e => setEmpresa({...empresa, direccion: e.target.value})} />
          </div>
          <button className="btn btn-primary h-12 px-8 font-black uppercase text-xs shadow-md" onClick={guardarEmpresa}>
            <Save className="w-4 h-4" /> Actualizar Empresa
          </button>
        </div>
      </div>

      {/* ZONA DE PELIGRO */}
      <div className="card border-status-danger/30 bg-status-danger-soft">
        <div className="card-head border-b border-status-danger/20 px-5 py-4">
          <h3 className="text-status-danger font-black uppercase italic text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Zona de Seguridad Crítica
          </h3>
        </div>
        <div className="card-body p-6">
          <p className="text-xs text-ink font-bold mb-5 uppercase tracking-tight">
            ESTA ACCIÓN BORRARÁ TODOS LOS DATOS Y USUARIOS DE FIRESTORE. EL SISTEMA SE REINICIARÁ AL ESTADO DE FÁBRICA.
          </p>
          <button 
            className="btn btn-danger h-12 px-8 font-black uppercase text-xs shadow-xl flex items-center gap-2" 
            onClick={formatearSistema}
            disabled={isFormatting}
          >
            {isFormatting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            {isFormatting ? 'PROCESANDO LIMPIEZA...' : 'Formatear Sistema Completo'}
          </button>
        </div>
      </div>
    </div>
  );
}
