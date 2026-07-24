import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { app } from '@/lib/firebase/config';
import { type Transaction, type Customer, type InventoryItem, type JobCard, type Expense } from '@/lib/firebase/types';
import { useAuth } from '../../context/AuthContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { formatCurrency } from '../../lib/utils/formatters';
import { Skeleton } from '../ui/Skeleton';
import toast from 'react-hot-toast';

class DashboardErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-error">
          <h2 className="text-xl font-bold mb-4">Dashboard Crashed</h2>
          <pre className="bg-error-container p-4 rounded whitespace-pre-wrap">{this.state.error?.message}</pre>
          <pre className="mt-4 text-xs">{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface AnalyticsDashboardProps {
  /** Optional callback to navigate to a specific tab */
  onNavigate?: (tab: string, id?: string) => void;
}

/**
 * The Analytics Dashboard component providing an overview of store performance,
 * revenue metrics, active jobs, and pending udhaar (credit).
 */
export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ onNavigate }) => {
  return (
    <DashboardErrorBoundary>
      <AnalyticsDashboardInner onNavigate={onNavigate} />
    </DashboardErrorBoundary>
  );
};

const AnalyticsDashboardInner: React.FC<AnalyticsDashboardProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [lastMonthRevenue, setLastMonthRevenue] = useState(0);
  const [totalUdhaar, setTotalUdhaar] = useState(0);
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);
  const [pendingCustomers, setPendingCustomers] = useState<Customer[]>([]);
  const [activeJobCards, setActiveJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'MONTH' | 'LAST_7'>('MONTH');
  const [chartData, setChartData] = useState<any[]>([]);
  const [plChartData, setPlChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!profile?.store_id) return;
      setLoading(true);
      try {
        const db = getFirestore(app);
        
        // Fetch all transactions to calculate revenue
        const txQ = query(collection(db, 'Transactions'), where('store_id', '==', profile.store_id));
        const txSnap = await getDocs(txQ);
        let mRev = 0;
        let lmRev = 0;
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month

        const txs: Transaction[] = [];

        txSnap.docs.forEach(doc => {
          const tx = doc.data() as Transaction;
          if (tx.status === 'VOIDED' || tx.document_type !== 'FINAL_SALE') return;

          txs.push(tx);

          const txDate = new Date(tx.timestamp?.seconds ? tx.timestamp.seconds * 1000 : tx.timestamp);
          
          if (txDate >= startOfMonth) {
            mRev += tx.total_amount;
          } else if (txDate >= startOfLastMonth && txDate <= endOfLastMonth) {
            lmRev += tx.total_amount;
          }
        });

        // Sort for recent transactions
        txs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
        setRecentTxs(txs); // Store all valid txs for export

        setMonthlyRevenue(mRev);
        setLastMonthRevenue(lmRev);

        // Prepare chart data
        const cData: Array<{dateObj: Date, name: string, revenue: number, previousRevenue: number}> = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          d.setHours(0,0,0,0);
          cData.push({
            dateObj: d,
            name: d.toLocaleDateString('en-US', { weekday: 'short' }),
            revenue: 0,
            previousRevenue: 0
          });
        }
        
        txs.forEach(tx => {
           const txDate = new Date(tx.timestamp?.seconds ? tx.timestamp.seconds * 1000 : tx.timestamp);
           const dayDiff = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 3600 * 24));
           if (dayDiff >= 0 && dayDiff < 30) {
             cData[29 - dayDiff].revenue += tx.total_amount;
           }
        });
        setChartData(cData);

        // Fetch Total Udhaar
        const custQ = query(collection(db, 'Customers'), where('store_id', '==', profile.store_id));
        const custSnap = await getDocs(custQ);
        let udhaar = 0;
        const pendingCusts: Customer[] = [];
        custSnap.docs.forEach(doc => {
          const cust = doc.data() as Customer;
          udhaar += (cust.udhaar_balance || 0);
          if (cust.udhaar_balance && cust.udhaar_balance > 0) {
            pendingCusts.push(cust);
          }
        });
        setTotalUdhaar(udhaar);
        pendingCusts.sort((a, b) => (b.udhaar_balance || 0) - (a.udhaar_balance || 0));
        setPendingCustomers(pendingCusts.slice(0, 5));

        // Fetch Total Inventory Value
        const invQ = query(collection(db, 'Inventory'), where('store_id', '==', profile.store_id));
        const invSnap = await getDocs(invQ);
        let invVal = 0;
        invSnap.docs.forEach(doc => {
          const prod = doc.data() as InventoryItem;
          invVal += (prod.purchase_price * (prod.current_stock || 0));
        });
        setTotalInventoryValue(invVal);

        // Fetch Active Job Cards
        const jobsQ = query(collection(db, 'JobCards'), where('store_id', '==', profile.store_id));
        const jobsSnap = await getDocs(jobsQ);
        const activeJobs: JobCard[] = [];
        jobsSnap.docs.forEach(doc => {
          const job = doc.data() as JobCard;
          if (job.status !== 'READY' && !job.is_deleted) {
            activeJobs.push(job);
          }
        });
        activeJobs.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
        setActiveJobCards(activeJobs.slice(0, 5));

        // Fetch Expenses for P&L chart (last 6 months)
        const expQ = query(collection(db, 'Expenses'), where('store_id', '==', profile.store_id), where('status', '==', 'PAID'));
        const expSnap = await getDocs(expQ);
        const expByMonth: Record<string, number> = {};
        expSnap.docs.forEach(doc => {
          const exp = doc.data() as Expense;
          const expDate = exp.date?.toDate ? exp.date.toDate() : new Date(exp.date);
          const key = expDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          expByMonth[key] = (expByMonth[key] || 0) + exp.amount;
        });

        const revByMonth: Record<string, number> = {};
        txs.forEach(tx => {
          const txDate = new Date(tx.timestamp?.seconds ? tx.timestamp.seconds * 1000 : tx.timestamp);
          const key = txDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          revByMonth[key] = (revByMonth[key] || 0) + tx.total_amount;
        });

        // Build last 6 months
        const plData: any[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          const revenue = revByMonth[key] || 0;
          const expenses = expByMonth[key] || 0;
          plData.push({
            name: d.toLocaleDateString('en-US', { month: 'short' }),
            revenue,
            expenses,
            profit: revenue - expenses,
          });
        }
        setPlChartData(plData);

      } catch (e) {
        console.error("Failed to fetch analytics", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMetrics();
  }, [profile?.store_id]);

  if (loading) {
    return (
      <div className="max-w-container-max mx-auto h-[calc(100dvh-4rem)] p-4 overflow-y-auto">
        <div className="flex justify-between items-end mb-8 mt-2">
          <div>
            <Skeleton className="w-48 h-8 mb-2" />
            <Skeleton className="w-64 h-4" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="w-32 h-10" />
            <Skeleton className="w-32 h-10" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter mb-gutter">
          {[1, 2, 3].map(i => (
            <div key={i} className="col-span-12 md:col-span-4 bg-surface-container-lowest border border-outline-variant p-6 rounded-lg">
              <div className="flex justify-between">
                <Skeleton className="w-10 h-10 rounded" />
                <Skeleton className="w-16 h-4" />
              </div>
              <div className="mt-6">
                <Skeleton className="w-24 h-4 mb-2" />
                <Skeleton className="w-32 h-8" />
              </div>
            </div>
          ))}
          
          <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant p-6 rounded-lg h-[350px]">
             <Skeleton className="w-48 h-6 mb-8" />
             <Skeleton className="w-full h-64" />
          </div>
          
          <div className="col-span-12 bg-surface-container-lowest border border-outline-variant p-6 rounded-lg h-[350px]">
             <Skeleton className="w-48 h-6 mb-8" />
             <Skeleton className="w-full h-64" />
          </div>
        </div>
      </div>
    );
  }

  // Calculate percentage change for Revenue
  const revDiff = monthlyRevenue - lastMonthRevenue;
  const revPercentChange = lastMonthRevenue > 0 ? (revDiff / lastMonthRevenue) * 100 : 0;
  const revIsPositive = revPercentChange >= 0;

  const handleExportCSV = () => {
    if (recentTxs.length === 0) {
      toast.error("No data to export");
      return;
    }
    const headers = "Date,Reference,Customer,Amount\n";
    const rows = recentTxs.map(tx => {
      const date = new Date(tx.timestamp?.seconds ? tx.timestamp.seconds * 1000 : tx.timestamp).toLocaleDateString();
      return `${date},${tx.custom_doc_no || tx.transaction_id},${tx.customer_id},${tx.total_amount}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LedgerX_Report_${new Date().toLocaleDateString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };
  
  const displayChartData = dateFilter === 'LAST_7' ? chartData.slice(-7) : chartData;

  return (
    <div className="max-w-container-max mx-auto h-[calc(100dvh-4rem)] overflow-y-auto pr-2 pb-10">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 mt-2">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary">Analytics Overview</h2>
          <p className="text-secondary font-body-md mt-1">Real-time performance metrics for your enterprise operations.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setDateFilter(dateFilter === 'LAST_7' ? 'MONTH' : 'LAST_7')}
            className={`px-4 py-2 border rounded flex items-center gap-2 transition-colors ${dateFilter === 'LAST_7' ? 'bg-surface-container-high border-outline text-primary' : 'border-outline-variant bg-surface-container-lowest text-secondary hover:bg-surface-container'}`}
          >
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            {dateFilter === 'LAST_7' ? 'Showing Last 7 Days' : 'Last 7 Days'}
          </button>
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-primary text-on-primary font-label-md rounded flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Report
          </button>
        </div>
      </div>

      {/* Bento Grid Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter mb-gutter">
        {/* Total Revenue Card */}
        <div className="col-span-12 md:col-span-4 bg-surface-container-lowest border border-outline-variant p-6 rounded-lg flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-surface-container-low flex items-center justify-center rounded">
              <span className="material-symbols-outlined text-primary text-[20px]" data-weight="fill">point_of_sale</span>
            </div>
            {lastMonthRevenue > 0 && (
              <span className={`${revIsPositive ? 'text-emerald-600' : 'text-error'} font-label-md flex items-center gap-1`}>
                <span className="material-symbols-outlined text-[14px]">
                  {revIsPositive ? 'trending_up' : 'trending_down'}
                </span>
                {revIsPositive ? '+' : ''}{revPercentChange.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="mt-6">
            <p className="text-secondary font-label-md uppercase tracking-wider mb-1">Total Revenue</p>
            <h3 className="font-headline-lg text-headline-lg text-primary">{formatCurrency(monthlyRevenue)}</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/30">
            <p className="text-[11px] text-on-primary-container">vs. {formatCurrency(lastMonthRevenue)} last month</p>
          </div>
        </div>

        {/* Total Pending Credit (Udhaar) */}
        <div className="col-span-12 md:col-span-4 bg-surface-container-lowest border border-outline-variant p-6 rounded-lg flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-error-container flex items-center justify-center rounded">
              <span className="material-symbols-outlined text-error text-[20px]" data-weight="fill">assignment_late</span>
            </div>
          </div>
          <div className="mt-6">
            <p className="text-secondary font-label-md uppercase tracking-wider mb-1">Total Pending Credit (Udhaar)</p>
            <h3 className="font-headline-lg text-headline-lg text-primary">{formatCurrency(totalUdhaar)}</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/30">
            <p className="text-[11px] text-on-primary-container">Total unpaid balances across all clients</p>
          </div>
        </div>

        {/* Total Inventory Value */}
        <div className="col-span-12 md:col-span-4 bg-surface-container-lowest border border-outline-variant p-6 rounded-lg flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-secondary-container flex items-center justify-center rounded">
              <span className="material-symbols-outlined text-on-secondary-container text-[20px]" data-weight="fill">inventory_2</span>
            </div>
            <span className="text-primary font-label-md flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">sync</span>
              Stable
            </span>
          </div>
          <div className="mt-6">
            <p className="text-secondary font-label-md uppercase tracking-wider mb-1">Total Inventory Value</p>
            <h3 className="font-headline-lg text-headline-lg text-primary">{formatCurrency(totalInventoryValue)}</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/30">
            <p className="text-[11px] text-on-primary-container">Total stock value currently held</p>
          </div>
        </div>

        {/* Custom SVG Line Chart replaced by Recharts AreaChart */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant p-6 rounded-lg hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="font-headline-md text-headline-md text-primary">Revenue Trends</h4>
              <p className="text-secondary text-body-md">Daily gross revenue comparison</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary"></span>
                <span className="text-label-md text-secondary">Current Period</span>
              </div>
            </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" opacity={0.5} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--color-secondary)', fontSize: 10 }}
                  minTickGap={20}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--color-primary)', fontWeight: 'bold' }}
                  labelStyle={{ color: 'var(--color-secondary)', marginBottom: '4px' }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="var(--color-primary)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* P&L Chart - Revenue vs Expenses */}
        <div className="col-span-12 bg-surface-container-lowest border border-outline-variant p-6 rounded-lg hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h4 className="font-headline-md text-headline-md text-primary">Profit & Loss Overview</h4>
              <p className="text-secondary text-body-md">Revenue vs. Expenses (last 6 months)</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary"></span><span className="text-secondary">Revenue</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-error"></span><span className="text-secondary">Expenses</span></div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-secondary)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--color-secondary)', marginBottom: '4px' }}
                  formatter={(value: number, name: string) => [
                    `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`,
                    name === 'revenue' ? 'Revenue' : 'Expenses'
                  ]}
                />
                <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Bar dataKey="expenses" fill="var(--color-error)" radius={[4, 4, 0, 0]} opacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Profit Summary Row */}
          <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-outline-variant/30">
            {plChartData.map(d => {
              const isProfit = d.profit >= 0;
              return (
                <div key={d.name} className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-secondary uppercase tracking-wider">{d.name}</span>
                  <span className={`text-xs font-bold ${isProfit ? 'text-emerald-600' : 'text-error'}`}>
                    {isProfit ? '+' : ''}₹{Math.abs(d.profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity Table (Asymmetric Span) */}
        <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out">
          <div className="p-6 border-b border-outline-variant">
            <h4 className="font-headline-md text-headline-md text-primary">Recent Transactions</h4>
            <p className="text-secondary text-body-md">Latest 5 ledger entries</p>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container-lowest">
                <tr>
                  <th className="text-left px-6 py-3 font-label-md text-secondary uppercase text-[10px] border-b border-outline-variant">Reference</th>
                  <th className="text-right px-6 py-3 font-label-md text-secondary uppercase text-[10px] border-b border-outline-variant">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {recentTxs.slice(0, 5).map(tx => (
                  <tr key={tx.transaction_id} className="hover:bg-surface-container-low transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-label-md text-primary font-bold">#{tx.custom_doc_no || tx.transaction_id.substring(0,8)}</p>
                      <p className="text-[11px] text-secondary mt-1">{tx.customer_id || 'Walk-in'}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-label-md text-primary">{formatCurrency(tx.total_amount)}</p>
                    </td>
                  </tr>
                ))}
                {recentTxs.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-8 text-center text-secondary text-sm">
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div 
            className="p-4 text-center font-label-md text-primary border-t border-outline-variant hover:bg-surface-container transition-colors uppercase tracking-widest text-[10px] cursor-pointer"
            onClick={() => onNavigate?.('TRANSACTIONS')}
          >
            View All Transactions
          </div>
        </div>

        {/* Pending Customers & Active Services Row */}
        <div className="col-span-12 lg:col-span-6 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out">
          <div className="p-6 border-b border-outline-variant">
            <h4 className="font-headline-md text-headline-md text-primary">Pending Payments</h4>
            <p className="text-secondary text-body-md">Customers with outstanding Udhaar</p>
          </div>
          <div className="flex-1 overflow-x-auto p-4 flex flex-col gap-3">
            {pendingCustomers.length === 0 ? (
              <div className="text-center py-4 text-secondary text-sm">No pending payments.</div>
            ) : pendingCustomers.map(c => (
              <div 
                key={c.customer_id} 
                className="flex justify-between items-center border border-outline-variant p-3 rounded bg-surface-container-lowest cursor-pointer hover:border-primary transition-colors"
                onClick={() => onNavigate?.('CRM', c.customer_id)}
              >
                <div>
                  <div className="font-bold text-primary text-body-md">{c.name}</div>
                  <div className="text-[11px] text-secondary">{c.phone}</div>
                </div>
                <div className="font-headline-md text-error font-bold">
                  {formatCurrency(c.udhaar_balance || 0)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out">
          <div className="p-6 border-b border-outline-variant">
            <h4 className="font-headline-md text-headline-md text-primary">Active Repairs</h4>
            <p className="text-secondary text-body-md">Latest ongoing repair jobs</p>
          </div>
          <div className="flex-1 overflow-x-auto p-4 flex flex-col gap-3">
            {activeJobCards.length === 0 ? (
              <div className="text-center py-4 text-secondary text-sm">No active repairs.</div>
            ) : activeJobCards.map(j => (
              <div 
                key={j.job_id} 
                className="flex justify-between items-start border border-outline-variant p-3 rounded bg-surface-container-lowest cursor-pointer hover:border-primary transition-colors"
                onClick={() => onNavigate?.('REPAIRS', j.job_id)}
              >
                <div>
                  <div className="font-bold text-primary text-body-md">{j.device}</div>
                  <div className="text-[11px] text-secondary">{j.customer_name} ({j.customer_phone})</div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-tight">
                  {j.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Operational Status (Contextual Card) */}
        <div className="col-span-12 bg-surface-container-lowest border border-outline-variant p-4 md:p-6 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <p className="text-body-md font-bold text-primary">System Operational</p>
            </div>
            <div className="h-4 w-[1px] bg-outline-variant"></div>
            <p className="text-secondary text-body-md">Last sync: Just now</p>
          </div>
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-secondary uppercase font-label-md">Active Store</span>
              <span className="text-body-md font-bold text-primary">LedgerX</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-secondary uppercase font-label-md">Pending UDHAAR</span>
              <span className="text-body-md font-bold text-primary">
                {formatCurrency(totalUdhaar)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
