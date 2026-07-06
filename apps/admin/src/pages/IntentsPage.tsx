import { Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { PersonalIntentDto } from "@travel/contracts";

import { Modal } from "../components/Modal";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { addCalendarDays, formatDate } from "../lib/format";

const intentStatus = {
  pending_follow_up: { label: "待跟进", tone: "warning" },
  communicating: { label: "沟通中", tone: "positive" },
  converted_to_order: { label: "已转订单", tone: "positive" },
  withdrawn_by_employee: { label: "用户已撤销", tone: "muted" },
  closed: { label: "已关闭", tone: "muted" },
} as const;

export function IntentsPage() {
  const { currentOperator, data, execute } = useAdminData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [convertingAssignee, setConvertingAssignee] = useState("");
  const [error, setError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const activeOperators = data.operatorAccounts.filter(
    ({ status }) => status === "active",
  );

  const {
    items: intents,
    pagination,
    setPage,
  } = usePaginatedList<PersonalIntentDto>(
    "/api/admin/intents",
    {
      query: query.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    },
    data,
  );
  const processingIntent = intents.find(
    ({ id }) => id === processingId,
  );
  const convertingIntent = intents.find(
    ({ id }) => id === convertingId,
  );

  async function handleFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!processingId) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const internalNote = String(form.get("internalNote") ?? "").trim();

    try {
      await execute((service) =>
        service.updateIntentFollowUp({
          intentId: processingId,
          status: String(form.get("status")) as
            | "pending_follow_up"
            | "communicating",
          assigneeAccountId: assigneeDraft,
          ...(internalNote ? { internalNote } : {}),
        }),
      );
      setProcessingId(null);
      setPageMessage("意向跟进信息已保存。");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "保存意向失败",
      );
    }
  }

  async function closeIntent() {
    if (!processingId) {
      return;
    }

    try {
      await execute((service) =>
        service.closePersonalIntent({
          intentId: processingId,
          assigneeAccountId: assigneeDraft,
        }),
      );
      setProcessingId(null);
      setPageMessage("意向已关闭。");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "关闭意向失败",
      );
    }
  }

  async function handleConvert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!convertingId) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const departureDate = String(form.get("departureDate") ?? "").trim();
    const returnDate = String(form.get("returnDate") ?? "").trim();

    try {
      await execute((service) =>
        service.convertIntentToPendingOrder({
          intentId: convertingId,
          assigneeAccountId: convertingAssignee,
          plannedQuotaDeduction: Number(
            form.get("plannedQuotaDeduction"),
          ),
          servicePlan: String(form.get("servicePlan")),
          departureDate,
          returnDate,
        }),
      );
      setConvertingId(null);
      setPageMessage("意向已转为待确认订单，当前尚未扣减额度。");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "转订单失败",
      );
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>个人意向</h1>
          <p>意向用于收集员工需求，不代表订单成立，也不会扣减员工额度。</p>
        </div>
      </section>

      {pageMessage ? <div className="page-message">{pageMessage}</div> : null}

      <section className="filter-card">
        <label className="search-field">
          <Search size={17} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索员工或意向商品"
            value={query}
          />
        </label>
        <label className="select-field">
          <span>意向状态</span>
          <select
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="all">全部状态</option>
            {Object.entries(intentStatus).map(([value, status]) => (
              <option key={value} value={value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <h2>意向列表</h2>
          <span className="record-count">共 {pagination.total} 条意向</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>员工</th>
                <th>所属集团</th>
                <th>意向商品</th>
                <th>预计出行</th>
                <th>停留天数</th>
                <th>状态</th>
                <th>跟进人</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {intents.map((intent) => {
                const employee = data.employees.find(
                  ({ id }) => id === intent.employeeId,
                );
                const group = data.groups.find(
                  ({ id }) => id === employee?.groupId,
                );
                const product = data.serviceProducts.find(
                  ({ id }) => id === intent.productId,
                );
                const status = intentStatus[intent.status];
                const active = ["pending_follow_up", "communicating"].includes(
                  intent.status,
                );

                return (
                  <tr key={intent.id}>
                    <td>
                      <div className="primary-cell">
                        <strong>{employee?.name}</strong>
                        <span>{employee?.phone}</span>
                      </div>
                    </td>
                    <td>{group?.name}</td>
                    <td>{product?.name}</td>
                    <td>{formatDate(intent.expectedTravelDate)}</td>
                    <td>{intent.expectedStayDays} 天</td>
                    <td>
                      <StatusBadge tone={status.tone}>
                        {status.label}
                      </StatusBadge>
                    </td>
                    <td>
                      {data.operatorAccounts.find(
                        ({ id }) => id === intent.assigneeAccountId,
                      )?.displayName || "未指派"}
                    </td>
                    <td>
                      {active ? (
                        <button
                          className="table-action"
                          onClick={() => {
                            setError("");
                            setAssigneeDraft(
                              intent.assigneeAccountId ??
                                currentOperator?.id ??
                                "",
                            );
                            setProcessingId(intent.id);
                          }}
                          type="button"
                        >
                          处理
                        </button>
                      ) : (
                        <span className="muted-text">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination meta={pagination} onChange={setPage} />
      </section>

      <Modal
        description="内部备注仅后台人员可见。"
        footer={
          <>
            <button
              className="button button--danger-ghost"
              onClick={closeIntent}
              type="button"
            >
              关闭意向
            </button>
            <button
              className="button button--secondary"
              onClick={() => {
                if (!assigneeDraft) {
                  setError("跟进人不能为空");
                  return;
                }
                setConvertingAssignee(assigneeDraft);
                setProcessingId(null);
                setConvertingId(processingId);
              }}
              type="button"
            >
              转待确认订单
            </button>
            <button
              className="button button--primary"
              form="follow-up-intent-form"
              type="submit"
            >
              保存跟进
            </button>
          </>
        }
        onClose={() => setProcessingId(null)}
        open={Boolean(processingIntent)}
        title="处理个人意向"
      >
        <form
          className="form-grid"
          id="follow-up-intent-form"
          onSubmit={handleFollowUp}
        >
          <div className="detail-summary field--wide">
            <strong>
              {
                data.employees.find(
                  ({ id }) => id === processingIntent?.employeeId,
                )?.name
              }
            </strong>
            <span>
              {
                data.serviceProducts.find(
                  ({ id }) => id === processingIntent?.productId,
                )?.name
              }
            </span>
          </div>
          <label className="field">
            <span>跟进状态</span>
            <select
              defaultValue={processingIntent?.status}
              key={`${processingIntent?.id}-status`}
              name="status"
            >
              <option value="pending_follow_up">待跟进</option>
              <option value="communicating">沟通中</option>
            </select>
          </label>
          <label className="field">
            <span>跟进人</span>
            <select
              onChange={(event) => setAssigneeDraft(event.target.value)}
              required
              value={assigneeDraft}
            >
              <option value="">请选择跟进人</option>
              {activeOperators.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName}（{account.username}）
                </option>
              ))}
            </select>
          </label>
          <label className="field field--wide">
            <span>内部备注</span>
            <textarea
              defaultValue={processingIntent?.internalNote}
              key={`${processingIntent?.id}-note`}
              name="internalNote"
              rows={4}
            />
          </label>
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        description="转订单后先进入待确认状态，确认订单时才会扣减额度。"
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setConvertingId(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--primary"
              form="convert-order-form"
              type="submit"
            >
              转为待确认订单
            </button>
          </>
        }
        onClose={() => setConvertingId(null)}
        open={Boolean(convertingIntent)}
        title="意向转订单"
      >
        <form
          className="form-grid"
          id="convert-order-form"
          onSubmit={handleConvert}
        >
          <label className="field field--wide">
            <span>计划扣减额度</span>
            <input
              min="1"
              name="plannedQuotaDeduction"
              required
              type="number"
            />
          </label>
          <label className="field">
            <span>出行日期</span>
            <input
              defaultValue={convertingIntent?.expectedTravelDate}
              name="departureDate"
              required
              type="date"
            />
          </label>
          <label className="field">
            <span>返程日期</span>
            <input
              defaultValue={
                convertingIntent
                  ? addCalendarDays(
                      convertingIntent.expectedTravelDate,
                      convertingIntent.expectedStayDays - 1,
                    )
                  : undefined
              }
              name="returnDate"
              required
              type="date"
            />
          </label>
          <label className="field field--wide">
            <span>订单专属方案</span>
            <textarea
              name="servicePlan"
              placeholder="填写本次沟通确认后的服务内容"
              required
              rows={5}
            />
          </label>
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}
