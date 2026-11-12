import { getRequestSessionId, getSessionUser } from '@/lib/auth/turso-auth';
import { NextResponse } from 'next/server';
import {
  assertTursoReady,
  getRecord,
  getAssignedTerminal,
  listRecords,
  listProductsPage,
  countRecords,
  upsertRecords,
  syncProductChanges,
  syncRecords,
  getAppConfig,
  patchAppConfig,
  getCatalog,
  getAllCatalogs,
  patchCatalog,
  factoryResetTransaction,
  createSaleTransaction,
  applyInventoryMovementsTransaction,
  syncProductsStockFromKardex,
  patchTerminalTransaction,
  upsertTerminalTransaction,
  deleteTerminalTransaction,
  createZClosureTransaction,
  applyDebtPaymentTransaction,
  createCashMovementTransaction,
  applyGlobalProviderPaymentTransaction,
  applyGlobalCustomerPaymentTransaction,
  createCustomerDebtTransaction,
  createSupplierDebtTransaction,
  processReturnOrCancellationTransaction,
  repairReturnInventoryAndCxcTransaction,
  reverseDebtPaymentTransaction,
  deleteCustomerAndDebtsTransaction,
  deleteCustomerDebtTransaction,
  createPurchaseTransaction,
  deletePurchaseTransaction,
  type TursoStoreTable,
} from '@/lib/turso/pos-store';

export const runtime = 'nodejs';

const TABLES = new Set([
  'productos','movimientos','ventas','cxc','cxp','clientes','proveedores',
  'devoluciones','anulaciones','terminales','libroDiario','reportesZ','caja','compras',
]);

function table(value: unknown): TursoStoreTable {
  const name = String(value || '');
  if (!TABLES.has(name)) throw new Error('Tabla POSVEN no permitida.');
  return name as TursoStoreTable;
}

async function requireUser(request: Request) {
  const user = await getSessionUser(getRequestSessionId(request));
  if (!user) throw new Error('No autenticado.');
  return user;
}

