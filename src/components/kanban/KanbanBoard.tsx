import { useEffect, useState, useCallback, useRef } from "react";
import { type JobCard, JobCardStatus, type InventoryItem, type JobCardPart, type Customer } from '@/lib/firebase/types';
import { updateJobCardStatus, addPartToJobCard, getJobCards, deleteJobCard } from '@/lib/firebase/api/jobCards';
import { searchInventory } from '@/lib/firebase/api/inventory';
import { getCustomer } from '@/lib/firebase/api/customers';
import { usePOS } from '../../context/POSContext';
import { useAuth } from '../../context/AuthContext';
import { JobCardIntake } from './JobCardIntake';
import { addInventoryItem } from '@/lib/firebase/api/inventory';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';
import toast from 'react-hot-toast';

export interface KanbanBoardProps {
  /** Callback to switch to the POS tab, triggered when a job is completed and billed */
  onSwitchToPOS: () => void;
  /** Optional Job ID to highlight upon loading */
  initialJobId?: string | null;
  /** Callback to clear the deep link highlight */
  onClearDeepLink?: () => void;
}

/**
 * A Kanban board for managing service/repair jobs (JobCards).
 * Supports drag-and-drop status changes, adding parts from inventory,
 * and transitioning completed jobs directly to the POS for billing.
 */
