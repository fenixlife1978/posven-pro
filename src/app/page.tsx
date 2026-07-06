"use client";

import React from 'react';
import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StartPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 animate-bounce">
        <Rocket className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-4">
        ¡Proyecto Reiniciado!
      </h1>
      <p className="text-muted-foreground max-w-md mb-8">
        He eliminado el sistema anterior. Estamos listos para comenzar algo increíble desde cero.
      </p>
      <div className="flex gap-4">
        <Button size="lg">Comenzar a Construir</Button>
      </div>
    </div>
  );
}
