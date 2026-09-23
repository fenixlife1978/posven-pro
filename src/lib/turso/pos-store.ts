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


function assertTerminalAccess(user: { rol: string; id: string; firebaseUid?: string | null }, terminal: any) {
  if (user.rol === 'administrador') return;
  const assigned = String(terminal?.usuarioId || '');
  const allowed = new Set([String(user.id), user.firebaseUid ? String(user.firebaseUid) : '']);
  if (!assigned || !allowed.has(assigned)) throw new Error('Esta terminal no está asignada al usuario autenticado.');
}

export async function patchTerminalTransaction(params: {
  user: { rol: string; id: string; firebaseUid?: string | null };
  terminalId: string;
  patch: Record<string, any>;
}) {
  assertTursoReady();
  return tursoInteractiveTransaction(async tx => {
    const current = rowFromDb((await tx.execute(txSelect('terminales', params.terminalId))).rows[0]);
    if (!current) throw new Error('La terminal ya no existe en Turso.');
    assertTerminalAccess(params.user, current);
    const updated = { ...current, ...clean(params.patch), id: params.terminalId };
    await tx.execute(rowStatement('terminales', updated));
    return { terminal: updated };
  });
}

export async function upsertTerminalTransaction(params: {
  user: { rol: string };
  terminal: any;
}) {
  assertTursoReady();
  if (params.user.rol !== 'administrador') throw new Error('Se requiere administrador.');
  if (!params.terminal?.id) throw new Error('La terminal no tiene id.');
  await tursoInteractiveTransaction(async tx => {
    await tx.execute(rowStatement('terminales', params.terminal));
  });
  return { terminal: params.terminal };
}

export async function deleteTerminalTransaction(params: {
  user: { rol: string };
  terminalId: string;
}) {
  assertTursoReady();
  if (params.user.rol !== 'administrador') throw new Error('Se requiere administrador.');
  return tursoInteractiveTransaction(async tx => {
    await tx.execute({ sql: 'DELETE FROM terminales WHERE id=?', args: [params.terminalId], wantRows: false });
    return { terminalId: params.terminalId };
  });
}

export async function createZClosureTransaction(params: {
  user: { rol: string; id: string; firebaseUid?: string | null };
  terminalId: string;
  report: any;
  terminalPatch: Record<string, any>;
}) {
  assertTursoReady();
  return tursoInteractiveTransaction(async tx => {
    const current = rowFromDb((await tx.execute(txSelect('terminales', params.terminalId))).rows[0]);
    if (!current) throw new Error('La terminal ya no existe en Turso.');
    assertTerminalAccess(params.user, current);

    const expectedNumber = Number(current.ultimoZ || 0) + 1;
    const requestedNumber = Number(params.report?.numeroZ || expectedNumber);
    if (requestedNumber !== expectedNumber) {
      throw new Error('El número Z cambió en otra caja. Actualice y vuelva a generar el corte.');
    }

    const prefix = terminalPrefix(current, params.terminalId);
    let report = { ...clean(params.report), terminalId: params.terminalId, numeroZ: expectedNumber };
    const requestedId = String(report.id || '');
    const existing = requestedId ? await tx.execute(txSelect('reportesZ', requestedId)) : { rows: [] } as any;
    if (existing.rows.length) {
      report.id = terminalSeries(prefix, 'Z', expectedNumber, 6);
      const canonical = await tx.execute(txSelect('reportesZ', report.id));
      if (canonical.rows.length) throw new Error('El corte Z de esta terminal ya fue registrado.');
    } else if (!requestedId) {
      report.id = terminalSeries(prefix, 'Z', expectedNumber, 6);
    }

    const updatedTerminal = { ...current, ...clean(params.terminalPatch), ultimoZ: expectedNumber, id: params.terminalId };
    await tx.execute(rowStatement('reportesZ', report));
    await tx.execute(rowStatement('terminales', updatedTerminal));
    return { report, terminal: updatedTerminal };
  });
}


