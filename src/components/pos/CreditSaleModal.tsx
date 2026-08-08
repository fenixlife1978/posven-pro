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
  
  let type = docType || '';
  let number = cedula;
  
  const match = cedula.match(/^([A-Z]-?)?(.*)/);
  if (match) {
    if (match[1] && !docType) {
      type = match[1].replace('-', '').trim() + '-';
    }
    number = match[2] || '';
  }
  
  const cleanNumber = number.replace(/[^0-9]/g, '');
  
  if (!type) type = 'V-';
  
  if (type === 'V-' || type === 'E-') {
    const digits = cleanNumber;
    if (digits.length <= 2) return `${type}${digits}`;
    if (digits.length <= 5) return `${type}${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${type}${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    return `${type}${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}`;
  }
  
  return `${type}${cleanNumber}`;
}

function getRawCedula(cedula: string): string {
  return cedula.replace(/[^0-9]/g, '');
}

function extractDocType(cedula: string): string {
  const match = cedula.match(/^([A-Z]-?)/);
  return match ? match[1].replace('-', '').trim() + '-' : 'V-';
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

  const handleDocNumberChange = (value: string) => {
    // Si contiene letras, permitir entrada libre para búsqueda por nombre
    if (/[a-zA-Z]/.test(value)) {
      setDocNumber(value.toUpperCase());
    } else {
      // Si son solo números o puntuación, aplicar máscara de cédula
      const clean = value.replace(/[^0-9]/g, '');
      const formatted = normalizeCedula(clean, docType);
      setDocNumber(formatted);
    }
  };

  const handleDocTypeChange = (type: string) => {
    setDocType(type);
    if (docNumber && !/[a-zA-Z]/.test(docNumber)) {
      const cleanNumber = docNumber.replace(/[^0-9]/g, '');
      const formatted = normalizeCedula(cleanNumber, type);
      setDocNumber(formatted);
    }
  };

  const findCustomer = (fullDoc: string): Customer | null => {
    const raw = getRawCedula(fullDoc);
    let customer: Customer | null = null;
    
    const customers: Customer[] = store.clientes || [];
    const found = customers.find(c => getRawCedula(c.cedula) === raw);
    if (found) {
      customer = { ...found };
    }
    
    const deudas: Debt[] = store.cxc || [];
    const deudasCliente = deudas.filter(d => {
      if (!d.cliente) return false;
      const match = d.cliente.match(/^(.*?)\s*\[(.*?)\]$/);
      return match && getRawCedula(match[2]) === raw;
    });
    const totalDeuda = deudasCliente.reduce((sum, d) => sum + (d.saldoUSD || 0), 0);
    
    if (!customer) {
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
      customer.debt = totalDeuda;
    }
    
    return customer;
  };

  const handleSearch = () => {
    if (!docNumber.trim()) {
      toast({ title: "Dato Requerido", description: "Por favor, ingrese un documento o nombre.", variant: "destructive" });
      return;
    }

    const searchStr = docNumber.trim().toUpperCase();
    
    // 1. Intentar búsqueda por Identificación (Normalizada)
    const cleanDoc = docNumber.replace(/\./g, '');
    const fullDoc = `${docType}${cleanDoc}`;
    let customer = findCustomer(fullDoc);

    // 2. Si no se encontró por ID, intentar búsqueda por Nombre en la lista de clientes
    if (!customer) {
      const customers: Customer[] = store.clientes || [];
      customer = customers.find(c => (c.name || '').toUpperCase().includes(searchStr)) || null;
    }
    
    if (customer) {
      setFoundCustomer(customer);
      setView('found');
    } else {
      setFoundCustomer(null);
      // Si lo buscado tiene letras, lo pre-cargamos como nombre para el registro nuevo
      if (/[A-Z]/.test(searchStr)) {
        setNewName(searchStr);
      }
      setView('create');
    }
  };

  const handleConfirmCharge = () => {
    if (foundCustomer) {
      const customers: Customer[] = store.clientes || [];
      const exists = customers.some(c => getRawCedula(c.cedula) === getRawCedula(foundCustomer.cedula));
      if (!exists) {
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
    const normalizedCedula = normalizeCedula(fullDoc);
    const raw = getRawCedula(normalizedCedula);
    
    if (!newName.trim() || !fullDoc) {
      toast({ title: "Campos Incompletos", description: "El nombre y la identificación son obligatorios.", variant: "destructive" });
      return;
    }

    const customers: Customer[] = store.clientes || [];
    const deudas: Debt[] = store.cxc || [];
    const exists = customers.some(c => getRawCedula(c.cedula) === raw) ||
                   deudas.some(d => {
                     if (!d.cliente) return false;
                     const match = d.cliente.match(/^(.*?)\s*\[(.*?)\]$/);
                     return match && getRawCedula(match[2]) === raw;
                   });

    if (exists) {
      toast({ title: "Cliente ya existe", description: `Ya existe un cliente con el documento ${normalizedCedula}`, variant: "destructive" });
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
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-black shrink-0">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#D4A017]" />
            <h2 className="text-base font-bold text-white uppercase tracking-tighter">Cargar Crédito a Cartera</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60 hover:text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          <div className="bg-black rounded-xl p-3 text-center shrink-0">
            <p className="text-[10px] font-bold text-white/60 uppercase">Monto total a deber</p>
            <p className="text-2xl font-black text-[#D4A017]">{formatUsd(totalAmount)}</p>
          </div>

          {view === 'search' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="doc-input" className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 ml-1">Identificación o Nombre del Cliente</label>
                <div className="flex items-center gap-2">
                  <select 
                    value={docType} 
                    onChange={e => handleDocTypeChange(e.target.value)} 
                    className="h-11 bg-gray-100 border border-gray-200 rounded-xl px-2 font-bold text-gray-700 focus:ring-2 focus:ring-[#D4A017] outline-none text-sm w-[75px]"
                  >
                    <option>V-</option> <option>E-</option> <option>J-</option> <option>G-</option> <option>P-</option>
                  </select>
                  <input
                    id="doc-input"
                    type="text"
                    value={docNumber}
                    onChange={(e) => handleDocNumberChange(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Escriba Cédula o Nombre..."
                    className="flex-1 h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-[#D4A017] outline-none text-sm placeholder:text-gray-300"
                    autoFocus
                  />
                  <button 
                    onClick={handleSearch} 
                    className="h-11 w-11 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center hover:bg-blue-700 transition-all shrink-0 shadow-lg shadow-blue-200"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-6 py-2 text-gray-400 font-bold hover:text-gray-600 transition-colors text-xs uppercase">Cancelar</button>
              </div>
            </div>
          )}

          {view === 'found' && foundCustomer && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="bg-blue-50 rounded-2xl p-5 text-center border border-blue-100">
                <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Cliente Localizado</p>
                <p className="font-black text-xl text-blue-900 uppercase">{foundCustomer.name}</p>
                <div className="h-px bg-blue-200 w-12 mx-auto my-3"></div>
                <p className="text-sm text-blue-700">
                  DEUDA ACTUAL: <span className="font-black text-red-600">{formatUsd(foundCustomer.debt || 0)}</span>
                </p>
                <p className="text-[10px] text-blue-400 font-bold mt-1 uppercase">ID: {foundCustomer.cedula}</p>
              </div>
              <button
                onClick={handleConfirmCharge}
                className="w-full h-14 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 hover:shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                <CreditCard className="w-5 h-5" />
                Confirmar y Cargar a Cuenta
              </button>
              <button onClick={handleBackToSearch} className="w-full text-center text-[10px] font-black text-gray-400 uppercase hover:text-blue-600">Buscar otro cliente</button>
            </div>
          )}

          {view === 'create' && (
            <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="font-bold text-amber-700 text-[10px] uppercase">El cliente no existe. Complete los datos para registrarlo e iniciar el crédito.</p>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[9px] font-black text-gray-400 block mb-1 uppercase ml-1">Nombre Completo</label>
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    className="w-full h-10 px-4 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-[#D4A017] outline-none text-sm uppercase" 
                    placeholder="EJ: MARIA PEREZ"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 block mb-1 uppercase ml-1">Identificación Fiscal</label>
                  <div className="flex items-center gap-2">
                    <select 
                      value={docType} 
                      onChange={e => setDocType(e.target.value)} 
                      className="h-10 bg-gray-100 border border-gray-200 rounded-xl px-2 font-bold text-gray-700 focus:ring-2 focus:ring-[#D4A017] outline-none text-sm w-[70px]"
                    >
                      <option>V-</option><option>E-</option><option>J-</option><option>G-</option><option>P-</option>
                    </select>
                    <input 
                      type="text" 
                      value={docNumber} 
                      onChange={(e) => handleDocNumberChange(e.target.value)} 
                      className="flex-1 h-10 px-4 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-[#D4A017] outline-none text-sm" 
                      placeholder="Número de cédula..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 block mb-1 uppercase ml-1">Teléfono</label>
                    <input 
                      type="tel" 
                      value={newPhone} 
                      onChange={e => setNewPhone(e.target.value)} 
                      className="w-full h-10 px-4 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-[#D4A017] outline-none text-sm" 
                      placeholder="04120000000"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 block mb-1 uppercase ml-1">Dirección</label>
                    <input 
                      type="text" 
                      value={newAddress} 
                      onChange={e => setNewAddress(e.target.value)} 
                      className="w-full h-10 px-4 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-[#D4A017] outline-none text-sm" 
                      placeholder="Localidad..."
                    />
                  </div>
                </div>
              </div>
              <button 
                onClick={handleCreateAndCharge} 
                className="w-full h-12 bg-green-600 text-white rounded-xl font-black text-sm hover:bg-green-700 shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest mt-2"
              >
                <UserPlus className="w-5 h-5" />
                Registrar y Cargar
              </button>
              <button onClick={handleBackToSearch} className="w-full text-center text-[10px] font-black text-gray-400 uppercase hover:text-blue-600 mt-1">Volver a buscar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
