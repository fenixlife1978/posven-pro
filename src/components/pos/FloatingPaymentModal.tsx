"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, DollarSign, CreditCard, Banknote, Smartphone, Fingerprint, Plane, Plus, Trash2, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  formatBs, 
  formatUsd, 
  formatUsdNumber,
  toCentsBs,
  toCentsUsd,
  fromCentsBs,
  fromCentsUsd,
} from '@/lib/currency-formatter';

interface PaymentItem {
  id: string;
  method: string;
  amount: number;
  usdAmount?: number;
  amountCents: number;
  usdAmountCents?: number;
}

interface FloatingPaymentModalProps {
  total: number;
  totalCents: number;
  exchangeRate: number;
  onClose: () => void;
  onConfirm: (data: { 
    payments: PaymentItem[]; 
    totalPaid: number; 
    totalPaidCents: number;
    change: number; 
    changeCents: number;
    method: string; 
    ajusteRedondeoBs?: number;
    ajusteRedondeoBsCents?: number;
  }) => void;
}

const methods = [
  { id: 'efectivo_bs', label: 'EFECTIVO Bs', icon: Banknote, currency: 'Bs' },
  { id: 'efectivo_usd', label: 'EFECTIVO USD', icon: DollarSign, currency: 'USD' },
  { id: 'punto_venta', label: 'TARJETA', icon: CreditCard, currency: 'Bs' },
  { id: 'biopago', label: 'BIOPAGO', icon: Fingerprint, currency: 'Bs' },
  { id: 'pagomovil', label: 'PAGO MÓVIL', icon: Smartphone, currency: 'Bs' },
  { id: 'zelle', label: 'ZELLE', icon: Plane, currency: 'USD' },
];

