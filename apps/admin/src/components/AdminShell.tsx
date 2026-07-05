import {
  Building2,
  CircleUserRound,
  ClipboardList,
  HeartHandshake,
  PackageSearch,
  Star,
  Send,
  LogOut,
  UserCog,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import type { AdminPagePermission } from "@travel/domain";

import { useAdminData } from "../context/AdminDataContext";

const navigation: Array<{
  to: string;
  label: string;
  icon: typeof Building2;
  permission: AdminPagePermission;
}> = [
  { to: "/groups", label: "集团管理", icon: Building2, permission: "groups" },
  { to: "/employees", label: "员工管理", icon: UsersRound, permission: "employees" },
  { to: "/quotas", label: "额度管理", icon: WalletCards, permission: "quotas" },
  { to: "/products", label: "服务商品", icon: PackageSearch, permission: "products" },
  { to: "/intents", label: "个人意向", icon: Send, permission: "intents" },
  { to: "/orders", label: "个人订单", icon: ClipboardList, permission: "orders" },
  { to: "/reviews", label: "评价管理", icon: Star, permission: "reviews" },
  { to: "/operator-accounts", label: "运营账号", icon: UserCog, permission: "operator_accounts" },
];

export function AdminShell() {
  const { currentOperator, hasPermission, logout } = useAdminData();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark" aria-hidden="true">
            <HeartHandshake size={22} strokeWidth={1.8} />
          </div>
          <div>
            <strong>疗养服务管理</strong>
            <span>企业康养管理系统</span>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="后台主导航">
          {navigation
            .filter(({ permission }) => hasPermission(permission))
            .map(({ to, label, icon: Icon }) => (
            <NavLink
              className={({ isActive }) =>
                `nav-item${isActive ? " nav-item--active" : ""}`
              }
              key={to}
              to={to}
            >
              <Icon size={19} strokeWidth={1.8} />
              <strong>{label}</strong>
            </NavLink>
            ))}
        </nav>

        <div className="sidebar__profile">
          <CircleUserRound size={30} strokeWidth={1.6} />
          <div>
            <strong>{currentOperator?.displayName}</strong>
            <span>
              {currentOperator?.role === "leader" ? "领导账号" : "职工账号"}
            </span>
          </div>
          <button
            aria-label="退出登录"
            className="sidebar__logout"
            onClick={logout}
            title="退出登录"
            type="button"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <strong>疗养服务管理平台</strong>
          <div className="topbar__status">
            <span className="status-dot" />
            Mock 数据已连接
          </div>
        </header>
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
