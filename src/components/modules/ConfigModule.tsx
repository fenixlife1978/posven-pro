'use client';

import React, { useState, useEffect } from 'react';
import { AppState } from '@/lib/types';
import { Save, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function ConfigModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [tasa, setTasa] = useState<string | number>(state.tasa);
  const [empresa, setEmpresa] = useState(state.empresa);
  const [pinDevolucion, setPinDevolucion] = useState(state.pinDevolucion || '');

  // Sincronizar estados locales cuando el estado global cambie (ej: desde otra pestaña)
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
            <p className="text-[0.7rem] text-ink font-bold mt-3 italic opacity-60">
              Esta tasa se sincroniza en tiempo real con todos los terminales de venta activos.
            </p>
          </div>
          <button className="btn btn-primary h-12 px-8 font-black uppercase text-xs shadow-md mt-2" onClick={guardarTasa}>
            <Save className="w-4 h-4" /> Guardar Tasa Actualizada
          </button>
        </div>
      </div>

      {/* SEGURIDAD DE OPERACIONES */}
      <div className="card shadow-lg border-line">
        <div className="card-head bg-surface-soft border-b border-line px-5 py-4">
          <h3 className="text-ink font-black uppercase text-xs tracking-widest">Seguridad de Operaciones</h3>
        </div>
        <div className="card-body p-6 space-y-4 bg-white">
          <div className="form-group">
            <label className="text-ink text-[10px] font-black uppercase block mb-2 opacity-70">PIN de Autorización (6 Dígitos)</label>
            <div className="relative">
               <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gold" />
               <input 
                 type="password" 
                 maxLength={6}
                 placeholder="000000"
                 className="form-input h-14 text-2xl font-black text-brand-gold-deep border-line bg-surface-soft/30 pl-12 text-center tracking-[0.5em]" 
                 value={pinDevolucion} 
                 onChange={e => setPinDevolucion(e.target.value.replace(/\D/g, ''))} 
               />
            </div>
            <p className="text-[0.7rem] text-ink font-bold mt-3 italic opacity-60">
              Este código de seguridad será solicitado para finalizar procesos de devolución.
            </p>
          </div>
          <button className="btn btn-primary h-12 px-8 font-black uppercase text-xs shadow-md mt-2" onClick={guardarPin}>
            <Save className="w-4 h-4" /> Establecer PIN de Seguridad
          </button>
        </div>
      </div>

      {/* DATOS DE LA EMPRESA */}
      <div className="card shadow-lg border-line">
        <div className="card-head bg-surface-soft border-b border-line px-5 py-4">
          <h3 className="text-ink font-black uppercase text-xs tracking-widest">Datos de Identidad Fiscal</h3>
        </div>
        <div className="card-body p-6 space-y-5 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="form-group">
              <label className="text-ink text-[10px] font-black uppercase block mb-1.5 opacity-70">Nombre del Negocio</label>
              <input className="form-input h-10 font-bold text-ink border-line" value={empresa.nombre} onChange={e => setEmpresa({...empresa, nombre: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="text-ink text-[10px] font-black uppercase block mb-1.5 opacity-70">Número de RIF</label>
              <input className="form-input h-10 font-black text-ink border-line uppercase" value={empresa.rif} onChange={e => setEmpresa({...empresa, rif: e.target.value})} />
            </div>
          </div>
          
          <div className="form-group">
            <label className="text-ink text-[10px] font-black uppercase block mb-1.5 opacity-70">Dirección Fiscal Completa</label>
            <input className="form-input h-10 font-bold text-ink border-line" value={empresa.direccion} onChange={e => setEmpresa({...empresa, direccion: e.target.value})} />
          </div>

          <div className="form-group">
            <label className="text-ink text-[10px] font-black uppercase block mb-1.5 opacity-70">Teléfono de Contacto</label>
            <input className="form-input h-10 font-bold text-ink border-line" value={empresa.telefono} onChange={e => setEmpresa({...empresa, telefono: e.target.value})} />
          </div>

          <button className="btn btn-primary h-12 px-8 font-black uppercase text-xs shadow-md" onClick={guardarEmpresa}>
            <Save className="w-4 h-4" /> Actualizar Perfil de Empresa
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
          <p className="text-xs text-ink font-bold mb-5 uppercase leading-relaxed tracking-tight">
            Esta acción borrará permanentemente la base de datos en la nube y reiniciará el sistema.
          </p>
          <button 
            className="btn btn-danger h-12 px-8 font-black uppercase text-xs shadow-xl" 
            onClick={() => { if(confirm('¿ESTÁ SEGURO DE ELIMINAR TODA LA INFORMACIÓN? ESTO NO SE PUEDE DESHACER.')) { localStorage.clear(); window.location.reload(); } }}
          >
            <AlertTriangle className="w-4 h-4" /> Formatear Sistema Completo
          </button>
        </div>
      </div>
    </div>
  );
}