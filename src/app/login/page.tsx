"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff,
  ChevronDown 
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.push('/');
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      toast({ variant: "destructive", title: "Atención", description: "Por favor seleccione su rol." });
      return;
    }
    setLoading(true);

    try {
      // Configuramos persistencia de sesión por pestaña
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Acceso Concedido", description: "Bienvenido al sistema." });
      router.push('/');
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "Error de Acceso", 
        description: "Credenciales inválidas o error de red." 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[440px] bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-12 animate-in fade-in zoom-in duration-500">
        
        {/* LOGO SECCIÓN */}
        <div className="mb-10 text-center sm:text-left">
          <div className="flex items-center gap-3 mb-2 justify-center sm:justify-start">
            <div className="w-11 h-11 bg-[#C8952E] rounded-xl flex items-center justify-center text-black font-black text-2xl shadow-lg shadow-[#C8952E]/20">
              P
            </div>
            <div className="font-display font-black text-2xl text-black tracking-tighter">
              Pos<span className="text-[#C8952E]">VEN</span> Pro
            </div>
          </div>
          <div className="h-1 w-12 bg-[#C8952E] rounded-full hidden sm:block"></div>
        </div>

        {/* TITULOS */}
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-[34px] font-extrabold text-black leading-tight mb-2 tracking-tight">
            ¡Bienvenido!
          </h1>
          <p className="text-[#9CA3AF] text-[15px] font-medium">
            Ingresa tus credenciales para acceder al panel administrativo.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* ROL SELECTOR */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase text-black/40 tracking-widest block ml-1">Seleccionar Rol</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#C8952E] transition-colors">
                <User className="w-5 h-5" />
              </div>
              <select 
                className="w-full h-[56px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl pl-12 pr-10 text-black font-semibold appearance-none focus:border-[#C8952E] focus:bg-white outline-none transition-all cursor-pointer"
                value={role}
                onChange={e => setRole(e.target.value)}
                required
              >
                <option value="" disabled>Selecciona tu rol de acceso</option>
                <option value="administrador">Administrador del Sistema</option>
                <option value="cajero">Cajero / Operador</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* EMAIL INPUT */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase text-black/40 tracking-widest block ml-1">Correo Electrónico</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#C8952E] transition-colors">
                <Mail className="w-5 h-5" />
              </div>
              <input 
                type="email" 
                required
                className="w-full h-[56px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl pl-12 pr-4 text-black font-semibold placeholder:text-[#D1D5DB] focus:border-[#C8952E] focus:bg-white outline-none transition-all"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* PASSWORD INPUT */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase text-black/40 tracking-widest block ml-1">Contraseña</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#C8952E] transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input 
                type={showPassword ? "text" : "password"}
                required
                className="w-full h-[56px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl pl-12 pr-12 text-black font-semibold placeholder:text-[#D1D5DB] focus:border-[#C8952E] focus:bg-white outline-none transition-all"
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

          {/* SUBMIT BUTTON */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full h-[60px] bg-[#C8952E] text-black font-black text-base rounded-2xl flex items-center justify-center hover:bg-[#D9A540] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-[#C8952E]/20 mt-4 uppercase tracking-widest"
          >
            {loading ? (
              <div className="w-6 h-6 border-3 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              "Iniciar Sesión"
            )}
          </button>
        </form>

        {/* FOOTER */}
        <div className="mt-10 pt-8 border-t border-[#F3F4F6] text-center">
          <p className="text-[11px] text-[#9CA3AF] font-bold uppercase tracking-widest">
            © 2026 PosVEN Pro · V 2.5.0
          </p>
        </div>
      </div>
    </div>
  );
}