export async function applyDebtPaymentTransaction(params: {
  operationId?: string; collection: 'cxc' | 'cxp'; debtId: string; amountUSD: number;
  amountBS?: number; payment: any; journal?: any | any[]; sale?: any; customerCedula?: string; terminalId?: string;
}) {
  assertTursoReady();
  const { operationId, collection, debtId, amountUSD, amountBS, payment, journal, sale, customerCedula, terminalId } = params;
  if (!(Number(amountUSD) > 0)) return null;
  return tursoInteractiveTransaction(async tx => {
    const opId = String(operationId || payment?.id || (collection+'|'+debtId+'|'+amountUSD+'|'+payment?.metodo+'|'+payment?.fecha));
    const check = await tx.execute({sql:'SELECT id FROM operaciones WHERE prefijo=? AND operation_id=? LIMIT 1',args:['PAGO-DEUDA',opId]});
    if (check.rows.length) throw new Error('Esta operación ya fue procesada. No se registrará nuevamente.');
    const debt = rowFromDb((await tx.execute(txSelect(collection,debtId))).rows[0]);
    if (!debt) throw new Error('La deuda ya no existe.');
    const saldo = Number(debt.saldoUSD)||0;
    if (saldo <= 0.001) throw new Error('La deuda ya está pagada en otra caja.');
    if (Number(amountUSD) > saldo + 0.001) throw new Error('El saldo cambió en otra caja. Actualice y vuelva a intentar.');
    const terminal = terminalId ? rowFromDb((await tx.execute(txSelect('terminales',terminalId))).rows[0]) : null;
    if (terminalId && !terminal) throw new Error('La caja/terminal ya no existe en Turso.');
    const field = collection==='cxc'?'proximoCobroDeuda':'proximoPagoProveedor';
    const label = collection==='cxc'?'CXC':'CXP';
    const counter=Number(terminal?.[field])||1;
    const receiptId=terminal?terminalSeries(terminalPrefix(terminal,terminalId),label,counter,6):terminalSeries('GLOBAL',label,Date.now(),6);
    const applied=Math.min(Number(amountUSD),saldo);
    const appliedBS=Number(amountBS)>0?Math.min(Number(amountBS),Number(payment?.montoBS)||Number(amountBS)):(Number(payment?.montoBS)||(applied*(Number(payment?.tasaAplicada)||0)));
    const pago=clean({...payment,id:receiptId,reciboId:receiptId,terminalId:terminalId||payment?.terminalId,montoUSD:applied,montoBS:appliedBS});
    const updated={...debt,abonadoUSD:(Number(debt.abonadoUSD)||0)+applied,saldoUSD:Math.max(0,saldo-applied),estado:saldo-applied<=0.001?'pagada':'parcial',historialPagos:[...(Array.isArray(debt.historialPagos)?debt.historialPagos:[]),pago]};
    const statements:TursoStatement[]=[rowStatement(collection,updated)];
    if(collection==='cxc'&&customerCedula){
      const found=await tx.execute({sql:"SELECT id,data_json FROM clientes WHERE json_extract(data_json,'$.cedula')=? LIMIT 1",args:[String(customerCedula)]});
      const customer=rowFromDb(found.rows[0]);
      if(customer) statements.push(rowStatement('clientes',{...customer,debt:Math.max(0,(Number(customer.debt)||0)-applied)}));
    }
    const journals=Array.isArray(journal)?journal:(journal?[journal]:[]);
    for(const entry of journals) if(entry?.id) statements.push(rowStatement('libroDiario',{...entry,referencia:receiptId,terminalId:terminalId||entry.terminalId,terminalName:terminal?.nombre||entry.terminalName}));
    const persistedSale=sale?.id?{...sale,id:receiptId,terminalId:terminalId||sale.terminalId,terminalName:terminal?.nombre||sale.terminalName}:null;
    if(persistedSale) statements.push(rowStatement('ventas',persistedSale));
    if(terminal) statements.push(rowStatement('terminales',{...terminal,[field]:counter+1}));
    statements.push({sql:'INSERT INTO operaciones(id,prefijo,operation_id,data_json) VALUES(?,?,?,?)',args:['PAGO-DEUDA-'+opId,'PAGO-DEUDA',opId,JSON.stringify({tipo:'PAGO-DEUDA',operationId:opId,referencia:debtId})],wantRows:false});
    for(const s of statements) await tx.execute(s);
    return {...updated,appliedUSD:applied,appliedBS,receiptId,payment:pago,journal:journals,sale:persistedSale,terminal:terminal?{...terminal,id:terminalId,[field]:counter+1}:null};
  });
}

