"use client";

import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Edit2, Shield, X, Save, Users as UsersIcon, Mail, Lock, User as UserIcon, Ban, CheckCircle2 } from 'lucide-react';
import { db, firebaseConfig } from '@/lib/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  username: string;
  nombre: string;
  email: string;
  rol: 'administrador' | 'cajero';
  fechaCreacion: string;
  uid: string;
  firebaseUid?: string | null;
  accesoBloqueado?: boolean;
  isSeedAdmin?: boolean;
}

const emptyForm = { username: '', nombre: '', email: '', password: '', rol: 'cajero' as 'administrador' | 'cajero' };

export default function UsersModule() {
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [usingTurso, setUsingTurso] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const cargarUsuarios = async () => {
    try {
      const response = await fetch('/api/users', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setUsingTurso(true);
        setUsuarios((data.users || []).map((u: any) => ({
          ...u,
          uid: u.firebaseUid || u.id,
          fechaCreacion: u.fechaCreacion || ''
        })));
        return;
      }
      if (response.status !== 503) throw new Error((await response.json().catch(() => ({}))).error || 'No autorizado.');
    } catch (error) {
      // Turso no configurado: durante la transición conservamos el módulo Firebase.
      if (String(error).includes('No autorizado')) throw error;
    }

    const querySnapshot = await getDocs(collection(db, 'users'));
    const list: UserProfile[] = [];
    querySnapshot.forEach((d) => {
      const data: any = d.data();
      list.push({
        id: d.id,
        uid: data.uid || d.id,
        username: data.username || data.email?.split('@')[0] || d.id,
        nombre: data.nombre || '',
        email: data.email || '',
        rol: data.rol,
        fechaCreacion: data.fechaCreacion || '',
        accesoBloqueado: !!data.accesoBloqueado,
        isSeedAdmin: false,
        firebaseUid: data.uid || d.id
      });
    });
    setUsingTurso(false);
    setUsuarios(list);
  };

  useEffect(() => {
    cargarUsuarios().catch(error => {
      console.error('Error cargando usuarios:', error);
      toast({ title: 'No se pudieron cargar los usuarios', description: String(error?.message || error), variant: 'destructive' });
    });
  }, []);

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.nombre.trim() || !formData.email.trim() || (!editingId && !formData.password)) {
      alert('Por favor complete todos los campos requeridos.');
      return;
    }
    if (!editingId && !formData.username.trim()) {
      alert('El usuario de ingreso es obligatorio.');
      return;
    }

    setLoading(true);
    let secondaryApp: any = null;

    try {
      if (usingTurso) {
        if (editingId) {
          const response = await fetch('/api/users/' + encodeURIComponent(editingId), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: formData.nombre.trim(), rol: formData.rol })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el usuario.');
        } else {
          const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: formData.username.trim(),
              email: formData.email.trim(),
              nombre: formData.nombre.trim().toUpperCase(),
              password: formData.password,
              rol: formData.rol
            })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'No se pudo crear el usuario.');
        }
        toast({ title: editingId ? 'Perfil actualizado' : 'Usuario creado', description: 'Los datos quedaron guardados en Turso.' });
      } else if (editingId) {
        const userRef = doc(db, 'users', editingId);
        await updateDoc(userRef, { nombre: formData.nombre, rol: formData.rol });
        toast({ title: 'Perfil actualizado', description: 'Los cambios se guardaron correctamente.' });
      } else {
        secondaryApp = initializeApp(firebaseConfig, 'SecondaryAuthApp_' + Date.now());
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        const newUid = userCredential.user.uid;
        await setDoc(doc(db, 'users', newUid), {
          uid: newUid,
          nombre: formData.nombre.toUpperCase(),
          email: formData.email.toLowerCase(),
          rol: formData.rol,
          fechaCreacion: new Date().toISOString(),
          accesoBloqueado: false
        });
        toast({ title: 'Usuario creado', description: 'Acceso configurado exitosamente.' });
      }

      closeModal();
      await cargarUsuarios();
    } catch (error: any) {
      console.error('Error al procesar usuario:', error);
      let msg = error?.message || 'Error técnico al procesar el registro.';
      if (error?.code === 'auth/email-already-in-use') msg = 'El correo ya está registrado.';
      alert(msg);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
      setLoading(false);
    }
  };

  const handleEdit = (u: UserProfile) => {
    setEditingId(u.id);
    setFormData({
      username: u.username || '',
      nombre: u.nombre,
      email: u.email,
      password: '',
      rol: u.rol
    });
    setShowModal(true);
  };

  const handleBlocked = async (u: UserProfile) => {
    if (!usingTurso) {
      alert('La activación/desactivación de usuarios se gestionará en Turso durante la migración.');
      return;
    }
    const action = u.accesoBloqueado ? 'activar' : 'desactivar';
    if (!confirm('¿Desea ' + action + ' el acceso de ' + u.nombre + '?')) return;
    setLoading(true);
    try {
      const response = await fetch('/api/users/' + encodeURIComponent(u.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accesoBloqueado: !u.accesoBloqueado })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo cambiar el estado del usuario.');
      toast({ title: u.accesoBloqueado ? 'Usuario activado' : 'Usuario desactivado' });
      await cargarUsuarios();
    } catch (error: any) {
      alert(error?.message || 'No se pudo cambiar el estado.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (u: UserProfile) => {
    if (u.isSeedAdmin) {
      alert('El administrador semilla no puede eliminarse. Puede desactivarse si existe otro administrador activo.');
      return;
    }
    if (!confirm('¿Está seguro de eliminar este acceso? Esta acción elimina el perfil de usuarios.')) return;
    try {
      if (usingTurso) {
        const response = await fetch('/api/users/' + encodeURIComponent(u.id), { method: 'DELETE' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo eliminar el usuario.');
      } else {
        await deleteDoc(doc(db, 'users', u.id));
      }
      await cargarUsuarios();
      toast({ title: 'Registro eliminado' });
    } catch (error: any) {
      alert(error?.message || 'Error al eliminar el usuario.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-ink font-black uppercase italic tracking-tighter text-2xl">Gestión de Usuarios</h2>
          <p className="text-[10px] text-ink font-bold uppercase tracking-widest opacity-60">Control de Accesos y Roles del Sistema</p>
        </div>
        <button onClick={() => { setEditingId(null); setFormData(emptyForm); setShowModal(true); }} className="btn btn-primary h-11 px-6 font-black uppercase text-xs flex items-center gap-2 shadow-lg">
          <UserPlus className="w-4 h-4" /> Crear Nuevo Usuario
        </button>
      </div>

      <div className="card shadow-xl border-line rounded-xl overflow-hidden">
        <div className="card-head bg-ink border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-black text-xs uppercase italic tracking-tighter flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-brand-gold" /> PERSONAL AUTORIZADO
          </h3>
          <span className="text-[9px] font-black uppercase text-white/50">{usingTurso ? 'TURSO' : 'FIREBASE · TRANSICIÓN'}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="bg-surface-soft">
                <th className="text-ink font-black text-[10px] uppercase">Nombre</th>
                <th className="text-ink font-black text-[10px] uppercase">Usuario / Email</th>
                <th className="text-ink font-black text-[10px] uppercase">Rol</th>
                <th className="text-ink font-black text-[10px] uppercase">Estado</th>
                <th className="text-ink font-black text-[10px] uppercase">Registro</th>
                <th className="text-ink font-black text-[10px] uppercase text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {usuarios.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-20 text-ink/20 font-black uppercase italic">No hay usuarios configurados</td></tr>
              ) : (
                usuarios.map(u => (
                  <tr key={u.id} className="border-b border-line/40 hover:bg-surface-warm/20 transition-colors">
                    <td className="text-ink font-black text-xs uppercase">{u.nombre}</td>
                    <td>
                      <div className="text-ink font-bold text-xs">{u.username || u.email}</div>
                      <div className="text-[9px] text-ink/50">{u.email}</div>
                      <div className="text-[8px] font-black text-ink/40 mono">ID: {u.firebaseUid || u.id}</div>
                    </td>
                    <td>
                      <span className={`badge ${u.rol === 'administrador' ? 'badge-info' : 'badge-neutral'} font-black text-[8px] uppercase px-3`}>{u.rol}</span>
                      {u.isSeedAdmin && <div className="text-[8px] font-black text-brand-gold-deep uppercase mt-1">Administrador semilla</div>}
                    </td>
                    <td>
                      <span className={`badge ${u.accesoBloqueado ? 'badge-danger' : 'badge-success'} font-black text-[8px] uppercase px-3`}>
                        {u.accesoBloqueado ? 'Desactivado' : 'Activo'}
                      </span>
                    </td>
                    <td className="text-ink font-bold text-xs opacity-60">{u.fechaCreacion ? u.fechaCreacion.slice(0, 10) : '-'}</td>
                    <td className="text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => handleEdit(u)} className="btn-icon h-8 w-8 text-ink hover:text-brand-gold" title="Modificar"><Edit2 className="w-4 h-4"/></button>
                        {usingTurso && (
                          <button onClick={() => handleBlocked(u)} disabled={loading} className={`btn-icon h-8 w-8 ${u.accesoBloqueado ? 'text-status-success' : 'text-status-danger'}`} title={u.accesoBloqueado ? 'Activar' : 'Desactivar'}>
                            {u.accesoBloqueado ? <CheckCircle2 className="w-4 h-4"/> : <Ban className="w-4 h-4"/>}
                          </button>
                        )}
                        <button onClick={() => handleDelete(u)} className="btn-icon h-8 w-8 text-ink hover:text-status-danger" title={u.isSeedAdmin ? 'Protegido' : 'Eliminar'}><Trash2 className="w-4 h-4"/></button>
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
          <div className="modal-bg" onClick={() => !loading && closeModal()}></div>
          <div className="modal-box bg-white max-w-md border-2 border-line">
            <div className="modal-head py-4 px-6 border-b border-line bg-surface-soft">
              <h3 className="text-ink font-black uppercase text-sm flex items-center gap-2"><Shield className="w-5 h-5 text-brand-gold" /> {editingId ? 'Editar Perfil' : 'Nuevo Acceso'}</h3>
              <button onClick={() => !loading && closeModal()} className="text-ink hover:text-brand-gold"><X /></button>
            </div>
            <div className="modal-body p-6 space-y-5">
              {!editingId && (
                <div className="form-group">
                  <label className="text-ink text-[10px] font-black uppercase block mb-1">Usuario de Ingreso</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-ink opacity-30" />
                    <input className="form-input pl-10" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="Ej: juanperez" />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="text-ink text-[10px] font-black uppercase block mb-1">Nombre Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-ink opacity-30" />
                  <input className="form-input pl-10" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: JUAN PEREZ" />
                </div>
              </div>

              <div className={`form-group ${editingId ? 'opacity-40 pointer-events-none' : ''}`}>
                <label className="text-ink text-[10px] font-black uppercase block mb-1">Email de Ingreso</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-ink opacity-30" />
                  <input type="email" className="form-input pl-10" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="user@posven.pro" />
                </div>
              </div>

              {!editingId && (
                <div className="form-group">
                  <label className="text-ink text-[10px] font-black uppercase block mb-1">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-ink opacity-30" />
                    <input type="password" minLength={6} className="form-input pl-10" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Mín. 6 caracteres" />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="text-ink text-[10px] font-black uppercase block mb-1">Permisos</label>
                <select className="form-select h-11 font-black uppercase text-xs" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value as any})}>
                  <option value="cajero">Cajero / Operador</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>

              <button onClick={handleSave} disabled={loading} className="btn btn-primary w-full h-14 font-black uppercase text-sm mt-4 shadow-xl">
                <Save className="w-4 h-4" /> {loading ? 'PROCESANDO...' : (editingId ? 'ACTUALIZAR DATOS' : 'CREAR USUARIO')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
