"use client";

import { useState } from "react";

type Result = {
  ok?: boolean;
  error?: string;
  dryRun?: boolean;
  affectedCount?: number;
  products?: Array<{
    id: string;
    codigo: string | null;
    nombre: string | null;
    departamentoActual: string | null;
    categoria: string | null;
  }>;
};

const payload = {
  operation: "reclassify-products",
  fromDepartment: "CHUCHERIA",
  toDepartment: "INVERGON",
  category: "MUNCHY",
};

export default function InventoryMaintenancePage() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(dryRun: boolean) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/maintenance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, dryRun }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo completar la operación.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!window.confirm("¿Confirmas cambiar únicamente el departamento de los productos MUNCHY que aún no están en INVERGON? Se conservarán todos los demás datos.")) return;
    setResult(null);
    await run(false);
  }

  return (
    <main style={{ maxWidth: 760, margin: "24px auto", padding: 20, fontFamily: "Arial, sans-serif", color: "#172033" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Mantenimiento de inventario</h1>
      <p style={{ lineHeight: 1.5 }}>Corrección controlada: todos los productos de categoría MUNCHY deben pertenecer al departamento INVERGON. Esta herramienta requiere una sesión de administrador y solo modifica el campo departamento.</p>
      <div style={{ padding: 14, background: "#f1f5f9", borderRadius: 10, margin: "18px 0" }}>
        <strong>Regla:</strong> CHUCHERIA + MUNCHY → INVERGON + MUNCHY
        <br />
        <strong>Regla adicional:</strong> MUNCHY + MUNCHY → INVERGON + MUNCHY
      </div>
      <button disabled={loading} onClick={() => run(true)} style={{ padding: "12px 18px", border: 0, borderRadius: 8, background: "#1d4ed8", color: "white", fontWeight: 700, opacity: loading ? 0.6 : 1 }}>
        {loading ? "Procesando…" : "1. Revisar cambios (sin modificar)"}
      </button>
      {error && <p role="alert" style={{ color: "#b91c1c", marginTop: 16 }}>{error}</p>}
      {result && (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 19 }}>Resultado {result.dryRun ? "de la revisión" : "de la corrección"}</h2>
          <p><strong>{result.affectedCount ?? 0}</strong> productos identificados.</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr><th style={{ textAlign: "left", padding: 8 }}>Código</th><th style={{ textAlign: "left", padding: 8 }}>Producto</th><th style={{ textAlign: "left", padding: 8 }}>Departamento actual</th></tr></thead>
              <tbody>{(result.products || []).map(p => <tr key={p.id}><td style={{ padding: 8, borderTop: "1px solid #ddd" }}>{p.codigo || "—"}</td><td style={{ padding: 8, borderTop: "1px solid #ddd" }}>{p.nombre || "—"}</td><td style={{ padding: 8, borderTop: "1px solid #ddd" }}>{p.departamentoActual || "—"}</td></tr>)}</tbody>
            </table>
          </div>
          {result.dryRun && result.affectedCount === 11 && (
            <button disabled={loading} onClick={apply} style={{ marginTop: 18, padding: "12px 18px", border: 0, borderRadius: 8, background: "#15803d", color: "white", fontWeight: 700 }}>
              2. Confirmar y aplicar los 11 cambios
            </button>
          )}
          {!result.dryRun && <p style={{ color: "#166534", fontWeight: 700 }}>Corrección ejecutada. Vuelve a revisar el resumen del inventario para verificar el resultado.</p>}
        </section>
      )}
    </main>
  );
}
