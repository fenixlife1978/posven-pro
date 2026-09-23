/**
 * Repositorio POSVEN sobre Turso.
 *
 * Exclusivamente servidor. No activa Turso ni toca Firebase por sí solo.
 * Las operaciones críticas usan transacción interactiva para conservar la
 * semántica de concurrencia que tenía Firestore runTransaction().
 */
import {
  isTursoConfigured,
  tursoExecute,
  tursoInteractiveTransaction,
  type TursoStatement,
} from './client';

const TABLES = {
  productos: 'productos',
  movimientos: 'movimientos',
  ventas: 'ventas',
  cxc: 'cxc',
  cxp: 'cxp',
  clientes: 'clientes',
  proveedores: 'proveedores',
  devoluciones: 'devoluciones',
  anulaciones: 'anulaciones',
  terminales: 'terminales',
  libroDiario: 'libro_diario',
  reportesZ: 'reportes_z',
  caja: 'caja',
  compras: 'compras',
} as const;

export type TursoStoreTable = keyof typeof TABLES;

export function assertTursoReady() {
  if (!isTursoConfigured()) throw new Error('Turso no está configurado.');
}

function clean(value: any): any {
  if (value === undefined) return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = clean(v);
    return out;
  }
  return value;
}

function rowFromDb(row: any): any {
  if (!row) return null;
  let data: any = {};
  try { data = JSON.parse(String(row.data_json || '{}')); } catch {}
  return { ...data, id: String(row.id) };
}

function tableName(table: TursoStoreTable): string {
  const name = TABLES[table];
  if (!name) throw new Error('Tabla POSVEN no permitida.');
  return name;
}

function rowStatement(table: TursoStoreTable, record: any): TursoStatement {
  const id = String(record?.id || '');
  if (!id) throw new Error('El registro no tiene id.');
  return {
    sql: `INSERT INTO ${tableName(table)}(id,data_json,fecha,updated_at)
      VALUES(?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        data_json=excluded.data_json,
        fecha=excluded.fecha,
        updated_at=CURRENT_TIMESTAMP`,
    args: [
      id,
      JSON.stringify(clean({ ...record, id })),
      record?.fecha == null ? null : String(record.fecha),
    ],
    wantRows: false,
  };
}

function txSelect(table: TursoStoreTable, id: string): TursoStatement {
  return {
    sql: `SELECT id,data_json FROM ${tableName(table)} WHERE id=? LIMIT 1`,
    args: [String(id)],
  };
}

function terminalPrefix(terminal: any, terminalId?: string): string {
  const raw = String(terminal?.prefijoCaja || '').trim().toUpperCase();
  if (raw) return raw;
  if (terminalId) return 'C-' + String(terminalId).replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase();
  return 'GLOBAL';
}

function terminalSeries(prefix: string, label: string, number: number, width = 6): string {
  return prefix + '-' + label + '-' + String(number).padStart(width, '0');
}

export async function getRecord(table: TursoStoreTable, id: string): Promise<any | null> {
  assertTursoReady();
  const result = await tursoExecute(txSelect(table, id));
  return rowFromDb(result.rows[0]);
}

export async function listRecords(
  table: TursoStoreTable,
  options: { limit?: number; terminalId?: string; estado?: string } = {},
): Promise<any[]> {
  assertTursoReady();
  const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 2000);
  const args: any[] = [];
  const filters: string[] = [];
  if (options.terminalId) {
    filters.push("json_extract(data_json,'$.terminalId')=?");
    args.push(String(options.terminalId));
  }
  if (options.estado) {
    filters.push("json_extract(data_json,'$.estado')=?");
    args.push(String(options.estado));
  }
  const where = filters.length ? ' WHERE ' + filters.join(' AND ') : '';
  const result = await tursoExecute({
    sql: `SELECT id,data_json FROM ${tableName(table)}${where} ORDER BY COALESCE(fecha,'') DESC LIMIT ${limit}`,
    args,
  });
  return result.rows.map(rowFromDb).filter(Boolean);
}

