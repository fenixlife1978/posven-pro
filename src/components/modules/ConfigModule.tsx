'use client';

import React, { useState } from 'react';
import { AppState } from '@/lib/types';
import { Save, AlertTriangle } from 'lucide-react';

export default function ConfigModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [tasa, setTasa] = useState<string | number>(state.tasa);
  const [empresa, setEmpresa] = useState(state.empresa);

  const guardarTasa = () => {
    const n = parseFloat(tasa.toString());
    if (isNaN(n)) return alert('Tasa inválida');
    updateState({ tasa: n });
    alert('Tasa actualizada');
  };

  const guardarEmpresa = () => {
    updateState({ empresa });
    alert('Datos de empresa actualizados');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card">
        <div className="card-head"><h3 className="text-white">Tasa de Cambio</h3></div>
        <div className="card-body space-y-4">
          <div className="form-group">
            <label className="form-label text-white uppercase font-black text-[10px]">1 USD =</label>
            <div className="flex items-center gap-3">
              <input 
                type="number" 
                className="form-input flex-1 bg-[#0b0b0b] text-white border-[#2a2a2a] h-12 text-lg font-black" 
                value={tasa} 
                onChange={e => setTasa(e.target.value)} 
              />
              <span className="text-white font-bold">Bolívares (BS)</span>
            </div>
            <p className="text-[0.75rem] text-white/80 mt-2 font-medium">Definición de tasa para cálculos y conversiones en bolívares en todo el sistema.</p>
          </div>
          <button className="btn btn-primary h-12 px-8 font-black uppercase text-xs" onClick={guardarTasa}><Save className="w-4 h-4" /> Guardar Tasa</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3 className="text-white">Datos de la Empresa</h3></div>
        <div className="card-body space-y-4">
          <div className="form-group"><label className="form-label text-white uppercase font-black text-[10px]">Nombre</label><input className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10" value={empresa.nombre} onChange={e => setEmpresa({...empresa, nombre: e.target.value})} /></div>
          <div className="form-group"><label className="form-label text-white uppercase font-black text-[10px]">RIF</label><input className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10" value={empresa.rif} onChange={e => setEmpresa({...empresa, rif: e.target.value})} /></div>
          <div className="form-row grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group"><label className="form-label text-white uppercase font-black text-[10px]">Dirección</label><input className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10" value={empresa.direccion} onChange={e => setEmpresa({...empresa, direccion: e.target.value})} /></div>
            <div className="form-group"><label className="form-label text-white uppercase font-black text-[10px]">Teléfono</label><input className="form-input bg-[#0b0b0b] text-white border-[#2a2a2a] h-10" value={empresa.telefono} onChange={e => setEmpresa({...empresa, telefono: e.target.value})} /></div>
          </div>
          <button className="btn btn-primary h-12 px-8 font-black uppercase text-xs" onClick={guardarEmpresa}><Save className="w-4 h-4" /> Guardar Empresa</button>
        </div>
      </div>

      <div className="card border-[#e04848]/40 bg-[#e04848]/5">
        <div className="card-head"><h3 className="text-[#e04848] font-black uppercase italic">Zona de Peligro</h3></div>
        <div className="card-body">
          <p className="text-sm text-white font-bold mb-4 uppercase tracking-tighter">Se borrarán todos los datos del sistema (ventas, productos, historial). Esta acción no se puede deshacer.</p>
          <button className="btn btn-danger h-12 px-8 font-black uppercase text-xs" onClick={() => { if(confirm('¿ELIMINAR TODO?')) { localStorage.clear(); window.location.reload(); } }}>
            <AlertTriangle className="w-4 h-4" /> Borrar todo el sistema
          </button>
        </div>
      </div>
    </div>
  );
}
