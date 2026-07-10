"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  ChevronDown 
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.push('/');
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Acceso Concedido", description: "Bienvenido al sistema." });
      router.push('/');
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "Error de Acceso", 
        description: "Credenciales inválidas." 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] bg-white rounded-[32px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] p-10">
        
        {/* LOGO */}
        <div className="mb-8">
          <div className="w-10 h-10 bg-[#C8952E] rounded-xl flex items-center justify-center text-black font-black text-xl mb-2">
            P
          </div>
          <div className="font-display font-black text-xl text-black tracking-tight">
            Pos<span className="text-[#C8952E]">VEN</span> Pro
          </div>
        </div>

        {/* TITULOS */}
        <div className="mb-10">
          <h1 className="text-[32px] font-bold text-black leading-tight mb-2">
            ¡Bienvenido de nuevo!
          </h1>
          <p className="text-[#9CA3AF] text-sm font-medium">
            Ingresa tus credenciales para acceder al panel
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* ROL */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-black block">Rol</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                <User className="w-5 h-5" />
              </div>
              <select 
                className="w-full h-[52px] bg-white border border-[#E5E7EB] rounded-xl pl-12 pr-10 text-[#9CA3AF] appearance-none focus:border-[#C8952E] outline-none transition-all"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                <option value="" disabled>Selecciona tu rol</option>
                <option value="administrador">Administrador</option>
                <option value="cajero">Cajero</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* EMAIL */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-black block">Correo electrónico</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                <Mail className="w-5 h-5" />
              </div>
              <input 
                type="email" 
                required
                className="w-full h-[52px] bg-white border border-[#E5E7EB] rounded-xl pl-12 pr-4 text-black placeholder:text-[#D1D5DB] focus:border-[#C8952E] outline-none transition-all"
                placeholder="tu@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-black block">Contraseña</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                <Lock className="w-5 h-5" />
              </div>
              <input 
                type="password" 
                required
                className="w-full h-[52px] bg-white border border-[#E5E7EB] rounded-xl pl-12 pr-12 text-black placeholder:text-[#D1D5DB] focus:border-[#C8952E] outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button 
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              >
                <Eye className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* FORGOT PASSWORD */}
          <div className="text-right">
            <button type="button" className="text-xs font-bold text-[#C8952E] hover:underline">
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* SUBMIT */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full h-[56px] bg-[#C8952E] text-black font-bold text-base rounded-xl flex items-center justify-center hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 mt-4"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              "Iniciar Sesión"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
