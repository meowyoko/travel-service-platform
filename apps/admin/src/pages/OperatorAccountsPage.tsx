import {
  ADMIN_PAGE_PERMISSIONS,
  type AdminPagePermission,
  type OperatorRole,
} from "@travel/domain";
import { Plus, UserCog } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import { formatDate } from "../lib/format";

const permissionLabels: Record<AdminPagePermission, string> = {
  groups: "集团管理",
  employees: "员工管理",
  quotas: "额度管理",
  products: "服务商品",
  intents: "个人意向",
  orders: "个人订单",
  reviews: "评价管理",
  operator_accounts: "运营账号",
};

const staffPermissions = ADMIN_PAGE_PERMISSIONS.filter(
  (permission) => permission !== "operator_accounts",
);

export function OperatorAccountsPage() {
  const { currentOperator, data, execute } = useAdminData();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [role, setRole] = useState<OperatorRole>("staff");
  const [permissions, setPermissions] = useState<AdminPagePermission[]>([
    "products",
    "intents",
    "orders",
  ]);
  const [error, setError] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  const editingAccount =
    editingId === "new"
      ? undefined
      : data.operatorAccounts.find(({ id }) => id === editingId);

  function openCreate() {
    setError("");
    setRole("staff");
    setPermissions(["products", "intents", "orders"]);
    setEditingId("new");
  }

  function openEdit(accountId: string) {
    const account = data.operatorAccounts.find(({ id }) => id === accountId);
    if (!account) {
      return;
    }
    setError("");
    setRole(account.role);
    setPermissions([...account.pagePermissions]);
    setEditingId(account.id);
  }

  function togglePermission(permission: AdminPagePermission) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((value) => value !== permission)
        : [...current, permission],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!currentOperator || !editingId) {
      return;
    }

    const form = new FormData(event.currentTarget);

    try {
      if (editingId === "new") {
        await execute((service) =>
          service.createOperatorAccount({
            actorAccountId: currentOperator.id,
            username: String(form.get("username")),
            password: String(form.get("password")),
            displayName: String(form.get("displayName")),
            role,
            pagePermissions: permissions,
          }),
        );
        setPageMessage("运营账号已创建。");
      } else {
        const newPassword = String(form.get("password") ?? "");
        await execute((service) =>
          service.updateOperatorAccount({
            actorAccountId: currentOperator.id,
            accountId: editingId,
            displayName: String(form.get("displayName")),
            role,
            status: String(form.get("status")) as "active" | "disabled",
            pagePermissions: permissions,
            ...(newPassword ? { newPassword } : {}),
          }),
        );
        setPageMessage("运营账号已更新。");
      }
      setEditingId(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "保存账号失败",
      );
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>运营账号</h1>
          <p>管理我方后台登录账号，并按页面配置普通职工的访问范围。</p>
        </div>
        <button
          className="button button--primary"
          onClick={openCreate}
          type="button"
        >
          <Plus size={17} />
          新增账号
        </button>
      </section>

      {pageMessage ? <div className="page-message">{pageMessage}</div> : null}

      <section className="content-card">
        <div className="content-card__header">
          <h2>账号列表</h2>
          <span className="record-count">
            共 {data.operatorAccounts.length} 个账号
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>账号</th>
                <th>角色</th>
                <th>页面权限</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.operatorAccounts.map((account) => (
                <tr key={account.id}>
                  <td>
                    <div className="primary-cell">
                      <strong>{account.displayName}</strong>
                      <span>{account.username}</span>
                    </div>
                  </td>
                  <td>{account.role === "leader" ? "领导账号" : "职工账号"}</td>
                  <td>
                    {account.role === "leader"
                      ? "全部页面"
                      : account.pagePermissions
                          .map((permission) => permissionLabels[permission])
                          .join("、") || "无"}
                  </td>
                  <td>
                    <StatusBadge
                      tone={account.status === "active" ? "positive" : "muted"}
                    >
                      {account.status === "active" ? "启用" : "停用"}
                    </StatusBadge>
                  </td>
                  <td>{formatDate(account.updatedAt)}</td>
                  <td>
                    <button
                      className="table-action"
                      onClick={() => openEdit(account.id)}
                      type="button"
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        description={
          editingId === "new"
            ? "用户名创建后不可修改；密码仅用于当前 Mock 原型。"
            : "留空密码表示不重置当前密码。"
        }
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
              form="operator-account-form"
              type="submit"
            >
              保存账号
            </button>
          </>
        }
        onClose={() => setEditingId(null)}
        open={Boolean(editingId)}
        title={editingId === "new" ? "新增运营账号" : "编辑运营账号"}
      >
        <form
          className="form-grid"
          id="operator-account-form"
          onSubmit={handleSubmit}
        >
          <div className="detail-summary field--wide">
            <UserCog size={18} />
            <span>页面权限只控制菜单和页面访问，不包含按钮级权限。</span>
          </div>
          <label className="field">
            <span>用户名</span>
            <input
              defaultValue={editingAccount?.username}
              disabled={editingId !== "new"}
              name="username"
              required={editingId === "new"}
            />
          </label>
          <label className="field">
            <span>{editingId === "new" ? "初始密码" : "重置密码"}</span>
            <input
              minLength={6}
              name="password"
              required={editingId === "new"}
              type="password"
            />
          </label>
          <label className="field">
            <span>显示姓名</span>
            <input
              defaultValue={editingAccount?.displayName}
              name="displayName"
              required
            />
          </label>
          <label className="field">
            <span>角色</span>
            <select
              onChange={(event) =>
                setRole(event.target.value as OperatorRole)
              }
              value={role}
            >
              <option value="leader">领导账号</option>
              <option value="staff">职工账号</option>
            </select>
          </label>
          {editingId !== "new" ? (
            <label className="field field--wide">
              <span>账号状态</span>
              <select
                defaultValue={editingAccount?.status}
                name="status"
              >
                <option value="active">启用</option>
                <option value="disabled">停用</option>
              </select>
            </label>
          ) : null}
          <fieldset
            className="checkbox-group field--wide"
            disabled={role === "leader"}
          >
            <legend>
              页面权限{role === "leader" ? "（领导默认全部）" : ""}
            </legend>
            {staffPermissions.map((permission) => (
              <label key={permission}>
                <input
                  checked={
                    role === "leader" || permissions.includes(permission)
                  }
                  onChange={() => togglePermission(permission)}
                  type="checkbox"
                />
                <span>{permissionLabels[permission]}</span>
              </label>
            ))}
          </fieldset>
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}
