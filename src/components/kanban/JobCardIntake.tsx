import { useState, useEffect } from "react";
import { type JobCard, JobCardStatus, type Customer } from '@/lib/firebase/types';
import { createJobCard, updateJobCardDetails } from '@/lib/firebase/api/jobCards';
import { createCustomer, searchCustomers } from '@/lib/firebase/api/customers';
import { getLatestDocumentNo } from '@/lib/firebase/api/transactions';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export const JobCardIntake: React.FC<{ onComplete: () => void, onCancel: () => void, initialJob?: JobCard | null }> = ({ onComplete, onCancel, initialJob }) => {
  const { profile } = useAuth();
  const [customerName, setCustomerName] = useState(initialJob?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(initialJob?.customer_phone || '');
  const [customerAddress, setCustomerAddress] = useState(initialJob?.customer_address || '');
  const [customerGstin, setCustomerGstin] = useState(initialJob?.customer_gstin || '');
  const [device, setDevice] = useState(initialJob?.device || '');
  const [reportedIssue, setReportedIssue] = useState(initialJob?.reported_issue || '');
  const [estimatedCost, setEstimatedCost] = useState(initialJob?.estimated_cost?.toString() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialJob?.customer_id ? { customer_id: initialJob.customer_id, name: initialJob.customer_name, phone: initialJob.customer_phone, address: initialJob.customer_address, gstin: initialJob.customer_gstin } as Customer : null);
  const [searchResults, setSearchResults] = useState<Customer[]>([]);

  const handlePhoneChange = async (val: string) => {
    setCustomerPhone(val);
    setSelectedCustomer(null);
    if (val.length > 3 && profile?.store_id) {
      const results = await searchCustomers(profile.store_id, val);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerAddress(c.address || '');
    setCustomerGstin(c.gstin || '');
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !device || !reportedIssue || !estimatedCost || !profile?.store_id) return;
    
    setIsSubmitting(true);
    try {
      let finalCustomerId = selectedCustomer?.customer_id;
      
      if (!finalCustomerId) {
        finalCustomerId = await getLatestDocumentNo(profile.store_id, 'CUST-');
        await createCustomer(profile.store_id, finalCustomerId, customerName, customerPhone, customerAddress, customerGstin);
      }

      if (initialJob?.job_id) {
        await updateJobCardDetails(initialJob.job_id, {
          customer_id: finalCustomerId,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          customer_gstin: customerGstin,
          device: device,
          reported_issue: reportedIssue,
          estimated_cost: parseFloat(estimatedCost) || 0,
        });
      } else {
        await createJobCard(profile.store_id, {
          customer_id: finalCustomerId,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          customer_gstin: customerGstin,
          device: device,
          device_model: '',
          reported_issue: reportedIssue,
          status: JobCardStatus.RECEIVED,
          estimated_cost: parseFloat(estimatedCost) || 0,
          parts_used: [],
        });
      }
      
      onComplete();
    } catch (error: any) {
      console.error("Failed to create job card", error);
      const msg = error?.message || error?.code || String(error);
      toast.error(`Error creating job card: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest w-full max-w-[700px] mx-4 p-4 md:p-8 rounded border border-outline-variant shadow-[0_4px_20px_rgba(15,23,42,0.04)] max-h-[90dvh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-headline-md text-headline-md text-primary">{initialJob ? 'Update Service Intake' : 'New Service Intake'}</h3>
        <button className="text-secondary hover:text-primary transition-colors" onClick={onCancel}>
          <span className="material-symbols-outlined" data-icon="close">close</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2 relative">
            <label className="block font-label-md text-label-md text-secondary">Customer Phone</label>
            <input 
              className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
              placeholder="Search or enter phone..." 
              value={customerPhone}
              onChange={e => handlePhoneChange(e.target.value)}
              required
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-surface-container-lowest border border-outline-variant shadow-lg rounded mt-1 z-10 max-h-40 overflow-y-auto">
                {searchResults.map(c => (
                  <div key={c.customer_id} onClick={() => selectCustomer(c)} className="p-3 cursor-pointer hover:bg-surface-container border-b border-outline-variant/30">
                    <div className="font-bold text-primary text-body-md">{c.name}</div>
                    <div className="text-secondary text-[12px]">{c.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-secondary">Customer Name</label>
            <input 
              className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
              placeholder="Full Name" 
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-secondary">Address (Optional)</label>
            <input 
              className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
              placeholder="Address" 
              value={customerAddress}
              onChange={e => setCustomerAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-secondary">GSTIN (Optional)</label>
            <input 
              className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
              placeholder="GST Number" 
              value={customerGstin}
              onChange={e => setCustomerGstin(e.target.value)}
            />
          </div>
        </div>

        <div className="h-px bg-outline-variant/50 w-full my-4"></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-secondary">Device Make & Model</label>
            <input 
              className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
              placeholder="e.g. MacBook Pro M2" 
              value={device}
              onChange={e => setDevice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-secondary">Estimated Cost (₹)</label>
            <input 
              className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
              type="number"
              placeholder="0.00" 
              value={estimatedCost}
              onChange={e => setEstimatedCost(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block font-label-md text-label-md text-secondary">Reported Issue</label>
          <textarea 
            className="w-full min-h-[100px] border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none resize-y" 
            placeholder="Describe the issue in detail..." 
            value={reportedIssue}
            onChange={e => setReportedIssue(e.target.value)}
            required
          />
        </div>

        <div className="pt-6 border-t border-outline-variant flex justify-end gap-4">
          <button 
            type="button"
            className="px-6 py-3 border border-outline-variant rounded font-label-md text-label-md text-primary hover:bg-surface-container transition-colors" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="flex-1 bg-primary text-on-primary py-3 rounded font-label-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : initialJob ? 'Update Job Card' : 'Create Job Card'}
          </button>
        </div>
      </form>
    </div>
  );
};
