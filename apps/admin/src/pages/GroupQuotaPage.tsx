import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckSquare,
  CircleDollarSign,
  Download,
  RotateCcw,
  Search,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import type {
  AdminEmployeeDto,
  QuotaTransactionDto,
} from "@travel/contracts";
import { Link, useSearchParams } from "react-router-dom";

import { Modal } from "../components/Modal";
import { ExportModal } from "../components/ExportModal";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { formatDate, formatQuota } from "../lib/format";

const transactionMeta = {
  grant: { label: "发放", tone: "positive", icon: ArrowDownLeft },
  deduction: { label: "扣减", tone: "warning", icon: ArrowUpRight },
  refund: { label: "退回", tone: "positive", icon: RotateCcw },
  adjustment: { label: "调整", tone: "muted", icon: CircleDollarSign },
} as const;

export function GroupQuotaPage() {
  const { currentOperator, data, execute } = useAdminData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedGroupId, setSelectedGroupId] = useState(
    () => searchParams.get("groupId") ?? "",
  );
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    new Set(),
  );
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [adjustingEmployeeId, setAdjustingEmployeeId] = useState<
    string | null
  >(null);
  const [refundOrderId, setRefundOrderId] = useState(() =>
    searchParams.get("action") === "refund"
      ? searchParams.get("orderId") ?? ""
      : "",
  );
  const [refundMode, setRefundMode] = useState<"full" | "partial">(
    "partial",
  );
  const [error, setError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [lastRefundedOrderId, setLastRefundedOrderId] = useState<
    string | null
  >(null);
  const [exportOpen, setExportOpen] = useState(false);

  const groupEmployees = useMemo(
    () =>
      data.employees.filter(
        (employee) => employee.groupId === selectedGroupId,
      ),
    [data.employees, selectedGroupId],
  );
  const departments = useMemo(
    () =>
      [...new Set(groupEmployees.map(({ department }) => department).filter(
        (department): department is string => Boolean(department),
      ))].sort(),
    [groupEmployees],
  );
  const matchingEmployees = useMemo(
    () =>
      groupEmployees.filter((employee) => {
        const matchesQuery =
          employee.name.includes(query.trim()) ||
          employee.phone.includes(query.trim()) ||
          employee.employeeNumber?.includes(query.trim());
        const matchesDepartment =
          departmentFilter === "all" ||
          employee.department === departmentFilter;
        return matchesQuery && matchesDepartment;
      }),
    [departmentFilter, groupEmployees, query],
  );
  const {
    items: pagedEmployees,
    pagination: employeePagination,
    setPage: setEmployeePage,
  } = usePaginatedList<AdminEmployeeDto>(
    "/api/admin/employees",
    {
      query: query.trim() || undefined,
      groupId: selectedGroupId || undefined,
      department:
        departmentFilter === "all" ? undefined : departmentFilter,
    },
    data,
  );
  const {
    items: pagedTransactions,
    pagination: transactionPagination,
    setPage: setTransactionPage,
  } = usePaginatedList<QuotaTransactionDto>(
    "/api/admin/quota-transactions",
    { groupId: selectedGroupId || undefined },
    data,
  );
  const groupAccounts = data.quotaAccounts.filter((account) =>
    groupEmployees.some(({ id }) => id === account.employeeId),
  );
  const totals = groupAccounts.reduce(
    (sum, account) => ({
      granted: sum.granted + account.totalGranted,
      available: sum.available + account.availableBalance,
      consumed:
        sum.consumed + account.totalDeducted - account.totalRefunded,
    }),
    { granted: 0, available: 0, consumed: 0 },
  );
  const selectedGroup = data.groups.find(({ id }) => id === selectedGroupId);
  const adjustingEmployee = data.employees.find(
    ({ id }) => id === adjustingEmployeeId,
  );
  const refundOrder = data.personalOrders.find(
    ({ id }) => id === refundOrderId,
  );
  const refundEmployee = data.employees.find(
    ({ id }) => id === refundOrder?.employeeId,
  );
  const remainingRefundableQuota = refundOrder
    ? refundOrder.deductedQuota - refundOrder.refundedQuota
    : 0;

  function closeRefundModal() {
    setRefundOrderId("");
    setRefundMode("partial");
    setError("");
    setSearchParams(selectedGroupId ? { groupId: selectedGroupId } : {});
  }

  function selectEmployees(employeeIds: string[]) {
    setSelectedEmployeeIds(
      new Set(
        employeeIds.filter((employeeId) =>
          groupEmployees.some(
            ({ id, status }) =>
              id === employeeId && status === "active",
          ),
        ),
      ),
    );
  }

  function toggleEmployee(employeeId: string) {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  }

  async function handleBatchGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);

    try {
      await execute((service) =>
        service.grantQuotaBatch({
          employeeIds: [...selectedEmployeeIds],
          amount: Number(form.get("amount")),
          reason: String(form.get("reason")),
          operator: currentOperator?.username ?? "unknown",
        }),
      );
      setGrantModalOpen(false);
      setSelectedEmployeeIds(new Set());
      setLastRefundedOrderId(null);
      setPageMessage(
        `已为 ${selectedEmployeeIds.size} 名员工发放额度并生成流水。`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "批量发放失败",
      );
    }
  }

  async function handleAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!adjustingEmployeeId) {
      return;
    }
    const form = new FormData(event.currentTarget);

    try {
      await execute((service) =>
        service.adjustQuota({
          employeeId: adjustingEmployeeId,
          amount: Number(form.get("amount")),
          reason: String(form.get("reason")),
          operator: currentOperator?.username ?? "unknown",
        }),
      );
      setPageMessage("员工额度已调整并生成调整流水。");
      setLastRefundedOrderId(null);
      setAdjustingEmployeeId(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "额度调整失败",
      );
    }
  }

  async function handleOrderRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!refundOrder) {
      return;
    }
    const form = new FormData(event.currentTarget);

    try {
      const amount =
        refundMode === "full"
          ? remainingRefundableQuota
          : Number(form.get("amount"));
      await execute((service) =>
        service.refundPersonalOrderQuota({
          orderId: refundOrder.id,
          amount,
          reason: String(form.get("reason")),
          internalNote: String(form.get("internalNote") ?? ""),
          operator: currentOperator?.username ?? "unknown",
        }),
      );
      setPageMessage(
        `订单 ${refundOrder.orderNumber} 已退回 ${formatQuota(amount)} 额度。`,
      );
      setLastRefundedOrderId(refundOrder.id);
      closeRefundModal();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "额度退回失败",
      );
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>额度管理</h1>
          <p>额度按集团组织员工进行管理，额度变化均生成可追溯流水。</p>
        </div>
        <button
          className="button button--secondary"
          onClick={() => setExportOpen(true)}
          type="button"
        >
          <Download size={17} />
          导出额度流水
        </button>
      </section>

      <section className="group-selector-card">
        <div className="group-selector-card__icon">
          <Building2 size={22} />
        </div>
        <div>
          <strong>选择需要管理额度的集团</strong>
          <span>选择集团后再查看员工账户并执行批量操作</span>
        </div>
        <select
          onChange={(event) => {
            setSelectedGroupId(event.target.value);
            setSearchParams(
              event.target.value ? { groupId: event.target.value } : {},
            );
            setDepartmentFilter("all");
            setQuery("");
            setSelectedEmployeeIds(new Set());
            setLastRefundedOrderId(null);
          }}
          value={selectedGroupId}
        >
          <option value="">请选择集团</option>
          {data.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </section>

      {selectedGroup ? (
        <>
          {pageMessage ? (
            <div className="page-message">
              {pageMessage}
              {lastRefundedOrderId ? (
                <Link
                  className="product-link"
                  to={`/orders/${lastRefundedOrderId}`}
                >
                  查看订单
                </Link>
              ) : null}
            </div>
          ) : null}
          <section className="metric-grid metric-grid--three">
            <article className="metric-card">
              <div className="metric-card__icon">
                <CircleDollarSign size={20} />
              </div>
              <span>累计发放额度</span>
              <strong>{formatQuota(totals.granted)}</strong>
              <small>{selectedGroup.name}</small>
            </article>
            <article className="metric-card">
              <div className="metric-card__icon metric-card__icon--slate">
                <WalletCards size={20} />
              </div>
              <span>当前可用额度</span>
              <strong>{formatQuota(totals.available)}</strong>
              <small>{groupEmployees.length} 名员工</small>
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

          <section className="filter-card quota-filter-card">
            <label className="search-field">
              <Search size={17} />
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索姓名、手机号或员工编号"
                value={query}
              />
            </label>
            <label className="select-field">
              <span>部门</span>
              <select
                onChange={(event) => {
                  setDepartmentFilter(event.target.value);
                  setSelectedEmployeeIds(new Set());
                }}
                value={departmentFilter}
              >
                <option value="all">全部部门</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <div className="selection-actions">
              <button
                className="button button--secondary"
                onClick={() =>
                  selectEmployees(groupEmployees.map(({ id }) => id))
                }
                type="button"
              >
                全选当前集团
              </button>
              <button
                className="button button--secondary"
                disabled={departmentFilter === "all"}
                onClick={() =>
                  selectEmployees(matchingEmployees.map(({ id }) => id))
                }
                type="button"
              >
                全选当前部门
              </button>
            </div>
          </section>

          <section className="content-card">
            <div className="content-card__header">
              <div>
                <h2>{selectedGroup.name} · 员工额度账户</h2>
                <span className="record-count">
                  已选择 {selectedEmployeeIds.size} 名员工
                </span>
              </div>
              <button
                className="button button--primary"
                disabled={selectedEmployeeIds.size === 0}
                onClick={() => {
                  setError("");
                  setGrantModalOpen(true);
                }}
                type="button"
              >
                <CheckSquare size={16} />
                批量管理额度
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="checkbox-cell">
                      <input
                        aria-label="选择当前筛选员工"
                        checked={
                          pagedEmployees.length > 0 &&
                          pagedEmployees
                            .filter(({ status }) => status === "active")
                            .every(({ id }) => selectedEmployeeIds.has(id))
                        }
                        onChange={(event) =>
                          event.target.checked
                            ? selectEmployees(
                                pagedEmployees.map(({ id }) => id),
                              )
                            : setSelectedEmployeeIds(new Set())
                        }
                        type="checkbox"
                      />
                    </th>
                    <th>员工</th>
                    <th>部门</th>
                    <th>累计发放</th>
                    <th>已扣减</th>
                    <th>已退回</th>
                    <th>累计调整</th>
                    <th>当前可用</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedEmployees.map((employee) => {
                    const account = data.quotaAccounts.find(
                      ({ employeeId }) => employeeId === employee.id,
                    );

                    return (
                      <tr key={employee.id}>
                        <td className="checkbox-cell">
                          <input
                            aria-label={`选择员工 ${employee.name}`}
                            checked={selectedEmployeeIds.has(employee.id)}
                            disabled={employee.status === "disabled"}
                            onChange={() => toggleEmployee(employee.id)}
                            type="checkbox"
                          />
                        </td>
                        <td>
                          <div className="primary-cell">
                            <strong>{employee.name}</strong>
                            <span>{employee.phone}</span>
                          </div>
                        </td>
                        <td>{employee.department || "未填写部门"}</td>
                        <td>{formatQuota(account?.totalGranted ?? 0)}</td>
                        <td>{formatQuota(account?.totalDeducted ?? 0)}</td>
                        <td>{formatQuota(account?.totalRefunded ?? 0)}</td>
                        <td>{formatQuota(account?.totalAdjusted ?? 0)}</td>
                        <td>
                          <strong className="quota-value">
                            {formatQuota(account?.availableBalance ?? 0)}
                          </strong>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="table-action"
                              disabled={employee.status === "disabled"}
                              onClick={() => {
                                setError("");
                                setAdjustingEmployeeId(employee.id);
                              }}
                              type="button"
                            >
                              调整
                            </button>
                            {data.personalOrders.some(
                              (order) =>
                                order.employeeId === employee.id &&
                                order.deductedQuota > order.refundedQuota,
                            ) ? (
                              <button
                                className="table-action table-action--primary"
                                onClick={() => {
                                  const order = data.personalOrders.find(
                                    (candidate) =>
                                      candidate.employeeId === employee.id &&
                                      candidate.deductedQuota >
                                        candidate.refundedQuota,
                                  );
                                  if (order) {
                                    setError("");
                                    setRefundMode("partial");
                                    setRefundOrderId(order.id);
                                  }
                                }}
                                type="button"
                              >
                                订单退回
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              meta={employeePagination}
              onChange={setEmployeePage}
            />
          </section>
        </>
      ) : (
        <section className="empty-selection">
          <UsersRound size={28} />
          <strong>尚未选择集团</strong>
          <span>选择集团后显示该集团员工的额度账户。</span>
        </section>
      )}

      <section className="content-card">
        <div className="content-card__header">
          <h2>最近额度流水</h2>
          <span className="record-count">
            共 {transactionPagination.total} 条流水
          </span>
        </div>
        <div className="transaction-list">
          {pagedTransactions.map((transaction) => {
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
        <Pagination
          meta={transactionPagination}
          onChange={setTransactionPage}
        />
      </section>

      <Modal
        description={`为已选择的 ${selectedEmployeeIds.size} 名员工统一发放额度，并分别生成额度流水。`}
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setGrantModalOpen(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--primary"
              form="batch-grant-quota-form"
              type="submit"
            >
              确认批量发放
            </button>
          </>
        }
        onClose={() => setGrantModalOpen(false)}
        open={grantModalOpen}
        title="批量管理额度"
      >
        <form
          className="form-grid"
          id="batch-grant-quota-form"
          onSubmit={handleBatchGrant}
        >
          <label className="field field--wide">
            <span>每人发放额度</span>
            <input min="1" name="amount" required type="number" />
          </label>
          <label className="field field--wide">
            <span>发放原因</span>
            <textarea
              name="reason"
              placeholder="例如：2026年度集团员工疗养额度发放"
              required
              rows={3}
            />
          </label>
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        description={
          adjustingEmployee
            ? `对 ${adjustingEmployee.name} 的可用额度进行人工增加或调减，并生成调整流水。`
            : ""
        }
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setAdjustingEmployeeId(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--primary"
              form="adjust-quota-form"
              type="submit"
            >
              确认调整
            </button>
          </>
        }
        onClose={() => setAdjustingEmployeeId(null)}
        open={Boolean(adjustingEmployee)}
        title="调整员工额度"
      >
        <form
          className="form-grid"
          id="adjust-quota-form"
          onSubmit={handleAdjustment}
        >
          <label className="field field--wide">
            <span>调整额度</span>
            <input
              name="amount"
              placeholder="增加填正数，调减填负数"
              required
              type="number"
            />
          </label>
          <label className="field field--wide">
            <span>调整原因</span>
            <textarea name="reason" required rows={3} />
          </label>
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        description={
          refundOrder
            ? `退回将关联订单 ${refundOrder.orderNumber}，并同步更新订单累计退回和最终消耗额度。`
            : ""
        }
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={closeRefundModal}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--primary"
              form="refund-order-quota-form"
              type="submit"
            >
              确认退回
            </button>
          </>
        }
        onClose={closeRefundModal}
        open={Boolean(refundOrder)}
        title="订单额度退回"
      >
        {refundOrder ? (
          <form
            className="form-grid"
            id="refund-order-quota-form"
            onSubmit={handleOrderRefund}
          >
            <div className="detail-summary field--wide">
              <strong>
                {refundEmployee?.name} · {refundOrder.productSnapshot.name}
              </strong>
              <span>
                剩余可退 {formatQuota(remainingRefundableQuota)}
              </span>
            </div>
            <label className="field field--wide">
              <span>退回订单</span>
              <select
                onChange={(event) => {
                  setError("");
                  setRefundMode("partial");
                  setRefundOrderId(event.target.value);
                }}
                value={refundOrder.id}
              >
                {data.personalOrders
                  .filter(
                    (order) =>
                      order.employeeId === refundOrder.employeeId &&
                      order.deductedQuota > order.refundedQuota,
                  )
                  .map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} · {order.productSnapshot.name} ·
                      可退{" "}
                      {formatQuota(
                        order.deductedQuota - order.refundedQuota,
                      )}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>退回类型</span>
              <select
                onChange={(event) =>
                  setRefundMode(event.target.value as "full" | "partial")
                }
                value={refundMode}
              >
                <option value="partial">部分退回</option>
                <option value="full">全额退回剩余额度</option>
              </select>
            </label>
            <label className="field">
              <span>本次退回额度</span>
              <input
                disabled={refundMode === "full"}
                key={`${refundOrder.id}-${refundMode}`}
                max={remainingRefundableQuota}
                min="1"
                name="amount"
                placeholder={
                  refundMode === "full"
                    ? String(remainingRefundableQuota)
                    : "请输入退回额度"
                }
                required={refundMode === "partial"}
                type="number"
              />
            </label>
            <label className="field field--wide">
              <span>退回原因</span>
              <textarea
                name="reason"
                placeholder="例如：订单取消、部分服务未使用"
                required
                rows={3}
              />
            </label>
            <label className="field field--wide">
              <span>内部备注（选填）</span>
              <textarea name="internalNote" rows={2} />
            </label>
            {error ? <p className="form-error field--wide">{error}</p> : null}
          </form>
        ) : null}
      </Modal>
      <ExportModal
        groups={data.groups}
        kind="quota-transactions"
        onClose={() => setExportOpen(false)}
        open={exportOpen}
      />
    </>
  );
}
