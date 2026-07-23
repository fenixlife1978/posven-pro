'use client';
import { useState, useEffect } from 'react';
import { X, Search, CreditCard, User, UserPlus, AlertCircle } from 'lucide-react';
import { Customer, Debt } from '@/lib/types';
import { Store } from '@/lib/db-store';
import { formatUsd } from '@/lib/currency-formatter';
import { useToast } from '@/hooks/use-toast';

// ============================================================
// UTILIDADES DE NORMALIZACIÓN DE CÉDULA (integradas)
// ============================================================

/**
 * Normaliza una cédula según el tipo de documento
 * - Para V- y E-: formato con puntos (XX.XXX.XXX)
 * - Para J-, G-, P-: solo dígitos sin formato
 */
function normalizeCedula(cedula: string, docType?: string): string {
  if (!cedula) return '';
  
  // Si viene con tipo (ej: "V-13.313.521"), extraer tipo y número
  let type = docType || '';
  let number = cedula;
  
  const match = cedula.match(/^([A-Z]-?)?(.*)/);
  if (match) {
    if (match[1] && !docType) {
      type = match[1].replace('-', '').trim() + '-';
    }
    number = match[2] || '';
  }
  
  // Limpiar puntos y otros caracteres no numéricos
  const cleanNumber = number.replace(/[^0-9]/g, '');
  
  // Si no hay tipo definido, intentar detectar
  if (!type) {
    // Por defecto asumimos V- si no se especifica
    type = 'V-';
  }
  
  // Para V- y E- aplicar formato con puntos
  if (type === 'V-' || type === 'E-') {
    const digits = cleanNumber;
    if (digits.length <= 2) return `${type}${digits}`;
    if (digits.length <= 5) return `${type}${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${type}${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    return `${type}${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}`;
  }
  
  // Para J-, G-, P-: solo dígitos
  return `${type}${cleanNumber}`;
}

/**
 * Obtiene solo el número de cédula sin puntos ni tipo
 */
function getRawCedula(cedula: string): string {
  return cedula.replace(/[^0-9]/g, '');
}

/**
 * Compara dos cédulas ignorando formato y tipo
 * Retorna true si el número (sin tipo) coincide
 */
function sameCedula(cedula1: string, cedula2: string): boolean {
  return getRawCedula(cedula1) === getRawCedula(cedula2);
}

/**
 * Extrae el tipo de documento (V-, J-, etc.) de una cédula
 */
function extractDocType(cedula: string): string {
  const match = cedula.match(/^([A-Z]-?)/);
  return match ? match[1].replace('-', '').trim() + '-' : 'V-';
}

/**
 * Busca un cliente por cédula normalizada, ignorando formato
 */
function findCustomerByCedula(customers: any[], cedula: string): any | null {
  const raw = getRawCedula(cedula);
  return customers.find(c => getRawCedula(c.cedula) === raw) || null;
}

/**
 * Busca deudas por cédula del cliente (en el campo cliente)
 */
function findDebtsByCedula(deudas: any[], cedula: string): any[] {
  const raw = getRawCedula(cedula);
  return deudas.filter(d => {
    if (!d.cliente) return false;
    const match = d.cliente.match(/^(.*?)\s*\[(.*?)\]$/);
    if (match) {
      return getRawCedula(match[2]) === raw;
    }
    return false;
  });
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customer: Customer, amount: number) => void;
  totalAmount: number;
}

export function CreditModal({ isOpen, onClose, onConfirm, totalAmount }: CreditModalProps) {
  const { toast } = useToast();
  const [store, setStore] = useState<any>(Store.get());

  const [view, setView] = useState<'search' | 'found' | 'create'>('search');
  const [docType, setDocType] = useState('V-');
  const [docNumber, setDocNumber] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  useEffect(() => {
    const unsubscribe = Store.subscribe(setStore);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setView('search');
      setDocType('V-');
      setDocNumber('');
      setFoundCustomer(null);
      setNewName('');
      setNewPhone('');
      setNewAddress('');
    }
  }, [isOpen]);

  // ===== FORMATO DE CÉDULA CON PUNTOS (SOLO PARA V- Y E-) =====
  // Ahora usa normalizeCedula
  const handleDocNumberChange = (value: string) => {
    // Primero limpiar todo lo que no sea número, luego normalizar con el tipo actual
    const clean = value.replace(/[^0-9]/g, '');
    const formatted = normalizeCedula(clean, docType);
    setDocNumber(formatted);
  };

  const handleDocTypeChange = (type: string) => {
    setDocType(type);
    if (docNumber) {
      const cleanNumber = docNumber.replace(/[^0-9]/g, '');
      const formatted = normalizeCedula(cleanNumber, type);
      setDocNumber(formatted);
    }
  };

  // ===== BUSCAR CLIENTE EN CLIENTES Y EN CXC (CON SALDO TOTAL ACTUALIZADO) =====
  const findCustomer = (fullDoc: string): Customer | null => {
    const raw = getRawCedula(fullDoc);
    let customer: Customer | null = null;
    
    // 1. Buscar en clientes
    const customers: Customer[] = store.clientes || [];
    const found = customers.find(c => getRawCedula(c.cedula) === raw);
    if (found) {
      customer = { ...found };
    }
    
    // 2. Buscar en deudas y sumar saldos
    const deudas: Debt[] = store.cxc || [];
    const deudasCliente = deudas.filter(d => {
      if (!d.cliente) return false;
      const match = d.cliente.match(/^(.*?)\s*\[(.*?)\]$/);
      return match && getRawCedula(match[2]) === raw;
    });
    const totalDeuda = deudasCliente.reduce((sum, d) => sum + (d.saldoUSD || 0), 0);
    
    if (!customer) {
      // Si no existe en clientes pero tiene deudas, crear cliente virtual
      if (deudasCliente.length > 0) {
        const primera = deudasCliente[0];
        const match = primera.cliente?.match(/^(.*?)\s*\[(.*?)\]$/);
        if (match) {
          const tipo = extractDocType(fullDoc);
          const cedulaNormalizada = normalizeCedula(match[2], tipo);
          customer = {
            id: `CUS-${Date.now()}`,
            name: match[1].trim(),
            cedula: cedulaNormalizada,
            address: 'Sin dirección',
            phone: 'Sin teléfono',
            debt: totalDeuda
          };
        }
      }
    } else {
      // Si existe, actualizar su deuda con el total calculado
      customer.debt = totalDeuda;
    }
    
    return customer;
  };

  const handleSearch = () => {
    if (!docNumber.trim()) {
      toast({ title: "Documento Requerido", description: "Por favor, ingrese un documento de identidad.", variant: "destructive" });
      return;
    }
    // Limpiar puntos para la búsqueda
    const cleanDoc = docNumber.replace(/\./g, '');
    const fullDoc = `${docType}${cleanDoc}`;
    
    const customer = findCustomer(fullDoc);
    if (customer) {
      setFoundCustomer(customer);
      setView('found');
    } else {
      setFoundCustomer(null);
      setView('create');
    }
  };

  const handleConfirmCharge = () => {
    if (foundCustomer) {
      const customers: Customer[] = store.clientes || [];
      const exists = customers.some(c => getRawCedula(c.cedula) === getRawCedula(foundCustomer.cedula));
      if (!exists) {
        // Normalizar cédula antes de guardar
        const cedulaNormalizada = normalizeCedula(foundCustomer.cedula, extractDocType(foundCustomer.cedula));
        const newCustomer: Customer = {
          id: `CUS-${Date.now()}`,
          name: foundCustomer.name,
          cedula: cedulaNormalizada,
          address: foundCustomer.address || 'Sin dirección',
          phone: foundCustomer.phone || 'Sin teléfono',
          debt: foundCustomer.debt || 0
        };
        const updatedCustomers = [...customers, newCustomer];
        Store.set({ ...store, clientes: updatedCustomers });
        setFoundCustomer({ ...newCustomer });
        onConfirm(newCustomer, totalAmount);
      } else {
        onConfirm(foundCustomer, totalAmount);
      }
    }
  };
  
  const handleCreateAndCharge = () => {
    const cleanDoc = docNumber.replace(/\./g, '');
    const fullDoc = `${docType}${cleanDoc}`;
    // Normalizar la cédula completa
    const normalizedCedula = normalizeCedula(fullDoc);
    const raw = getRawCedula(normalizedCedula);
    
    if (!newName.trim() || !fullDoc) {
      toast({ title: "Campos Incompletos", description: "El nombre y la identificación son obligatorios.", variant: "destructive" });
      return;
    }

    // Verificar duplicado en clientes y en deudas usando raw
    const customers: Customer[] = store.clientes || [];
    const deudas: Debt[] = store.cxc || [];
    const exists = customers.some(c => getRawCedula(c.cedula) === raw) ||
                   deudas.some(d => {
                     if (!d.cliente) return false;
                     const match = d.cliente.match(/^(.*?)\s*\[(.*?)\]$/);
                     return match && getRawCedula(match[2]) === raw;
                   });

    if (exists) {
      toast({ 
        title: "Cliente ya existe", 
        description: `Ya existe un cliente con el documento ${normalizedCedula}`,
        variant: "destructive"
      });
      return;
    }

    const newCustomer: Customer = {
      id: `CUS-${Date.now()}`,
      cedula: normalizedCedula,
      name: newName.trim().toUpperCase(),
      phone: newPhone.trim(),
      address: newAddress.trim(),
      debt: 0
    };
    
    const updatedCustomers = [...customers, newCustomer];
    Store.set({ ...store, clientes: updatedCustomers });

    toast({ title: "Cliente Creado", description: `Se ha registrado a ${newName}. Procediendo a cargar el crédito.` });
    
    onConfirm(newCustomer, totalAmount);
  };

  const handleBackToSearch = () => {
    setView('search');
    setFoundCustomer(null);
    setDocNumber('');
    setNewName('');
    setNewPhone('');
    setNewAddress('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 animate-in fade-in-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 overflow-hidden max-h-[95vh] flex flex-col">
        {/* HEADER */}
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-black shrink-0">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#D4A017]" />
            <h2 className="text-base font-bold text-white">CARGAR CRÉDITO</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60 hover:text-white" />
          </button>
        </div>

        {/* CUERPO DEL MODAL - SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          {/* ===== MONTO A DEBER - FONDO NEGRO ===== */}
          <div className="bg-black rounded-xl p-3 text-center shrink-0">
            <p className="text-[10px] font-bold text-white/60 uppercase">Monto a deber</p>
            <p className="text-2xl font-black text-[#D4A017]">{formatUsd(totalAmount)}</p>
          </div>

          {/* ============================================================ */}
          {/* PASO 1: BÚSQUEDA */}
          {/* ============================================================ */}
          {view === 'search' && (
            <div className="space-y-2">
              <div>
                <label htmlFor="doc-input" className="block text-[10px] font-bold text-gray-500">Documento de Identidad</label>
                <div className="flex items-center gap-2 mt-1">
                  <select 
                    value={docType} 
                    onChange={e => handleDocTypeChange(e.target.value)} 
                    className="h-9 bg-gray-100 border border-gray-300 rounded-lg px-2 font-bold text-gray-700 focus:ring-2 focus:ring-[#D4A017] outline-none text-sm w-[70px]"
                  >
                    <option>V-</option> <option>E-</option> <option>J-</option> <option>G-</option>
                  </select>
                  <input
                    id="doc-input"
                    type="text"
                    value={docNumber}
                    onChange={(e) => handleDocNumberChange(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={docType === 'V-' || docType === 'E-' ? "XX.XXX.XXX" : "Número de identificación"}
                    className="flex-1 h-9 px-3 bg-white border border-gray-300 rounded-lg font-medium focus:ring-2 focus:ring-[#D4A017] outline-none text-sm"
                  />
                  <button 
                    onClick={handleSearch} 
                    className="h-9 px-3 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center hover:bg-blue-700 transition-all shrink-0"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* PASO 2: CLIENTE ENCONTRADO (con saldo total actualizado) */}
          {/* ============================================================ */}
          {view === 'found' && foundCustomer && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                <p className="font-bold text-base text-gray-800">{foundCustomer.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  SALDO ACTUAL: <span className="font-bold text-red-600">{formatUsd(foundCustomer.debt || 0)}</span>
                  {foundCustomer.debt === 0 && (
                    <span className="ml-2 text-xs text-green-600 font-bold">(AL DÍA)</span>
                  )}
                </p>
                {foundCustomer.debt !== undefined && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Equiv. Bs: <span className="font-bold">{(foundCustomer.debt * (store.tasa || 1)).toFixed(2)}</span>
                  </p>
                )}
              </div>
              <button
                onClick={handleConfirmCharge}
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-base hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                CARGAR CRÉDITO
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* PASO 3: CLIENTE NO ENCONTRADO - PREGUNTAR SI CREAR */}
          {/* ============================================================ */}
          {view === 'create' && !foundCustomer && (
            <div className="space-y-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
                <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-1" />
                <p className="font-bold text-yellow-700 text-sm">Cliente no encontrado</p>
                <p className="text-xs text-yellow-600 mt-0.5">
                  No existe un cliente con el documento {docType}{docNumber.replace(/\./g, '')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBackToSearch}
                  className="flex-1 h-9 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors text-sm"
                >
                  No
                </button>
                <button
                  onClick={() => setFoundCustomer(null)}
                  className="flex-1 h-9 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Sí, Crear Cliente
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* PASO 4: CREAR NUEVO CLIENTE */}
          {/* ============================================================ */}
          {view === 'create' && foundCustomer === null && (
            <div className="space-y-2">
              <p className="text-center text-sm font-bold text-gray-700">Nuevo Cliente</p>
              
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-0.5">NOMBRE COMPLETO</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-semibold focus:ring-2 focus:ring-[#D4A017] outline-none text-sm uppercase" 
                  placeholder="GLORIA MACHETE"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-0.5">CÉDULA / IDENTIFICACIÓN</label>
                <div className="flex items-center gap-2">
                  <select 
                    value={docType} 
                    onChange={e => handleDocTypeChange(e.target.value)} 
                    className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-bold focus:ring-2 focus:ring-[#D4A017] outline-none text-sm w-[70px]"
                  >
                    <option>V-</option><option>E-</option><option>J-</option><option>G-</option>
                  </select>
                  <input 
                    type="text" 
                    value={docNumber} 
                    onChange={(e) => handleDocNumberChange(e.target.value)} 
                    className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-semibold focus:ring-2 focus:ring-[#D4A017] outline-none text-sm" 
                    placeholder={docType === 'V-' || docType === 'E-' ? "XX.XXX.XXX" : "Número de identificación"}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-0.5">TELÉFONO</label>
                <input 
                  type="tel" 
                  value={newPhone} 
                  onChange={e => setNewPhone(e.target.value)} 
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-semibold focus:ring-2 focus:ring-[#D4A017] outline-none text-sm" 
                  placeholder="04125896659"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-0.5">DIRECCIÓN</label>
                <input 
                  type="text" 
                  value={newAddress} 
                  onChange={e => setNewAddress(e.target.value)} 
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-semibold focus:ring-2 focus:ring-[#D4A017] outline-none text-sm" 
                  placeholder="Dirección del cliente"
                />
              </div>
              <div className="flex flex-col gap-1.5 pt-1">
                <button 
                  onClick={handleCreateAndCharge} 
                  className="w-full h-10 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  GUARDAR Y CARGAR
                </button>
                <button 
                  onClick={handleBackToSearch} 
                  className="font-bold text-gray-600 hover:underline text-xs text-center"
                >
                  VOLVER A LA LISTA
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}