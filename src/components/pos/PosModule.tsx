"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, DollarSign, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Store } from '@/lib/db-store';
import { Product, CartItem, Sale, PaymentMethod } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { PaymentModal } from './PaymentModal';
import { CreditSaleModal } from './CreditSaleModal';
import { ReceiptModal } from './ReceiptModal';

export function PosModule() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [exchangeRate, setExchangeRate] = useState(36.5);
  const [isCashOpen, setIsCashOpen] = useState(false);
  
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCreditOpen, setIsCreditOpen] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  useEffect(() => {
    setProducts(Store.get('products', []));
    setExchangeRate(Store.get('exchangeRate', 36.5));
    setIsCashOpen(Store.get('isCashOpen', false));
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.barcode.includes(searchTerm)
    ).slice(0, 10);
  }, [searchTerm, products]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Sin Stock", description: "Este producto no tiene existencias.", variant: "destructive" });
      return;
    }
    const existing = cart.find(c => c.productId === product.id);
    if (existing) {
      if (existing.qty >= product.stock) {
        toast({ title: "Stock Máximo", description: "No hay más unidades disponibles.", variant: "destructive" });
        return;
      }
      setCart(cart.map(c => c.productId === product.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { 
        productId: product.id, 
        barcode: product.barcode, 
        name: product.name, 
        price: product.price, 
        qty: 1, 
        maxStock: product.stock 
      }]);
    }
    setSearchTerm('');
  };

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.productId === id) {
        const next = c.qty + delta;
        if (next > c.maxStock) {
          toast({ title: "Stock insuficiente", variant: "destructive" });
          return c;
        }
        return next > 0 ? { ...c, qty: next } : c;
      }
      return c;
    }).filter(c => c.qty > 0));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const totalUSD = subtotal / exchangeRate;

  const handleSaleComplete = (sale: Sale) => {
    setLastSale(sale);
    setIsReceiptOpen(true);
    setCart([]);
    setProducts(Store.get('products', [])); // Refresh stock
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full p-2 lg:p-4 overflow-hidden">
      {/* Sidebar: Search */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        <Card className="bg-secondary border-none shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" />
              Tasa de Cambio: <span className="text-primary">{exchangeRate} BS/$</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Escanee o busque..." 
                className="pl-9 bg-background/50 border-border"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <p className="text-[10px] text-center mt-2 text-muted-foreground">📷 Escáner HID listo para detectar códigos</p>
          </CardContent>
        </Card>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredProducts.map(p => (
            <div 
              key={p.id} 
              className="p-3 bg-card border border-border hover:border-primary cursor-pointer rounded-lg transition-all transform hover:translate-x-1"
              onClick={() => addToCart(p)}
            >
              <div className="flex justify-between items-start">
                <span className="font-semibold text-sm line-clamp-1">{p.name}</span>
                <span className="text-primary font-bold text-sm">Bs. {p.price}</span>
              </div>
              <div className="flex justify-between items-end mt-2">
                <span className="text-[10px] text-muted-foreground font-code">{p.barcode}</span>
                <Badge variant={p.stock <= p.minStock ? "destructive" : "secondary"} className="text-[10px] py-0">
                  Stock: {p.stock}
                </Badge>
              </div>
            </div>
          ))}
          {searchTerm && filteredProducts.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">No se encontraron productos</p>
          )}
        </div>
      </div>

      {/* Main Area: Cart */}
      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col overflow-hidden bg-card border-none shadow-2xl relative">
          {!isCashOpen && (
            <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 text-center">
              <div className="max-w-xs">
                <h3 className="text-xl font-bold mb-2">Caja Cerrada</h3>
                <p className="text-muted-foreground mb-4">Debe abrir una sesión de caja para poder procesar ventas.</p>
              </div>
            </div>
          )}
          
          <CardHeader className="border-b bg-secondary/30">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Carrito de Compra
              </CardTitle>
              <Badge variant="outline" className="text-primary border-primary">
                {cart.length} productos
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <ShoppingCart className="w-16 h-16 mb-4" />
                <p>El carrito está vacío</p>
              </div>
            ) : (
              cart.map((item, i) => (
                <div key={item.productId} className="flex items-center gap-4 p-3 bg-secondary/20 rounded-xl border border-border/50 animate-in slide-in-from-top-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground font-code">{item.barcode}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="w-8 h-8 rounded-full" onClick={() => updateQty(item.productId, -1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-6 text-center font-bold text-sm">{item.qty}</span>
                    <Button variant="outline" size="icon" className="w-8 h-8 rounded-full" onClick={() => updateQty(item.productId, 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="w-24 text-right">
                    <p className="font-bold text-sm">Bs. {(item.price * item.qty).toFixed(2)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => updateQty(item.productId, -999)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
          
          <CardFooter className="flex-col gap-4 border-t bg-secondary/30 p-6">
            <div className="w-full space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>Bs. {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-2xl font-black text-primary">
                <span>TOTAL</span>
                <span>Bs. {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-emerald-500">
                <span>≈ USD</span>
                <span>$ {totalUSD.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 w-full">
              <Button 
                variant="outline" 
                size="lg" 
                className="h-14 font-bold border-2 hover:bg-primary/10"
                disabled={cart.length === 0}
                onClick={() => setIsCreditOpen(true)}
              >
                Venta a Crédito
              </Button>
              <Button 
                size="lg" 
                className="h-14 font-black bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 text-lg uppercase tracking-wider"
                disabled={cart.length === 0}
                onClick={() => setIsPaymentOpen(true)}
              >
                Cobrar Ahora
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      <PaymentModal 
        isOpen={isPaymentOpen} 
        onClose={() => setIsPaymentOpen(false)} 
        cart={cart} 
        exchangeRate={exchangeRate}
        onComplete={handleSaleComplete}
      />
      
      <CreditSaleModal
        isOpen={isCreditOpen}
        onClose={() => setIsCreditOpen(false)}
        cart={cart}
        exchangeRate={exchangeRate}
        onComplete={handleSaleComplete}
      />

      {lastSale && (
        <ReceiptModal 
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          sale={lastSale}
        />
      )}
    </div>
  );
}
