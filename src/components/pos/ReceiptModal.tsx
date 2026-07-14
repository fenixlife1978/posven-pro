"use client";

import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, X, Zap, Share2, Monitor, HandCoins, BarChart3, Clock } from 'lucide-react';
import { Store, Utils } from '@/lib/db-store';
import { formatBs, formatUsd } from '@/lib/currency-formatter';
import { auth } from '@/lib/firebase';

declare global {
  interface Window {
    electronAPI?: {
      printTicket: (data: any) => Promise<void>;
    };
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sale?: any; 
  reportData?: any; 
  type?: 'SALE' | 'REPORT_X' | 'REPORT_Z';
}

export function ReceiptModal({ isOpen, onClose, sale, reportData, type = 'SALE' }: Props) {
  const state = Store.get();
  const printRef = useRef<HTMLDivElement>(null);

  const isReport = type === 'REPORT_X' || type === 'REPORT_Z';
  const data = isReport ? reportData : sale;
  
  if (!data) return null;

  const transactionDate = React.useMemo(() => {
    try {
      const rawDate = data.fecha || data.date || Utils.ahora();
      const dateObj = new Date(rawDate);
      return dateObj.toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
    }
  }, [data.fecha, data.date]);

  const customerName = (data.cliente || 'CONSUMIDOR FINAL').toUpperCase();
  const terminalIdLabel = (data.terminalName || 'SISTEMA GLOBAL').toUpperCase();
  
  const getReportTitle = () => {
    if (type === 'REPORT_Z') return `REPORTE Z - CIERRE DIARIO`;
    if (type === 'REPORT_X') return `REPORTE X - LECTURA PARCIAL`;
    return (data.type || 'RECIBO DE VENTA').toUpperCase();
  };

  const DataRow = ({ label, value, bold = false, indent = false }: { label: string, value: string, bold?: boolean, indent?: boolean }) => (
    <div className={`flex justify-between w-full text-[11px] leading-tight ${bold ? 'font-black' : 'font-normal'} ${indent ? 'pl-4' : ''}`}>
      <span className="text-left uppercase">{label}</span>
      <span className="text-right whitespace-nowrap">{value}</span>
    </div>
  );

  const handleNativePrint = async () => {
    if (!window.electronAPI) {
      handlePrint();
      return;
    }
    // Lógica para Roccia omitida por brevedad en este bloque, pero mantendrá la coherencia visual
    handlePrint();
  };

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0;
              padding: 4mm;
              font-size: 11px;
              color: #000;
              background: #fff;
              line-height: 1.3;
              -webkit-print-color-adjust: exact;
            }
            .thermal-80mm { width: 100%; }
            .black-box { background: #000 !important; color: #fff !important; padding: 4px; text-align: center; font-weight: bold; margin: 8px 0; text-transform: uppercase; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .separator { border-top: 1px dashed #000; margin: 6px 0; }
            .flex-row { display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; }
            .title { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    if (isReport) setTimeout(onClose, 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px] p-0 bg-transparent border-none overflow-hidden shadow-none">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200">
          <div className="bg-black p-4 flex justify-between items-center">
            <h3 className="text-white font-black text-xs flex items-center gap-2 tracking-widest uppercase">
              <Printer size={16} className="text-brand-gold" /> VISTA PREVIA FISCAL
            </h3>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
          </div>

          <div className="p-6 bg-gray-100 flex justify-center max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div 
              ref={printRef}
              className="thermal-80mm bg-white p-6 shadow-sm text-black font-mono select-none"
              style={{ width: '72mm', boxSizing: 'border-box', color: '#000', fontSize: '11px' }}
            >
              <div className="text-center mb-4">
                <h1 className="text-[20px] font-black uppercase mb-1">{state.empresa.nombre}</h1>
                <p className="text-[10px] leading-snug uppercase mb-1">{state.empresa.direccion}</p>
                <p className="text-[10px] font-bold">RIF: {state.empresa.rif} | TEL: {state.empresa.telefono}</p>
              </div>

              <div className="separator" />

              <div className="black-box text-[13px] tracking-widest py-1.5" style={{ background: '#000', color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                {getReportTitle()}
              </div>

              <div className="text-center space-y-1 my-3">
                <div className="text-[10px] font-bold uppercase flex items-center justify-center gap-1">
                  <Monitor size={10} /> TERMINAL: {terminalIdLabel}
                </div>
                <div className="text-[11px] font-black uppercase">
                  FECHA/HORA: {transactionDate}
                </div>
              </div>

              <div className="separator" />

              {isReport ? (
                <div className="space-y-4">
                  {type === 'REPORT_Z' && (
                    <div className="space-y-1">
                      <p className="font-black text-center mb-2 uppercase text-[10px]">DATOS DE CONTROL Y AUDITORÍA</p>
                      <DataRow label="Reporte Z N°:" value={String(data.numeroZ || 0).padStart(6, '0')} bold />
                      <DataRow label="Rango Facturas:" value={`${data.desdeFactura} - ${data.hastaFactura}`} />
                      <DataRow label="Rango Notas Cred:" value={`${data.desdeNC} - ${data.hastaNC}`} />
                      <div className="separator" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="font-black text-center mb-2 uppercase text-[10px]">RESUMEN DE FACTURACIÓN</p>
                    <DataRow label="Venta Bruta:" value={formatBs(data.brUSD * state.tasa).replace('Bs. ', 'Bs.')} />
                    <DataRow label="Descuentos:" value={'-' + formatBs(data.descUSD * state.tasa).replace('Bs. ', 'Bs.')} />
                    <DataRow label="Devoluciones:" value={'-' + formatBs(data.devUSD * state.tasa).replace('Bs. ', 'Bs.')} />
                    <div className="separator" />
                    <div className="flex justify-between font-black text-[14px] border-t border-black pt-1">
                      <span>VENTA NETA:</span>
                      <span>{formatBs(data.netUSD * state.tasa).replace('Bs. ', 'Bs.')}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-black text-center mb-2 uppercase text-[10px]">DESGLOSE FISCAL</p>
                    <DataRow label="Monto Exento:" value={formatBs((data.exentoUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')} />
                    <DataRow label="Base Imponible:" value={formatBs((data.baseImponibleUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')} />
                    <DataRow label="IVA Recaudado (16%):" value={formatBs((data.ivaUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')} />
                    <DataRow label="Total IGTF (3%):" value={formatBs((data.igtfUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')} />
                  </div>

                  <div className="space-y-1">
                    <p className="font-black text-center mb-2 uppercase text-[10px]">MOVIMIENTOS DE CAJA</p>
                    <DataRow label="Fondo Apertura:" value={formatBs((data.fondoAperturaUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')} />
                    <DataRow label="Entradas Caja:" value={formatBs((data.manualEntradas || 0) * state.tasa).replace('Bs. ', 'Bs.')} />
                    <DataRow label="Salidas / Gastos:" value={'-' + formatBs((data.manualSalidas || 0) * state.tasa).replace('Bs. ', 'Bs.')} />
                  </div>

                  <div className="space-y-1">
                    <p className="font-black text-center mb-2 uppercase text-[10px]">CONCILIACIÓN DE PAGOS</p>
                    {Object.entries(data.paymentMethods || {}).map(([method, val]) => (
                      <DataRow key={method} label={Utils.metodoLabel(method)} value={formatBs((val as number) * state.tasa).replace('Bs. ', 'Bs.')} />
                    ))}
                  </div>

                  <div className="space-y-1">
                    <p className="font-black text-center mb-2 uppercase text-[10px]">ESTADÍSTICAS DE JORNADA</p>
                    <DataRow label="Facturas Emitidas:" value={String(data.stats.facturas)} />
                    <DataRow label="Notas Crédito:" value={String(data.stats.devoluciones)} />
                    <DataRow label="Docs. Anulados:" value={String(data.stats.anulaciones)} bold />
                    <DataRow label="Ticket Promedio:" value={formatBs(data.stats.ticketPromedio * state.tasa).replace('Bs. ', 'Bs.')} />
                  </div>

                  {type === 'REPORT_Z' && (
                    <div className="pt-2 border-t border-black border-double">
                      <DataRow label="GRAN TOTAL ACUMULADO (BS):" value={formatBs(data.acumuladoHistoricoUSD * state.tasa).replace('Bs. ', 'Bs.')} bold />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <DataRow label="N° CONTROL:" value={data.id} bold />
                  <DataRow label="CLIENTE:" value={customerName} bold />
                  <div className="separator" />
                  <table className="w-full">
                    <thead>
                      <tr className="text-[10px] border-b border-black">
                        <th className="text-left py-1 uppercase">Producto</th>
                        <th className="text-right py-1 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="uppercase">
                      {data.items.map((item: any, idx: number) => (
                        <tr key={idx} className="text-[10px]">
                          <td className="py-1">{item.cantidad || item.qty}x {(item.nombre || item.name).slice(0, 30)}</td>
                          <td className="text-right py-1 font-bold">{formatBs((item.subtotalUSD || (item.price * item.qty)) * state.tasa).replace('Bs. ', 'Bs.')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="separator" />
                  <div className="space-y-1">
                    <div className="flex justify-between font-black text-[16px]">
                      <span>TOTAL A PAGAR:</span>
                      <span>{formatBs(data.totalBS).replace('Bs. ', 'Bs.')}</span>
                    </div>
                    <DataRow label="EQUIVALENTE REF. USD:" value={formatUsd(data.totalUSD)} bold />
                  </div>
                </div>
              )}

              <div className="text-center mt-8 pt-4 border-t border-dotted border-black/30">
                <p className="font-bold mb-1">¡Gracias por su preferencia!</p>
                <p className="opacity-60 text-[8px]">PosVEN Pro v2.5 - Bloque Fiscal Imagen 3</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onClose} className="py-3 bg-[#E5E7EB] text-[#374151] font-black text-xs rounded-xl hover:bg-gray-300 transition-all uppercase tracking-widest">Cerrar</button>
              <button className="py-3 bg-[#2ECC71] text-white font-black text-xs rounded-xl hover:bg-green-600 flex items-center justify-center gap-2 uppercase tracking-widest shadow-sm"><Share2 size={14} /> Compartir</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handlePrint} className="py-3 bg-black text-white font-black text-xs rounded-xl hover:opacity-90 flex items-center justify-center gap-2 uppercase tracking-widest shadow-md"><Printer size={14} /> Estándar</button>
              <button onClick={handleNativePrint} className="py-3 bg-[#C8952E] text-black font-black text-xs rounded-xl hover:bg-[#D9A540] transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg">
                <Zap size={16} className="fill-current" /> Impresión Roccia
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
