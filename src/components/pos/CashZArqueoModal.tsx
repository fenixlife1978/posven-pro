"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type Props = {
  open: boolean;
  mode: "X" | "Z";
  report: any;
  onCancel: () => void;
  onConfirm: (real: Record<string, string>, diff: { bs: number; usd: number }) => void;
};

const METHODS = [
  "efectivo_bs", "efectivo_usd", "zelle", "pagomovil", "biopago",
  "transferencia_bs", "transferencia_usd", "tarjeta", "credito",
];

const LABELS: Record<string, string> = {
  efectivo_bs: "Efectivo Bs.",
  efectivo_usd: "Efectivo USD",
  zelle: "Zelle",
  pagomovil: "Pago móvil",
  biopago: "Biopago",
  transferencia_bs: "Transferencia Bs.",
  transferencia_usd: "Transferencia USD",
  tarjeta: "Tarjeta / Punto de venta",
  credito: "Ventas a crédito",
};

const isUsd = (method: string) =>
  ["efectivo_usd", "zelle", "transferencia_usd"].includes(method);

const money = (value: number, currency: "BS" | "USD") =>
  currency === "BS"
    ? "Bs. " + Number(value || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "$" + Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CashZArqueoModal({ open, mode, report, onCancel, onConfirm }: Props) {
  const [real, setReal] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    if (!report) return [];
    const source = Array.isArray(report.metodosArqueo) ? report.metodosArqueo : [];
    const map = new Map<string, any>();
    source.forEach((row: any) => {
      const method = String(row?.metodo || "").toLowerCase();
      if (method) map.set(method, row);
    });
    METHODS.forEach(method => {
      if (!map.has(method)) map.set(method, { metodo: method });
    });

    return Array.from(map.entries()).map(([method, value]) => {
      const currency: "BS" | "USD" = isUsd(method) ? "USD" : "BS";
      const opening = method === "efectivo_bs"
        ? Number(report.fondoAperturaBS || 0)
        : method === "efectivo_usd" ? Number(report.fondoAperturaUSD || 0) : 0;
      const sales = currency === "BS" ? Number(value.ventasBS || 0) : Number(value.ventasUSD || 0);
      const cxc = currency === "BS" ? Number(value.cobrosBS || 0) : Number(value.cobrosUSD || 0);
      const returns = currency === "BS" ? Number(value.devBS || 0) : Number(value.devUSD || 0);
      const plus = currency === "BS" ? Number(value.movPlusBS || 0) : Number(value.movPlusUSD || 0);
      const minus = currency === "BS" ? Number(value.movMinusBS || 0) : Number(value.movMinusUSD || 0);
      const system = Number((opening + sales + cxc - returns + plus - minus).toFixed(2));
      return { method, currency, opening, sales, cxc, returns, plus, minus, system };
    });
  }, [report]);

  const diff = useMemo(() => {
    let bs = 0;
    let usd = 0;
    rows.forEach(row => {
      const raw = String(real[row.method] ?? "").trim().replace(",", ".");
      if (!raw) return;
      const amount = Number(raw);
      if (!Number.isFinite(amount)) return;
      if (row.currency === "BS") bs += amount - row.system;
      else usd += amount - row.system;
    });
    return { bs: Number(bs.toFixed(2)), usd: Number(usd.toFixed(2)) };
  }, [rows, real]);

  const allAmountsEntered = rows.length > 0 && rows.every(row => {
    const raw = String(real[row.method] ?? "").trim().replace(",", ".");
    return raw !== "" && Number.isFinite(Number(raw)) && Number(raw) >= 0;
  });

  if (!open || !report) return null;

  const reconciled = mode === "Z" && allAmountsEntered && Math.abs(diff.bs) < 0.01 && Math.abs(diff.usd) < 0.01;
  const hasShortage = diff.bs < -0.01 || diff.usd < -0.01;
  const status = mode === "X"
    ? "LECTURA PARCIAL — NO CIERRA LA CAJA"
    : !allAmountsEntered ? "FALTAN MONTOS REALES POR CONTAR"
      : reconciled ? "ARQUEO CONCILIADO" : hasShortage ? "FALTANTE" : "SOBRANTE";

  return (
    <div className="fixed inset-0 z-[220] bg-black/60 flex items-center justify-center p-3">
      <div className="bg-white w-full max-w-[1500px] max-h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 bg-ink text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-black uppercase italic">{mode === "Z" ? "Arqueo previo al Corte Z" : "Corte X — Arqueo de caja"}</h3>
            <p className="text-[9px] text-white/60 font-bold uppercase mt-1">
              {report.terminalName || "Caja"} · {mode === "Z" ? "Z-" + String(report.numeroZ || 0).padStart(6, "0") : "Consulta sin cierre"}
            </p>
          </div>
          <button onClick={onCancel} className="p-2 text-white/60 hover:text-white" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 overflow-auto">
          <table className="min-w-[1250px] w-full text-xs border-collapse">
            <thead className="bg-surface-soft text-ink">
              <tr>
                {["Método de pago", "Fondo Inicial Bs.", "Fondo Inicial USD", "Ventas", "CxC", "Dev/Anu.", "Mov. Caja (+)", "Mov. Caja (-)", "Total Monto Sistema", "Monto Real", "DIF. (+/-)"].map(h =>
                  <th key={h} className="p-2 border border-line text-left font-black uppercase">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const raw = String(real[row.method] ?? "");
                const parsed = raw.trim() === "" ? null : Number(raw.replace(",", "."));
                const rowDiff = parsed === null || !Number.isFinite(parsed) ? null : Number((parsed - row.system).toFixed(2));
                return (
                  <tr key={row.method}>
                    <td className="p-2 border border-line font-black">{LABELS[row.method] || row.method.replace(/_/g, " ")}</td>
                    <td className="p-2 border border-line text-right">{money(row.method === "efectivo_bs" ? row.opening : 0, "BS")}</td>
                    <td className="p-2 border border-line text-right">{money(row.method === "efectivo_usd" ? row.opening : 0, "USD")}</td>
                    <td className="p-2 border border-line text-right">{money(row.sales, row.currency)}</td>
                    <td className="p-2 border border-line text-right">{money(row.cxc, row.currency)}</td>
                    <td className="p-2 border border-line text-right">{money(row.returns, row.currency)}</td>
                    <td className="p-2 border border-line text-right">{money(row.plus, row.currency)}</td>
                    <td className="p-2 border border-line text-right">{money(row.minus, row.currency)}</td>
                    <td className="p-2 border border-line text-right font-black">{money(row.system, row.currency)}</td>
                    <td className="p-1 border border-line">
                      {mode === "Z" ? (
                        <input type="text" inputMode="decimal" value={raw}
                          onChange={e => setReal(prev => ({ ...prev, [row.method]: e.target.value.replace(/[^0-9.,]/g, "") }))}
                          placeholder={row.currency === "BS" ? "Bs." : "USD"}
                          className="w-32 px-2 py-1.5 border border-line rounded-lg text-right font-bold" />
                      ) : <span className="block text-center text-ink/40">—</span>}
                    </td>
                    <td className="p-2 border border-line text-right font-black">
                      {rowDiff === null ? "—" : <span className={rowDiff > 0.005 ? "text-status-success" : rowDiff < -0.005 ? "text-status-danger" : "text-ink"}>{money(rowDiff, row.currency)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 rounded-xl border border-line bg-surface-soft p-4">
            <div className="flex items-center gap-2 font-black text-sm">
              {reconciled ? <CheckCircle2 className="w-5 h-5 text-status-success" /> : <AlertTriangle className="w-5 h-5 text-brand-gold-deep" />}
              {status}
            </div>
            {mode === "Z" && (
              <>
                <div className="text-xs mt-1">Diferencia Bs.: <b>{money(diff.bs, "BS")}</b> · Diferencia USD: <b>{money(diff.usd, "USD")}</b></div>
                <div className="text-[10px] text-ink/50 mt-1">Debe introducir el efectivo y saldo real de cada medio de pago, incluso cero. Los medios electrónicos no se convierten en efectivo.</div>
              </>
            )}
          </div>
        </div>

        <div className="p-4 bg-surface-soft border-t border-line flex justify-end gap-2 shrink-0">
          <button onClick={onCancel} className="px-5 h-10 rounded-xl border border-line text-ink font-black uppercase text-[10px]">Cerrar</button>
          {mode === "Z" && (
            <button disabled={!allAmountsEntered} onClick={() => onConfirm(real, diff)}
              className="px-5 h-10 rounded-xl bg-status-danger text-white font-black uppercase text-[10px] shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
              Guardar y ejecutar Z
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
