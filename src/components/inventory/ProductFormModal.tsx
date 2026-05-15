"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Product } from '@/lib/types';
import { Store } from '@/lib/db-store';
import { toast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product?: Product;
  onSave: () => void;
}

export function ProductFormModal({ isOpen, onClose, product, onSave }: Props) {
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', barcode: '', category: 'Ron', price: 0, stock: 0, minStock: 5, description: ''
  });

  useEffect(() => {
    if (product) setFormData(product);
    else setFormData({ name: '', barcode: '', category: 'Ron', price: 0, stock: 0, minStock: 5, description: '' });
  }, [product, isOpen]);

  const handleSave = () => {
    if (!formData.name || !formData.barcode || !formData.price) {
      toast({ title: "Datos incompletos", variant: "destructive" });
      return;
    }

    const all = Store.get<Product[]>('products', []);
    if (product) {
      const idx = all.findIndex(p => p.id === product.id);
      if (idx >= 0) all[idx] = { ...all[idx], ...formData } as Product;
    } else {
      const nextId = Store.get('nextProductId', 20);
      const newProd = { ...formData, id: `P-${String(nextId).padStart(3, '0')}` } as Product;
      all.push(newProd);
      Store.set('nextProductId', nextId + 1);
    }
    
    Store.set('products', all);
    toast({ title: "Producto Guardado" });
    onSave();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-none text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-primary">
            {product ? 'Editar Producto' : 'Nuevo Producto'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Código de Barras</Label>
            <Input 
              value={formData.barcode} 
              onChange={(e) => setFormData({...formData, barcode: e.target.value})}
              className="font-code bg-secondary/50"
              placeholder="Escanee o ingrese código"
            />
          </div>
          <div className="space-y-1">
            <Label>Nombre del Producto</Label>
            <Input 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="bg-secondary/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Categoría</Label>
              <Input 
                value={formData.category} 
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-1">
              <Label>Precio BS</Label>
              <Input 
                type="number"
                value={formData.price} 
                onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                className="bg-secondary/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Stock Inicial</Label>
              <Input 
                type="number"
                value={formData.stock} 
                onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value)})}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-1">
              <Label>Stock Mínimo</Label>
              <Input 
                type="number"
                value={formData.minStock} 
                onChange={(e) => setFormData({...formData, minStock: parseInt(e.target.value)})}
                className="bg-secondary/50"
              />
            </div>
          </div>
        </div>

        <Button className="w-full h-12 mt-4 bg-primary font-black uppercase tracking-widest" onClick={handleSave}>
          Guardar Cambios
        </Button>
      </DialogContent>
    </Dialog>
  );
}
