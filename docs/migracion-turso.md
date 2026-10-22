# POSVEN PRO — arquitectura y optimización Turso

## Fuente de verdad
Turso es la única base de datos operativa para usuarios, sesiones, productos, inventario, ventas, clientes, proveedores, CxC, CxP, movimientos, compras, terminales y catálogos. La caché del navegador sólo acelera la presentación; nunca confirma una operación ni sustituye las validaciones transaccionales del servidor.

## Autenticación
- Sesiones propias de POSVEN almacenadas en Turso.
- Contraseñas almacenadas únicamente mediante hash.
- Administrador semilla: `admin`, rol `administrador`.
- Las operaciones protegidas requieren sesión válida y permisos en el servidor.

## Optimización de consultas
- Los listados cronológicos usan columnas indexables en vez de envolver la fecha en funciones SQL.
- Índices para búsquedas por terminal y fecha en ventas y libro diario.
- Índices de fecha para movimientos, devoluciones, anulaciones y compras.
- Índice de orden de productos por `updated_at`.
- Las consultas de listas deben solicitar únicamente el límite y el filtro necesarios; evitar descargar tablas completas para pintar indicadores.
- Las escrituras de sesión no deben ejecutarse en cada lectura autenticada.

## Integridad
- Las ventas, inventario, deudas, pagos y movimientos se validan y confirman en transacciones de Turso.
- Los fallos de Turso deben mostrarse como errores; no se permite un respaldo silencioso a otra base de datos.
- Los IDs y campos de negocio se conservan en `data_json` donde corresponda.
- Los respaldos y restauraciones se verifican por conteos y muestras antes de considerarlos válidos.

## Regla de oro: Corte Z
El módulo Corte Z está fuera del alcance de esta optimización. No modificar sus cálculos, flujo de cierre, formato de recibo, historial ni reimpresión. Cualquier cambio futuro en componentes compartidos debe demostrar que no altera ese módulo.

## Despliegue
Los cambios se preparan en la rama `optimización-turso`. No se publica a producción ni se modifica `main` como parte de este trabajo.