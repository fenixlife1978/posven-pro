import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product, Movimiento, Sale } from './types';

// Helper para formatear moneda en USD
const fmt = (v: number) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CompanyInfo {
  nombre: string;
  direccion: string;
  rif: string;
  telefono: string;
}

// Función base para dibujar el encabezado profesional
const drawHeader = (doc: jsPDF, title: string, empresa: CompanyInfo) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const usableWidth = pageWidth - (margin * 2);

  // Nombre de la Empresa (Izquierda)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  const companyName = empresa.nombre.toUpperCase();
  // Se limita el ancho para evitar que choque con el título a la derecha
  doc.text(companyName, margin, 20, { maxWidth: usableWidth * 0.55 });

  // Datos secundarios de la empresa (Izquierda)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(empresa.direccion.toUpperCase(), margin, 26, { maxWidth: usableWidth * 0.6 });
  doc.text(`RIF: ${empresa.rif} | TEL: ${empresa.telefono}`, margin, 30);

  // Título del Reporte (Derecha)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  // Se limita el ancho y se alinea a la derecha para evitar superposiciones
  doc.text(title.toUpperCase(), pageWidth - margin, 20, { align: 'right', maxWidth: usableWidth * 0.4 });

  // Fecha de generación (Derecha, debajo del título)
  const now = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`GENERADO EL: ${now}`, pageWidth - margin, 26, { align: 'right' });

  // Línea divisoria elegante
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, 35, pageWidth - margin, 35);
};

// 1. Reporte de Inventario Simple (Listado)
export const generarPDFInventarioSimple = (products: Product[], empresa: CompanyInfo) => {
  const doc = new jsPDF('p', 'mm', 'letter');
  drawHeader(doc, 'Listado de Productos', empresa);

  const tableRows = products.map(p => [
    p.codigo,
    p.nombre.toUpperCase(),
    p.categoria.toUpperCase(),
    fmt(p.costoUSD),
    fmt(p.precioUSD),
    p.stock.toString()
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['CÓDIGO', 'NOMBRE', 'CATEGORÍA', 'COSTO', 'PRECIO', 'STOCK']],
    body: tableRows,
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
    margin: { left: 15, right: 15 }
  });

  doc.save(`Inventario_Basico_${new Date().getTime()}.pdf`);
};