export async function upsertRecords(table: TursoStoreTable, records: any[]): Promise<{ count: number }> {
  assertTursoReady();
  if (!records.length) return { count: 0 };
  if (records.length > 450) throw new Error('El lote supera el límite seguro de 450 registros.');
  await tursoInteractiveTransaction(async tx => {
    for (const record of records) await tx.execute(rowStatement(table, record));
  });
  return { count: records.length };
}

/**
 * Venta atómica: venta + inventario + kardex + asiento + CxC + cliente +
 * correlativo + idempotencia en una sola transacción.
 */
export async function createSaleTransaction(params: {
  operationId: string;
  cart: any[];
  payments: any[];
  clientName: string;
  terminalId?: string;
  fallbackReceiptNumber?: number;
  now: string;
  tasa: number;
  saleType?: string;
  credit?: { customer: any; debtId: string };
  cajeroId?: string;
}) {
  assertTursoReady();
  const { operationId, cart, payments, clientName, terminalId, fallbackReceiptNumber, now,
    tasa, saleType = 'VENTA', credit, cajeroId } = params;

  if (!cart?.length) throw new Error('La venta no contiene productos.');
  if (!(Number(tasa) > 0)) throw new Error('La tasa de la venta no es válida.');

  return tursoInteractiveTransaction(async tx => {
    const opCheck = await tx.execute({
      sql: 'SELECT id FROM operaciones WHERE prefijo=? AND operation_id=? LIMIT 1',
      args: ['VENTA', operationId],
    });
    if (opCheck.rows.length) throw new Error('Esta operación ya fue procesada. No se registrará nuevamente.');

    const terminal = terminalId
      ? rowFromDb((await tx.execute(txSelect('terminales', terminalId))).rows[0])
      : null;
    if (terminalId && !terminal) throw new Error('La caja/terminal ya no existe en Turso.');

    const nextNumber = Number(terminal?.proximoRecibo ?? fallbackReceiptNumber ?? 1);
    const reciboId = terminalSeries(terminalPrefix(terminal, terminalId), 'V', nextNumber, 9);
    const existingSale = await tx.execute(txSelect('ventas', reciboId));
    if (existingSale.rows.length) throw new Error('El correlativo de esta venta ya fue utilizado.');

    const products = new Map<string, any>();
    const productIds = [...new Set(cart.map(i => String(i.productoId || '')).filter(Boolean))];
    for (const pid of productIds) {
      const product = rowFromDb((await tx.execute(txSelect('productos', pid))).rows[0]);
      if (!product) throw new Error('Un producto de la venta ya no existe en Turso.');
      products.set(pid, product);
    }

    const componentIds = new Set<string>();
    for (const item of cart) {
      const p = products.get(String(item.productoId));
      if (p?.isKit && p.kitType === 'stock_componentes' && Array.isArray(p.kitItems)) {
        p.kitItems.forEach((ki: any) => componentIds.add(String(ki.productoId)));
      }
    }
    for (const pid of componentIds) {
      if (!products.has(pid)) {
        const product = rowFromDb((await tx.execute(txSelect('productos', pid))).rows[0]);
        if (!product) throw new Error('Un componente del kit ya no existe en Turso.');
        products.set(pid, product);
      }
    }

    let customer: any = null;
    if (credit?.customer) {
      if (credit.customer.id) {
        customer = rowFromDb((await tx.execute(txSelect('clientes', credit.customer.id))).rows[0]);
      }
      if (!customer && credit.customer.cedula) {
        const found = await tx.execute({
          sql: "SELECT id,data_json FROM clientes WHERE json_extract(data_json,'$.cedula')=? LIMIT 1",
          args: [String(credit.customer.cedula)],
        });
        customer = rowFromDb(found.rows[0]);
      }
      if (!customer) throw new Error('No se pudo resolver el cliente para la venta a crédito.');
    }

    const totals = cart.reduce((acc: any, item: any) => {
      const p = products.get(String(item.productoId));
      const sub = Number(item.subtotalUSD) || 0;
      if (p?.aplicaIVA) {
        const base = sub / 1.16;
        acc.base += base;
        acc.iva += sub - base;
      } else acc.exento += sub;
      acc.total += sub;
      return acc;
    }, { total: 0, base: 0, iva: 0, exento: 0 });

    const totalPaid = payments.reduce((s, p) => s + (Number(p.montoUSD) || 0), 0);
    if (!credit && totalPaid + 0.001 < totals.total) {
      throw new Error('El pago recibido es menor al total de la venta.');
    }

    const deductions = new Map<string, { qty: number; references: string[] }>();
    for (const item of cart) {
      const p = products.get(String(item.productoId));
      if (!p) throw new Error('Producto no encontrado.');
      const qty = Number(item.cantidad) || 0;
      if (qty <= 0) throw new Error('La venta contiene una cantidad inválida.');
      if (p.isKit && p.kitType === 'stock_componentes' && Array.isArray(p.kitItems)) {
        for (const ki of p.kitItems) {
          const id = String(ki.productoId);
          const d = deductions.get(id) || { qty: 0, references: [] };
          d.qty += qty * (Number(ki.cantidad) || 0);
          d.references.push(String(p.nombre || item.nombre || item.productoId));
          deductions.set(id, d);
        }
      } else {
        const id = String(p.id);
        const d = deductions.get(id) || { qty: 0, references: [] };
        d.qty += qty;
        d.references.push(String(p.nombre || item.nombre || item.productoId));
        deductions.set(id, d);
      }
    }

    const productUpdates = new Map<string, any>();
    const movements: any[] = [];
    for (const [pid, deduction] of deductions) {
      const p = products.get(pid);
      const stock = Number(p?.stock) || 0;
      if (!p || stock < deduction.qty) throw new Error('Stock insuficiente para: ' + (p?.nombre || pid));
      const updated = { ...p, stock: stock - deduction.qty };
      productUpdates.set(pid, updated);
      movements.push({
        id: 'MOV-' + crypto.randomUUID(),
        productoId: pid,
        tipo: 'venta',
        cantidad: -deduction.qty,
        stockAntes: stock,
        stockDespues: updated.stock,
        fecha: now,
        referencia: saleType + ' ' + reciboId + (deduction.references.length > 1 ? ' - SALIDA AGRUPADA' : ''),
        terminalId: terminalId || 'GLOBAL',
      });
    }

    const igtf = payments
      .filter(p => p.metodo === 'efectivo_usd' || p.metodo === 'zelle')
      .reduce((s, p) => s + (Number(p.montoUSD) || 0) * 0.03, 0);

    const sale = {
      id: reciboId, fecha: now, cliente: clientName, items: cart.map(x => ({ ...x })),
      subtotalUSD: totals.total, descuentoUSD: 0, totalUSD: totals.total, totalBS: totals.total * tasa,
      metodoPago: credit ? 'credito' : (payments.length > 1 ? 'mixto' : (payments[0]?.metodo || 'efectivo_usd')),
      estado: 'completada', type: saleType, received: totalPaid,
      change: Math.max(0, totalPaid - totals.total), payments: payments.map(x => ({ ...x })),
      terminalId, terminalName: terminal?.nombre || 'SISTEMA GLOBAL', cajeroId,
      baseImponibleUSD: Math.round(totals.base * 100) / 100,
      ivaUSD: Math.round(totals.iva * 100) / 100, exentoUSD: Math.round(totals.exento * 100) / 100,
      igtfUSD: Math.round(igtf * 100) / 100, tasa,
    };

    const journals = credit ? [] : payments.map(p => ({
      id: 'ACC-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase(),
      fecha: now, tipo: 'ingreso', categoria: 'VENTA',
      concepto: `VENTA #${reciboId} - CLIENTE: ${String(clientName).toUpperCase()}`,
      montoUSD: Number(p.montoUSD) || 0,
      montoBS: Number(p.montoBS) || (Number(p.montoUSD) || 0) * tasa,
      metodo: p.metodo, referencia: reciboId + '-' + (terminalId || 'GLOBAL'),
      terminalId: terminalId || 'GLOBAL',
    }));

    const debt = credit ? {
      id: 'CRD-' + reciboId, fecha: now.slice(0, 10), fechaVencimiento: '2099-12-31',
      cliente: `${customer.name} [${customer.cedula}]`, montoUSD: totals.total,
      abonadoUSD: 0, saldoUSD: totals.total, estado: 'pendiente', historialPagos: [],
      ventaId: reciboId,
    } : null;

    const writes: TursoStatement[] = [{
      sql: 'INSERT INTO operaciones(id,prefijo,operation_id,data_json) VALUES(?,?,?,?)',
      args: [
        'VENTA-' + operationId, 'VENTA', operationId,
        JSON.stringify({ tipo: 'VENTA', operationId, referencia: reciboId, terminalId: terminalId || 'GLOBAL' }),
      ],
      wantRows: false,
    }, rowStatement('ventas', sale)];

    for (const product of productUpdates.values()) writes.push(rowStatement('productos', product));
    for (const movement of movements) writes.push(rowStatement('movimientos', movement));
    for (const journal of journals) writes.push(rowStatement('libroDiario', journal));
    if (debt) writes.push(rowStatement('cxc', debt));
    if (customer) writes.push(rowStatement('clientes', { ...customer, debt: (Number(customer.debt) || 0) + totals.total }));
    if (terminal) writes.push(rowStatement('terminales', { ...terminal, proximoRecibo: nextNumber + 1 }));

    for (const statement of writes) await tx.execute(statement);

    return {
      sale, debt, journals, products: [...productUpdates.values()],
      nextNumber: nextNumber + 1,
      terminal: terminal ? { ...terminal, id: terminalId, proximoRecibo: nextNumber + 1 } : null,
    };
  });
}

