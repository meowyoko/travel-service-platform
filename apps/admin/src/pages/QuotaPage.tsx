import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Plus,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import { type FormEvent, useState } from "react";

import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import { formatDate, formatQuota } from "../lib/format";

const transactionMeta = {
  grant: { label: "发放", tone: "positive", icon: ArrowDownLeft },
  deduction: { label: "扣减", tone: "warning", icon: ArrowUpRight },
  refund: { label: "退回", tone: "positive", icon: RotateCcw },
  adjustment: { label: "调整", tone: "muted", icon: CircleDollarSign },
} as const;

export function QuotaPage() {
  const { currentOperator, data, execute } = useAdminData();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");

  const totals = data.quotaAccounts.reduce(
    (sum, account) => ({
      granted: sum.granted + account.totalGranted,
      available: sum.available + account.availableBalance,
      consumed:
        sum.consumed + account.totalDeducted - account.totalRefunded,
    }),
    { granted: 0, available: 0, consumed: 0 },
  );
  const selectedEmployee = data.employees.find(
    ({ id }) => id === selectedEmployeeId,
  );

  function handleGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedEmployeeId) {
      return;
    }

    const form = new FormData(event.currentTarget);

    try {
      execute((service) =>
        service.grantQuota({
          employeeId: selectedEmployeeId,
          amount: Number(form.get("amount")),
          reason: String(form.get("reason")),
          operator: currentOperator?.username ?? "unknown",
        }),
      );
      setSelectedEmployeeId(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "发放额度失败",
      );
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>额度管理</h1>
          <p>额度是集团员工的虚拟权益，不代表线上真实支付金额。</p>
        </div>
      </section>

      <section className="metric-grid metric-grid--three">
        <article className="metric-card">
          <div className="metric-card__icon">
            <CircleDollarSign size={20} />
          </div>
          <span>累计发放额度</span>
          <strong>{formatQuota(totals.granted)}</strong>
          <small>所有发放流水合计</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--slate">
            <WalletCards size={20} />
          </div>
          <span>当前可用额度</span>
          <strong>{formatQuota(totals.available)}</strong>
          <small>员工账户余额合计</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--soft">
            <ArrowUpRight size={20} />
          </div>
          <span>最终消耗额度</span>
          <strong>{formatQuota(totals.consumed)}</strong>
          <small>已扣减额度减已退回额度</small>
        </article>
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <div>
            <h2>员工额度账户</h2>
          </div>
          <span className="record-count">
            共 {data.quotaAccounts.length} 个账户
          </span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>员工</th>
                <th>累计发放</th>
                <th>已扣减</th>
                <th>已退回</th>
                <th>当前可用</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.quotaAccounts.map((account) => {
                const employee = data.employees.find(
                  ({ id }) => id === account.employeeId,
                );

                return (
                  <tr key={account.id}>
                    <td>
                      <div className="primary-cell">
                        <strong>{employee?.name}</strong>
                        <span>{employee?.phone}</span>
                      </div>
                    </td>
                    <td>{formatQuota(account.totalGranted)}</td>
                    <td>{formatQuota(account.totalDeducted)}</td>
                    <td>{formatQuota(account.totalRefunded)}</td>
                    <td>
                      <strong className="quota-value">
                        {formatQuota(account.availableBalance)}
                      </strong>
                    </td>
                    <td>
                      <button
                        className="table-action"
                        onClick={() => {
                          setError("");
                          setSelectedEmployeeId(account.employeeId);
                        }}
                        type="button"
                      >
                        <Plus size={15} />
                        发放额度
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <div>
            <h2>最近额度流水</h2>
          </div>
          <span className="record-count">
            共 {data.quotaTransactions.length} 条流水
          </span>
        </div>

        <div className="transaction-list">
          {[...data.quotaTransactions]
            .sort((left, right) =>
              right.occurredAt.localeCompare(left.occurredAt),
            )
            .map((transaction) => {
              const employee = data.employees.find(
                ({ id }) => id === transaction.employeeId,
              );
              const meta = transactionMeta[transaction.type];
              const Icon = meta.icon;

              return (
                <article className="transaction-row" key={transaction.id}>
                  <div className="transaction-row__icon">
                    <Icon size={17} />
                  </div>
                  <div className="transaction-row__main">
                    <div>
                      <strong>{employee?.name}</strong>
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </div>
                    <span>{transaction.reason}</span>
                  </div>
                  <div className="transaction-row__amount">
                    <strong>
                      {transaction.amount > 0 ? "+" : ""}
                      {formatQuota(transaction.amount)}
                    </strong>
                    <span>{formatDate(transaction.occurredAt)}</span>
                  </div>
                </article>
              );
            })}
        </div>
      </section>

      <Modal
        description={`为 ${selectedEmployee?.name ?? "员工"} 增加可用额度，并自动生成发放流水。`}
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setSelectedEmployeeId(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--primary"
              form="grant-quota-form"
              type="submit"
            >
              确认发放
            </button>
          </>
        }
        onClose={() => setSelectedEmployeeId(null)}
        open={Boolean(selectedEmployeeId)}
        title="发放额度"
      >
        <form
          className="form-grid"
          id="grant-quota-form"
          onSubmit={handleGrant}
        >
          <label className="field field--wide">
            <span>发放额度</span>
            <input min="1" name="amount" placeholder="请输入额度数值" required type="number" />
          </label>
          <label className="field field--wide">
            <span>发放原因</span>
            <textarea
              name="reason"
              placeholder="例如：2026年度员工疗养额度发放"
              required
              rows={3}
            />
          </label>
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}
