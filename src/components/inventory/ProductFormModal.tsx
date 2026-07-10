"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Product } from '@/lib/types';
import { Store, Utils } from '@/lib/db-store';
import { toast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product?: Product;
  onSave: () => void;
  state: any;
  updateState: (newState: any) => void;
}

export function ProductFormModal({ isOpen, onClose, product, onSave, state, updateState }: Props) {
  // Usamos `any` para permitir strings en los campos de monto
  const [formData, setFormData] = useState<any>({
    codigo: '',
    nombre: '',
    categoria: 'Ron',
    precioUSD: '0',
    stock: 0,
    stockMinimo: 5,
    costoUSD: '0',
    marca: '',
    proveedor: '',
    departamento: 'Licores',
    cantidad: '750ml',
    activo: true
  });

  useEffect(() => {
    if (product) {
      setFormData({
        codigo: product.codigo || '',
        nombre: product.nombre || '',
        categoria: product.categoria || 'Ron',
        precioUSD: product.precioUSD?.toString() ?? '0',
        stock: product.stock || 0,
        stockMinimo: product.stockMinimo || 5,
        costoUSD: product.costoUSD?.toString() ?? '0',
        marca: product.marca || '',
        proveedor: product.proveedor || '',
        departamento: product.departamento || 'Licores',
        cantidad: product.cantidad || '750ml',
        activo: product.activo !== undefined ? product.activo : true
      });
    } else {
      setFormData({
        codigo: '',
        nombre: '',
        categoria: 'Ron',
        precioUSD: '0',
        stock: 0,
        stockMinimo: 5,
        costoUSD: '0',
        marca: '',
        proveedor: '',
        departamento: 'Licores',
        cantidad: '750ml',
        activo: true
      });
    }
  }, [product, isOpen]);

  const handleSave = () => {
    if (!formData.nombre || !formData.codigo || !formData.precioUSD) {
      toast({ title: "Datos incompletos", description: "Nombre, código y precio son obligatorios", variant: "destructive" });
      return;
    }

    // Convertir los montos a número con parseFloat (mantiene precisión)
    const precioUSDNum = parseFloat(formData.precioUSD) || 0;
    const costoUSDNum = parseFloat(formData.costoUSD) || 0;

    let productosActualizados = [...state.productos];

    if (product) {
      // Editar producto existente
      const idx = productosActualizados.findIndex(p => p.id === product.id);
      if (idx >= 0) {
        productosActualizados[idx] = { 
          ...productosActualizados[idx], 
          ...formData,
          precioUSD: precioUSDNum,
          costoUSD: costoUSDNum,
          margen: precioUSDNum - costoUSDNum,
          id: product.id,
          fechaCreacion: product.fechaCreacion || Utils.hoy()
        } as Product;
      }
    } else {
      // Crear nuevo producto
      const newProduct: Product = {
        id: Store.uid(),
        codigo: formData.codigo || '',
        nombre: formData.nombre || '',
        categoria: formData.categoria || 'Ron',
        departamento: formData.departamento || 'Licores',
        cantidad: formData.cantidad || '750ml',
        marca: formData.marca || '',
        proveedor: formData.proveedor || '',
        costoUSD: costoUSDNum,
        precioUSD: precioUSDNum,
        margen: precioUSDNum - costoUSDNum,
        stock: formData.stock || 0,
        stockMinimo: formData.stockMinimo || 5,
        fechaCreacion: Utils.hoy(),
        activo: true
      };
      productosActualizados.push(newProduct);
    }

    // Actualizar estado
    updateState({ productos: productosActualizados });
    toast({ title: "Producto Guardado", description: `${formData.nombre} ha sido guardado exitosamente` });
    onSave();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[#131313] border-[#2a2a2a] text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-[#c8952e]">
            {product ? 'Editar Producto' : 'Nuevo Producto'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-white/70 font-bold uppercase text-xs tracking-wider">Código de Barras</Label>
            <Input 
              value={formData.codigo} 
              onChange={(e) => setFormData({...formData, codigo: e.target.value})}
              className="bg-[#0b0b0b] border-[#2a2a2a] text-white"
              placeholder="Escanee o ingrese código"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-white/70 font-bold uppercase text-xs tracking-wider">Nombre del Producto</Label>
            <Input 
              value={formData.nombre} 
              onChange={(e) => setFormData({...formData, nombre: e.target.value})}
              className="bg-[#0b0b0b] border-[#2a2a2a] text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-white/70 font-bold uppercase text-xs tracking-wider">Categoría</Label>
              <Input 
                value={formData.categoria} 
                onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                className="bg-[#0b0b0b] border-[#2a2a2a] text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white/70 font-bold uppercase text-xs tracking-wider">Precio USD</Label>
              <Input 
                type="text"
                inputMode="decimal"
                value={formData.precioUSD}
                onChange={(e) => {
                  const val = e.target.value;
                  // Permitir solo números, punto y un solo punto decimal
                  if (/^[\d]*\.?[\d]*$/.test(val) || val === '') {
                    setFormData({...formData, precioUSD: val});
                  }
                }}
                className="bg-[#0b0b0b] border-[#2a2a2a] text-white font-mono"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-white/70 font-bold uppercase text-xs tracking-wider">Costo USD</Label>
              <Input 
                type="text"
                inputMode="decimal"
                value={formData.costoUSD}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[\d]*\.?[\d]*$/.test(val) || val === '') {
                    setFormData({...formData, costoUSD: val});
                  }
                }}
                className="bg-[#0b0b0b] border-[#2a2a2a] text-white font-mono"
                placeholder="0.0000"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white/70 font-bold uppercase text-xs tracking-wider">Marca</Label>
              <Input 
                value={formData.marca} 
                onChange={(e) => setFormData({...formData, marca: e.target.value})}
                className="bg-[#0b0b0b] border-[#2a2a2a] text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-white/70 font-bold uppercase text-xs tracking-wider">Stock Inicial</Label>
              <Input 
                type="number"
                value={formData.stock} 
                onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                className="bg-[#0b0b0b] border-[#2a2a2a] text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white/70 font-bold uppercase text-xs tracking-wider">Stock Mínimo</Label>
              <Input 
                type="number"
                value={formData.stockMinimo} 
                onChange={(e) => setFormData({...formData, stockMinimo: parseInt(e.target.value) || 5})}
                className="bg-[#0b0b0b] border-[#2a2a2a] text-white"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-white/70 font-bold uppercase text-xs tracking-wider">Proveedor</Label>
            <Input 
              value={formData.proveedor} 
              onChange={(e) => setFormData({...formData, proveedor: e.target.value})}
              className="bg-[#0b0b0b] border-[#2a2a2a] text-white"
              placeholder="Proveedor del producto"
            />
          </div>
        </div>

        <Button 
          className="w-full h-12 mt-4 bg-[#c8952e] text-[#0b0b0b] font-black uppercase tracking-widest hover:bg-[#d9a540]"
          onClick={handleSave}
        >
          {product ? 'Actualizar Producto' : 'Crear Producto'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}