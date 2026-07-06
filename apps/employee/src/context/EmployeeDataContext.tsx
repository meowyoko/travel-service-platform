import type {
  PersonalIntentDto,
  PersonalOrderDto,
  PublicEmployee,
  QuotaTransactionDto,
  ServiceProductDto,
  ServiceReviewDto,
  SubmitPersonalIntentRequest,
  SubmitOrderReviewRequest,
} from "@travel/contracts";
import type { QuotaAccount } from "@travel/domain";
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
  fetchEmployeeContext,
  loginEmployee,
  logoutEmployee,
  restoreEmployeeSession,
  submitIntent,
  submitOrderReview,
  withdrawIntent,
  type EmployeeContextData,
} from "../lib/api";

interface EmployeeDataContextValue {
  currentEmployee: PublicEmployee | null;
  currentGroup: EmployeeContextData["group"];
  quotaAccount: QuotaAccount | null;
  visibleProducts: ServiceProductDto[];
  intentProducts: ServiceProductDto[];
  personalIntents: PersonalIntentDto[];
  personalOrders: PersonalOrderDto[];
  personalReviews: ServiceReviewDto[];
  personalQuotaTransactions: Array<
    Omit<QuotaTransactionDto, "internalNote" | "operator">
  >;
  publishedReviews: ServiceReviewDto[];
  isLoading: boolean;
  login(phone: string, password: string): Promise<void>;
  logout(): Promise<void>;
  submitPersonalIntent(
    input: SubmitPersonalIntentRequest,
  ): Promise<PersonalIntentDto>;
  withdrawPersonalIntent(input: {
    intentId: string;
  }): Promise<PersonalIntentDto>;
  submitReview(
    orderId: string,
    input: SubmitOrderReviewRequest,
  ): Promise<ServiceReviewDto>;
}

const emptyData: Omit<EmployeeContextData, "employee"> = {
  group: null,
  quotaAccount: null,
  visibleProducts: [],
  personalIntents: [],
  personalOrders: [],
  personalReviews: [],
  publishedReviews: [],
  personalQuotaTransactions: [],
};

const EmployeeDataContext = createContext<EmployeeDataContextValue | null>(
  null,
);

export function EmployeeDataProvider({ children }: PropsWithChildren) {
  const [currentEmployee, setCurrentEmployee] =
    useState<PublicEmployee | null>(null);
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const context = await fetchEmployeeContext();
    setCurrentEmployee(context.employee);
    setData(context);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const employee = await restoreEmployeeSession();
        const context = await fetchEmployeeContext();
        if (active) {
          setCurrentEmployee(employee);
          setData(context);
        }
      } catch {
        if (active) {
          setCurrentEmployee(null);
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

  const intentProducts = useMemo(() => {
    const productIds = new Set(
      data.personalIntents.map(({ productId }) => productId),
    );
    return data.visibleProducts.filter(({ id }) => productIds.has(id));
  }, [data.personalIntents, data.visibleProducts]);

  const value = useMemo<EmployeeDataContextValue>(
    () => ({
      currentEmployee,
      currentGroup: data.group,
      quotaAccount: data.quotaAccount,
      visibleProducts: data.visibleProducts,
      intentProducts,
      personalIntents: data.personalIntents,
      personalOrders: data.personalOrders,
      personalReviews: data.personalReviews,
      personalQuotaTransactions: data.personalQuotaTransactions,
      publishedReviews: data.publishedReviews,
      isLoading,
      login: async (phone, password) => {
        const employee = await loginEmployee(phone, password);
        setCurrentEmployee(employee);
        await refreshData();
      },
      logout: async () => {
        try {
          await logoutEmployee();
        } finally {
          setCurrentEmployee(null);
          setData(emptyData);
        }
      },
      submitPersonalIntent: async (input) => {
        const intent = await submitIntent(input);
        await refreshData();
        return intent;
      },
      withdrawPersonalIntent: async ({ intentId }) => {
        const intent = await withdrawIntent(intentId);
        await refreshData();
        return intent;
      },
      submitReview: async (orderId, input) => {
        const review = await submitOrderReview(orderId, input);
        await refreshData();
        return review;
      },
    }),
    [currentEmployee, data, intentProducts, isLoading, refreshData],
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
