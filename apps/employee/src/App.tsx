import { useEffect, useRef } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useEmployeeData } from "./context/EmployeeDataContext";
import { HomePage } from "./pages/HomePage";
import { IntentSubmissionPage } from "./pages/IntentSubmissionPage";
import { IntentsPage } from "./pages/IntentsPage";
import { LoginPage } from "./pages/LoginPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { QuotaPage } from "./pages/QuotaPage";

function RequireEmployeeLogin() {
  const { currentEmployee, isLoading } = useEmployeeData();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationEntry = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;
  const shouldReturnHomeRef = useRef(
    navigationEntry?.type === "reload" && location.pathname !== "/",
  );
  const shouldReturnHome =
    !isLoading &&
    Boolean(currentEmployee) &&
    shouldReturnHomeRef.current;

  useEffect(() => {
    if (shouldReturnHome) {
      shouldReturnHomeRef.current = false;
      navigate("/", { replace: true });
    }
  }, [navigate, shouldReturnHome]);

  if (isLoading) return null;
  if (shouldReturnHome) return null;
  return currentEmployee ? <Outlet /> : <Navigate replace to="/login" />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireEmployeeLogin />}>
        <Route index element={<HomePage />} />
        <Route
          path="/products/:productId"
          element={<ProductDetailPage />}
        />
        <Route
          path="/products/:productId/intent"
          element={<IntentSubmissionPage />}
        />
        <Route path="/intents" element={<IntentsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        <Route path="/quota" element={<QuotaPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}
