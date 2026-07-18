"use client";

import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, X, Zap, Share2, Monitor, Loader2 } from 'lucide-react';
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
  const [isPrinting, setIsPrinting] = useState(false);

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

  /**
   * Helper para Font A (42 chars) - Alineación estricta con espacios
   */
  const formatLine = (label: string, value: string, width = 42) => {
    const cleanLabel = label.trim().toUpperCase();
    const cleanValue = value.trim();
    const spaces = width - cleanLabel.length - cleanValue.length;
    return cleanLabel + (spaces > 0 ? ' '.repeat(spaces) : ' ') + cleanValue;
  };

  const handleNativePrint = async () => {
    if (isPrinting) return;
    if (!window.electronAPI) {
      handlePrint();
      return;
    }

    setIsPrinting(true);
    const SEPARATOR = '------------------------------------------'; // 42 chars
    
    let printData: any[] = [
      { type: 'text', value: state.empresa.nombre.toUpperCase(), style: { fontWeight: "800", textAlign: 'center', fontSize: "20px" } },
      { type: 'text', value: state.empresa.direccion.toUpperCase(), style: { textAlign: 'center', fontSize: "11px" } },
      { type: 'text', value: `RIF: ${state.empresa.rif} | TEL: ${state.empresa.telefono}`, style: { textAlign: 'center', fontSize: "11px" } },
      { type: 'text', value: SEPARATOR, style: { textAlign: 'center' } }
    ];

    if (isReport) {
      printData.push({ type: 'text', value: getReportTitle(), style: { textAlign: 'center', fontWeight: "800", fontSize: "16px" } });
      printData.push({ type: 'text', value: `TERMINAL: ${terminalIdLabel}`, style: { textAlign: 'center', fontWeight: "700", fontSize: "12px" } });
      printData.push({ type: 'text', value: `FECHA/HORA: ${transactionDate}`, style: { fontSize: "11px", textAlign: 'center' } });
      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
      
      if (type === 'REPORT_Z') {
        printData.push({ type: 'text', value: 'DATOS DE CONTROL', style: { textAlign: 'center', fontWeight: "800" } });
        printData.push({ type: 'text', value: formatLine('REPORTE Z N°', String(data.numeroZ || 0).padStart(6, '0')), style: { fontSize: "11px" } });
        printData.push({ type: 'text', value: formatLine('RANGO FACT', `${data.desdeFactura}-${data.hastaFactura}`), style: { fontSize: "10px" } });
        printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
      }

      printData.push({ type: 'text', value: 'RESUMEN FACTURACION', style: { textAlign: 'center', fontWeight: "800" } });
      printData.push({ type: 'text', value: formatLine('VENTA BRUTA', formatBs(data.brUSD * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: formatLine('DESCUENTOS', '-' + formatBs(data.descUSD * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: formatLine('DEVOLUCIONES', '-' + formatBs(data.devUSD * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: formatLine('VENTA NETA', formatBs(data.netUSD * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "12px", fontWeight: "700" } });
      
      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
      printData.push({ type: 'text', value: 'DESGLOSE FISCAL', style: { textAlign: 'center', fontWeight: "800" } });
      printData.push({ type: 'text', value: formatLine('MONTO EXENTO', formatBs((data.exentoUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: formatLine('BASE IMPONIBLE', formatBs((data.baseImponibleUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: formatLine('IVA RECAUDADO', formatBs((data.ivaUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      printData.push({ type: 'text', value: formatLine('TOTAL IGTF', formatBs((data.igtfUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });

      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
      printData.push({ type: 'text', value: 'CONCILIACION PAGOS', style: { textAlign: 'center', fontWeight: "800" } });
      Object.entries(data.paymentMethods || {}).forEach(([method, val]) => {
        printData.push({ type: 'text', value: formatLine(Utils.metodoLabel(method), formatBs((val as number) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      });
      printData.push({ type: 'text', value: formatLine('SALIDAS CAJA', '-' + formatBs((data.manualSalidas || 0) * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "11px" } });
      
      if (type === 'REPORT_Z') {
        printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
        printData.push({ type: 'text', value: formatLine('GRAN TOTAL (BS)', formatBs(data.acumuladoHistoricoUSD * state.tasa).replace('Bs. ', 'Bs.')), style: { fontSize: "12px", fontWeight: "800" } });
      }

    } else {
      printData.push({ type: 'text', value: getReportTitle(), style: { textAlign: 'center', fontWeight: "800", fontSize: "16px" } });
      printData.push({ type: 'text', value: formatLine('N° CONTROL', data.id), style: { fontSize: "11px", fontWeight: "700" } });
      printData.push({ type: 'text', value: `FECHA/HORA: ${transactionDate}`, style: { fontSize: "10px" } });
      printData.push({ type: 'text', value: `CLIENTE: ${customerName}`, style: { fontSize: "10px" } });
      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });

      data.items.forEach((item: any) => {
        const qty = item.cantidad || item.qty;
        const name = (item.nombre || item.name).toUpperCase().slice(0, 30);
        const totalLine = formatBs((item.subtotalUSD || (item.price * item.qty)) * state.tasa).replace('Bs. ', 'Bs.');
        printData.push({ type: 'text', value: `${qty}x ${name}`, style: { fontWeight: "700", fontSize: "11px" } });
        printData.push({ type: 'text', value: formatLine('', totalLine), style: { fontSize: "10px" } });
      });

      printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
      printData.push({ type: 'text', value: formatLine('TOTAL A PAGAR', formatBs(data.totalBS).replace('Bs. ', 'Bs.')), style: { fontWeight: "800", fontSize: "18px" } });
      printData.push({ type: 'text', value: formatLine('REF. USD', formatUsd(data.totalUSD)), style: { fontSize: "12px", fontWeight: "700" } });
    }

    printData.push({ type: 'text', value: SEPARATOR, style: { textAlign: 'center' } });
    printData.push({ type: 'text', value: '¡Gracias por su preferencia!', style: { textAlign: 'center', fontSize: "10px" } });
    printData.push({ type: 'text', value: 'PosVEN Pro v2.5 - Font A (42c)\n\n\n', style: { textAlign: 'center', fontSize: "8px" } });

    try {
      await window.electronAPI.printTicket(printData);
      setTimeout(() => {
        setIsPrinting(false);
        onClose();
      }, 500);
    } catch (e) {
      handlePrint();
    }
  };

  const handlePrint = () => {
    if (isPrinting) return;
    setIsPrinting(true);
    
    const printContent = printRef.current?.innerHTML;
    if (!printContent) {
      setIsPrinting(false);
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setIsPrinting(false);
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Impresion_PosVEN_Pro</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 80mm;
              margin: 0;
              padding: 4mm;
              font-size: 12px;
              color: #000;
              background: #fff;
              line-height: 1.2;
              letter-spacing: 0;
            }
            table { width: 100%; border-collapse: collapse; margin-bottom: 2px; }
            td { vertical-align: top; padding: 1px 0; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .separator { border-top: 1px dashed #000; margin: 4px 0; }
            .header-title { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
            .section-title { font-size: 14px; font-weight: bold; text-align: center; margin: 5px 0; }
            .total-line { font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
              setTimeout(function() { window.close(); }, 1500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      setIsPrinting(false);
      onClose();
    }, 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] p-0 bg-transparent border-none overflow-hidden shadow-none">
        <DialogHeader className="sr-only"><DialogTitle>Impresión Font A 42c</DialogTitle></DialogHeader>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200">
          <div className="bg-black p-4 flex justify-between items-center">
            <h3 className="text-white font-black text-xs flex items-center gap-2 tracking-widest uppercase">
              <Printer size={16} className="text-brand-gold" /> OPTIMIZADO FONT A (42c)
            </h3>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
          </div>

          <div className="p-6 bg-gray-100 flex justify-center max-h-[65vh] overflow-y-auto custom-scrollbar">
            <div 
              ref={printRef}
              className="thermal-80mm bg-white p-6 shadow-sm text-black font-mono select-none"
              style={{ width: '100%', maxWidth: '80mm', color: '#000', fontSize: '12px', lineHeight: '1.2' }}
            >
              {/* Encabezado Fiscal */}
              <div className="text-center mb-4">
                <div className="text-[20px] font-bold uppercase leading-tight">{state.empresa.nombre}</div>
                <div className="text-[10px] uppercase">{state.empresa.direccion}</div>
                <div className="text-[11px] font-bold uppercase">RIF: {state.empresa.rif} | TEL: {state.empresa.telefono}</div>
              </div>

              <div className="separator" />

              {/* Título de Documento */}
              <div className="text-center mb-3">
                <div className="text-[14px] font-bold uppercase">{getReportTitle()}</div>
                {isReport && (
                  <div className="text-[11px] font-bold uppercase">TERMINAL: {terminalIdLabel}</div>
                )}
                <div className="text-[11px] uppercase">EMISION: {transactionDate}</div>
              </div>

              {isReport && type === 'REPORT_Z' && (
                <div className="mb-4">
                  <div className="text-center font-bold text-[11px] mb-1">AUDITORIA DE CONTROL</div>
                  <table style={{ width: '100%' }}>
                    <tbody>
                      <tr><td className="text-left uppercase">REPORTE Z N:</td><td className="text-right font-bold">{String(data.numeroZ || 0).padStart(6, '0')}</td></tr>
                      <tr><td className="text-left uppercase">RANGO FACT:</td><td className="text-right">{data.desdeFactura}-{data.hastaFactura}</td></tr>
                      <tr><td className="text-left uppercase">RANGO NC:</td><td className="text-right">{data.desdeNC}-{data.hastaNC}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="separator" />

              {isReport ? (
                <div className="space-y-4">
                  {/* Resumen de Facturación */}
                  <div>
                    <div className="text-center font-bold text-[11px] mb-1">RESUMEN FACTURACION</div>
                    <table style={{ width: '100%' }}>
                      <tbody>
                        <tr><td className="text-left uppercase">VENTA BRUTA</td><td className="text-right">{formatBs(data.brUSD * state.tasa).replace('Bs. ', 'Bs.')}</td></tr>
                        <tr><td className="text-left uppercase">DESCUENTOS</td><td className="text-right">-{formatBs(data.descUSD * state.tasa).replace('Bs. ', 'Bs.')}</td></tr>
                        <tr><td className="text-left uppercase">DEVOLUCIONES</td><td className="text-right">-{formatBs(data.devUSD * state.tasa).replace('Bs. ', 'Bs.')}</td></tr>
                        <tr className="bold"><td className="text-left uppercase">VENTA NETA</td><td className="text-right">{formatBs(data.netUSD * state.tasa).replace('Bs. ', 'Bs.')}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Desglose Fiscal */}
                  <div>
                    <div className="text-center font-bold text-[11px] mb-1">DESGLOSE FISCAL</div>
                    <table style={{ width: '100%' }}>
                      <tbody>
                        <tr><td className="text-left uppercase">MONTO EXENTO</td><td className="text-right">{formatBs((data.exentoUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')}</td></tr>
                        <tr><td className="text-left uppercase">BASE IMPONIBLE</td><td className="text-right">{formatBs((data.baseImponibleUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')}</td></tr>
                        <tr><td className="text-left uppercase">IVA (16%)</td><td className="text-right">{formatBs((data.ivaUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')}</td></tr>
                        <tr><td className="text-left uppercase">IGTF (3%)</td><td className="text-right">{formatBs((data.igtfUSD || 0) * state.tasa).replace('Bs. ', 'Bs.')}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Conciliación */}
                  <div>
                    <div className="text-center font-bold text-[11px] mb-1">CONCILIACION CAJA</div>
                    <table style={{ width: '100%' }}>
                      <tbody>
                        {Object.entries(data.paymentMethods || {}).map(([method, val]) => (
                          <tr key={method}>
                            <td className="text-left uppercase">{Utils.metodoLabel(method)}</td>
                            <td className="text-right">{formatBs((val as number) * state.tasa).replace('Bs. ', 'Bs.')}</td>
                          </tr>
                        ))}
                        <tr><td className="text-left uppercase">SALIDAS/GASTOS</td><td className="text-right">-{formatBs((data.manualSalidas || 0) * state.tasa).replace('Bs. ', 'Bs.')}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {type === 'REPORT_Z' && (
                    <div className="pt-2">
                       <table style={{ width: '100%' }}>
                        <tbody>
                          <tr className="bold" style={{ fontSize: '13px' }}><td className="text-left uppercase">GRAN TOTAL BS</td><td className="text-right">{formatBs(data.acumuladoHistoricoUSD * state.tasa).replace('Bs. ', 'Bs.')}</td></tr>
                        </tbody>
                       </table>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {/* Cuerpo de Recibo de Venta */}
                  <table style={{ width: '100%' }}>
                    <tbody>
                      <tr><td className="text-left bold uppercase">N CONTROL:</td><td className="text-right bold">{data.id}</td></tr>
                      <tr><td className="text-left uppercase">CLIENTE:</td><td className="text-right">{customerName}</td></tr>
                    </tbody>
                  </table>

                  <div className="separator" />

                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr className="bold" style={{ fontSize: '11px' }}>
                        <td className="text-left">CANT/DESCRIPCION</td>
                        <td className="text-right">TOTAL BS</td>
                      </tr>
                    </thead>
                    <tbody className="uppercase" style={{ fontSize: '11px' }}>
                      {data.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="text-left" style={{ paddingBottom: '3px' }}>
                            {item.cantidad || item.qty}x {(item.nombre || item.name).slice(0, 25)}
                          </td>
                          <td className="text-right bold">
                            {formatBs((item.subtotalUSD || (item.price * item.qty)) * state.tasa).replace('Bs. ', 'Bs.')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="separator" />

                  <table style={{ width: '100%' }}>
                    <tbody>
                      <tr className="total-line">
                        <td className="text-left uppercase">TOTAL PAGAR</td>
                        <td className="text-right">{formatBs(data.totalBS).replace('Bs. ', 'Bs.')}</td>
                      </tr>
                      <tr className="bold" style={{ fontSize: '12px' }}>
                        <td className="text-left uppercase">REF. DIVISA</td>
                        <td className="text-right">{formatUsd(data.totalUSD)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="text-center mt-6 pt-4" style={{ borderTop: '1px dotted #000' }}>
                <p className="bold uppercase mb-1">¡Gracias por su preferencia!</p>
                <p className="opacity-60 text-[9px] uppercase">PosVEN Pro v2.5 - RC-8002 optimized</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onClose} disabled={isPrinting} className="py-3 bg-[#E5E7EB] text-[#374151] font-black text-xs rounded-xl hover:bg-gray-300 transition-all uppercase tracking-widest disabled:opacity-50">Cerrar</button>
              <button disabled={isPrinting} className="py-3 bg-[#2ECC71] text-white font-black text-xs rounded-xl hover:bg-green-600 flex items-center justify-center gap-2 uppercase tracking-widest shadow-sm disabled:opacity-50"><Share2 size={14} /> Compartir</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handlePrint} disabled={isPrinting} className="py-3 bg-black text-white font-black text-xs rounded-xl hover:opacity-90 flex items-center justify-center gap-2 uppercase tracking-widest shadow-md disabled:opacity-50">
                {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer size={14} />} Estándar
              </button>
              <button onClick={handleNativePrint} disabled={isPrinting} className="py-3 bg-[#C8952E] text-black font-black text-xs rounded-xl hover:bg-[#D9A540] transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg disabled:opacity-50">
                {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap size={16} className="fill-current" />} Impresión Roccia
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}