async function applyGlobalPayment(params:any, collection:'cxc'|'cxp'){
  assertTursoReady();
  const {operationId,provider,customerName,customerCedula,amountUSD,amountBS,payment,journal,terminalId}=params;
  if(!(Number(amountUSD)>0)) return {appliedUSD:0,appliedBS:0,debts:[]};
  return tursoInteractiveTransaction(async tx=>{
    const opId=String(operationId||payment?.id||((collection==='cxp'?'CXP-GLOBAL':'CXC-GLOBAL')+'|'+(provider||customerName)+'|'+amountUSD+'|'+payment?.fecha+'|'+payment?.metodo));
    const prefix=collection==='cxp'?'PAGO-CXP-GLOBAL':'PAGO-CXC-GLOBAL';
    const check=await tx.execute({sql:'SELECT id FROM operaciones WHERE prefijo=? AND operation_id=? LIMIT 1',args:[prefix,opId]});
    if(check.rows.length) throw new Error('Esta operación ya fue procesada. No se registrará nuevamente.');
    const terminal=terminalId?rowFromDb((await tx.execute(txSelect('terminales',terminalId))).rows[0]):null;
    if(terminalId&&!terminal) throw new Error('La caja/terminal ya no existe en Turso.');
    const field=collection==='cxp'?'proximoPagoProveedor':'proximoCobroDeuda';
    const label=collection==='cxp'?'CXP':'CXC';
    const counter=Number(terminal?.[field])||1;
    const receiptId=terminal?terminalSeries(terminalPrefix(terminal,terminalId),label,counter,6):terminalSeries('GLOBAL',label,Date.now(),6);
    const matchField=collection==='cxp'?'proveedor':'cliente';
    const matchValue=collection==='cxp'?String(provider||''):String(customerCedula?customerName+' ['+customerCedula+']':customerName||'');
    const found=await tx.execute({sql:"SELECT id,data_json FROM "+tableName(collection)+" WHERE json_extract(data_json,'$."+matchField+"')=? ORDER BY COALESCE(fecha,'') ASC,id ASC",args:[matchValue]});
    const docs=found.rows.map(rowFromDb).filter((d:any)=>(Number(d?.saldoUSD)||0)>0.001&&d?.estado!=='pagada');
    let remUSD=Number(amountUSD), remBS=Number(amountBS)>0?Number(amountBS):Number(amountUSD)*(Number(payment?.tasaAplicada)||0);
    let appliedUSD=0, appliedBS=0; const debts:any[]=[]; const statements:TursoStatement[]=[];
    for(const d of docs){
      if(remUSD<=0.000001) break;
      const pago=Math.min(Number(d.saldoUSD)||0,remUSD); if(pago<=0) continue;
      const tasa=Number(payment?.tasaAplicada)||0; const pagoBS=Math.min(remBS,pago*tasa);
      remUSD=Math.max(0,remUSD-pago); remBS=Math.max(0,remBS-pagoBS);
      const h=[...(Array.isArray(d.historialPagos)?d.historialPagos:[])];
      h.push(clean({...payment,id:receiptId,reciboId:receiptId,terminalId:terminalId||payment?.terminalId,montoUSD:pago,montoBS:pagoBS}));
      const updated={...d,abonadoUSD:(Number(d.abonadoUSD)||0)+pago,saldoUSD:Math.max(0,(Number(d.saldoUSD)||0)-pago),estado:(Number(d.saldoUSD)-pago)<=0.001?'pagada':'parcial',historialPagos:h};
      statements.push(rowStatement(collection,updated)); debts.push({...updated,appliedUSD:pago,appliedBS:pagoBS}); appliedUSD+=pago; appliedBS+=pagoBS;
    }
    if(appliedUSD<=0.000001) throw new Error('No hay saldo pendiente para registrar este pago.');
    if(collection==='cxc'&&customerCedula){
      const foundCustomer=await tx.execute({sql:"SELECT id,data_json FROM clientes WHERE json_extract(data_json,'$.cedula')=? LIMIT 1",args:[String(customerCedula)]});
      const customer=rowFromDb(foundCustomer.rows[0]); if(customer) statements.push(rowStatement('clientes',{...customer,debt:Math.max(0,(Number(customer.debt)||0)-appliedUSD)}));
    }
    if(journal?.id) statements.push(rowStatement('libroDiario',{...journal,montoUSD:appliedUSD,montoBS:appliedBS,referencia:receiptId,terminalId:terminalId||journal.terminalId,terminalName:terminal?.nombre||journal.terminalName}));
    if(terminal) statements.push(rowStatement('terminales',{...terminal,[field]:counter+1}));
    statements.push({sql:'INSERT INTO operaciones(id,prefijo,operation_id,data_json) VALUES(?,?,?,?)',args:[prefix+'-'+opId,prefix,opId,JSON.stringify({tipo:prefix,operationId:opId,referencia:receiptId,terminalId:terminalId||'GLOBAL'})],wantRows:false});
    for(const s of statements) await tx.execute(s);
    return {appliedUSD,appliedBS,debts,receiptId};
  });
}
export async function applyGlobalProviderPaymentTransaction(params:any){ return applyGlobalPayment(params,'cxp'); }
export async function applyGlobalCustomerPaymentTransaction(params:any){ return applyGlobalPayment(params,'cxc'); }

