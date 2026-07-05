import {
  InMemoryPlatformRepository,
  PlatformService,
  type SubmitPersonalIntentInput,
  type WithdrawPersonalIntentInput,
} from "@travel/application";
import type {
  Employee,
  Group,
  PersonalIntent,
  PersonalOrder,
  QuotaAccount,
  QuotaTransaction,
  ServiceReview,
  ServiceProduct,
} from "@travel/domain";
import { mockData } from "@travel/mock-data";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from "react";

interface EmployeeDataContextValue {
  currentEmployee: Employee | null;
  currentGroup: Group | null;
  quotaAccount: QuotaAccount | null;
  visibleProducts: ServiceProduct[];
  intentProducts: ServiceProduct[];
  personalIntents: PersonalIntent[];
  personalOrders: PersonalOrder[];
  personalReviews: ServiceReview[];
  personalQuotaTransactions: QuotaTransaction[];
  publishedReviews: ServiceReview[];
  login(phone: string, password: string): void;
  logout(): void;
  submitPersonalIntent(
    input: Omit<SubmitPersonalIntentInput, "employeeId">,
  ): PersonalIntent;
  withdrawPersonalIntent(
    input: Omit<WithdrawPersonalIntentInput, "employeeId">,
  ): PersonalIntent;
}

const SESSION_KEY = "travel-employee-id";
const EmployeeDataContext = createContext<EmployeeDataContextValue | null>(
  null,
);

export function EmployeeDataProvider({ children }: PropsWithChildren) {
  const repository = useMemo(
    () => new InMemoryPlatformRepository(mockData),
    [],
  );
  const service = useMemo(() => new PlatformService(repository), [repository]);
  const [data, setData] = useState(() => repository.getSnapshot());
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(
    () => sessionStorage.getItem(SESSION_KEY),
  );
  const currentEmployee =
    data.employees.find(
      ({ id, status }) =>
        id === currentEmployeeId && status === "active",
    ) ?? null;
  const currentGroup =
    data.groups.find(({ id }) => id === currentEmployee?.groupId) ?? null;
  const quotaAccount =
    data.quotaAccounts.find(
      ({ employeeId }) => employeeId === currentEmployee?.id,
    ) ?? null;
  const visibleProducts = useMemo(
    () =>
      currentEmployee
        ? data.serviceProducts.filter(
            (product) =>
              product.status === "published" &&
              (product.visibility.scope === "all_groups" ||
                product.visibility.groupIds.includes(
                  currentEmployee.groupId,
                )),
          )
        : [],
    [currentEmployee, data.serviceProducts],
  );
  const publishedReviews = useMemo(
    () =>
      data.serviceReviews.filter(({ status }) => status === "published"),
    [data.serviceReviews],
  );
  const personalIntents = useMemo(
    () =>
      currentEmployee
        ? data.personalIntents.filter(
            ({ employeeId }) => employeeId === currentEmployee.id,
          )
        : [],
    [currentEmployee, data.personalIntents],
  );
  const intentProducts = useMemo(() => {
    const productIds = new Set(
      personalIntents.map(({ productId }) => productId),
    );
    return data.serviceProducts.filter(({ id }) => productIds.has(id));
  }, [data.serviceProducts, personalIntents]);
  const personalOrders = useMemo(
    () =>
      currentEmployee
        ? data.personalOrders.filter(
            ({ employeeId }) => employeeId === currentEmployee.id,
          )
        : [],
    [currentEmployee, data.personalOrders],
  );
  const personalReviews = useMemo(
    () =>
      currentEmployee
        ? data.serviceReviews.filter(
            ({ employeeId }) => employeeId === currentEmployee.id,
          )
        : [],
    [currentEmployee, data.serviceReviews],
  );
  const personalQuotaTransactions = useMemo(
    () =>
      currentEmployee
        ? data.quotaTransactions.filter(
            ({ employeeId }) => employeeId === currentEmployee.id,
          )
        : [],
    [currentEmployee, data.quotaTransactions],
  );

  const value = useMemo<EmployeeDataContextValue>(
    () => ({
      currentEmployee,
      currentGroup,
      quotaAccount,
      visibleProducts,
      intentProducts,
      personalIntents,
      personalOrders,
      personalReviews,
      personalQuotaTransactions,
      publishedReviews,
      login: (phone, password) => {
        const employee = service.authenticateEmployee({ phone, password });
        sessionStorage.setItem(SESSION_KEY, employee.id);
        setCurrentEmployeeId(employee.id);
      },
      logout: () => {
        sessionStorage.removeItem(SESSION_KEY);
        setCurrentEmployeeId(null);
      },
      submitPersonalIntent: (input) => {
        if (!currentEmployee) {
          throw new Error("请先登录后再提交意向");
        }

        const intent = service.submitPersonalIntent({
          ...input,
          employeeId: currentEmployee.id,
        });
        setData(repository.getSnapshot());
        return intent;
      },
      withdrawPersonalIntent: (input) => {
        if (!currentEmployee) {
          throw new Error("请先登录后再撤销意向");
        }

        const intent = service.withdrawPersonalIntent({
          ...input,
          employeeId: currentEmployee.id,
        });
        setData(repository.getSnapshot());
        return intent;
      },
    }),
    [
      currentEmployee,
      currentGroup,
      intentProducts,
      personalIntents,
      personalOrders,
      personalReviews,
      personalQuotaTransactions,
      publishedReviews,
      quotaAccount,
      repository,
      service,
      visibleProducts,
    ],
  );

  return (
    <EmployeeDataContext.Provider value={value}>
      {children}
    </EmployeeDataContext.Provider>
  );
}

export function useEmployeeData(): EmployeeDataContextValue {
  const context = useContext(EmployeeDataContext);
  if (!context) {
    throw new Error("useEmployeeData 必须在 EmployeeDataProvider 中使用");
  }
  return context;
}
