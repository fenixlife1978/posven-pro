"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, DollarSign, CreditCard, Banknote, Smartphone, Fingerprint, Plane, Plus, Trash2, Calculator, ArrowRightLeft, Check } from 'lucide-react';
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
  allowPartial?: boolean;
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
  { id: 'tarjeta', label: 'TARJETA', icon: CreditCard, currency: 'Bs' },
  { id: 'biopago', label: 'BIOPAGO', icon: Fingerprint, currency: 'Bs' },
  { id: 'pagomovil', label: 'PAGO MÓVIL', icon: Smartphone, currency: 'Bs' },
  { id: 'zelle', label: 'ZELLE', icon: Plane, currency: 'USD' },
];

export default function FloatingPaymentModal({ 
  total, 
  totalCents, 
  exchangeRate, 
  onClose, 
  allowPartial = false,
  onConfirm 
}: FloatingPaymentModalProps) {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [currentMethod, setCurrentMethod] = useState('efectivo_bs');
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Estados para la calculadora informativa "Quiero Pagar"
  const [showConverter, setShowConverter] = useState(false);
  const [calcUSD, setCalcUSD] = useState('');
  const [calcBS, setCalcBS] = useState('');
  const [lastEdited, setLastEdited] = useState<'USD' | 'BS' | null>(null);

  const currentMethodObj = methods.find(m => m.id === currentMethod);
  const isUsd = currentMethodObj?.currency === 'USD';

  const totalPaidCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  const totalPaid = fromCentsBs(totalPaidCents);
  
  const totalUsdCents = Math.round((totalCents * 100) / Math.round(exchangeRate * 100));
  
  const totalPaidUsdCents = payments.reduce((sum, p) => {
    if (p.usdAmountCents) return sum + p.usdAmountCents;
    return sum + Math.round((p.amountCents * 100) / Math.round(exchangeRate * 100));
  }, 0);

  const isPaidByUsd = totalPaidUsdCents >= (totalUsdCents - 1);
  const isFullyPaid = isPaidByUsd || (totalPaidCents >= totalCents - 1);
  const canConfirm = isFullyPaid || (allowPartial && totalPaidCents > 0);
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

  const addPayment = (amountToUse?: string, forceMethod?: string) => {
    const valueStr = amountToUse || inputValue;
    const methodToUse = forceMethod || currentMethod;
    const methodObj = methods.find(m => m.id === methodToUse);
    const useUsd = methodObj?.currency === 'USD';

    let rawAmount = parseFloat(valueStr);
    if (isNaN(rawAmount) || rawAmount <= 0) return;

    if (useUsd) {
      const usdAmount = rawAmount;
      const usdAmountCents = toCentsUsd(usdAmount);
      const bsAmountCents = Math.round((usdAmountCents * Math.round(exchangeRate * 100)) / 100);
      const bsAmount = fromCentsBs(bsAmountCents);
      setPayments([...payments, {
        id: crypto.randomUUID(),
        method: methodToUse,
        amount: bsAmount,
        usdAmount: usdAmount,
        amountCents: bsAmountCents,
        usdAmountCents: usdAmountCents,
      }]);
    } else {
      const bsAmount = rawAmount;
      const bsAmountCents = toCentsBs(bsAmount);
      setPayments([...payments, {
        id: crypto.randomUUID(),
        method: methodToUse,
        amount: bsAmount,
        amountCents: bsAmountCents,
      }]);
    }
    setInputValue('');
    if (!amountToUse) inputRef.current?.focus();
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const setExactAmount = () => {
    const currentRemainingCents = Math.max(0, totalCents - totalPaidCents);
    if (currentRemainingCents <= 0) return;
    
    let amountToAdd = fromCentsBs(currentRemainingCents);
    if (isUsd) {
      amountToAdd = payments.length === 0 
        ? fromCentsUsd(totalUsdCents) 
        : fromCentsUsd(Math.round((currentRemainingCents * 100) / Math.round(exchangeRate * 100)));
    }
    setInputValue(amountToAdd.toFixed(2));
  };

  const confirmPayment = useCallback(() => {
    if (!canConfirm) return;
    setIsProcessing(true);
    const mainPayment = payments[0] || { method: 'efectivo_bs' };
    
    let finalChangeCents = Math.max(0, totalPaidCents - totalCents);
    if (isPaidByUsd && Math.abs(totalPaidUsdCents - totalUsdCents) <= 1 && finalChangeCents <= 5) {
      finalChangeCents = 0;
    }
    
    onConfirm({ 
      payments, 
      totalPaid: fromCentsBs(totalPaidCents),
      totalPaidCents: totalPaidCents,
      change: fromCentsBs(finalChangeCents),
      changeCents: finalChangeCents,
      method: mainPayment.method,
      ajusteRedondeoBs,
      ajusteRedondeoBsCents,
    });
    setIsProcessing(false);
  }, [payments, totalPaidCents, totalCents, canConfirm, isPaidByUsd, totalPaidUsdCents, totalUsdCents, ajusteRedondeoBs, ajusteRedondeoBsCents, onConfirm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        if (canConfirm) confirmPayment();
      }
      if (e.key === 'Enter' && document.activeElement === inputRef.current) {
        e.preventDefault();
        addPayment();
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canConfirm, confirmPayment, addPayment, onClose]);

  useEffect(() => { if (!showConverter) inputRef.current?.focus(); }, [showConverter]);

  return (
    <div
      className="fixed z-[200] bg-white rounded-2xl shadow-2xl w-[520px] max-w-[95vw] border border-gray-200 overflow-hidden"
      style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', position: 'fixed' }}
    >
      <div className="bg-black p-3 text-white flex justify-between items-center select-none">
        <div className="flex items-center gap-2">
          <Calculator size={18} className="text-brand-gold" />
          <h3 className="font-black text-sm uppercase tracking-tighter">Procesar Pago del Cliente</h3>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-soft p-4 rounded-2xl text-center border border-line shadow-inner">
            <span className="text-[10px] font-black text-ink/40 uppercase tracking-widest block mb-1">Total Factura</span>
            <p className="text-3xl font-black text-ink">{formatBs(total)}</p>
            <p className="text-xs font-bold text-ink/40 mt-1">≈ {formatUsd(total / exchangeRate)}</p>
          </div>
          <div className="bg-status-success-soft/20 p-4 rounded-2xl text-center border border-status-success/20">
            <span className="text-[10px] font-black text-status-success uppercase tracking-widest block mb-1">Abonado Real</span>
            <p className="text-3xl font-black text-status-success">{formatBs(displayedTotalPaidBs)}</p>
            {totalPaidUsdCents > 0 && <p className="text-xs font-bold text-status-success/70 mt-1">USD {formatUsdNumber(fromCentsUsd(totalPaidUsdCents))}</p>}
          </div>
        </div>

        <div className="relative">
          {!showConverter ? (
            <button 
              onClick={() => setShowConverter(true)}
              className="w-full h-10 bg-brand-gold-soft border border-brand-gold/30 rounded-xl flex items-center justify-center gap-2 text-brand-gold-deep font-black text-[11px] uppercase hover:bg-brand-gold hover:text-white transition-all shadow-sm mb-2"
            >
              <ArrowRightLeft size={14} /> Quiero Pagar (Consultar Cambio)
            </button>
          ) : (
            <div className="bg-ink p-5 rounded-2xl border-2 border-brand-gold animate-in zoom-in-95 duration-200 shadow-xl mb-2">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-brand-gold font-black text-[10px] uppercase tracking-[0.2em]">Calculadora Informativa</h4>
                <button onClick={() => setShowConverter(false)} className="text-white/40 hover:text-white"><X size={16}/></button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 items-start">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase block ml-1">Monto en USD</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 w-4 h-4 text-brand-gold" />
                    <input 
                      type="text" 
                      inputMode="decimal"
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 text-white font-black text-lg focus:border-brand-gold outline-none transition-all"
                      placeholder="0.00"
                      value={calcUSD}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        setCalcUSD(val);
                        setLastEdited('USD');
                        const n = parseFloat(val) || 0;
                        setCalcBS((n * exchangeRate).toFixed(2));
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase block ml-1">Monto en Bs.</label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-3 w-4 h-4 text-brand-gold" />
                    <input 
                      type="text" 
                      inputMode="decimal"
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 text-white font-black text-lg focus:border-brand-gold outline-none transition-all"
                      placeholder="0.00"
                      value={calcBS}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        setCalcBS(val);
                        setLastEdited('BS');
                        const n = parseFloat(val) || 0;
                        setCalcUSD((n / exchangeRate).toFixed(2));
                      }}
                    />
                  </div>
                </div>
              </div>

              {(calcUSD || calcBS) && (
                <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-2xl text-center animate-in fade-in slide-in-from-top-2">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em]">EQUIVALENCIA AL CAMBIO</span>
                  <div className="mt-1">
                    {lastEdited === 'USD' ? (
                      <p className="text-4xl font-black text-brand-gold leading-none">{formatBs(parseFloat(calcBS) || 0)}</p>
                    ) : (
                      <p className="text-4xl font-black text-brand-gold leading-none">{formatUsd(parseFloat(calcUSD) || 0)}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!showConverter && (
          <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-end bg-white border border-line p-3 rounded-2xl shadow-sm">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-ink/40 uppercase block ml-1">Forma de Pago</label>
              <select
                value={currentMethod}
                onChange={(e) => setCurrentMethod(e.target.value)}
                className="w-full h-11 border-line bg-surface-soft rounded-xl px-3 text-xs font-black uppercase text-ink outline-none focus:ring-2 focus:ring-brand-gold"
              >
                {methods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-ink/40 uppercase block ml-1">Monto ({isUsd ? 'USD' : 'BS'})</label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-full h-11 border-line bg-surface-soft rounded-xl px-3 text-sm font-black text-ink text-right outline-none focus:ring-2 focus:ring-brand-gold"
                  placeholder="0.00"
                />
              </div>
            </div>
            <button onClick={() => addPayment()} className="h-11 w-11 bg-ink text-brand-gold rounded-xl flex items-center justify-center hover:bg-brand-gold-deep hover:text-white transition-all shadow-md">
              <Plus size={20} />
            </button>
          </div>
        )}

        <div className="bg-surface-soft/50 rounded-2xl border border-line overflow-hidden">
          <div className="px-4 py-2 bg-ink text-white/40 text-[9px] font-black uppercase tracking-widest">Lote de Pagos Actual</div>
          <div className="max-h-24 overflow-y-auto divide-y divide-line/30">
            {payments.length === 0 ? (
              <div className="py-6 text-center text-[10px] font-black text-ink/20 uppercase italic">Esperando ingreso de fondos...</div>
            ) : (
              payments.map(p => {
                const methodInfo = methods.find(m => m.id === p.method);
                return (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-white hover:bg-brand-gold-soft/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-soft flex items-center justify-center text-ink">
                        {methodInfo?.icon && <methodInfo.icon size={16} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-ink uppercase">{methodInfo?.label}</p>
                        <p className="text-[9px] font-bold text-ink/40">Registro de entrada</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-black text-xs text-ink">{methodInfo?.currency === 'USD' ? formatUsd(p.usdAmount || 0) : formatBs(p.amount)}</span>
                      <button onClick={() => removePayment(p.id)} className="text-ink/20 hover:text-status-danger transition-colors p-1"><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={cn(
          "rounded-[24px] p-5 text-center border-2 transition-all duration-300 shadow-lg",
          remainingCents > 0 ? "bg-status-danger-soft border-status-danger/20" : "bg-status-success-soft border-status-success/20"
        )}>
          {remainingCents > 0 ? (
            <div className="animate-in pulse duration-1000 infinite">
              <span className="text-[10px] font-black text-status-danger uppercase tracking-[0.2em] block mb-1">Monto Faltante</span>
              <p className="text-4xl font-black text-status-danger">{formatBs(remaining)}</p>
              <p className="text-sm font-bold text-status-danger/60 mt-1">≈ {formatUsd(remaining / exchangeRate)}</p>
            </div>
          ) : changeCents > 0 ? (
            <div>
              <span className="text-[10px] font-black text-status-success uppercase tracking-[0.2em] block mb-1">Vuelto a entregar en Bs.</span>
              <p className="text-4xl font-black text-status-success">{formatBs(change)}</p>
              <p className="text-sm font-bold text-status-success/60 mt-1">≈ {formatUsd(change / exchangeRate)}</p>
            </div>
          ) : (
            <div className="py-2 flex items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full bg-status-success text-white flex items-center justify-center shadow-lg shadow-status-success/20"><Check size={18} /></div>
              <p className="text-base font-black text-status-success uppercase tracking-wider">Pago Exacto - Sin Vuelto</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={setExactAmount}
            className="h-12 bg-white border-2 border-line text-ink font-black text-[10px] uppercase rounded-xl hover:bg-surface-soft transition-all"
          >
            Monto Exacto
          </button>
          <button
            onClick={confirmPayment}
            disabled={!canConfirm || isProcessing}
            className={cn(
              "h-12 rounded-xl text-white font-black text-xs uppercase tracking-widest transition-all shadow-xl",
              canConfirm ? "bg-status-success hover:brightness-110 shadow-status-success/20" : "bg-gray-300 cursor-not-allowed text-white/50"
            )}
          >
            {isProcessing ? "Procesando..." : (isFullyPaid ? "Completar Facturación" : "Confirmar Abono")}
          </button>
        </div>
        
        <p className="text-center text-[9px] font-black text-ink/20 uppercase tracking-widest select-none">
          Espacio: Finalizar | ESC: Cerrar | Enter: Añadir Pago
        </p>
      </div>
    </div>
  );
}
