import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVendors, useVendorMutations } from '../../hooks/queries/useVendors';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import type { Vendor } from '@/lib/firebase';

const formatCurrency = (amount: number) => `₹${amount.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

export const VendorList: React.FC = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const { data: vendors = [], isLoading } = useVendors(profile?.store_id, searchTerm);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  return (
    <div className="flex-1 overflow-auto px-4 md:px-8 pb-8 mt-6">
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-on-surface">Registered Vendors</h2>
        <button
          onClick={() => {
            setSelectedVendor(null);
            setIsFormOpen(true);
          }}
          className="px-4 py-2 bg-secondary text-on-secondary rounded-lg font-medium hover:bg-secondary/90 transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Add Vendor
        </button>
      </div>

      <div className="mb-6 max-w-md">
        <Input
          placeholder="Search vendors by name, phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon="search"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 flex justify-center text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin mr-2">sync</span> Loading vendors...
          </div>
        ) : vendors.length === 0 ? (
          <div className="col-span-full py-12 text-center text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded-2xl">
            No vendors found. Add one to start tracking payables.
          </div>
        ) : (
          vendors.map(vendor => (
            <div key={vendor.vendor_id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-on-surface">{vendor.name}</h3>
                  {vendor.phone && <p className="text-sm text-on-surface-variant flex items-center gap-1 mt-1"><span className="material-symbols-outlined text-[14px]">call</span> {vendor.phone}</p>}
                </div>
                <button
                  onClick={() => {
                    setSelectedVendor(vendor);
                    setIsFormOpen(true);
                  }}
                  className="p-1.5 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
              </div>

              <div className="mt-auto pt-4 border-t border-outline-variant flex justify-between items-end">
                <div>
                  <p className="text-xs uppercase font-bold text-on-surface-variant tracking-wider mb-1">Payable Balance</p>
                  <p className={`text-xl font-bold ${vendor.payable_balance > 0 ? 'text-error' : 'text-primary'}`}>
                    {formatCurrency(vendor.payable_balance)}
                  </p>
                </div>
                
                {vendor.payable_balance > 0 && (
                  <button
                    onClick={() => {
                      setSelectedVendor(vendor);
                      setIsPaymentModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary rounded-lg text-sm font-bold transition-colors"
                  >
                    Pay Now
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <VendorFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        initialData={selectedVendor} 
      />

      {selectedVendor && (
        <RecordPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          vendor={selectedVendor}
        />
      )}
    </div>
  );
};

// --- Sub-components (Forms) ---

const VendorFormModal: React.FC<{ isOpen: boolean, onClose: () => void, initialData: Vendor | null }> = ({ isOpen, onClose, initialData }) => {
  const { profile } = useAuth();
  const { createMutation, updateMutation } = useVendorMutations(profile?.store_id);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');

  React.useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPhone(initialData.phone || '');
      setAddress(initialData.address || '');
      setGstin(initialData.gstin || '');
    } else {
      setName(''); setPhone(''); setAddress(''); setGstin('');
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialData) {
        await updateMutation.mutateAsync({
          vendorId: initialData.vendor_id,
          updates: { name, phone, address, gstin }
        });
      } else {
        await createMutation.mutateAsync({ name, phone, address, gstin });
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save vendor.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Vendor" : "Add Vendor"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Business / Vendor Name" value={name} onChange={e => setName(e.target.value)} required />
        <Input label="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} />
        <Input label="GSTIN (Optional)" value={gstin} onChange={e => setGstin(e.target.value)} />
        <Input label="Address" value={address} onChange={e => setAddress(e.target.value)} />
        
        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors">Cancel</button>
          <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
            {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Vendor'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const RecordPaymentModal: React.FC<{ isOpen: boolean, onClose: () => void, vendor: Vendor }> = ({ isOpen, onClose, vendor }) => {
  const { profile } = useAuth();
  const { recordPaymentMutation } = useVendorMutations(profile?.store_id);

  const [amount, setAmount] = useState(vendor.payable_balance.toString());
  const [method, setMethod] = useState('CASH');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setAmount(vendor.payable_balance.toString());
      setMethod('CASH');
      setNotes('');
    }
  }, [isOpen, vendor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordPaymentMutation.mutateAsync({
        vendorId: vendor.vendor_id,
        vendorName: vendor.name,
        amount: parseFloat(amount),
        paymentMethod: method,
        notes
      });
      onClose();
    } catch (err) {
      alert("Failed to record payment.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Record Payment to ${vendor.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-error/10 text-error p-3 rounded-lg flex items-center justify-between font-bold">
          <span>Current Due:</span>
          <span>{formatCurrency(vendor.payable_balance)}</span>
        </div>

        <Input label="Payment Amount (₹)" type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="1" max={vendor.payable_balance} step="0.01" />

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Payment Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full bg-surface border border-outline rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>

        <Input label="Notes / Reference No." value={notes} onChange={e => setNotes(e.target.value)} />
        
        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors">Cancel</button>
          <button type="submit" disabled={recordPaymentMutation.isPending} className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
            {recordPaymentMutation.isPending ? 'Processing...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
