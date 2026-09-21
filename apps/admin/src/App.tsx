import type { AdminPagePermission } from "@travel/domain";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { AdminShell } from "./components/AdminShell";
import { EmployeesPage } from "./pages/EmployeesPage";
import { GroupsPage } from "./pages/GroupsPage";
import { HotelsPage } from "./pages/HotelsPage";
import { HotelDetailPage } from "./pages/HotelDetailPage";
import { IntentsPage } from "./pages/IntentsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { GroupQuotaPage } from "./pages/GroupQuotaPage";
import { LoginPage } from "./pages/LoginPage";
import { OperatorAccountsPage } from "./pages/OperatorAccountsPage";
import { useAdminData } from "./context/AdminDataContext";

const defaultRoutes: Array<{
  permission: AdminPagePermission;
  to: string;
}> = [
  { permission: "groups", to: "/groups" },
  { permission: "employees", to: "/employees" },
  { permission: "quotas", to: "/quotas" },
  { permission: "products", to: "/products" },
  { permission: "hotels", to: "/hotels" },
  { permission: "intents", to: "/intents" },
  { permission: "orders", to: "/orders" },
  { permission: "reviews", to: "/reviews" },
  { permission: "operator_accounts", to: "/operator-accounts" },
];

function RequireLogin() {
  const { currentOperator, isLoading } = useAdminData();
  if (isLoading) return null;
  return currentOperator ? <Outlet /> : <Navigate replace to="/login" />;
}

function PermissionRoute({
  permission,
}: {
  permission: AdminPagePermission;
}) {
  const { hasPermission } = useAdminData();
  return hasPermission(permission) ? <Outlet /> : <Navigate replace to="/" />;
}

function DefaultRoute() {
  const { hasPermission } = useAdminData();
  const route = defaultRoutes.find(({ permission }) =>
    hasPermission(permission),
  );
  return route ? (
    <Navigate replace to={route.to} />
  ) : (
    <section className="empty-selection">
      <strong>当前账号没有可访问的后台页面</strong>
    </section>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireLogin />}>
        <Route element={<AdminShell />}>
          <Route index element={<DefaultRoute />} />
          <Route element={<PermissionRoute permission="groups" />}>
            <Route path="/groups" element={<GroupsPage />} />
          </Route>
          <Route element={<PermissionRoute permission="employees" />}>
            <Route path="/employees" element={<EmployeesPage />} />
          </Route>
          <Route element={<PermissionRoute permission="quotas" />}>
            <Route path="/quotas" element={<GroupQuotaPage />} />
          </Route>
          <Route element={<PermissionRoute permission="products" />}>
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:productId" element={<ProductDetailPage />} />
          </Route>
          <Route element={<PermissionRoute permission="hotels" />}>
            <Route path="/hotels" element={<HotelsPage />} />
            <Route path="/hotels/:hotelId" element={<HotelDetailPage />} />
          </Route>
          <Route element={<PermissionRoute permission="intents" />}>
            <Route path="/intents" element={<IntentsPage />} />
          </Route>
          <Route element={<PermissionRoute permission="orders" />}>
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          </Route>
          <Route element={<PermissionRoute permission="reviews" />}>
            <Route path="/reviews" element={<ReviewsPage />} />
          </Route>
          <Route element={<PermissionRoute permission="operator_accounts" />}>
            <Route
              path="/operator-accounts"
              element={<OperatorAccountsPage />}
            />
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Route>
    </Routes>
  );
}
