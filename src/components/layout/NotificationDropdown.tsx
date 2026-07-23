import React, { useRef, useEffect } from 'react';
import { useNotifications, NotificationItem, useNotificationActions } from '../../hooks/queries/useNotifications';
import { useAuth } from '../../context/AuthContext';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, id?: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose, onNavigate }) => {
  const { profile } = useAuth();
  const { data: notifications = [], isLoading } = useNotifications(profile?.store_id);
  const { dismissNotification } = useNotificationActions();
  const [filterTab, setFilterTab] = React.useState<'ALL' | 'STOCK' | 'REPAIRS' | 'BILLS'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'LOW_STOCK': return <span className="material-symbols-outlined text-error">warning</span>;
      case 'REPAIR_ACTIVE': return <span className="material-symbols-outlined text-primary">build</span>;
      case 'UNPAID_BILL_CUSTOMER': return <span className="material-symbols-outlined text-amber-600">account_balance_wallet</span>;
      case 'UNPAID_BILL_VENDOR': return <span className="material-symbols-outlined text-secondary">receipt_long</span>;
      default: return <span className="material-symbols-outlined">notifications</span>;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filterTab === 'STOCK') return n.type === 'LOW_STOCK';
    if (filterTab === 'REPAIRS') return n.type === 'REPAIR_ACTIVE';
    if (filterTab === 'BILLS') return n.type === 'UNPAID_BILL_CUSTOMER' || n.type === 'UNPAID_BILL_VENDOR';
    return true;
  });

  return (
    <div 
      ref={dropdownRef}
      className="absolute top-14 right-4 md:right-10 w-80 md:w-96 max-h-[28rem] bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg flex flex-col z-50 overflow-hidden"
    >
      <div className="p-3 border-b border-outline-variant bg-surface-container-lowest shrink-0 space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="font-headline-sm text-on-surface text-base font-bold">Notifications</h3>
          <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
            {notifications.length} New
          </span>
        </div>
        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto text-[11px] font-bold">
          {(['ALL', 'STOCK', 'REPAIRS', 'BILLS'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                filterTab === tab 
                  ? 'bg-primary text-on-primary' 
                  : 'bg-surface-container text-secondary hover:bg-surface-container-high'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab === 'STOCK' ? 'Stock' : tab === 'REPAIRS' ? 'Repairs' : 'Bills'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-secondary text-sm flex items-center justify-center">
            <span className="material-symbols-outlined animate-spin mr-2">sync</span> Loading...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-secondary">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_paused</span>
            <p className="text-sm">No notifications in this category.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-outline-variant">
            {filteredNotifications.map(notif => (
              <div 
                key={notif.id} 
                className="p-4 hover:bg-surface-container-low transition-colors cursor-pointer flex gap-3 items-start group"
                onClick={() => {
                  if (notif.actionUrl) {
                    onNavigate(notif.actionUrl, notif.actionId);
                    onClose();
                  }
                }}
              >
                <div className="mt-1 shrink-0 bg-surface-container w-8 h-8 rounded-full flex items-center justify-center">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0 pr-6 relative">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-bold text-on-surface truncate">{notif.title}</p>
                    <button 
                      className="absolute right-0 top-0 p-1 text-secondary hover:text-error hover:bg-surface-container-high rounded-full transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(notif.id, profile?.store_id);
                      }}
                      title="Dismiss notification"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                  <p className="text-xs text-secondary mt-0.5 line-clamp-2 leading-relaxed">{notif.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