// 2. Reporte General (Detallado por Grupo)
export const exportarPDFInventarioGeneral = (productos: Product[], empresa: CompanyInfo, groupBy: string, totals: any) => {
  const doc = new jsPDF('p', 'mm', 'letter');
  drawHeader(doc, `Inventario Detallado por ${groupBy}`, empresa);

  // Resumen Ejecutivo en Cabecera
  doc.setFillColor(240, 240, 240);
  doc.rect(15, 40, 186, 12, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`VALOR TOTAL AL COSTO: ${fmt(totals.costo)}`, 20, 48);
  doc.text(`VALOR TOTAL A LA VENTA: ${fmt(totals.venta)}`, 110, 48);

  const uniqueGroups = Array.from(new Set(productos.map(p => (p[groupBy as keyof Product] as string) || 'SIN ASIGNAR'))).sort();

  let currentY = 55;

  uniqueGroups.forEach((groupName) => {
    const groupProds = productos.filter(p => ((p[groupBy as keyof Product] as string) || 'SIN ASIGNAR') === groupName);
    
    // Verificar salto de página manual si el espacio es poco
    if (currentY > 240) {
      doc.addPage();
      drawHeader(doc, `Inventario Detallado por ${groupBy}`, empresa);
      currentY = 40;
    }

    // Encabezado de Grupo
    doc.setFillColor(60, 60, 60);
    doc.rect(15, currentY, 186, 7, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${groupBy.toUpperCase()}: ${groupName.toUpperCase()} (${groupProds.length} ÍTEMS)`, 18, currentY + 5);
    
    autoTable(doc, {
      startY: currentY + 7,
      head: [['CÓDIGO', 'PRODUCTO', 'COSTO UNIT.', 'PRECIO UNIT.', 'STOCK', 'SUBTOTAL COSTO']],
      body: groupProds.map(p => [
        p.codigo,
        p.nombre.toUpperCase(),
        fmt(p.costoUSD),
        fmt(p.precioUSD),
        p.stock,
        fmt(p.costoUSD * p.stock)
      ]),
      headStyles: { fillColor: [100, 100, 100] },
      styles: { fontSize: 7 },
      margin: { left: 15, right: 15 },
      theme: 'grid'
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;
  });

  doc.save(`Reporte_Inventario_Detallado_${groupBy}_${new Date().getTime()}.pdf`);
};

// 3. Reporte de Ventas Detallado
export const exportarPDFVentasDetallado = (ventas: any[], empresa: CompanyInfo, periodo: string, stats: any) => {
  const doc = new jsPDF('p', 'mm', 'letter');
  drawHeader(doc, 'Reporte de Ventas Detallado', empresa);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`PERIODO: ${periodo.toUpperCase()}`, 15, 42);
  doc.text(`VOLUMEN TOTAL: ${stats.totalVendidos} UNIDADES`, 15, 47);

  autoTable(doc, {
    startY: 55,
    head: [['FECHA', 'PRODUCTO', 'MÉTODO', 'CANT.', 'PRECIO UNIT.', 'TOTAL (USD)']],
    body: ventas.flatMap(v => v.items.map((item: any, idx: number) => [
      idx === 0 ? v.fecha.slice(0, 10) : '',
      item.nombre.toUpperCase(),
      v.metodoPago.toUpperCase(),
      item.cantidad,
      fmt(item.precioUnitUSD),
      fmt(item.subtotalUSD)
    ])),
    headStyles: { fillColor: [30, 30, 30] },
    styles: { fontSize: 7 }
  });

  doc.save(`Ventas_${periodo}_${new Date().getTime()}.pdf`);
};

// 4. Reporte de Kardex (Ficha de Producto)
export const exportarPDFKardex = (producto: Product, movimientos: Movimiento[], empresa: CompanyInfo) => {
  const doc = new jsPDF('p', 'mm', 'letter');
  drawHeader(doc, 'Kardex de Movimientos', empresa);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`PRODUCTO: ${producto.nombre.toUpperCase()}`, 15, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(`CÓDIGO: ${producto.codigo} | STOCK ACTUAL: ${producto.stock}`, 15, 47);

  autoTable(doc, {
    startY: 55,
    head: [['FECHA / HORA', 'TIPO MOVIMIENTO', 'CANT.', 'ANTES', 'DESPUÉS', 'REFERENCIA']],
    body: movimientos.map(m => [
      m.fecha.replace('T', ' ').slice(0, 16),
      m.tipo.replace('_', ' ').toUpperCase(),
      m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad,
      m.stockAntes,
      m.stockDespues,
      m.referencia
    ]),
    headStyles: { fillColor: [30, 30, 30] },
    styles: { fontSize: 7 }
  });

  doc.save(`Kardex_${producto.codigo}_${new Date().getTime()}.pdf`);
};

// 5. Historial de Ajustes
export const exportarPDFHistorialAjustes = (ajustes: any[], empresa: CompanyInfo, efectoNeto: number) => {
  const doc = new jsPDF('p', 'mm', 'letter');
  drawHeader(doc, 'Historial Cronológico de Ajustes', empresa);

  doc.setFillColor(240, 240, 240);
  doc.rect(15, 40, 186, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`EFECTO NETO EN VALOR INVENTARIO: ${fmt(efectoNeto)}`, 20, 46.5);

  autoTable(doc, {
    startY: 55,
    head: [['FECHA', 'PRODUCTO', 'TIPO', 'CANT.', 'ANTES', 'DESPUÉS', 'REFERENCIA']],
    body: ajustes.map(m => [
      m.fecha.replace('T', ' ').slice(0, 16),
      m.nombreProd.toUpperCase(),
      m.tipo.toUpperCase(),
      m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad,
      m.stockAntes,
      m.stockDespues,
      m.referencia
    ]),
    headStyles: { fillColor: [30, 30, 30] },
    styles: { fontSize: 7 }
  });

  doc.save(`Historial_Ajustes_${new Date().getTime()}.pdf`);
};

// 6. Reporte de Consumo y Colaboraciones
export const exportarPDFConsumoInterno = (movs: any[], empresa: CompanyInfo, totalPerdida: number) => {
  const doc = new jsPDF('p', 'mm', 'letter');
  drawHeader(doc, 'Consumo Interno y Colaboraciones', empresa);

  doc.setFillColor(255, 235, 235);
  doc.rect(15, 40, 186, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 0, 0);
  doc.text(`COSTO TOTAL DE SALIDA (PÉRDIDA): ${fmt(totalPerdida)}`, 20, 46.5);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 55,
    head: [['FECHA', 'PRODUCTO', 'TIPO', 'CANTIDAD', 'COSTO UNIT.', 'SUBTOTAL PÉRDIDA']],
    body: movs.map(m => [
      m.fecha.slice(0, 10),
      m.nombreProd.toUpperCase(),
      m.tipo.toUpperCase(),
      Math.abs(m.cantidad),
      fmt(m.costoUnit),
      fmt(m.subtotal)
    ]),
    headStyles: { fillColor: [30, 30, 30] },
    styles: { fontSize: 8 }
  });

  doc.save(`Reporte_Consumo_${new Date().getTime()}.pdf`);
};

// Mantenemos la función original para compatibilidad si se requiere en otros módulos
export const generarPDFInventario = async (products: Product[]) => {
  const doc = new jsPDF('l', 'mm', 'letter');
  autoTable(doc, {
    head: [['CÓDIGO', 'PRODUCTO', 'CATEGORÍA', 'PRECIO', 'STOCK']],
    body: products.map(p => [p.codigo, p.nombre, p.categoria, p.precioUSD, p.stock]),
  });
  doc.save('inventario.pdf');
};