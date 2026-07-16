"use client";

import React, { useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Printer, X } from 'lucide-react';
import { Store, Utils } from '@/lib/db-store';
import { formatBs, formatUsd } from '@/lib/currency-formatter';

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

  const DataRow = ({ label, value, bold = false }: { label: string, value: string, bold?: boolean }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2px', pageBreakInside: 'avoid' }}>
      <tbody>
        <tr style={{ fontSize: '11px', fontWeight: bold ? '900' : '700' }}>
          <td style={{ textAlign: 'left', textTransform: 'uppercase', padding: '0' }}>{label}</td>
          <td style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '0' }}>{value}</td>
        </tr>
      </tbody>
    </table>
  );

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
            html, body { height: auto; margin: 0; padding: 0; }
            body {
              font-family: 'Arial', 'Helvetica', sans-serif;
              width: 72mm;
              margin: 0;
              padding: 4mm;
              font-size: 11px;
              color: #000;
              background: #fff;
              line-height: 1.1;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-weight: 700;
            }
            .thermal-80mm { width: 100%; display: block; }
            .black-box { 
              background: #000 !important; 
              color: #fff !important; 
              padding: 6px; 
              text-align: center; 
              font-weight: 900; 
              margin: 10px 0; 
              text-transform: uppercase; 
              font-size: 13px;
              width: 100%;
              box-sizing: border-box;
              display: block;
              page-break-inside: avoid;
            }
            .text-center { text-align: center; }
            .separator { border-top: 1px dashed #000; margin: 8px 0; width: 100%; display: block; height: 1px; }
            table { width: 100%; border-collapse: collapse; margin: 0; padding: 0; page-break-inside: avoid; }
            td { padding: 0; margin: 0; }
            .bold { font-weight: 900; }
            .header-title { font-size: 20px; font-weight: 900; }
            .header-info { font-size: 10px; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="thermal-80mm">
            ${printContent}
          </div>
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
              className="thermal-80mm bg-white p-6 shadow-sm text-black font-sans select-none"
              style={{ width: '72mm', boxSizing: 'border-box', color: '#000', fontSize: '11px', fontWeight: 700, display: 'block' }}
            >
              <div className="text-center mb-4">
                <h1 className="header-title uppercase mb-1" style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 900 }}>{state.empresa.nombre}</h1>
                <p className="header-info leading-snug uppercase mb-1" style={{ margin: '0 0 2px 0', fontSize: '10px', fontWeight: 700 }}>{state.empresa.direccion}</p>
                <p className="header-info" style={{ margin: '0', fontSize: '10px', fontWeight: 700 }}>RIF: {state.empresa.rif} | TEL: {state.empresa.telefono}</p>
              </div>

              <div className="separator" />

              <div className="black-box">
                {getReportTitle()}
              </div>

              <div className="text-center my-3" style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                  TERMINAL: {terminalIdLabel}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>
                  FECHA/HORA: {transactionDate}
                </div>
              </div>

              <div className="separator" />

              {isReport ? (
                <div style={{ width: '100%' }}>
                  {type === 'REPORT_Z' && (
                    <div style={{ marginBottom: '10px' }}>
                      <p style={{ fontWeight: 900, textAlign: 'center', marginBottom: '4px', fontSize: '10px' }}>DATOS DE CONTROL Y AUDITORÍA</p>
                      <DataRow label="Reporte Z N°:" value={String(data.numeroZ || 0).padStart(6, '0')} bold />
                      <DataRow label="Rango Facturas:" value={`${data.desdeFactura} - ${data.hastaFactura}`} />
                      <DataRow label="Rango Notas Cred:" value={`${data.desdeNC} - ${data.hastaNC}`} />
                      <div className="separator" />
                    </div>
                  )}

                  <div style={{ marginBottom: '10px' }}>
                    <p style={{ fontWeight: 900, textAlign: 'center', marginBottom: '4px', fontSize: '10px' }}>RESUMEN DE FACTURACIÓN</p>
                    <DataRow label="Venta Bruta:" value={formatBs(data.brUSD * state.tasa)} />
                    <DataRow label="Descuentos:" value={'-' + formatBs(data.descUSD * state.tasa)} />
                    <DataRow label="Devoluciones:" value={'-' + formatBs(data.devUSD * state.tasa)} />
                    <div className="separator" />
                    <table style={{ width: '100%', borderTop: '1px solid black', paddingTop: '2px' }}>
                      <tbody>
                        <tr>
                          <td style={{ textAlign: 'left', fontWeight: 900, fontSize: '14px' }}>VENTA NETA:</td>
                          <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '14px' }}>{formatBs(data.netUSD * state.tasa)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <p style={{ fontWeight: 900, textAlign: 'center', marginBottom: '4px', fontSize: '10px' }}>DESGLOSE FISCAL</p>
                    <DataRow label="Monto Exento:" value={formatBs((data.exentoUSD || 0) * state.tasa)} />
                    <DataRow label="Base Imponible:" value={formatBs((data.baseImponibleUSD || 0) * state.tasa)} />
                    <DataRow label="IVA Recaudado (16%):" value={formatBs((data.ivaUSD || 0) * state.tasa)} />
                    <DataRow label="Total IGTF (3%):" value={formatBs((data.igtfUSD || 0) * state.tasa)} />
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <p style={{ fontWeight: 900, textAlign: 'center', marginBottom: '4px', fontSize: '10px' }}>MOVIMIENTOS DE CAJA</p>
                    <DataRow label="Fondo de apertura Bs.:" value={formatBs(data.fondoAperturaBS || 0)} />
                    <DataRow label="Fondo de Apertura USD:" value={formatUsd(data.fondoAperturaUSD || 0)} />
                    <DataRow label="Entradas Caja:" value={formatBs((data.manualEntradas || 0) * state.tasa)} />
                    <DataRow label="Salidas / Gastos:" value={'-' + formatBs((data.manualSalidas || 0) * state.tasa)} />
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <p style={{ fontWeight: 900, textAlign: 'center', marginBottom: '4px', fontSize: '10px' }}>CONCILIACIÓN DE PAGOS</p>
                    {Object.entries(data.paymentMethods || {}).map(([method, val]) => (
                      <DataRow key={method} label={Utils.metodoLabel(method)} value={formatBs((val as number) * state.tasa)} />
                    ))}
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <p style={{ fontWeight: 900, textAlign: 'center', marginBottom: '4px', fontSize: '10px' }}>ESTADÍSTICAS DE JORNADA</p>
                    <DataRow label="Facturas Emitidas:" value={String(data.stats.facturas)} />
                    <DataRow label="Notas Crédito:" value={String(data.stats.devoluciones)} />
                    <DataRow label="Docs. Anulados:" value={String(data.stats.anulaciones)} bold />
                    <DataRow label="Ticket Promedio:" value={formatBs(data.stats.ticketPromedio * state.tasa)} />
                  </div>

                  {type === 'REPORT_Z' && (
                    <div style={{ paddingTop: '2px', borderTop: '1px double black', marginTop: '5px' }}>
                      <DataRow label="GRAN TOTAL ACUMULADO (BS):" value={formatBs(data.acumuladoHistoricoUSD * state.tasa)} bold />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ width: '100%' }}>
                  <DataRow label="N° CONTROL:" value={data.id} bold />
                  <DataRow label="CLIENTE:" value={customerName} bold />
                  <div className="separator" />
                  <p style={{ fontWeight: 900, textAlign: 'center', marginBottom: '4px', fontSize: '10px' }}>DESGLOSE DE PRODUCTOS</p>
                  {data.items.map((item: any, idx: number) => (
                    <DataRow 
                      key={idx} 
                      label={`${item.cantidad || item.qty}x ${(item.nombre || item.name).slice(0, 24)}`} 
                      value={formatBs((item.subtotalUSD || (item.price * item.qty)) * state.tasa)} 
                    />
                  ))}
                  <div className="separator" />
                  <div style={{ marginTop: '4px' }}>
                    <table style={{ width: '100%' }}>
                      <tbody>
                        <tr>
                          <td style={{ textAlign: 'left', fontWeight: 900, fontSize: '16px' }}>TOTAL A PAGAR:</td>
                          <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '16px' }}>{formatBs(data.totalBS)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <DataRow label="EQUIVALENTE REF. USD:" value={formatUsd(data.totalUSD)} bold />
                  </div>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: '15px', paddingTop: '8px', borderTop: '1px dotted #ccc', pageBreakInside: 'avoid' }}>
                <p style={{ fontWeight: 'bold', margin: '0 0 2px 0' }}>¡Gracias por su preferencia!</p>
                <p style={{ opacity: '0.6', fontSize: '8px', margin: '0' }}>PosVEN Pro v2.5 - Bloque Fiscal Unificado</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onClose} className="py-3 bg-[#E5E7EB] text-[#374151] font-black text-xs rounded-xl hover:bg-gray-300 transition-all uppercase tracking-widest">Cerrar</button>
              <button className="py-3 bg-black text-white font-black text-xs rounded-xl hover:opacity-90 flex items-center justify-center gap-2 uppercase tracking-widest shadow-md" onClick={handlePrint}>Imprimir</button>
            </div>
            <button className="py-3 bg-[#C8952E] text-black font-black text-xs rounded-xl hover:bg-[#D9A540] transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg" onClick={handlePrint}>
              <Printer size={16} /> Impresión Térmica Pro
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
