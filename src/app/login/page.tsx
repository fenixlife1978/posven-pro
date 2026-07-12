
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
import { doc, getDoc, setDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [systemEmpty, setSystemEmpty] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Verificar si existen usuarios en el sistema para permitir el registro inicial (Primer Uso)
  useEffect(() => {
    const checkSystemStatus = async () => {
      if (!db) return;
      try {
        // Realizamos una consulta limitada para verificar si la colección de usuarios está vacía
        const q = query(collection(db, 'users'), limit(1));
        const snap = await getDocs(q);
        setSystemEmpty(snap.empty);
      } catch (e) {
        // Si hay error de permisos, asumimos que no está vacío (porque las reglas solo permiten leer a autenticados)
        console.log("Verificando integridad del sistema...");
        setSystemEmpty(false);
      }
    };
    checkSystemStatus();
  }, []);

  // Listener de autenticación para redirección automática
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Buscamos el perfil por UID estrictamente
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.accesoBloqueado) {
              await signOut(auth);
              toast({ 
                variant: "destructive", 
                title: "Acceso Bloqueado", 
                description: "Su acceso ha sido suspendido por administración." 
              });
              setAuthChecked(true);
              return;
            }
            // Usuario válido, vamos al dashboard/pos
            router.push('/');
          } else {
            // Documento de perfil no encontrado para este UID
            await signOut(auth);
            setAuthChecked(true);
          }
        } catch (e) {
          console.error("Error al verificar perfil:", e);
          setAuthChecked(true);
        }
      } else {
        setAuthChecked(true);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      toast({ variant: "destructive", title: "Atención", description: "Por favor seleccione su rol de acceso." });
      return;
    }
    setLoading(true);

    try {
      if (!auth || !db) throw new Error("Servicios de seguridad no disponibles");
      
      // Persistencia solo por sesión del navegador
      await setPersistence(auth, browserSessionPersistence);
      
      let user;
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
      }

      // El documento en Firestore SIEMPRE debe tener el ID = UID de Auth
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Si estamos registrando o el perfil no existe, lo creamos vinculándolo al UID
        const newUserData = {
          email: user.email!.toLowerCase(),
          nombre: email.split('@')[0].toUpperCase(),
          rol: role,
          uid: user.uid,
          fechaCreacion: new Date().toISOString(),
          accesoBloqueado: false
        };
        await setDoc(userDocRef, newUserData);
      } else if (!isRegistering) {
        const userData = userDoc.data();
        
        // Verificación de integridad: Estado y Rol
        if (userData.accesoBloqueado) {
          await signOut(auth);
          toast({ variant: "destructive", title: "Acceso Bloqueado", description: "Consulte con el administrador del sistema." });
          setLoading(false);
          return;
        }
        
        if (userData.rol !== role) {
          await signOut(auth);
          toast({ 
            variant: "destructive", 
            title: "Rol Incorrecto", 
            description: `Usted está registrado como ${userData.rol.toUpperCase()}.` 
          });
          setLoading(false);
          return;
        }
      }

      toast({ 
        title: isRegistering ? "Cuenta Inicial Creada" : "Acceso Exitoso", 
        description: `Iniciando sesión como ${role.toUpperCase()}.` 
      });
      
      router.push('/');
      
    } catch (err: any) {
      console.error('Error de autenticación:', err);
      let msg = "Credenciales incorrectas o error de red.";
      if (err.code === 'auth/email-already-in-use') msg = "El correo ya está registrado.";
      if (err.code === 'auth/weak-password') msg = "La contraseña es demasiado débil.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = "Usuario o contraseña inválidos.";
      }
      
      toast({ variant: "destructive", title: "Fallo de Ingreso", description: msg });
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-surface-warm flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">Iniciando Protocolos...</p>
        </div>
      </div>
    );
  }

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
            {isRegistering ? 'Configurar Administrador' : '¡Bienvenido!'}
          </h1>
          <p className="text-[#9CA3AF] text-[14px] font-medium">
            {isRegistering ? 'Cree la cuenta raíz para la gestión del negocio.' : 'Ingrese sus credenciales de acceso.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-black/40 tracking-widest block ml-1">Perfil de Usuario</label>
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
                <option value="" disabled>Seleccione Rol</option>
                <option value="administrador">Administrador</option>
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
              isRegistering ? "Configurar Acceso Inicial" : "Iniciar Sesión"
            )}
          </button>
        </form>

        {(systemEmpty || isRegistering) && (
          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsRegistering(!isRegistering)} 
              className="text-[11px] font-black text-[#C8952E] hover:underline flex items-center justify-center gap-2 mx-auto uppercase tracking-tighter"
            >
              {isRegistering ? <><LogIn className="w-4 h-4" /> Volver al Ingreso</> : <><UserPlus className="w-4 h-4" /> Registrar Administrador Raíz</>}
            </button>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-[#F3F4F6] text-center">
          <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">PosVEN Pro · Cloud Synchronization Active</p>
        </div>
      </div>
    </div>
  );
}
