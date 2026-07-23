import { useState, useEffect } from 'react';
import { updateBusinessProfile, wipeStoreData, signOut, auth, type BusinessProfile } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useBusiness } from '../../context/BusinessContext';
import { useAuth } from '../../context/AuthContext';

/**
 * Settings Dashboard for managing the business profile, contact information,
 * and dangerous actions like wiping store data or signing out.
 */
export const SettingsDashboard: React.FC = () => {
  const { user, profile: authProfile } = useAuth();
  const { profile, refreshProfile } = useBusiness();
  const [formData, setFormData] = useState<Partial<BusinessProfile>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [showWipeModal, setShowWipeModal] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const handleChange = (field: keyof BusinessProfile, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const storeId = profile?.store_id || authProfile?.store_id;
    if (!storeId) return;
    setIsSaving(true);
    try {
      await updateBusinessProfile(storeId, {
        business_id: profile?.business_id || storeId,
        store_id: storeId,
        business_name: formData.business_name || '',
        owner_name: formData.owner_name || '',
        phone: formData.phone || '',
        alt_phone: formData.alt_phone || '',
        email: formData.email || '',
        website: formData.website || '',
        address: formData.address || '',
        gstin: formData.gstin || '',
        upi_id: formData.upi_id || '',
        bank_account: formData.bank_account || '',
        bank_ifsc: formData.bank_ifsc || '',
        bank_name: formData.bank_name || '',
        invoice_terms: formData.invoice_terms || '',
        quotation_terms: formData.quotation_terms || '',
        signature_name: formData.signature_name || '',
      });
      await refreshProfile();
      alert("Settings saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleWipeData = async () => {
    const storeId = profile?.store_id || authProfile?.store_id;
    if (!storeId) return;

    setIsWiping(true);
    try {
      await wipeStoreData(storeId);
      alert("All store data has been successfully wiped.");
      window.location.reload(); 
    } catch (e) {
      console.error(e);
      alert("Failed to wipe data.");
    } finally {
      setIsWiping(false);
      setShowWipeModal(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      alert("No email address found for your account.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      alert(`Password reset link sent to ${user.email}`);
    } catch (e: any) {
      console.error(e);
      alert(`Failed to send password reset email: ${e.message}`);
    }
  };

  return (
    <div className="max-w-container-max mx-auto p-4 md:p-margin-desktop w-full h-[calc(100dvh-4rem)] overflow-y-auto">
      <div className="mb-8">
        <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">Business Settings</h2>
        <p className="font-body-md text-body-md text-secondary mt-2">Manage your organization's core profile, compliance details, and financial integrations.</p>
      </div>

      <div className="space-y-6">
        {/* Section: Account & Security */}
        <section className="bg-surface-container-lowest border border-outline-variant p-8 flex flex-col md:flex-row gap-6 rounded-lg shadow-sm">
          <div className="md:w-1/3">
            <h3 className="font-headline-md text-headline-md text-primary mb-2">Account & Security</h3>
            <p className="font-body-md text-body-md text-secondary">Manage your login credentials and account security.</p>
          </div>
          <div className="md:w-2/3 space-y-6">
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-on-surface">Registered Email</label>
              <input 
                className="w-full border border-outline-variant rounded bg-surface-container-low text-secondary font-body-md text-body-md p-3 cursor-not-allowed" 
                type="text" 
                value={user?.email || 'No email attached'} 
                disabled 
              />
              <p className="text-[11px] text-secondary">This is the email address used to sign in to LedgerX.</p>
            </div>
            <div>
              <button 
                onClick={handlePasswordReset}
                className="px-4 py-2 bg-surface-container border border-outline-variant rounded font-label-md text-label-md text-primary hover:bg-surface-container-high transition-colors"
              >
                Send Password Reset Email
              </button>
            </div>
          </div>
        </section>

        {/* Section: Business Profile */}
        <section className="bg-surface-container-lowest border border-outline-variant p-8 flex flex-col md:flex-row gap-6 rounded-lg shadow-sm">
          <div className="md:w-1/3">
            <h3 className="font-headline-md text-headline-md text-primary mb-2">Business Profile</h3>
            <p className="font-body-md text-body-md text-secondary">Basic information about your store or enterprise used for billing and identity.</p>
          </div>
          <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-on-surface">Business Name</label>
              <input 
                className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors" 
                type="text" 
                value={formData.business_name || ''} 
                onChange={e => handleChange('business_name', e.target.value)}
                placeholder="e.g. LedgerX Repair Shop"
              />
            </div>
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-on-surface">Owner Name</label>
              <input 
                className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors" 
                type="text" 
                value={formData.owner_name || ''} 
                onChange={e => handleChange('owner_name', e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="block font-label-md text-label-md text-on-surface">GSTIN (Tax ID)</label>
              <div className="relative">
                <input 
                  className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 uppercase transition-colors" 
                  type="text" 
                  value={formData.gstin || ''} 
                  onChange={e => handleChange('gstin', e.target.value)}
                  placeholder="e.g. 27AADCB2230M1Z2"
                />
                {formData.gstin && formData.gstin.length > 5 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-widest border border-emerald-100">Entered</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Section: Contact & Address */}
        <section className="bg-surface-container-lowest border border-outline-variant p-8 flex flex-col md:flex-row gap-6 rounded-lg shadow-sm">
          <div className="md:w-1/3">
            <h3 className="font-headline-md text-headline-md text-primary mb-2">Contact & Address</h3>
            <p className="font-body-md text-body-md text-secondary">The primary contact details for your business location and support inquiries.</p>
          </div>
          <div className="md:w-2/3 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block font-label-md text-label-md text-on-surface">Primary Phone</label>
                <input 
                  className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors" 
                  type="tel" 
                  value={formData.phone || ''} 
                  onChange={e => handleChange('phone', e.target.value)}
                  placeholder="+91..."
                />
              </div>
              <div className="space-y-2">
                <label className="block font-label-md text-label-md text-on-surface">Alternate Phone</label>
                <input 
                  className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors" 
                  type="tel" 
                  value={formData.alt_phone || ''} 
                  onChange={e => handleChange('alt_phone', e.target.value)}
                  placeholder="+91..."
                />
              </div>
              <div className="space-y-2">
                <label className="block font-label-md text-label-md text-on-surface">Email Address</label>
                <input 
                  className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors" 
                  type="email" 
                  value={formData.email || ''} 
                  onChange={e => handleChange('email', e.target.value)}
                  placeholder="hello@business.com"
                />
              </div>
              <div className="space-y-2">
                <label className="block font-label-md text-label-md text-on-surface">Website</label>
                <input 
                  className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors" 
                  type="url" 
                  value={formData.website || ''} 
                  onChange={e => handleChange('website', e.target.value)}
                  placeholder="https://business.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-on-surface">Business Address</label>
              <textarea 
                className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors min-h-[100px] resize-y" 
                value={formData.address || ''} 
                onChange={e => handleChange('address', e.target.value)}
                placeholder="Shop No. 123, Main Street, City"
              />
            </div>
          </div>
        </section>

        {/* Section: Payment Information */}
        <section className="bg-surface-container-lowest border border-outline-variant p-8 flex flex-col md:flex-row gap-6 rounded-lg shadow-sm">
          <div className="md:w-1/3">
            <h3 className="font-headline-md text-headline-md text-primary mb-2">Payment Information</h3>
            <p className="font-body-md text-body-md text-secondary">Configure where you receive settlements and how customers pay you. This will appear on invoices.</p>
          </div>
          <div className="md:w-2/3 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2 sm:col-span-2">
                <label className="block font-label-md text-label-md text-on-surface">Primary UPI ID</label>
                <div className="relative">
                  <input 
                    className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 pr-10 transition-colors" 
                    type="text" 
                    value={formData.upi_id || ''} 
                    onChange={e => handleChange('upi_id', e.target.value)}
                    placeholder="business@ybl"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant text-[20px]">qr_code_2</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block font-label-md text-label-md text-on-surface">Bank Name</label>
                <input 
                  className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors" 
                  type="text" 
                  value={formData.bank_name || ''} 
                  onChange={e => handleChange('bank_name', e.target.value)}
                  placeholder="e.g. Acme Bank"
                />
              </div>
              <div className="space-y-2">
                <label className="block font-label-md text-label-md text-on-surface">Bank Account No.</label>
                <input 
                  className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors" 
                  type="text" 
                  value={formData.bank_account || ''} 
                  onChange={e => handleChange('bank_account', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block font-label-md text-label-md text-on-surface">Branch & IFS Code</label>
                <input 
                  className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors" 
                  type="text" 
                  value={formData.bank_ifsc || ''} 
                  onChange={e => handleChange('bank_ifsc', e.target.value)}
                />
              </div>
            </div>
            
            <hr className="border-t border-outline-variant/30 my-8" />
            
            <h4 className="font-headline-md text-headline-md text-primary mb-4">Document Customization</h4>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block font-label-md text-label-md text-on-surface">Invoice Terms & Conditions</label>
                <textarea 
                  className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors resize-y min-h-[80px]" 
                  value={formData.invoice_terms || ''} 
                  onChange={e => handleChange('invoice_terms', e.target.value)}
                  placeholder="e.g. Goods once sold will not be taken back..."
                />
              </div>
              <div className="space-y-2">
                <label className="block font-label-md text-label-md text-on-surface">Quotation Terms & Conditions</label>
                <textarea 
                  className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors resize-y min-h-[80px]" 
                  value={formData.quotation_terms || ''} 
                  onChange={e => handleChange('quotation_terms', e.target.value)}
                  placeholder="e.g. Rates are valid for 30 days only..."
                />
              </div>
              <div className="space-y-2">
                <label className="block font-label-md text-label-md text-on-surface">Authorized Signatory Name</label>
                <input 
                  className="w-full border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md p-3 transition-colors" 
                  type="text" 
                  value={formData.signature_name || ''} 
                  onChange={e => handleChange('signature_name', e.target.value)}
                  placeholder="e.g. Acme Corp"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                className="bg-primary text-on-primary px-8 py-3 rounded font-label-md text-label-md shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          </div>
        </section>

        {/* Section: Danger Zone */}
        <section className="bg-rose-50/30 border border-rose-100 p-8 flex flex-col md:flex-row gap-6 rounded-lg">
          <div className="md:w-1/3">
            <h3 className="font-headline-md text-headline-md text-rose-800 mb-2">Danger Zone</h3>
            <p className="font-body-md text-body-md text-rose-600/80">Permanent destructive actions. These settings cannot be undone.</p>
          </div>
          <div className="md:w-2/3">
            <div className="border border-rose-200/50 rounded bg-white p-6 flex flex-col sm:flex-row items-center justify-between gap-6 mb-4">
              <div>
                <h4 className="font-label-md text-label-md text-primary font-bold">Wipe All Data</h4>
                <p className="font-body-md text-body-md text-secondary mt-1">Delete all transaction history, inventory logs, and customer records. This action is irreversible.</p>
              </div>
              <button 
                className="whitespace-nowrap rounded border border-rose-600 text-rose-600 hover:bg-rose-600 hover:text-white px-6 py-2.5 font-label-md text-label-md transition-all active:scale-95"
                onClick={() => setShowWipeModal(true)}
              >
                Wipe All Data
              </button>
            </div>
            
            <div className="border border-outline-variant rounded bg-white p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <h4 className="font-label-md text-label-md text-primary font-bold">Account Access</h4>
                <p className="font-body-md text-body-md text-secondary mt-1">Sign out of this device securely.</p>
              </div>
              <button 
                className="whitespace-nowrap rounded border border-outline-variant text-secondary hover:bg-surface-container px-6 py-2.5 font-label-md text-label-md transition-all active:scale-95 flex items-center gap-2"
                onClick={() => signOut()}
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign Out
              </button>
            </div>
          </div>
        </section>

        <footer className="pt-8 border-t border-outline-variant flex justify-between items-center text-outline pb-8">
          <p className="font-label-md text-label-md">LedgerX Enterprise Management</p>
        </footer>
      </div>

      {/* Wipe Modal */}
      {showWipeModal && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-md w-full p-8 rounded border border-outline-variant shadow-[0px_4px_20px_rgba(15,23,42,0.08)] animate-in fade-in zoom-in duration-300">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-rose-600 text-[24px]">warning</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary mb-2">Absolute Data Erasure</h3>
            <p className="font-body-md text-body-md text-secondary mb-8">
              This will immediately purge all data associated with <strong>{formData.business_name || 'your store'}</strong>. You will lose access to all financial records permanently.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                className="w-full rounded bg-rose-600 text-white py-3 font-label-md text-label-md hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50"
                onClick={handleWipeData}
                disabled={isWiping}
              >
                {isWiping ? 'Erasing...' : 'Confirm Deletion'}
              </button>
              <button 
                className="w-full rounded bg-surface-container text-primary py-3 font-label-md text-label-md hover:bg-surface-container-high active:scale-95 transition-all disabled:opacity-50" 
                onClick={() => setShowWipeModal(false)}
                disabled={isWiping}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
