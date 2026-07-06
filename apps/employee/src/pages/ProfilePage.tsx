import {
  Building2,
  ChevronRight,
  ClipboardList,
  IdCard,
  LockKeyhole,
  LogOut,
  Phone,
  Star,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { EmployeeBottomNav } from "../components/EmployeeBottomNav";
import { EmployeeSummaryHeader } from "../components/EmployeeSummaryHeader";
import { useEmployeeData } from "../context/EmployeeDataContext";

const PROFILE_ENTRIES = [
  {
    label: "我的额度",
    description: "查看额度余额与变动明细",
    path: "/quota",
    icon: WalletCards,
  },
  {
    label: "我的意向",
    description: "查看已提交的服务意向",
    path: "/intents",
    icon: ClipboardList,
  },
  {
    label: "我的评价",
    description: "查看服务评分与审核状态",
    path: "/reviews",
    icon: Star,
  },
  {
    label: "我的订单",
    description: "查看订单与行程安排",
    path: "/orders",
    icon: IdCard,
  },
] as const;

export function ProfilePage() {
  const navigate = useNavigate();
  const { currentEmployee, currentGroup, logout } = useEmployeeData();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  async function confirmLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <main className="profile-page">
      <EmployeeSummaryHeader />

      <section className="profile-content">
        <section className="profile-identity">
          <div aria-hidden="true">
            <UserRound size={27} strokeWidth={1.6} />
          </div>
          <span>
            <small>员工账号</small>
            <h1>{currentEmployee?.name ?? "员工"}</h1>
            <p>
              {currentEmployee?.department ?? "部门信息待完善"}
              {currentEmployee?.position
                ? ` · ${currentEmployee.position}`
                : ""}
            </p>
          </span>
        </section>

        <section className="profile-section">
          <h2>个人信息</h2>
          <div className="profile-info-card">
            <div>
              <span>
                <Phone size={16} />
                手机号
              </span>
              <strong>{currentEmployee?.phone ?? "—"}</strong>
            </div>
            <div>
              <span>
                <Building2 size={16} />
                所属集团
              </span>
              <strong>{currentGroup?.name ?? "—"}</strong>
            </div>
            <div>
              <span>
                <IdCard size={16} />
                员工编号
              </span>
              <strong>{currentEmployee?.employeeNumber ?? "未填写"}</strong>
            </div>
          </div>
        </section>

        <section className="profile-section">
          <h2>常用功能</h2>
          <div className="profile-entry-list">
            {PROFILE_ENTRIES.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.path}
                  onClick={() => navigate(entry.path)}
                  type="button"
                >
                  <span className="profile-entry-icon">
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong>{entry.label}</strong>
                    <small>{entry.description}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="profile-section">
          <h2>账号设置</h2>
          <div className="profile-account-actions">
            <button className="profile-password-action" disabled type="button">
              <LockKeyhole size={17} />
              <span>修改密码</span>
              <small>暂未开放</small>
            </button>
            <button
              className="profile-logout-action"
              onClick={() => setShowLogoutConfirm(true)}
              type="button"
            >
              <LogOut size={17} />
              退出登录
            </button>
          </div>
        </section>
      </section>

      {showLogoutConfirm ? (
        <div className="intent-confirm-backdrop" role="presentation">
          <section
            aria-labelledby="logout-confirm-title"
            aria-modal="true"
            className="intent-confirm profile-logout-confirm"
            role="dialog"
          >
            <h2 id="logout-confirm-title">确认退出登录？</h2>
            <p>退出后需要重新输入手机号和密码才能进入员工端。</p>
            <div>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                type="button"
              >
                暂不退出
              </button>
              <button onClick={confirmLogout} type="button">
                确认退出
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <EmployeeBottomNav active="profile" />
    </main>
  );
}
