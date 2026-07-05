import { WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEmployeeData } from "../context/EmployeeDataContext";
import { formatQuota } from "../lib/format";

export function EmployeeSummaryHeader() {
  const navigate = useNavigate();
  const { currentGroup, quotaAccount } = useEmployeeData();

  return (
    <header className="employee-summary-header">
      <div className="employee-summary-group">
        <span>所属集团</span>
        <strong>{currentGroup?.name ?? "集团信息缺失"}</strong>
      </div>
      <button
        aria-label="查看我的额度"
        className="employee-summary-quota"
        onClick={() => navigate("/quota")}
        type="button"
      >
        <WalletCards size={17} />
        <span>
          <small>可用额度</small>
          <strong>{formatQuota(quotaAccount?.availableBalance ?? 0)}</strong>
        </span>
      </button>
    </header>
  );
}
