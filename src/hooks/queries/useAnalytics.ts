import { useQuery } from '@tanstack/react-query';
import { getAnalyticsDashboardData } from '@/lib/firebase/api/analytics';

export const ANALYTICS_QUERY_KEY = 'analytics';

export const useAnalytics = (storeId: string | undefined, dateRange: number) => {
  return useQuery({
    queryKey: [ANALYTICS_QUERY_KEY, storeId, dateRange],
    queryFn: async () => {
      if (!storeId) return null;
      return getAnalyticsDashboardData(storeId, dateRange);
    },
    enabled: !!storeId,
  });
};