/**
 * Inventario atómico: el stock se lee y calcula dentro de BEGIN IMMEDIATE.
 */
export async function applyInventoryMovementsTransaction(params: {
  operationId: string;
  operationType: string;
  movements: any[];
  productPatches?: Record<string, any>;
}) {
  assertTursoReady();
  if (!params.movements?.length) throw new Error('No hay movimientos de inventario para registrar.');

  return tursoInteractiveTransaction(async tx => {
    const check = await tx.execute({
      sql: 'SELECT id FROM operaciones WHERE prefijo=? AND operation_id=? LIMIT 1',
      args: ['INVENTARIO', params.operationId],
    });
    if (check.rows.length) throw new Error('Esta operación ya fue procesada. No se registrará nuevamente.');

    const productIds = [...new Set(params.movements.map(m => String(m.productoId || '')).filter(Boolean))];
    if (params.movements.length + productIds.length + 2 > 450) {
      throw new Error('La operación contiene demasiados movimientos para una sola transacción.');
    }

    const products = new Map<string, any>();
    for (const pid of productIds) {
      const product = rowFromDb((await tx.execute(txSelect('productos', pid))).rows[0]);
      if (!product) throw new Error('El producto ' + pid + ' ya no existe en Turso.');
      products.set(pid, product);
    }

    const statements: TursoStatement[] = [{
      sql: 'INSERT INTO operaciones(id,prefijo,operation_id,data_json) VALUES(?,?,?,?)',
      args: ['INVENTARIO-' + params.operationId, 'INVENTARIO', params.operationId, JSON.stringify({
        tipo: params.operationType, operationId: params.operationId,
      })],
      wantRows: false,
    }];

    const persistedMovements: any[] = [];
    const persistedProducts: any[] = [];

    for (const pid of productIds) {
      let running = Number(products.get(pid)?.stock) || 0;
      for (const movement of params.movements.filter(m => String(m.productoId) === pid)) {
        const before = running;
        running += Number(movement.cantidad) || 0;
        const persisted = {
          ...movement,
          id: String(movement.id || ('MOV-' + crypto.randomUUID())),
          productoId: pid,
          stockAntes: before,
          stockDespues: running,
        };
        persistedMovements.push(persisted);
        statements.push(rowStatement('movimientos', persisted));
      }
      const persistedProduct = {
        ...products.get(pid), ...(params.productPatches?.[pid] || {}), stock: running,
      };
      persistedProducts.push(persistedProduct);
      statements.push(rowStatement('productos', persistedProduct));
    }

    for (const statement of statements) await tx.execute(statement);
    return { movements: persistedMovements, productIds, products: persistedProducts };
  });
}
