import {
  InMemoryPlatformRepository,
  PlatformService,
} from "@travel/application";
import type {
  AdminPagePermission,
  OperatorAccount,
  PlatformData,
} from "@travel/domain";
import { mockData } from "@travel/mock-data";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useCallback,
  useMemo,
  useState,
} from "react";

interface AdminDataContextValue {
  data: PlatformData;
  currentOperator: OperatorAccount | null;
  execute<TResult>(operation: (service: PlatformService) => TResult): TResult;
  hasPermission(permission: AdminPagePermission): boolean;
  login(username: string, password: string): void;
  logout(): void;
  syncOrderStatuses(): number;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ children }: PropsWithChildren) {
  const repository = useMemo(
    () => new InMemoryPlatformRepository(mockData),
    [],
  );
  const service = useMemo(() => new PlatformService(repository), [repository]);
  const [data, setData] = useState(() => repository.getSnapshot());
  const [currentOperatorId, setCurrentOperatorId] = useState<string | null>(
    () => sessionStorage.getItem("travel-admin-operator-id"),
  );
  const currentOperator =
    data.operatorAccounts.find(
      ({ id, status }) =>
        id === currentOperatorId && status === "active",
    ) ?? null;
  const syncOrderStatuses = useCallback(() => {
    const updatedCount = service.syncPersonalOrderStatuses();
    if (updatedCount > 0) {
      setData(repository.getSnapshot());
    }
    return updatedCount;
  }, [repository, service]);

  const value = useMemo<AdminDataContextValue>(
    () => ({
      data,
      currentOperator,
      execute: <TResult,>(
        operation: (platformService: PlatformService) => TResult,
      ) => {
        const result = operation(service);
        setData(repository.getSnapshot());
        return result;
      },
      hasPermission: (permission) =>
        Boolean(
          currentOperator &&
            (currentOperator.role === "leader" ||
              currentOperator.pagePermissions.includes(permission)),
        ),
      login: (username, password) => {
        const normalizedUsername = username.trim().toLowerCase();
        const account = repository
          .getSnapshot()
          .operatorAccounts.find(
            (candidate) =>
              candidate.username.toLowerCase() === normalizedUsername,
          );

        if (!account || account.password !== password) {
          throw new Error("用户名或密码错误");
        }
        if (account.status !== "active") {
          throw new Error("该运营账号已停用");
        }

        sessionStorage.setItem("travel-admin-operator-id", account.id);
        setCurrentOperatorId(account.id);
      },
      logout: () => {
        sessionStorage.removeItem("travel-admin-operator-id");
        setCurrentOperatorId(null);
      },
      syncOrderStatuses,
    }),
    [currentOperator, data, repository, service, syncOrderStatuses],
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