export default function FloatingPaymentModal({ 
  total, 
  totalCents, 
  exchangeRate, 
  onClose, 
  onConfirm 
}: FloatingPaymentModalProps) {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [currentMethod, setCurrentMethod] = useState('efectivo_bs');
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentMethodObj = methods.find(m => m.id === currentMethod);
  const isUsd = currentMethodObj?.currency === 'USD';

  const totalPaidCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  
  const totalUsdCents = Math.round((totalCents * 100) / Math.round(exchangeRate * 100));
  
  const totalPaidUsdCents = payments.reduce((sum, p) => {
    if (p.usdAmountCents) return sum + p.usdAmountCents;
    return sum + Math.round((p.amountCents * 100) / Math.round(exchangeRate * 100));
  }, 0);
  const totalPaidUsd = fromCentsUsd(totalPaidUsdCents);

  const isPaidByUsd = totalPaidUsdCents >= (totalUsdCents - 1);
  const isFullyPaid = isPaidByUsd || (totalPaidCents >= totalCents - 1);

  const remainingCents = isFullyPaid ? 0 : Math.max(0, totalCents - totalPaidCents);
  const remaining = fromCentsBs(remainingCents);
  
  let changeCents = Math.max(0, totalPaidCents - totalCents);
  
  if (isPaidByUsd && Math.abs(totalPaidUsdCents - totalUsdCents) <= 1 && changeCents <= 5) {
    changeCents = 0;
  }
  
  const change = fromCentsBs(changeCents);
  const ajusteRedondeoBsCents = (isPaidByUsd && totalPaidCents < totalCents) ? (totalCents - totalPaidCents) : 0;
  const ajusteRedondeoBs = fromCentsBs(ajusteRedondeoBsCents);

  const displayedTotalPaidBsCents = (isPaidByUsd && (ajusteRedondeoBsCents > 0 || (totalPaidCents > totalCents && changeCents === 0))) ? totalCents : totalPaidCents;
  const displayedTotalPaidBs = fromCentsBs(displayedTotalPaidBsCents);

  const addPayment = () => {
    let rawAmount = parseFloat(inputValue);
    if (isNaN(rawAmount) || rawAmount <= 0) return;

    if (isUsd) {
      const usdAmount = rawAmount;
      const usdAmountCents = toCentsUsd(usdAmount);
      const bsAmountCents = Math.round((usdAmountCents * Math.round(exchangeRate * 100)) / 100);
      const bsAmount = fromCentsBs(bsAmountCents);
      const newPayment: PaymentItem = {
        id: crypto.randomUUID(),
        method: currentMethod,
        amount: bsAmount,
        usdAmount: usdAmount,
        amountCents: bsAmountCents,
        usdAmountCents: usdAmountCents,
      };
      setPayments([...payments, newPayment]);
    } else {
      const bsAmount = rawAmount;
      const bsAmountCents = toCentsBs(bsAmount);
      const newPayment: PaymentItem = {
        id: crypto.randomUUID(),
        method: currentMethod,
        amount: bsAmount,
        amountCents: bsAmountCents,
      };
      setPayments([...payments, newPayment]);
    }
    setInputValue('');
    inputRef.current?.focus();
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const setExactAmount = () => {
    const currentRemainingCents = Math.max(0, totalCents - totalPaidCents);
    if (currentRemainingCents <= 0) return;
    
    let amountToAdd = fromCentsBs(currentRemainingCents);
    if (isUsd) {
      if (payments.length === 0) {
        amountToAdd = fromCentsUsd(totalUsdCents);
      } else {
        amountToAdd = fromCentsUsd(Math.round((currentRemainingCents * 100) / Math.round(exchangeRate * 100)));
      }
    }
    setInputValue(amountToAdd.toFixed(2));
  };

  const confirmPayment = useCallback(() => {
    if (!isFullyPaid) return;
    setIsProcessing(true);
    const mainPayment = payments[0] || { method: 'efectivo_bs' };
    
    let finalChangeCents = Math.max(0, totalPaidCents - totalCents);
    if (isPaidByUsd && Math.abs(totalPaidUsdCents - totalUsdCents) <= 1 && finalChangeCents <= 5) {
      finalChangeCents = 0;
    }
    
    const finalChange = fromCentsBs(finalChangeCents);
    const finalTotalPaid = fromCentsBs(totalPaidCents);

    onConfirm({ 
      payments, 
      totalPaid: finalTotalPaid,
      totalPaidCents: totalPaidCents,
      change: finalChange,
      changeCents: finalChangeCents,
      method: mainPayment.method,
      ajusteRedondeoBs,
      ajusteRedondeoBsCents,
    });
    setIsProcessing(false);
  }, [payments, totalPaidCents, totalCents, isFullyPaid, isPaidByUsd, totalPaidUsdCents, totalUsdCents, ajusteRedondeoBs, ajusteRedondeoBsCents, onConfirm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        if (isFullyPaid) confirmPayment();
      }
      if (e.key === 'Enter' && document.activeElement === inputRef.current) {
        e.preventDefault();
        addPayment();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullyPaid, confirmPayment, addPayment, onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const formatPaymentAmount = (payment: PaymentItem) => {
    const methodInfo = methods.find(m => m.id === payment.method);
    if (methodInfo?.currency === 'USD') {
      const usdValue = payment.usdAmount ?? fromCentsUsd(payment.usdAmountCents || 0);
      return formatUsd(usdValue);
    }
    return formatBs(payment.amount);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-2xl shadow-2xl w-[500px] max-w-full border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-[#1A2C4E] p-3 text-white flex justify-between items-center select-none">
          <div className="flex items-center gap-2">
            <Calculator size={18} />
            <h3 className="font-black text-sm uppercase tracking-widest">Pago / Cobro de Venta</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl text-center shadow-sm border border-gray-200/50">
              <span className="text-[10px] font-black text-black/60 uppercase tracking-wider">Total a pagar</span>
              <p className="text-3xl font-black mt-1 text-black">{formatBs(total)}</p>
              <p className="text-xs font-bold text-black/60 mt-0.5">≈ {formatUsd(total / exchangeRate)}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl text-center shadow-sm border border-green-200/50">
              <span className="text-[10px] font-black text-green-700 uppercase tracking-wider">Pagado</span>
              <p className="text-3xl font-black mt-1 text-green-700">{formatBs(displayedTotalPaidBs)}</p>
              {totalPaidUsd > 0 && <p className="text-xs font-bold text-green-600 mt-0.5">USD {formatUsdNumber(totalPaidUsd)}</p>}
            </div>
          </div>

          <div className="max-h-32 overflow-y-auto border rounded-lg bg-gray-50/50 shadow-inner">
            {payments.length === 0 ? (
              <div className="text-center py-6 text-xs text-black/40 font-bold uppercase italic">Sin pagos registrados</div>
            ) : (
              <div className="divide-y border-gray-100">
                {payments.map(p => {
                  const methodInfo = methods.find(m => m.id === p.method);
                  return (
                    <div key={p.id} className="flex justify-between items-center p-2.5 text-xs hover:bg-white transition-colors">
                      <div className="flex items-center gap-2">
                        {methodInfo?.icon && <methodInfo.icon size={14} className="text-[#1A2C4E]" />}
                        <span className="font-black text-black uppercase">{methodInfo?.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-black">{formatPaymentAmount(p)}</span>
                        <button onClick={() => removePayment(p.id)} className="text-red-500 hover:text-red-700 transition-transform active:scale-90">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black uppercase text-black/60 block mb-1 ml-1">Método de pago</label>
              <select
                value={currentMethod}
                onChange={(e) => setCurrentMethod(e.target.value)}
                className="w-full h-11 border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-black bg-white focus:ring-2 focus:ring-[#1A2C4E] focus:border-transparent outline-none uppercase"
              >
                {methods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-black/60 block mb-1 ml-1">Monto a abonar</label>
              <div className="flex gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="flex-1 h-11 border border-gray-300 rounded-xl px-4 py-1.5 text-sm font-black font-mono text-right focus:ring-2 focus:ring-[#1A2C4E] outline-none"
                  placeholder="0.00"
                  onKeyDown={e => e.key === 'Enter' && addPayment()}
                />
                <button onClick={addPayment} className="h-11 w-11 bg-[#1A2C4E] rounded-xl text-white flex items-center justify-center shadow-md active:scale-95 transition-all">
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <button
              onClick={setExactAmount}
              className="flex-1 h-10 bg-gray-100 text-black text-[10px] font-black uppercase tracking-widest rounded-xl border border-gray-300 hover:bg-gray-200 transition-all active:scale-95"
            >
              Monto Exacto
            </button>
            <button
              onClick={addPayment}
              className="flex-1 h-10 bg-[#D4A017] text-black text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md hover:brightness-110 transition-all active:scale-95"
            >
              Agregar al total
            </button>
          </div>

          <div className={cn(
            "rounded-2xl p-4 text-center border shadow-inner transition-all duration-300",
            remainingCents > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
          )}>
            {remainingCents > 0 ? (
              <>
                <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1">Saldo Faltante</p>
                <p className="text-4xl font-black text-red-700 tracking-tighter">{formatBs(remaining)}</p>
                <p className="text-sm font-bold text-red-600 mt-1">≈ {formatUsd(remaining / exchangeRate)}</p>
              </>
            ) : changeCents > 0 ? (
              <>
                <p className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1">Vuelto a entregar (Bs)</p>
                <p className="text-4xl font-black text-green-700 tracking-tighter">{formatBs(change)}</p>
                <p className="text-sm font-bold text-green-600 mt-1">≈ {formatUsd(change / exchangeRate)}</p>
              </>
            ) : (
              <div className="py-2 flex items-center justify-center gap-2">
                <Check size={20} className="text-green-700" />
                <p className="text-base font-black text-green-700 uppercase tracking-widest">Pago conciliado</p>
              </div>
            )}
          </div>

          <button
            onClick={confirmPayment}
            disabled={!isFullyPaid || isProcessing}
            className={cn(
              "w-full h-14 rounded-2xl text-white font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-[0.98]",
              isFullyPaid ? "bg-[#2ECC71] hover:brightness-105" : "bg-gray-400 cursor-not-allowed"
            )}
          >
            {isProcessing ? "Procesando..." : (changeCents > 0 ? `COMPLETAR - Vuelto ${formatBs(change)}` : "COMPLETAR PAGO")}
          </button>
          
          <div className="flex justify-center gap-4 text-[8px] font-black text-black/30 uppercase tracking-[0.2em]">
            <span>␣ Espacio: Finalizar</span>
            <span>ESC: Cerrar</span>
            <span>Enter: Agregar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
