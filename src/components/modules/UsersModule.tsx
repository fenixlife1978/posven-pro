"use client";

import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Edit2, Shield, X, Save, Users as UsersIcon, Mail, Lock, User as UserIcon } from 'lucide-react';
import { db, firebaseConfig } from '@/lib/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  rol: 'administrador' | 'cajero';
  fechaCreacion: string;
}

export default function UsersModule() {
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'cajero' as 'administrador' | 'cajero'
  });

  const cargarUsuarios = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const list: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      setUsuarios(list);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const handleSave = async () => {
    if (!formData.nombre || !formData.email || (!editingId && !formData.password)) {
      alert("Por favor complete todos los campos requeridos.");
      return;
    }

    setLoading(true);
    let secondaryApp;

    try {
      if (editingId) {
        const userRef = doc(db, 'users', editingId);
        await updateDoc(userRef, {
          nombre: formData.nombre,
          rol: formData.rol
        });
        toast({ title: "Éxito", description: "Perfil actualizado correctamente." });
      } else {
        // 1. Crear usuario en Firebase Auth usando una APP SECUNDARIA
        // Esto evita que el administrador actual sea deslogueado
        secondaryApp = initializeApp(firebaseConfig, "SecondaryAuthApp");
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          formData.email, 
          formData.password
        );

        // 2. Crear perfil en Firestore
        const newId = formData.email.replace(/\W/g, '_');
        await setDoc(doc(db, 'users', newId), {
          uid: userCredential.user.uid,
          nombre: formData.nombre,
          email: formData.email,
          rol: formData.rol,
          fechaCreacion: new Date().toISOString()
        });

        toast({ 
          title: "Usuario Creado", 
          description: "Acceso y perfil configurados con éxito." 
        });
      }
      
      setShowModal(false);
      setEditingId(null);
      setFormData({ nombre: '', email: '', password: '', rol: 'cajero' });
      await cargarUsuarios();

    } catch (error: any) {
      console.error("Error al crear usuario:", error);
      const msg = error.code === 'auth/email-already-in-use' 
        ? "El correo ya está registrado en el sistema." 
        : "Error técnico al procesar el registro.";
      alert(msg);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setLoading(false);
    }
  };

  const handleEdit = (u: UserProfile) => {
    setEditingId(u.id);
    setFormData({
      nombre: u.nombre,
      email: u.email,
      password: '',
      rol: u.rol
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar este acceso? El perfil será borrado de Firestore (El acceso Auth deberá borrarse manualmente en la consola por seguridad).")) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      await cargarUsuarios();
      toast({ title: "Registro eliminado" });
    } catch (error) {
      alert("Error al eliminar el documento.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-ink font-black uppercase italic tracking-tighter text-2xl">Gestión de Usuarios</h2>
          <p className="text-[10px] text-ink font-bold uppercase tracking-widest opacity-60">Control de Accesos y Roles del Sistema</p>
        </div>
        <button onClick={() => { setEditingId(null); setShowModal(true); }} className="btn btn-primary h-11 px-6 font-black uppercase text-xs flex items-center gap-2 shadow-lg">
          <UserPlus className="w-4 h-4" /> Crear Nuevo Usuario
        </button>
      </div>

      <div className="card shadow-xl border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-brand-gold" /> LISTADO DE PERSONAL AUTORIZADO
          </h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="text-ink font-black text-[10px] uppercase">Nombre y Apellido</th>
                <th className="text-ink font-black text-[10px] uppercase">Correo Electrónico</th>
                <th className="text-ink font-black text-[10px] uppercase">Rol de Usuario</th>
                <th className="text-ink font-black text-[10px] uppercase">Fecha Ingreso</th>
                <th className="text-ink font-black text-[10px] uppercase text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {usuarios.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-20 text-ink/20 font-black uppercase italic">No se han registrado usuarios</td></tr>
              ) : (
                usuarios.map(u => (
                  <tr key={u.id} className="border-b border-line/40 hover:bg-surface-warm/20 transition-colors">
                    <td className="text-ink font-black text-xs uppercase">{u.nombre}</td>
                    <td className="text-ink font-bold text-xs">{u.email}</td>
                    <td>
                      <span className={`badge ${u.rol === 'administrador' ? 'badge-info' : 'badge-neutral'} font-black text-[9px] uppercase px-3`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="text-ink font-bold text-xs opacity-60">
                      {u.fechaCreacion ? u.fechaCreacion.slice(0, 10) : '-'}
                    </td>
                    <td className="text-center">
                       <div className="flex justify-center gap-2">
                          <button onClick={() => handleEdit(u)} className="btn-icon h-8 w-8 text-ink hover:text-brand-gold" title="Modificar Datos"><Edit2 className="w-4 h-4"/></button>
                          <button onClick={() => handleDelete(u.id)} className="btn-icon h-8 w-8 text-ink hover:text-status-danger" title="Eliminar"><Trash2 className="w-4 h-4"/></button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal show">
          <div className="modal-bg" onClick={() => setShowModal(false)}></div>
          <div className="modal-box bg-white max-w-md border-2 border-line">
            <div className="modal-head py-4 px-6 border-b border-line bg-surface-soft">
              <h3 className="text-ink font-black uppercase text-sm flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-gold" /> {editingId ? 'Editar Perfil de Usuario' : 'Crear Acceso Nuevo'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-ink hover:text-brand-gold"><X /></button>
            </div>
            <div className="modal-body p-6 space-y-5">
              <div className="form-group">
                <label className="text-ink text-[10px] font-black uppercase block mb-1">Nombre Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-ink opacity-30" />
                  <input className="form-input pl-10" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Juan Pérez" />
                </div>
              </div>
              
              <div className={`form-group ${editingId ? 'opacity-40 pointer-events-none' : ''}`}>
                <label className="text-ink text-[10px] font-black uppercase block mb-1">Correo Electrónico (Login)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-ink opacity-30" />
                  <input type="email" className="form-input pl-10" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="admin@empresa.com" />
                </div>
              </div>

              {!editingId && (
                <div className="form-group">
                  <label className="text-ink text-[10px] font-black uppercase block mb-1">Contraseña de Acceso</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-ink opacity-30" />
                    <input type="password" minLength={6} className="form-input pl-10" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Min. 6 caracteres" />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="text-ink text-[10px] font-black uppercase block mb-1">Rol y Permisos</label>
                <select className="form-select" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value as any})}>
                  <option value="cajero">Cajero (Operativo)</option>
                  <option value="administrador">Administrador (Total)</option>
                </select>
              </div>

              <div className="p-3 bg-brand-gold-soft/20 rounded border border-brand-gold/10">
                <p className="text-[9px] text-brand-gold-deep font-bold italic text-center leading-tight">
                  {editingId ? 'Solo se permite modificar el nombre y el rol por seguridad.' : 'El sistema creará automáticamente el acceso en Firebase Auth y el perfil en Firestore.'}
                </p>
              </div>

              <button onClick={handleSave} disabled={loading} className="btn btn-primary w-full h-14 font-black uppercase text-sm mt-4 shadow-xl">
                <Save className="w-4 h-4" /> {loading ? 'PROCESANDO REGISTRO...' : (editingId ? 'ACTUALIZAR DATOS' : 'CREAR USUARIO COMPLETO')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
