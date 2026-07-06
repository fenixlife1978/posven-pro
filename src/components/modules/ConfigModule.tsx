
"use client";

import React, { useState } from 'react';
import { AppState } from '@/lib/types';
import { Save, AlertTriangle } from 'lucide-react';

export default function ConfigModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [tasa, setTasa] = useState(state.tasa);
  const [empresa, setEmpresa] = useState(state.empresa);

  const guardarTasa = () => {
    updateState({ tasa });
    alert('Tasa actualizada');
  };

  const guardarEmpresa = () => {
    updateState({ empresa });
    alert('Datos de empresa actualizados');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card">
        <div className="card-head"><h3>Tasa de Cambio</h3></div>
        <div className="card-body space-y-4">
          <div className="form-group">
            <label className="form-label">1 USD =</label>
            <div className="flex items-center gap-3">
              <input type="number" className="form-input flex-1" value={tasa} onChange={e => setTasa(parseFloat(e.target.value))} />
              <span className="text-[#8a847c]">Bolivares (BS)</span>
            </div>
            <p className="text-[0.72rem] text-[#5a5650] mt-1">Definición de tasa para cálculos en bolívares.</p>
          </div>
          <button className="btn btn-primary" onClick={guardarTasa}><Save className="w-4 h-4" /> Guardar Tasa</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Datos de la Empresa</h3></div>
        <div className="card-body space-y-4">
          <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" value={empresa.nombre} onChange={e => setEmpresa({...empresa, nombre: e.target.value})} /></div>
          <div className="form-group"><label classsName="form-label">RIF</label><input className="form-input" value={empresa.rif} onChange={e => setEmpresa({...empresa, rif: e.target.value})} /></div>
          <div className="form-row grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group"><label className="form-label">Dirección</label><input className="form-input" value={empresa.direccion} onChange={e => setEmpresa({...empresa, direccion: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={empresa.telefono} onChange={e => setEmpresa({...empresa, telefono: e.target.value})} /></div>
          </div>
          <button className="btn btn-primary" onClick={guardarEmpresa}><Save className="w-4 h-4" /> Guardar Empresa</button>
        </div>
      </div>

      <div className="card border-[#e04848]/20 bg-[#e04848]/5">
        <div className="card-head"><h3 className="text-[#e04848]">Zona de Peligro</h3></div>
        <div className="card-body">
          <p className="text-sm text-[#8a847c] mb-4">Se borrarán todos los datos del sistema (ventas, productos, historial). Esta acción no se puede deshacer.</p>
          <button className="btn btn-danger" onClick={() => { if(confirm('¿ELIMINAR TODO?')) { localStorage.clear(); window.location.reload(); } }}>
            <AlertTriangle className="w-4 h-4" /> Borrar todo
          </button>
        </div>
      </div>
    </div>
  );
}
