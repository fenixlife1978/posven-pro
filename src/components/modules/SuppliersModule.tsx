
"use client";

import React, { useState } from 'react';
import { AppState } from '@/lib/types';
import { Utils, Store } from '@/lib/db-store';
import { 
  Truck, 
  Plus, 
  X, 
  Save, 
  Trash2, 
  Edit2, 
  Search,
  ClipboardList,
  AlertTriangle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function SuppliersModule({ state, updateState }: { state: AppState, updateState: (s: Partial<AppState>) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [editingIndex, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState('');

  const filtered = (state.proveedores || []).filter(p => 
    p.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (!formData.trim()) return alert('Ingrese el nombre del proveedor');
    
    let nuevos = [...state.proveedores];
    const nombreNormalizado = formData.trim();

    if (editingIndex !== null) {
      const viejoNombre = nuevos[editingIndex];
      nuevos[editingIndex] = nombreNormalizado;
      
      // Actualizar productos que usaban este proveedor para mantener integridad
      const nuevosProductos = state.productos.map(p => 
        p.proveedor === viejoNombre ? { ...p, proveedor: nombreNormalizado } : p
      );
      
      updateState({ proveedores: nuevos, productos: nuevosProductos });
      toast({ title: "Proveedor Actualizado", description: "El catálogo y productos asociados han sido actualizados." });
    } else {
      if (nuevos.includes(nombreNormalizado)) return alert('Este proveedor ya existe');
      nuevos.push(nombreNormalizado);
      updateState({ proveedores: nuevos });
      toast({ title: "Proveedor Registrado", description: "Nuevo aliado comercial añadido con éxito." });
    }
    
    setShowModal(false);
    setEditingId(null);
    setFormData('');
  };

  const handleEdit = (nombre: string, index: number) => {
    setEditingId(index);
    setFormData(nombre);
    setShowModal(true);
  };

  const handleDelete = (nombre: string) => {
    if (!confirm(`¿Seguro que desea eliminar a "${nombre}"? Los productos que lo utilicen quedarán sin proveedor asignado.`)) return;
    const nuevos = state.proveedores.filter(p => p !== nombre);
    updateState({ proveedores: nuevos });
    toast({ title: "Proveedor Eliminado" });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-ink font-black uppercase italic tracking-tighter text-2xl flex items-center gap-2">
            <Truck className="text-brand-gold w-7 h-7" /> GESTIÓN DE PROVEEDORES
          </h2>
          <p className="text-[10px] text-ink font-bold uppercase tracking-widest opacity-60">Catálogo de Aliados y Distribuidores</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setFormData(''); setShowModal(true); }} 
          className="btn btn-primary h-11 px-6 font-black uppercase text-xs flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" /> Nuevo Proveedor
        </button>
      </div>

      <div className="card shadow-lg border-line rounded-xl overflow-hidden bg-white">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-brand-gold" /> DIRECTORIO DE PROVEEDORES ACTIVOS
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-ink opacity-30" />
            <input 
              className="form-input pl-10 h-9 text-xs font-bold uppercase" 
              placeholder="Buscar proveedor..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="text-ink font-black text-[10px] uppercase py-4 px-6 border-b border-line">Nombre del Distribuidor</th>
                <th className="text-ink font-black text-[10px] uppercase py-4 px-6 border-b border-line text-center">Productos Relacionados</th>
                <th className="text-ink font-black text-[10px] uppercase py-4 px-6 border-b border-line text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-20 text-ink/20 font-black uppercase italic">No hay proveedores que coincidan</td></tr>
              ) : (
                filtered.map((p, idx) => {
                  const count = state.productos.filter(prod => prod.proveedor === p).length;
                  return (
                    <tr key={idx} className="border-b border-line/30 hover:bg-surface-warm/20 transition-colors">
                      <td className="text-ink font-black text-xs uppercase py-4 px-6">{p}</td>
                      <td className="text-center py-4 px-6">
                        <span className="badge badge-neutral font-black px-3">{count} ítems</span>
                      </td>
                      <td className="text-right py-4 px-6">
                        <div className="flex justify-end gap-1">
                          <button 
                            onClick={() => handleEdit(p, state.proveedores.indexOf(p))}
                            className="btn-icon h-8 w-8 text-ink hover:text-brand-gold" 
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(p)}
                            className="btn-icon h-8 w-8 text-ink hover:text-status-danger" 
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-5 bg-brand-gold-soft/20 border border-brand-gold/20 rounded-2xl flex items-start gap-4">
        <AlertTriangle className="text-brand-gold-deep w-6 h-6 shrink-0 mt-1" />
        <div>
          <h4 className="text-brand-gold-deep font-black uppercase text-xs mb-1">Integridad de Datos</h4>
          <p className="text-[10px] text-brand-gold-deep/70 font-bold leading-relaxed uppercase">
            Al editar el nombre de un proveedor, el sistema actualizará automáticamente el campo "Proveedor" en todos los productos del inventario vinculados para mantener la coherencia histórica.
          </p>
        </div>
      </div>

      {showModal && (
        <div className="modal show">
          <div className="modal-bg" onClick={() => setShowModal(false)}></div>
          <div className="modal-box bg-white max-w-sm border-2 border-line">
            <div className="modal-head py-4 px-6 border-b border-line bg-surface-soft">
              <h3 className="text-ink font-black uppercase text-sm">
                {editingIndex !== null ? 'Editar Distribuidor' : 'Añadir Proveedor'}
              </h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-ink"/></button>
            </div>
            <div className="modal-body p-6 space-y-4">
              <div className="form-group">
                <label className="text-ink text-[10px] font-black uppercase block mb-1">Nombre Comercial</label>
                <input 
                  className="form-input h-12 text-sm font-black uppercase" 
                  placeholder="Ej: Distribuidora Polar C.A." 
                  value={formData}
                  onChange={e => setFormData(e.target.value)}
                  autoFocus
                />
              </div>
              <button 
                onClick={handleSave} 
                className="btn btn-primary w-full h-14 font-black uppercase text-xs shadow-xl"
              >
                <Save className="w-4 h-4" /> {editingIndex !== null ? 'Guardar Cambios' : 'Registrar Proveedor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