export const KanbanBoard: React.FC<KanbanBoardProps> = ({ onSwitchToPOS, initialJobId, onClearDeepLink }) => {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const { addToCart, setCustomer } = usePOS();
  const [isAddingJob, setIsAddingJob] = useState(false);
  const [editingJob, setEditingJob] = useState<JobCard | null>(null);
  const [jobToDelete, setJobToDelete] = useState<JobCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingInventory, setIsAddingInventory] = useState(false);
  const [invName, setInvName] = useState('');
  const [invCategory, setInvCategory] = useState('');
  const [invSellPrice, setInvSellPrice] = useState('');
  const [invPurchasePrice, setInvPurchasePrice] = useState('');
  const [invGst, setInvGst] = useState('18');
  const [invStock, setInvStock] = useState('1');
  const [isSavingInv, setIsSavingInv] = useState(false);
  
  // Drag state
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (profile?.store_id) {
      const data = await getJobCards(profile.store_id);
      setJobs(data);
    }
  }, [profile?.store_id]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // HTML5 Drag Handlers
  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggingJobId(jobId);
    e.dataTransfer.setData('jobId', jobId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleStatusChange = async (jobId: string, newStatus: JobCardStatus) => {
    if (profile?.store_id) {
      await updateJobCardStatus(jobId, newStatus);
      await fetchJobs();
    }
  };

  const handleDrop = async (e: React.DragEvent, newStatus: JobCardStatus) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('jobId');
    setDraggingJobId(null);
    if (jobId) {
      const job = jobs.find(j => j.job_id === jobId);
      if (job && job.status !== newStatus && profile?.store_id) {
        await handleStatusChange(jobId, newStatus);
      }
    }
  };

  const handleCompleteAndBill = async (job: JobCard) => {
    if (!profile?.store_id) return;
    
    const custData = await getCustomer(profile.store_id, job.customer_id);
    setCustomer(custData || {
      customer_id: job.customer_id,
      store_id: profile.store_id,
      name: job.customer_name || 'Walk-in',
      phone: job.customer_phone || '',
      udhaar_balance: 0,
      created_at: new Date(),
      search_terms: []
    } as Customer);

    // Push base repair fee
    addToCart({
      item_id: `SVC_${job.job_id}`,
      name: `Repair Service: ${job.device}`,
      qty: 1,
      price: job.estimated_cost,
      is_custom: true, // It's a service, doesn't deduct physical stock
      gst_rate: 18, 
    });

    // Push parts used
    if (job.parts_used) {
      job.parts_used.forEach(part => {
        addToCart({
          item_id: part.item_id,
          name: part.name,
          qty: part.qty,
          price: part.price,
          is_custom: false, // These are real inventory items
          gst_rate: part.gst_rate || 0,
        });
      });
    }

    onSwitchToPOS();
  };

  const columns = [
    { title: "Intake", status: JobCardStatus.RECEIVED, dotColor: "bg-on-secondary-container" },
    { title: "In Progress", status: JobCardStatus.IN_PROGRESS, dotColor: "bg-on-tertiary-container" },
    { title: "Ready", status: JobCardStatus.READY, dotColor: "bg-emerald-500" },
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] max-w-container-max mx-auto p-4 md:p-margin-desktop overflow-hidden">
      {/* Board Toolbar */}
      <section className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 shrink-0">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary">Service Board</h2>
          <p className="text-secondary font-body-md mt-1">Manage active repairs and client assets in real-time.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="flex items-center gap-2 px-4 py-2 border border-outline-variant bg-surface-container-lowest text-secondary hover:bg-surface-container transition-colors rounded font-label-md"
            onClick={() => setIsAddingInventory(true)}
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            Add to Inventory
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary hover:opacity-90 transition-all rounded font-label-md font-bold"
            onClick={() => setIsAddingJob(true)}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Job Card
          </button>
        </div>
      </section>

      {/* Kanban Board Container */}
      <section className="flex-1 overflow-x-auto pb-8">
        <div className="flex gap-6 min-w-max h-full">
          {columns.map(col => (
            <div key={col.status} className="w-72 flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-label-md text-[11px] font-bold text-secondary uppercase tracking-widest">{col.title} ({jobs.filter(j => j.status === col.status).length})</h3>
                </div>
              </div>
              <div 
                className="flex-1 min-h-[200px] rounded-lg bg-surface-container-low/40 p-1 space-y-4"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.status)}
              >
                {jobs.filter(j => j.status === col.status).map(job => (
                  <JobCardItem 
                    key={job.job_id} 
                    job={job}
                    isDragging={draggingJobId === job.job_id}
                    onDragStart={handleDragStart}
                    onDragEnd={() => setDraggingJobId(null)}
                    onComplete={() => handleCompleteAndBill(job)}
                    onStatusChange={(status) => handleStatusChange(job.job_id, status)}
                    onEdit={() => setEditingJob(job)}
                    onDelete={() => setJobToDelete(job)}
                    storeId={profile?.store_id}
                    onRefresh={fetchJobs}
                    isHighlighted={initialJobId === job.job_id}
                    onHighlightClear={onClearDeepLink}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Job Card Intake Modal */}
      {(isAddingJob || editingJob) && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <JobCardIntake 
            initialJob={editingJob}
            onComplete={() => {
              setIsAddingJob(false);
              setEditingJob(null);
              fetchJobs();
              toast.success(editingJob ? 'Job Card updated successfully!' : 'Job Card created successfully!');
            }} 
            onCancel={() => {
              setIsAddingJob(false);
              setEditingJob(null);
            }} 
          />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!jobToDelete}
        onCancel={() => setJobToDelete(null)}
        onConfirm={async () => {
          if (!jobToDelete) return;
          setIsDeleting(true);
          try {
            await deleteJobCard(jobToDelete.job_id);
            toast.success("Repair card deleted successfully");
            setJobToDelete(null);
            fetchJobs();
          } catch(e) {
            toast.error("Failed to delete repair card");
          } finally {
            setIsDeleting(false);
          }
        }}
        title="Delete Repair Card"
        message="Are you sure you want to delete this repair card? This cannot be undone."
        confirmLabel="Delete"
        isDestructive={true}
        isProcessing={isDeleting}
      />

      {/* Add to Inventory Modal */}
      {isAddingInventory && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[60] flex items-center justify-center">
          <div className="bg-surface-container-lowest p-6 rounded-lg w-full max-w-md shadow-xl border border-outline-variant">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-headline-md text-headline-md text-primary">Add to Inventory</h3>
              <button onClick={() => setIsAddingInventory(false)} className="text-secondary hover:text-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-md text-secondary mb-1">Item Name *</label>
                  <input className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={invName} onChange={e => setInvName(e.target.value)} placeholder="e.g. iPhone Screen" />
                </div>
                <div>
                  <label className="block text-label-md text-secondary mb-1">Category</label>
                  <input className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={invCategory} onChange={e => setInvCategory(e.target.value)} placeholder="e.g. Parts" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-md text-secondary mb-1">Selling Price (₹) *</label>
                  <input type="number" className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={invSellPrice} onChange={e => setInvSellPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-label-md text-secondary mb-1">Purchase Price (₹)</label>
                  <input type="number" className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={invPurchasePrice} onChange={e => setInvPurchasePrice(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-md text-secondary mb-1">GST Rate (%)</label>
                  <select className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={invGst} onChange={e => setInvGst(e.target.value)}>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-label-md text-secondary mb-1">Opening Stock</label>
                  <input type="number" className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={invStock} onChange={e => setInvStock(e.target.value)} placeholder="1" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border border-outline-variant rounded text-secondary hover:bg-surface-container" onClick={() => setIsAddingInventory(false)}>Cancel</button>
              <button
                disabled={!invName || !invSellPrice || isSavingInv}
                className="px-4 py-2 bg-primary text-on-primary rounded hover:opacity-90 disabled:opacity-50"
                onClick={async () => {
                  if (!profile?.store_id || !invName || !invSellPrice) return;
                  setIsSavingInv(true);
                  try {
                    await addInventoryItem(profile.store_id, {
                      name: invName,
                      category: invCategory,
                      selling_price: parseFloat(invSellPrice),
                      purchase_price: parseFloat(invPurchasePrice) || 0,
                      gst_rate: parseFloat(invGst),
                      current_stock: parseInt(invStock) || 1,
                      is_active: true,
                    } as any);
                    setIsAddingInventory(false);
                    setInvName(''); setInvCategory(''); setInvSellPrice(''); setInvPurchasePrice(''); setInvGst('18'); setInvStock('1');
                    toast.success('Item added to inventory!');
                  } catch(e) {
                    toast.error('Failed to add item.');
                  } finally {
                    setIsSavingInv(false);
                  }
                }}
              >
                {isSavingInv ? 'Saving...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const JobCardItem: React.FC<{
  job: JobCard;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onComplete: () => void;
  onStatusChange: (status: JobCardStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  storeId?: string;
  onRefresh: () => void;
  isHighlighted?: boolean;
  onHighlightClear?: () => void;
}> = ({ job, isDragging, onDragStart, onDragEnd, onComplete, onStatusChange, onEdit, onDelete, storeId, onRefresh, isHighlighted, onHighlightClear }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [partSearch, setPartSearch] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  useEffect(() => {
    const search = async () => {
      if (partSearch.trim().length > 0 && storeId) {
        setIsSearching(true);
        const res = await searchInventory(storeId, partSearch);
        setSearchResults(res);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    };
    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [partSearch, storeId]);

  const handleAddPart = async (item: InventoryItem) => {
    const newPart: JobCardPart = {
      item_id: item.item_id,
      name: item.name,
      qty: 1, 
      price: item.selling_price,
      gst_rate: item.gst_rate
    };
    await addPartToJobCard(job.job_id, job.parts_used || [], newPart);
    setPartSearch('');
    onRefresh();
  };

  // Status mapping for badge UI
  const getBadgeStyle = (status: JobCardStatus) => {
    switch (status) {
      case JobCardStatus.RECEIVED: return 'bg-blue-50 text-blue-700';
      case JobCardStatus.IN_PROGRESS: return 'bg-amber-50 text-amber-700';
      case JobCardStatus.READY: return 'bg-emerald-50 text-emerald-700';
      default: return 'bg-surface-container-high text-on-surface-variant';
    }
  };

  return (
    <div 
      ref={cardRef}
      className={`bg-surface-container-lowest border p-4 rounded hover:border-primary transition-all cursor-grab active:cursor-grabbing group ${
        isDragging ? 'opacity-50 scale-95' : ''} ${
        isHighlighted ? 'border-primary ring-2 ring-primary ring-offset-1' : 'border-outline-variant'
      }`}
      draggable
      onDragStart={(e) => onDragStart(e, job.job_id)}
      onDragEnd={onDragEnd}
      onClick={() => { if (isHighlighted) onHighlightClear?.(); }}
    >
      <div className="flex justify-between items-start mb-3">
        <span className={`${getBadgeStyle(job.status)} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter`}>
          {job.status.replace('_', ' ')}
        </span>
        <div className="flex items-center gap-2">
          <button 
            className="text-secondary hover:text-primary transition-colors flex items-center" 
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Edit Repair Card"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
          <button 
            className="text-secondary hover:text-error transition-colors flex items-center" 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete Repair Card"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
          <span className="text-outline font-code text-code">#{job.job_id.substring(0, 8)}</span>
        </div>
      </div>
      <h4 className="font-headline-md text-label-md font-bold text-primary mb-1">{job.customer_name}</h4>
      <p className="text-secondary text-body-md mb-3">{job.device}</p>
      
      <p className="text-[12px] text-outline mb-4 line-clamp-2">{job.reported_issue}</p>
      
      {/* Parts Management for In Progress */}
      {job.status === JobCardStatus.IN_PROGRESS && (
        <div className="mt-4 mb-4 border-t border-outline-variant/30 pt-3">
          <h4 className="text-[10px] uppercase font-bold text-secondary mb-2 tracking-wider">Parts Used</h4>
          <ul className="space-y-1 mb-3">
            {(job.parts_used || []).map((p, i) => (
              <li key={i} className="flex justify-between text-[11px]">
                <span className="text-secondary">{p.name} <span className="text-outline">(x{p.qty})</span></span>
                <span className="text-primary font-code">₹{p.price * p.qty}</span>
              </li>
            ))}
          </ul>
          <div className="relative">
            <input 
              placeholder="Search parts to add..."
              className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-[11px] outline-none focus:border-primary"
              value={partSearch}
              onChange={(e) => setPartSearch(e.target.value)}
            />
            {isSearching && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-surface-container-lowest border border-outline-variant shadow-lg rounded mt-1 z-10 max-h-40 overflow-y-auto">
                {searchResults.map(res => (
                  <div 
                    key={res.item_id} 
                    className="px-2 py-1.5 text-[11px] hover:bg-surface-container cursor-pointer border-b border-outline-variant/30 last:border-0"
                    onClick={() => handleAddPart(res)}
                  >
                    <div className="font-bold">{res.name}</div>
                    <div className="text-secondary">₹{res.selling_price}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-3 border-t border-outline-variant">
        <span className="font-bold text-primary">Est. ₹{job.estimated_cost}</span>
        <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-primary">
          {(job.customer_name || 'WK').substring(0, 2).toUpperCase()}
        </div>
      </div>

      <div className="flex justify-between mt-3 pt-3 border-t border-outline-variant/50">
        {job.status === JobCardStatus.IN_PROGRESS || job.status === JobCardStatus.READY ? (
          <button 
            className="text-[10px] uppercase font-bold text-secondary flex items-center gap-1 hover:text-primary transition-colors"
            onClick={() => onStatusChange(job.status === JobCardStatus.READY ? JobCardStatus.IN_PROGRESS : JobCardStatus.RECEIVED)}
          >
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            Prev
          </button>
        ) : <div />}
        
        {job.status === JobCardStatus.RECEIVED || job.status === JobCardStatus.IN_PROGRESS ? (
          <button 
            className="text-[10px] uppercase font-bold text-secondary flex items-center gap-1 hover:text-primary transition-colors"
            onClick={() => onStatusChange(job.status === JobCardStatus.RECEIVED ? JobCardStatus.IN_PROGRESS : JobCardStatus.READY)}
          >
            Next
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        ) : <div />}
      </div>

      {job.status === JobCardStatus.READY && (
        <div className="mt-3">
          <button 
            className="w-full py-2 bg-primary text-on-primary rounded text-label-md font-bold hover:opacity-90 transition-all"
            onClick={onComplete}
          >
            Complete & Bill
          </button>
        </div>
      )}
    </div>
  );
};
