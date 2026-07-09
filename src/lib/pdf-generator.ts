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

/**
 * Dibuja el encabezado profesional de forma dinámica
 * Retorna la coordenada Y donde termina la cabecera para que el contenido empiece correctamente.
 */
const drawHeader = (doc: jsPDF, title: string, empresa: CompanyInfo): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const usableWidth = pageWidth - (margin * 2);

  // 1. Bloque Izquierdo: Datos de la Empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  
  const companyName = empresa.nombre.toUpperCase();
  const companyLines = doc.splitTextToSize(companyName, usableWidth * 0.55);
  doc.text(companyLines, margin, 18);
  
  // Calculamos el Y dinámico después del nombre (aprox 6.5mm por línea de 16pt)
  let leftY = 18 + (companyLines.length * 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  
  const address = empresa.direccion.toUpperCase();
  const addressLines = doc.splitTextToSize(address, usableWidth * 0.55);
  doc.text(addressLines, margin, leftY);
  
  // El RIF y Teléfono se colocan después de las líneas de dirección (aprox 3.5mm por línea de 8pt)
  leftY += (addressLines.length * 3.5);
  doc.text(`RIF: ${empresa.rif} | TEL: ${empresa.telefono}`, margin, leftY);
  leftY += 5; // Margen de seguridad inferior

  // 2. Bloque Derecho: Título y Fecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  
  const titleLines = doc.splitTextToSize(title.toUpperCase(), usableWidth * 0.40);
  doc.text(titleLines, pageWidth - margin, 18, { align: 'right' });
  
  // La fecha se coloca después del título
  let rightY = 18 + (titleLines.length * 5.5);
  
  const now = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`GENERADO EL: ${now}`, pageWidth - margin, rightY, { align: 'right' });
  rightY += 5;

  // 3. Línea divisoria basada en el punto más bajo de ambos bloques
  const headerBottomY = Math.max(leftY, rightY) + 2;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, headerBottomY, pageWidth - margin, headerBottomY);
  
  return headerBottomY + 5; // Retornamos el punto de inicio para el contenido
};

// 1. Reporte de Inventario Simple (Listado)
export const generarPDFInventarioSimple = (products: Product[], empresa: CompanyInfo) => {
  const doc = new jsPDF('p', 'mm', 'letter');
  const startY = drawHeader(doc, 'Listado de Productos', empresa);

  const tableRows = products.map(p => [
    p.codigo,
    p.nombre.toUpperCase(),
    p.categoria.toUpperCase(),
    fmt(p.costoUSD),
    fmt(p.precioUSD),
    p.stock.toString()
  ]);

  autoTable(doc, {
    startY: startY,
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
  const headerY = drawHeader(doc, `Inventario Detallado por ${groupBy}`, empresa);

  // Resumen Ejecutivo
  doc.setFillColor(240, 240, 240);
  doc.rect(15, headerY, 186, 12, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`VALOR TOTAL AL COSTO: ${fmt(totals.costo)}`, 20, headerY + 8);
  doc.text(`VALOR TOTAL A LA VENTA: ${fmt(totals.venta)}`, 110, headerY + 8);

  const uniqueGroups = Array.from(new Set(productos.map(p => (p[groupBy as keyof Product] as string) || 'SIN ASIGNAR'))).sort();

  let currentY = headerY + 16;

  uniqueGroups.forEach((groupName) => {
    const groupProds = productos.filter(p => ((p[groupBy as keyof Product] as string) || 'SIN ASIGNAR') === groupName);
    
    if (currentY > 240) {
      doc.addPage();
      currentY = drawHeader(doc, `Inventario Detallado por ${groupBy}`, empresa);
    }

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
  const startY = drawHeader(doc, 'Reporte de Ventas Detallado', empresa);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`PERIODO: ${periodo.toUpperCase()}`, 15, startY + 5);
  doc.text(`VOLUMEN TOTAL: ${stats.totalVendidos} UNIDADES`, 15, startY + 10);

  autoTable(doc, {
    startY: startY + 18,
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

  doc.save(`Ventas_${periodo.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};

// 4. Reporte de Kardex (Ficha de Producto)
export const exportarPDFKardex = (producto: Product, movimientos: Movimiento[], empresa: CompanyInfo) => {
  const doc = new jsPDF('p', 'mm', 'letter');
  const startY = drawHeader(doc, 'Kardex de Movimientos', empresa);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`PRODUCTO: ${producto.nombre.toUpperCase()}`, 15, startY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`CÓDIGO: ${producto.codigo} | STOCK ACTUAL: ${producto.stock}`, 15, startY + 10);

  autoTable(doc, {
    startY: startY + 18,
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
  const startY = drawHeader(doc, 'Historial Cronológico de Ajustes', empresa);

  doc.setFillColor(240, 240, 240);
  doc.rect(15, startY, 186, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`EFECTO NETO EN VALOR INVENTARIO: ${fmt(efectoNeto)}`, 20, startY + 6.5);

  autoTable(doc, {
    startY: startY + 15,
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
  const startY = drawHeader(doc, 'Consumo Interno y Colaboraciones', empresa);

  doc.setFillColor(255, 235, 235);
  doc.rect(15, startY, 186, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 0, 0);
  doc.text(`COSTO TOTAL DE SALIDA (PÉRDIDA): ${fmt(totalPerdida)}`, 20, startY + 6.5);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: startY + 15,
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

// 7. Reporte de Devoluciones Detallado
export const exportarPDFDevoluciones = (devoluciones: any[], empresa: CompanyInfo, periodo: string, stats: any) => {
  const doc = new jsPDF('p', 'mm', 'letter');
  const startY = drawHeader(doc, 'Reporte de Devoluciones Detallado', empresa);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`PERIODO: ${periodo.toUpperCase()}`, 15, startY + 5);
  doc.text(`TOTAL REEMBOLSADO: ${fmt(stats.totalUSD)}`, 15, startY + 10);

  autoTable(doc, {
    startY: startY + 18,
    head: [['FECHA', 'ID DEV.', 'PRODUCTO', 'CANT.', 'PRECIO UNIT.', 'TOTAL (USD)', 'MOTIVO']],
    body: devoluciones.flatMap(d => d.items.map((item: any, idx: number) => [
      idx === 0 ? d.fecha.slice(0, 10) : '',
      idx === 0 ? d.id : '',
      item.nombre.toUpperCase(),
      item.cantidad,
      fmt(item.precioUnitUSD),
      fmt(item.cantidad * item.precioUnitUSD),
      idx === 0 ? d.motivo.toUpperCase() : ''
    ])),
    headStyles: { fillColor: [180, 0, 0] },
    styles: { fontSize: 7 }
  });

  doc.save(`Devoluciones_${periodo.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};

// Mantenemos la función original para compatibilidad
export const generarPDFInventario = async (products: Product[]) => {
  const doc = new jsPDF('l', 'mm', 'letter');
  autoTable(doc, {
    head: [['CÓDIGO', 'PRODUCTO', 'CATEGORÍA', 'PRECIO', 'STOCK']],
    body: products.map(p => [p.codigo, p.nombre, p.categoria, p.precioUSD, p.stock]),
  });
  doc.save('inventario.pdf');
};