export async function createCustomerDebtTransaction(params:any){
  assertTursoReady();
  return tursoInteractiveTransaction(async tx=>{
    const opId=String(params.operationId||params.debt?.id);
    const check=await tx.execute({sql:'SELECT id FROM operaciones WHERE prefijo=? AND operation_id=? LIMIT 1',args:['DEUDA-CXC',opId]});
    if(check.rows.length) throw new Error('Esta operación ya fue procesada. No se registrará nuevamente.');
    const debt=params.debt; if(!debt?.id) throw new Error('La deuda no tiene id.');
    if((await tx.execute(txSelect('cxc',debt.id))).rows.length) throw new Error('La deuda ya existe en Turso.');
    const statements:TursoStatement[]=[rowStatement('cxc',debt)];
    let customer=null;
    if(params.customerId) customer=rowFromDb((await tx.execute(txSelect('clientes',params.customerId))).rows[0]);
    if(!customer&&params.customerCedula) customer=rowFromDb((await tx.execute({sql:"SELECT id,data_json FROM clientes WHERE json_extract(data_json,'$.cedula')=? LIMIT 1",args:[String(params.customerCedula)]})).rows[0]);
    if(customer) statements.push(rowStatement('clientes',{...customer,debt:(Number(customer.debt)||0)+(Number(debt.montoUSD)||0)}));
    if(params.journal?.id) statements.push(rowStatement('libroDiario',params.journal));
    statements.push({sql:'INSERT INTO operaciones(id,prefijo,operation_id,data_json) VALUES(?,?,?,?)',args:['DEUDA-CXC-'+opId,'DEUDA-CXC',opId,JSON.stringify({tipo:'DEUDA-CXC',operationId:opId,referencia:debt.id})],wantRows:false});
    for(const s of statements) await tx.execute(s); return {debt,customer};
  });
}
export async function createSupplierDebtTransaction(params:any){
  assertTursoReady();
  return tursoInteractiveTransaction(async tx=>{
    const opId=String(params.operationId||params.debt?.id);
    const check=await tx.execute({sql:'SELECT id FROM operaciones WHERE prefijo=? AND operation_id=? LIMIT 1',args:['DEUDA-CXP',opId]});
    if(check.rows.length) throw new Error('Esta operación ya fue procesada. No se registrará nuevamente.');
    const debt=params.debt; if(!debt?.id) throw new Error('La deuda no tiene id.');
    if((await tx.execute(txSelect('cxp',debt.id))).rows.length) throw new Error('La deuda ya existe en Turso.');
    const statements:TursoStatement[]=[rowStatement('cxp',debt)]; if(params.journal?.id) statements.push(rowStatement('libroDiario',params.journal));
    statements.push({sql:'INSERT INTO operaciones(id,prefijo,operation_id,data_json) VALUES(?,?,?,?)',args:['DEUDA-CXP-'+opId,'DEUDA-CXP',opId,JSON.stringify({tipo:'DEUDA-CXP',operationId:opId,referencia:debt.id})],wantRows:false});
    for(const s of statements) await tx.execute(s); return debt;
  });
}

