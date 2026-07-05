import { Building2, LogOut, WalletCards } from "lucide-react";

import { useEmployeeData } from "../context/EmployeeDataContext";

function formatQuota(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function AccountLandingPage() {
  const { currentEmployee, currentGroup, quotaAccount, logout } =
    useEmployeeData();

  return (
    <main className="landing-page">
      <header className="landing-header">
        <div>
          <span>欢迎回来</span>
          <h1>{currentEmployee?.name}</h1>
        </div>
        <button aria-label="退出登录" onClick={logout} type="button">
          <LogOut size={20} />
        </button>
      </header>

      <section className="account-card">
        <div>
          <Building2 size={20} />
          <span>所属集团</span>
        </div>
        <strong>{currentGroup?.name ?? "集团信息缺失"}</strong>
        <hr />
        <div>
          <WalletCards size={20} />
          <span>当前可用额度</span>
        </div>
        <strong className="quota-number">
          {formatQuota(quotaAccount?.availableBalance ?? 0)}
        </strong>
      </section>

      <section className="next-stage">
        <span>员工端已连接</span>
        <h2>精选服务首页将在下一阶段接入</h2>
        <p>当前已完成手机号密码登录、账号停用校验和会话保持。</p>
      </section>
    </main>
  );
}
