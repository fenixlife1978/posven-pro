
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff,
  ChevronDown,
  UserPlus,
  LogIn
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged, 
  setPersistence, 
  browserSessionPersistence, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocId = user.email!.toLowerCase().replace(/\W/g, '_');
          const userDoc = await getDoc(doc(db, 'users', userDocId));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.accesoBloqueado) {
              await signOut(auth);
              toast({ variant: "destructive", title: "Acceso Bloqueado", description: "Su acceso ha sido bloqueado automáticamente." });
              return;
            }
            router.push('/');
          }
        } catch (e) {
          console.error("Error checking profile:", e);
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      toast({ variant: "destructive", title: "Atención", description: "Por favor seleccione su rol." });
      return;
    }
    setLoading(true);

    try {
      if (!auth) throw new Error("Firebase Auth no inicializado");
      await setPersistence(auth, browserSessionPersistence);
      
      let user;
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
      }

      const userDocId = user.email!.toLowerCase().replace(/\W/g, '_');
      const userDocRef = doc(db, 'users', userDocId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        const newUserData = {
          email: user.email!.toLowerCase(),
          nombre: email.split('@')[0] || 'Usuario',
          rol: role,
          uid: user.uid,
          fechaCreacion: new Date().toISOString(),
          accesoBloqueado: false
        };
        await setDoc(userDocRef, newUserData);
      } else if (!isRegistering) {
        const userData = userDoc.data();
        if (userData.accesoBloqueado) {
          await signOut(auth);
          toast({ variant: "destructive", title: "Acceso Bloqueado", description: "Usted requiere autorización administrativa." });
          setLoading(false);
          return;
        }
      }

      toast({ title: isRegistering ? "Cuenta Creada" : "Bienvenido", description: `Acceso concedido como ${role}.` });
      router.push('/');
    } catch (err: any) {
      console.error('Error de auth:', err);
      let msg = "Error de red o credenciales inválidas.";
      if (err.code === 'auth/email-already-in-use') msg = "El correo ya está registrado.";
      if (err.code === 'auth/weak-password') msg = "La contraseña debe tener al menos 6 caracteres.";
      
      toast({ variant: "destructive", title: "Error de Acceso", description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#D4C5A6] via-[#C8B99A] to-[#B8A98A] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[440px] bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.25)] p-10 animate-in fade-in zoom-in duration-500">
        <div className="mb-8 text-center sm:text-left">
          <div className="flex items-center gap-3 mb-2 justify-center sm:justify-start">
            <div className="w-11 h-11 bg-[#C8952E] rounded-xl flex items-center justify-center text-black font-black text-2xl shadow-lg shadow-[#C8952E]/20">P</div>
            <div className="font-display font-black text-2xl text-black tracking-tighter">Pos<span className="text-[#C8952E]">VEN</span> Pro</div>
          </div>
          <div className="h-1 w-12 bg-[#C8952E] rounded-full hidden sm:block"></div>
        </div>

        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-[28px] font-extrabold text-black leading-tight mb-2 tracking-tight">
            {isRegistering ? 'Crear Cuenta Nueva' : '¡Bienvenido de nuevo!'}
          </h1>
          <p className="text-[#9CA3AF] text-[14px] font-medium">
            {isRegistering ? 'Regístrate para configurar tu acceso inicial.' : 'Ingresa tus credenciales para acceder al panel.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-black/40 tracking-widest block ml-1">Rol de Acceso</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#C8952E] transition-colors">
                <User className="w-5 h-5" />
              </div>
              <select 
                className="w-full h-[52px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl pl-12 pr-10 text-black font-semibold appearance-none focus:border-[#C8952E] focus:bg-white outline-none transition-all cursor-pointer" 
                value={role} 
                onChange={e => setRole(e.target.value)} 
                required
              >
                <option value="" disabled>Selecciona tu rol</option>
                <option value="administrador">Administrador del Sistema</option>
                <option value="cajero">Cajero / Operador</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-black/40 tracking-widest block ml-1">Correo Electrónico</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#C8952E] transition-colors">
                <Mail className="w-5 h-5" />
              </div>
              <input 
                type="email" 
                required 
                className="w-full h-[52px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl pl-12 pr-4 text-black font-semibold placeholder:text-[#D1D5DB] focus:border-[#C8952E] focus:bg-white outline-none transition-all" 
                placeholder="ejemplo@correo.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-black/40 tracking-widest block ml-1">Contraseña</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#C8952E] transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                className="w-full h-[52px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl pl-12 pr-12 text-black font-semibold placeholder:text-[#D1D5DB] focus:border-[#C8952E] focus:bg-white outline-none transition-all" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#C8952E] transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full h-[56px] bg-[#C8952E] text-black font-black text-sm rounded-2xl flex items-center justify-center hover:bg-[#D9A540] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-[#C8952E]/20 mt-4 uppercase tracking-widest"
          >
            {loading ? (
              <div className="w-6 h-6 border-3 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              isRegistering ? "Crear Mi Cuenta" : "Iniciar Sesión"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegistering(!isRegistering)} 
            className="text-[12px] font-bold text-[#C8952E] hover:underline flex items-center justify-center gap-2 mx-auto uppercase tracking-tighter"
          >
            {isRegistering ? <><LogIn className="w-4 h-4" /> Ya tengo cuenta, ingresar</> : <><UserPlus className="w-4 h-4" /> No tengo cuenta, registrarme</>}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-[#F3F4F6] text-center">
          <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">© 2026 PosVEN Pro · Cloud Sync Active</p>
        </div>
      </div>
    </div>
  );
}