export async function processReturnOrCancellationTransaction(params:any){
  assertTursoReady();
  const {operationId,operationType,saleId,operationDoc,movements=[],journal,terminalId}=params;
  return tursoInteractiveTransaction(async tx=>{
    const check=await tx.execute({sql:'SELECT id FROM operaciones WHERE prefijo=? AND operation_id=? LIMIT 1',args:[operationType,operationId]});
    if(check.rows.length) throw new Error('Esta operación ya fue procesada. No se registrará nuevamente.');
    const sale=rowFromDb((await tx.execute(txSelect('ventas',String(saleId)))).rows[0]); if(!sale) throw new Error('La venta ya no existe en Turso.');
    if(operationType==='ANULACION'&&String(sale.estado||'')==='anulada') throw new Error('La factura ya fue anulada.');
    const terminal=terminalId?rowFromDb((await tx.execute(txSelect('terminales',terminalId))).rows[0]):null;
    if(terminalId&&!terminal) throw new Error('La terminal de la operación ya no existe.');
    const field=operationType==='DEVOLUCION'?'proximaDevolucion':'proximaAnulacion';
    const label=operationType==='DEVOLUCION'?'DEV':'ANU'; const counter=Number(terminal?.[field])||1;
    const canonicalId=terminal?terminalSeries(terminalPrefix(terminal,terminalId),label,counter,6):terminalSeries('GLOBAL',label,Date.now(),6);
    const table=operationType==='DEVOLUCION'?'devoluciones':'anulaciones';
    if((await tx.execute(txSelect(table,canonicalId))).rows.length) throw new Error('Esta operación ya fue registrada.');
    const products=new Map<string,any>();
    for(const m of movements){const pid=String(m.productoId||''); if(!pid) continue; if(!products.has(pid)){const p=rowFromDb((await tx.execute(txSelect('productos',pid))).rows[0]); if(!p) throw new Error('Un producto de la operación ya no existe en Turso.'); products.set(pid,p);}}
    const statements:TursoStatement[]=[];
    for(const m of movements){const pid=String(m.productoId),p=products.get(pid); const before=Number(p.stock)||0; const after=before+(Number(m.cantidad)||0); const persisted={...m,id:String(m.id||('MOV-'+crypto.randomUUID())),productoId:pid,stockAntes:before,stockDespues:after}; products.set(pid,{...p,stock:after}); statements.push(rowStatement('movimientos',persisted));}
    for(const p of products.values()) statements.push(rowStatement('productos',p));
    statements.push(rowStatement(table,{...operationDoc,id:canonicalId,terminalId:terminalId||operationDoc?.terminalId,terminalName:terminal?.nombre||operationDoc?.terminalName}));
    statements.push(rowStatement('ventas',{...sale,estado:operationType==='ANULACION'?'anulada':'parcialmente_devuelta'}));
    if(journal?.id) statements.push(rowStatement('libroDiario',{...journal,referencia:canonicalId,terminalId:terminalId||journal.terminalId,terminalName:terminal?.nombre||journal.terminalName}));
    if(terminal) statements.push(rowStatement('terminales',{...terminal,[field]:counter+1}));
    statements.push({sql:'INSERT INTO operaciones(id,prefijo,operation_id,data_json) VALUES(?,?,?,?)',args:[operationType+'-'+operationId,operationType,operationId,JSON.stringify({tipo:operationType,operationId,referencia:canonicalId,terminalId:terminalId||'GLOBAL'})],wantRows:false});
    for(const s of statements) await tx.execute(s);
    return {operationId,operationType,receiptId:canonicalId,operationDoc:{...operationDoc,id:canonicalId},products:[...products.values()],terminal:terminal?{...terminal,id:terminalId,[field]:counter+1}:null};
  });
}