export async function GET(request: Request) {
  try {
    assertTursoReady();
    const user = await requireUser(request);
    const url = new URL(request.url);
    const special = url.searchParams.get('special');
    if (special === 'config') return NextResponse.json({ ok: true, config: await getAppConfig() });
    if (special === 'catalog') return NextResponse.json({ ok: true, lista: await getCatalog(String(url.searchParams.get('name') || '')) });
    if (special === 'catalogs') return NextResponse.json({ ok: true, catalogs: await getAllCatalogs() });
    if (special === 'products-page') {
      const result = await listProductsPage({
        page: Number(url.searchParams.get('page') || 1),
        pageSize: Number(url.searchParams.get('pageSize') || 10),
        search: url.searchParams.get('search') || '',
        departamento: url.searchParams.get('departamento') || '',
        categoria: url.searchParams.get('categoria') || '',
      });
      return NextResponse.json({ ok: true, ...result });
    }
    const t = table(url.searchParams.get('table'));
    const cashier = user.rol !== 'administrador';
    const restrictedAdminTables = new Set(['cxp', 'proveedores', 'compras']);
    if (cashier && restrictedAdminTables.has(t)) throw new Error('Se requiere administrador.');
    const terminalScopedTables = new Set(['ventas', 'movimientos', 'devoluciones', 'anulaciones', 'reportesZ', 'caja', 'libroDiario']);
    const assignedTerminal = cashier && (terminalScopedTables.has(t) || t === 'terminales') ? await getAssignedTerminal(user) : null;
    if (cashier && !assignedTerminal && (terminalScopedTables.has(t) || t === 'terminales')) {
      throw new Error('El usuario no tiene una terminal asignada.');
    }
    if (special === 'count') {
      return NextResponse.json({ ok: true, total: await countRecords(t) });
    }
    const id = url.searchParams.get('id');
    if (id) {
      const record = await getRecord(t, id);
      if (cashier && t === 'terminales' && String(record?.id || '') !== String(assignedTerminal?.id || '')) {
        throw new Error('No tiene acceso a esa terminal.');
      }
      if (cashier && terminalScopedTables.has(t) && String(record?.terminalId || '') !== String(assignedTerminal?.id || '')) {
        throw new Error('No tiene acceso a los registros de otra terminal.');
      }
      return NextResponse.json({ ok: true, record });
    }
    if (cashier && t === 'terminales') {
      const requested = url.searchParams.get('terminalId');
      if (requested && requested !== String(assignedTerminal?.id || '')) throw new Error('No tiene acceso a esa terminal.');
      return NextResponse.json({ ok: true, records: assignedTerminal ? [assignedTerminal] : [] });
    }
    const records = await listRecords(t, {
      limit: Number(url.searchParams.get('limit') || 500),
      offset: Number(url.searchParams.get('offset') || 0),
      terminalId: cashier && terminalScopedTables.has(t) ? String(assignedTerminal?.id || '') : (url.searchParams.get('terminalId') || undefined),
      estado: url.searchParams.get('estado') || undefined,
      since: url.searchParams.get('since') || undefined,
      until: url.searchParams.get('until') || undefined,
    });
    return NextResponse.json({ ok: true, records });
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = message.includes('no está configurado') ? 503
      : message.includes('No autenticado') ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    assertTursoReady();
    const user = await requireUser(request);
    const body = await request.json();

    switch (String(body?.operation || '')) {
      case 'configPatch': {
        // La tasa BCV es una configuración operativa que los cajeros están
        // autorizados a actualizar permanentemente. Los demás parámetros de
        // configuración siguen restringidos al administrador.
        const patch = body.patch || {};
        const keys = Object.keys(patch);
        const onlyRate = keys.length > 0 && keys.every((key) => key === 'tasa');
        if (user.rol !== 'administrador' && !onlyRate) {
          throw new Error('Solo la tasa BCV puede ser modificada por un cajero.');
        }
        const config = await patchAppConfig(patch);
        return NextResponse.json({ ok: true, config });
      }
      case 'catalogPatch': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const lista = await patchCatalog(String(body.name), Array.isArray(body.lista) ? body.lista : []);
        return NextResponse.json({ ok: true, name: String(body.name), lista });
      }
      case 'factoryReset': {
        const result = await factoryResetTransaction({ user });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'productSync': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result = await syncProductChanges({
          changes: Array.isArray(body.changes) ? body.changes : [],
          deletedIds: Array.isArray(body.deletedIds) ? body.deletedIds : [],
        });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'recordsSync': {
        const allowed = new Set(['clientes', 'proveedores', 'movimientos', 'libroDiario']);
        const target = String(body.table || '');
        if (!allowed.has(target)) throw new Error('Tabla no permitida para sincronización general.');
        if (target === 'proveedores' && user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        if (user.rol !== 'administrador' && ['proveedores', 'movimientos', 'libroDiario'].includes(target)) {
          throw new Error('Se requiere administrador para sincronizar estos registros.');
        }
        const result = await syncRecords({
          table: target as any,
          records: Array.isArray(body.records) ? body.records : [],
          deletedIds: Array.isArray(body.deletedIds) ? body.deletedIds : [],
        });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'upsert': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result = await upsertRecords(table(body.table), Array.isArray(body.records) ? body.records : []);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'inventoryStockSync': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result = await syncProductsStockFromKardex();
        return NextResponse.json({ ok: true, ...result });
      }
      case 'inventory': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result = await applyInventoryMovementsTransaction(body);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'sale': {
        const result = await createSaleTransaction({
          ...body,
          cajeroId: user.rol === 'administrador' ? body.cajeroId : user.id,
          user,
        });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'terminalPatch': {
        const patch = body.patch || {};
        const protectedFields = ['id', 'usuarioId', 'nombre', 'prefijoCaja', 'activo', 'rol', 'permisos', 'cajeroId'];
        if (user.rol !== 'administrador' && Object.keys(patch).some((key) => protectedFields.includes(key))) {
          throw new Error('Un cajero no puede modificar la asignación ni la configuración de su terminal.');
        }
        const result = await patchTerminalTransaction({ user, terminalId: String(body.terminalId), patch });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'terminalUpsert': {
        const result = await upsertTerminalTransaction({ user, terminal: body.terminal });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'terminalDelete': {
        const result = await deleteTerminalTransaction({ user, terminalId: String(body.terminalId) });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'debtPayment': {
        if (body.collection === 'cxp' && user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result = await applyDebtPaymentTransaction({ ...body, user });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'cashMovement': {
        const result = await createCashMovementTransaction({
          operationId: String(body.operationId || ''),
          movement: body.movement,
          terminalId: String(body.terminalId || body.movement?.terminalId || ''),
          user,
        });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'globalProviderPayment': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result = await applyGlobalProviderPaymentTransaction(body);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'globalCustomerPayment': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result = await applyGlobalCustomerPaymentTransaction(body);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'customerDebt': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result = await createCustomerDebtTransaction(body);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'supplierDebt': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result = await createSupplierDebtTransaction(body);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'reverseDebtPayment': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result=await reverseDebtPaymentTransaction(body); return NextResponse.json({ok:true,...result});
      }
      case 'createPurchase': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.'); const result=await createPurchaseTransaction(body); return NextResponse.json({ok:true,...result}); }
      case 'deletePurchase': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.'); const result=await deletePurchaseTransaction(body); return NextResponse.json({ok:true,...result}); }
      case 'deleteCustomerDebt': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.'); const result=await deleteCustomerDebtTransaction(body); return NextResponse.json({ok:true,...result}); }
      case 'deleteCustomerAndDebts': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result=await deleteCustomerAndDebtsTransaction(body); return NextResponse.json({ok:true,...result});
      }
      case 'returnOrCancellation': {
        const result = await processReturnOrCancellationTransaction({ ...body, user });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'repairReturnInventoryAndCxc': {
        if (user.rol !== 'administrador') throw new Error('Se requiere administrador.');
        const result = await repairReturnInventoryAndCxcTransaction({
          saleId: String(body.saleId || ''),
          operationId: String(body.operationId || ('REPAIR-' + String(body.saleId || '') + '-' + Date.now())),
        });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'zClosure': {
        const result = await createZClosureTransaction({
          user,
          terminalId: String(body.terminalId),
          report: body.report,
          terminalPatch: body.terminalPatch || {},
        });
        return NextResponse.json({ ok: true, ...result });
      }
      default:
        throw new Error('Operación Turso no soportada todavía.');
    }
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = message.includes('no está configurado') ? 503
      : message.includes('No autenticado') ? 401
      : message.includes('Se requiere administrador') ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
