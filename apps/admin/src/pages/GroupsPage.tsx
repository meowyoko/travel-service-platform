import { Building2, Plus, UsersRound } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import { formatDate } from "../lib/format";

const groupStatus = {
  active: { label: "合作中", tone: "positive" },
  paused: { label: "已暂停", tone: "warning" },
  ended: { label: "已结束", tone: "muted" },
} as const;

export function GroupsPage() {
  const { data, execute } = useAdminData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [error, setError] = useState("");
  const activeGroups = data.groups.filter(({ status }) => status === "active");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);
    const note = String(form.get("note") ?? "").trim();

    try {
      execute((service) =>
        service.createGroup({
          name: String(form.get("name")),
          contactName: String(form.get("contactName")),
          contactPhone: String(form.get("contactPhone")),
          cooperationStartDate: String(form.get("cooperationStartDate")),
          ...(note ? { note } : {}),
        }),
      );
      setModalOpen(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "创建集团失败",
      );
    }
  }

  const editingGroup = data.groups.find(({ id }) => id === editingId);
  const deletingGroup = data.groups.find(({ id }) => id === deletingId);
  const deletingEmployeeCount = data.employees.filter(
    ({ groupId }) => groupId === deletingId,
  ).length;
  const deletingOrderCount = data.personalOrders.filter(
    ({ groupId }) => groupId === deletingId,
  ).length;

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!editingId) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const cooperationEndDate = String(
      form.get("cooperationEndDate") ?? "",
    ).trim();
    const note = String(form.get("note") ?? "").trim();

    try {
      execute((service) =>
        service.updateGroup({
          groupId: editingId,
          name: String(form.get("name")),
          contactName: String(form.get("contactName")),
          contactPhone: String(form.get("contactPhone")),
          cooperationStartDate: String(form.get("cooperationStartDate")),
          status: String(form.get("status")) as
            | "active"
            | "paused"
            | "ended",
          ...(cooperationEndDate ? { cooperationEndDate } : {}),
          ...(note ? { note } : {}),
        }),
      );
      setEditingId(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "编辑集团失败",
      );
    }
  }

  function handleDelete() {
    if (!deletingGroup) {
      return;
    }

    if (
      deletingEmployeeCount > 0 &&
      deleteConfirmText !== deletingGroup.name
    ) {
      setError("请输入完整集团名称以确认删除");
      return;
    }

    try {
      execute((service) => service.deleteGroup(deletingGroup.id));
      setDeletingId(null);
      setDeleteConfirmText("");
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "删除集团失败",
      );
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>集团管理</h1>
          <p>维护合作集团档案，员工归属和商品可见范围都以集团为基础。</p>
        </div>
        <button
          className="button button--primary"
          onClick={() => setModalOpen(true)}
          type="button"
        >
          <Plus size={17} />
          新增集团
        </button>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <div className="metric-card__icon">
            <Building2 size={20} />
          </div>
          <span>合作集团</span>
          <strong>{activeGroups.length}</strong>
          <small>当前处于合作状态</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--slate">
            <UsersRound size={20} />
          </div>
          <span>已录入员工</span>
          <strong>{data.employees.length}</strong>
          <small>全部集团员工合计</small>
        </article>
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <div>
            <h2>集团列表</h2>
          </div>
          <span className="record-count">共 {data.groups.length} 个集团</span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>集团名称</th>
                <th>联系人</th>
                <th>员工数量</th>
                <th>合作状态</th>
                <th>合作周期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.groups.map((group) => {
                const status = groupStatus[group.status];
                const employeeCount = data.employees.filter(
                  ({ groupId }) => groupId === group.id,
                ).length;

                return (
                  <tr key={group.id}>
                    <td>
                      <div className="primary-cell">
                        <strong>{group.name}</strong>
                        <span>{group.note || "集团合作档案"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="primary-cell">
                        <strong>{group.contactName}</strong>
                        <span>{group.contactPhone}</span>
                      </div>
                    </td>
                    <td>{employeeCount} 人</td>
                    <td>
                      <StatusBadge tone={status.tone}>
                        {status.label}
                      </StatusBadge>
                    </td>
                    <td>
                      {formatDate(group.cooperationStartDate)}
                      <span className="table-separator">—</span>
                      {formatDate(group.cooperationEndDate)}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="table-action"
                          onClick={() => {
                            setError("");
                            setEditingId(group.id);
                          }}
                          type="button"
                        >
                          编辑
                        </button>
                        <button
                          className="table-action table-action--danger"
                          onClick={() => {
                            setError("");
                            setDeleteConfirmText("");
                            setDeletingId(group.id);
                          }}
                          type="button"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        description="集团创建后即可录入员工并分配可用额度。"
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setModalOpen(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--primary"
              form="create-group-form"
              type="submit"
            >
              创建集团
            </button>
          </>
        }
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title="新增集团"
      >
        <form
          className="form-grid"
          id="create-group-form"
          onSubmit={handleSubmit}
        >
          <label className="field field--wide">
            <span>集团名称</span>
            <input name="name" placeholder="例如：远山能源集团" required />
          </label>
          <label className="field">
            <span>联系人</span>
            <input name="contactName" placeholder="集团对接人" required />
          </label>
          <label className="field">
            <span>联系电话</span>
            <input name="contactPhone" placeholder="请输入联系电话" required />
          </label>
          <label className="field field--wide">
            <span>合作开始时间</span>
            <input name="cooperationStartDate" required type="date" />
          </label>
          <label className="field field--wide">
            <span>内部备注</span>
            <textarea name="note" placeholder="可选，仅后台可见" rows={3} />
          </label>
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        description="集团名称、联系人、合作状态等信息可在此调整。"
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setEditingId(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--primary"
              form="edit-group-form"
              type="submit"
            >
              保存修改
            </button>
          </>
        }
        onClose={() => setEditingId(null)}
        open={Boolean(editingGroup)}
        title="编辑集团"
      >
        <form
          className="form-grid"
          id="edit-group-form"
          onSubmit={handleEdit}
        >
          <label className="field field--wide">
            <span>集团名称</span>
            <input defaultValue={editingGroup?.name} name="name" required />
          </label>
          <label className="field">
            <span>联系人</span>
            <input
              defaultValue={editingGroup?.contactName}
              name="contactName"
              required
            />
          </label>
          <label className="field">
            <span>联系电话</span>
            <input
              defaultValue={editingGroup?.contactPhone}
              name="contactPhone"
              required
            />
          </label>
          <label className="field">
            <span>合作开始时间</span>
            <input
              defaultValue={editingGroup?.cooperationStartDate}
              name="cooperationStartDate"
              required
              type="date"
            />
          </label>
          <label className="field">
            <span>合作结束时间</span>
            <input
              defaultValue={editingGroup?.cooperationEndDate}
              name="cooperationEndDate"
              type="date"
            />
          </label>
          <label className="field field--wide">
            <span>合作状态</span>
            <select defaultValue={editingGroup?.status} name="status">
              <option value="active">合作中</option>
              <option value="paused">已暂停</option>
              <option value="ended">已结束</option>
            </select>
          </label>
          <label className="field field--wide">
            <span>内部备注</span>
            <textarea
              defaultValue={editingGroup?.note}
              name="note"
              rows={3}
            />
          </label>
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        description="删除操作不可撤销。"
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setDeletingId(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--danger"
              onClick={handleDelete}
              type="button"
            >
              确认删除
            </button>
          </>
        }
        onClose={() => setDeletingId(null)}
        open={Boolean(deletingGroup)}
        title={`删除集团：${deletingGroup?.name ?? ""}`}
      >
        <div className="delete-confirmation">
          {deletingEmployeeCount > 0 ? (
            <>
              <div className="warning-panel">
                该集团已导入 {deletingEmployeeCount} 名员工，并存在{" "}
                {deletingOrderCount} 笔个人订单。删除集团会将员工相关的额度、
                意向、订单及其他业务数据一并删除。
              </div>
              <label className="field">
                <span>请输入集团名称进行二次确认</span>
                <input
                  onChange={(event) =>
                    setDeleteConfirmText(event.target.value)
                  }
                  placeholder={deletingGroup?.name}
                  value={deleteConfirmText}
                />
              </label>
            </>
          ) : (
            <p>该集团尚未导入员工，确认删除集团档案吗？</p>
          )}
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </Modal>
    </>
  );
}