export async function reverseDebtPaymentTransaction(params:any){
  assertTursoReady();
  const {operationId,collection,debtId,paymentId,journalId}=params;
  return tursoInteractiveTransaction(async tx=>{
    const opId=String(operationId||collection+'|'+debtId+'|'+paymentId+'|REVERSE');
    const check=await tx.execute({sql:'SELECT id FROM operaciones WHERE prefijo=? AND operation_id=? LIMIT 1',args:['REVERSAR-PAGO',opId]});
    if(check.rows.length) throw new Error('Esta operación ya fue procesada. No se registrará nuevamente.');
    const debt=rowFromDb((await tx.execute(txSelect(collection,debtId))).rows[0]); if(!debt) throw new Error('La deuda ya no existe.');
    const historial=Array.isArray(debt.historialPagos)?debt.historialPagos:[]; const idx=historial.findIndex((p:any)=>String(p?.id||'')===String(paymentId));
    if(idx<0) throw new Error('El abono ya fue eliminado o no existe en la deuda.');
    const pago=historial[idx], restantes=historial.filter((_:any,i:number)=>i!==idx);
    const abonado=Math.max(0,Math.round((restantes.reduce((s:number,p:any)=>s+(Number(p?.montoUSD)||0),0)+Number.EPSILON)*100)/100);
    const saldo=Math.max(0,Math.round(((Number(debt.montoUSD)||0)-abonado+Number.EPSILON)*100)/100);
    const updated={...debt,abonadoUSD:abonado,saldoUSD:saldo,estado:saldo<=.001?'pagada':abonado>0?'parcial':'pendiente',historialPagos:restantes};
    const statements:TursoStatement[]=[rowStatement(collection,updated)];
    if(journalId){
      const jr=await tx.execute(txSelect('libroDiario',journalId)); const journal=rowFromDb(jr.rows[0]);
      if(journal){
        const monto=Math.max(0,Math.round(((Number(journal.montoUSD)||0)-(Number(pago?.montoUSD)||0)+Number.EPSILON)*100)/100);
        const montoBS=Math.max(0,Math.round(((Number(journal.montoBS)||0)-(Number(pago?.montoBS)||0)+Number.EPSILON)*100)/100);
        if(monto<=.001) await tx.execute({sql:'DELETE FROM libro_diario WHERE id=?',args:[journalId],wantRows:false});
        else statements.push(rowStatement('libroDiario',{...journal,montoUSD:monto,montoBS:montoBS,concepto:String(journal.concepto||'').replace(/ \(abono revertido\)$/i,'')+' (abono revertido)'}));
      }
    }
    statements.push({sql:'INSERT INTO operaciones(id,prefijo,operation_id,data_json) VALUES(?,?,?,?)',args:['REVERSAR-PAGO-'+opId,'REVERSAR-PAGO',opId,JSON.stringify({tipo:'REVERSAR-PAGO',operationId:opId,referencia:paymentId})],wantRows:false});
    for(const s of statements) await tx.execute(s);
    return {...updated,reversedPayment:pago};
  });
}
export async function deleteCustomerAndDebtsTransaction(params:any){
  assertTursoReady();
  return tursoInteractiveTransaction(async tx=>{
    const {operationId,customerId,customerName,customerCedula}=params; const opId=String(operationId||customerId);
    const check=await tx.execute({sql:'SELECT id FROM operaciones WHERE prefijo=? AND operation_id=? LIMIT 1',args:['ELIMINAR-CLIENTE',opId]});
    if(check.rows.length) throw new Error('Esta operación ya fue procesada. No se registrará nuevamente.');
    const customer=customerId?rowFromDb((await tx.execute(txSelect('clientes',customerId))).rows[0]):null; if(!customer) throw new Error('El cliente ya no existe.');
    const exact=customerCedula?String(customerName||customer.cliente||customer.nombre||'')+' ['+customerCedula+']':String(customerName||customer.cliente||customer.nombre||'');
    const found=await tx.execute({sql:"SELECT id,data_json FROM cxc WHERE json_extract(data_json,'$.cliente') IN (?,?)",args:[exact,String(customerName||customer.cliente||customer.nombre||'')]});
    const debts=found.rows.map(rowFromDb);
    const active=debts.find((d:any)=>d.estado!=='pagada'&&(Number(d.saldoUSD)||0)>.001); if(active) throw new Error('El cliente tiene una deuda pendiente.');
    for(const d of debts) await tx.execute({sql:'DELETE FROM cxc WHERE id=?',args:[d.id],wantRows:false});
    await tx.execute({sql:'DELETE FROM clientes WHERE id=?',args:[customerId],wantRows:false});
    await tx.execute({sql:'INSERT INTO operaciones(id,prefijo,operation_id,data_json) VALUES(?,?,?,?)',args:['ELIMINAR-CLIENTE-'+opId,'ELIMINAR-CLIENTE',opId,JSON.stringify({tipo:'ELIMINAR-CLIENTE',operationId:opId,referencia:customerId})],wantRows:false});
    return {customer,deletedDebts:debts.length};
  });
}
