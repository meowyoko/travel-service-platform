import type { PublicOperatorAccount } from "@travel/contracts";
import type { AdminPagePermission } from "@travel/domain";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchAdminContext,
  loginAdmin,
  logoutAdmin,
  RemotePlatformService,
  restoreAdminSession,
  type AdminPlatformData,
} from "../lib/api";

interface AdminDataContextValue {
  data: AdminPlatformData;
  currentOperator: PublicOperatorAccount | null;
  isLoading: boolean;
  execute<TResult>(
    operation: (service: RemotePlatformService) => Promise<TResult>,
  ): Promise<TResult>;
  hasPermission(permission: AdminPagePermission): boolean;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refreshData(): Promise<void>;
  syncOrderStatuses(): Promise<number>;
}

const emptyData: AdminPlatformData = {
  operatorAccounts: [],
  groups: [],
  employees: [],
  quotaAccounts: [],
  serviceProducts: [],
  personalIntents: [],
  personalOrders: [],
  serviceReviews: [],
  quotaTransactions: [],
};

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ children }: PropsWithChildren) {
  const service = useMemo(() => new RemotePlatformService(), []);
  const [data, setData] = useState<AdminPlatformData>(emptyData);
  const [currentOperator, setCurrentOperator] =
    useState<PublicOperatorAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    setData(await fetchAdminContext());
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const account = await restoreAdminSession();
        const nextData = await fetchAdminContext();
        if (active) {
          setCurrentOperator(account);
          setData(nextData);
        }
      } catch {
        if (active) {
          setCurrentOperator(null);
          setData(emptyData);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AdminDataContextValue>(
    () => ({
      data,
      currentOperator,
      isLoading,
      execute: async <TResult,>(
        operation: (platformService: RemotePlatformService) => Promise<TResult>,
      ) => {
        const result = await operation(service);
        await refreshData();
        return result;
      },
      hasPermission: (permission) =>
        Boolean(
          currentOperator &&
            (currentOperator.role === "leader" ||
              currentOperator.pagePermissions.includes(permission)),
        ),
      login: async (username, password) => {
        const account = await loginAdmin(username, password);
        setCurrentOperator(account);
        await refreshData();
      },
      logout: async () => {
        try {
          await logoutAdmin();
        } finally {
          setCurrentOperator(null);
          setData(emptyData);
        }
      },
      refreshData,
      syncOrderStatuses: async () => {
        const updatedCount = await service.syncPersonalOrderStatuses();
        if (updatedCount > 0) {
          await refreshData();
        }
        return updatedCount;
      },
    }),
    [currentOperator, data, isLoading, refreshData, service],
  );

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData(): AdminDataContextValue {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData 必须在 AdminDataProvider 中使用");
  }
  return context;
}
