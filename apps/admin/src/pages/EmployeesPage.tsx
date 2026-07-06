import {
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  UserPlus,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import type { AdminEmployeeDto } from "@travel/contracts";

import { Modal } from "../components/Modal";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { formatQuota } from "../lib/format";

export function EmployeesPage() {
  const { data, execute } = useAdminData();
  const [modalOpen, setModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState<
    "single" | "batch" | null
  >(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importGroupId, setImportGroupId] = useState("");
  const [importRows, setImportRows] = useState<
    Array<{
      name: string;
      phone: string;
      password?: string;
      department?: string;
      employeeNumber?: string;
    }>
  >([]);
  const [importFileName, setImportFileName] = useState("");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [error, setError] = useState("");

  const {
    items: filteredEmployees,
    pagination,
    setPage,
  } = usePaginatedList<AdminEmployeeDto>(
    "/api/admin/employees",
    {
      query: query.trim() || undefined,
      groupId: groupFilter === "all" ? undefined : groupFilter,
    },
    data,
  );
  const editingEmployee = filteredEmployees.find(
    ({ id }) => id === editingId,
  );
  const deletingEmployee = filteredEmployees.find(
    ({ id }) => id === deletingId,
  );
  const deletingEmployeeHasOrders = data.personalOrders.some(
    ({ employeeId }) => employeeId === deletingId,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);
    const department = String(form.get("department") ?? "").trim();
    const employeeNumber = String(form.get("employeeNumber") ?? "").trim();

    try {
      await execute((service) =>
        service.createEmployee({
          name: String(form.get("name")),
          phone: String(form.get("phone")),
          password: String(form.get("password")),
          groupId: String(form.get("groupId")),
          ...(department ? { department } : {}),
          ...(employeeNumber ? { employeeNumber } : {}),
        }),
      );
      setModalOpen(false);
      setCreateMode(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "创建员工失败",
      );
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["员工姓名", "手机号", "初始密码", "部门", "员工编号"],
      ["示例员工", "13800138000", "123456", "综合管理部", "EMP-001"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "员工导入");
    const content = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const url = URL.createObjectURL(
      new Blob([content], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "员工批量导入模板.xlsx";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function handleImportFile(file?: File) {
    setError("");
    setImportRows([]);
    setImportFileName("");

    if (!file) {
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer());
      const worksheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];

      if (!worksheet) {
        throw new Error("Excel 文件中没有可读取的工作表");
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        { defval: "" },
      );
      const parsedRows = rows.map((row, index) => {
        const name = String(row["员工姓名"] ?? "").trim();
        const phone = String(row["手机号"] ?? "").trim();

        if (!name || !phone) {
          throw new Error(
            `第 ${index + 2} 行缺少员工姓名或手机号`,
          );
        }

        const department = String(row["部门"] ?? "").trim();
        const employeeNumber = String(row["员工编号"] ?? "").trim();
        const password = String(row["初始密码"] ?? "").trim();
        return {
          name,
          phone,
          ...(password ? { password } : {}),
          ...(department ? { department } : {}),
          ...(employeeNumber ? { employeeNumber } : {}),
        };
      });

      if (parsedRows.length === 0) {
        throw new Error("Excel 文件中没有员工数据");
      }

      setImportRows(parsedRows);
      setImportFileName(file.name);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "解析 Excel 失败",
      );
    }
  }

  async function handleBatchImport() {
    setError("");

    if (!importGroupId) {
      setError("请先选择员工所属集团");
      return;
    }

    try {
      await execute((service) =>
        service.createEmployeesBatch({
          groupId: importGroupId,
          employees: importRows,
        }),
      );
      setModalOpen(false);
      setCreateMode(null);
      setImportRows([]);
      setImportFileName("");
      setImportGroupId("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "批量导入失败",
      );
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!editingId) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const department = String(form.get("department") ?? "").trim();
    const employeeNumber = String(form.get("employeeNumber") ?? "").trim();
    const position = String(form.get("position") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();

    try {
      await execute((service) =>
        service.updateEmployee({
          employeeId: editingId,
          groupId: String(form.get("groupId")),
          status: String(form.get("status")) as "active" | "disabled",
          ...(department ? { department } : {}),
          ...(employeeNumber ? { employeeNumber } : {}),
          ...(position ? { position } : {}),
          ...(note ? { note } : {}),
        }),
      );
      setEditingId(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "编辑员工失败",
      );
    }
  }

  async function handleDelete() {
    if (!deletingId || deletingEmployeeHasOrders) {
      return;
    }

    try {
      await execute((service) => service.deleteEmployee(deletingId));
      setDeletingId(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "删除员工失败",
      );
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>员工管理</h1>
          <p>员工由后台统一创建，并严格归属于一个合作集团。</p>
        </div>
        <button
          className="button button--primary"
          onClick={() => {
            setError("");
            setCreateMode(null);
            setModalOpen(true);
          }}
          type="button"
        >
          <Plus size={17} />
          新增员工
        </button>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <div className="metric-card__icon">
            <UsersRound size={20} />
          </div>
          <span>员工总数</span>
          <strong>{pagination.total}</strong>
          <small>后台已录入账号</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--slate">
            <UserRoundCheck size={20} />
          </div>
          <span>正常账号</span>
          <strong>
            {data.employees.filter(({ status }) => status === "active").length}
          </strong>
          <small>可使用平台服务</small>
        </article>
      </section>

      <section className="filter-card">
        <label className="search-field">
          <Search size={17} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索姓名、手机号或员工编号"
            value={query}
          />
        </label>
        <label className="select-field">
          <span>所属集团</span>
          <select
            onChange={(event) => setGroupFilter(event.target.value)}
            value={groupFilter}
          >
            <option value="all">全部集团</option>
            {data.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <div>
            <h2>员工列表</h2>
          </div>
          <span className="record-count">
            共 {pagination.total} 名员工
          </span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>员工</th>
                <th>所属集团</th>
                <th>部门 / 编号</th>
                <th>当前可用额度</th>
                <th>账号状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const group = data.groups.find(
                  ({ id }) => id === employee.groupId,
                );
                const account = data.quotaAccounts.find(
                  ({ employeeId }) => employeeId === employee.id,
                );

                return (
                  <tr key={employee.id}>
                    <td>
                      <div className="primary-cell">
                        <strong>{employee.name}</strong>
                        <span>{employee.phone}</span>
                      </div>
                    </td>
                    <td>{group?.name}</td>
                    <td>
                      <div className="primary-cell">
                        <strong>{employee.department || "未填写部门"}</strong>
                        <span>{employee.employeeNumber || "暂无编号"}</span>
                      </div>
                    </td>
                    <td>
                      <strong className="quota-value">
                        {formatQuota(account?.availableBalance ?? 0)}
                      </strong>
                    </td>
                    <td>
                      <StatusBadge
                        tone={
                          employee.status === "active" ? "positive" : "muted"
                        }
                      >
                        {employee.status === "active" ? "正常" : "停用"}
                      </StatusBadge>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="table-action"
                          onClick={() => {
                            setError("");
                            setEditingId(employee.id);
                          }}
                          type="button"
                        >
                          编辑
                        </button>
                        <button
                          className="table-action table-action--danger"
                          onClick={() => {
                            setError("");
                            setDeletingId(employee.id);
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
        <Pagination meta={pagination} onChange={setPage} />
      </section>

      <Modal
        description={
          createMode === "batch"
            ? "批量导入前必须选择集团；未填写初始密码时默认使用 123456。"
            : "手机号作为登录账号，新员工同时建立零余额额度账户。"
        }
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => {
                if (createMode) {
                  setCreateMode(null);
                  setError("");
                } else {
                  setModalOpen(false);
                }
              }}
              type="button"
            >
              {createMode ? "返回" : "取消"}
            </button>
            {createMode === "single" ? (
              <button
                className="button button--primary"
                form="create-employee-form"
                type="submit"
              >
                创建员工
              </button>
            ) : null}
            {createMode === "batch" ? (
              <button
                className="button button--primary"
                disabled={importRows.length === 0}
                onClick={handleBatchImport}
                type="button"
              >
                导入 {importRows.length || ""} 名员工
              </button>
            ) : null}
          </>
        }
        onClose={() => {
          setModalOpen(false);
          setCreateMode(null);
        }}
        open={modalOpen}
        title={
          createMode === "single"
            ? "新增单个员工"
            : createMode === "batch"
              ? "批量导入员工"
              : "选择新增方式"
        }
      >
        {createMode === null ? (
          <div className="choice-grid">
            <button
              className="choice-card"
              onClick={() => setCreateMode("single")}
              type="button"
            >
              <UserPlus size={24} />
              <strong>新增单个员工</strong>
              <span>逐个填写员工资料并创建账号</span>
            </button>
            <button
              className="choice-card"
              onClick={() => setCreateMode("batch")}
              type="button"
            >
              <FileSpreadsheet size={24} />
              <strong>批量导入员工</strong>
              <span>使用固定格式 Excel 一次导入多人</span>
            </button>
          </div>
        ) : null}

        {createMode === "single" ? (
          <form
            className="form-grid"
            id="create-employee-form"
            onSubmit={handleSubmit}
          >
            <label className="field">
              <span>员工姓名</span>
              <input name="name" placeholder="请输入姓名" required />
            </label>
            <label className="field">
              <span>手机号</span>
              <input name="phone" placeholder="作为登录凭证" required />
            </label>
            <label className="field field--wide">
              <span>所属集团</span>
              <select defaultValue="" name="groupId" required>
                <option disabled value="">
                  请选择集团
                </option>
                {data.groups
                  .filter(({ status }) => status === "active")
                  .map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>初始密码</span>
              <input
                minLength={6}
                name="password"
                placeholder="至少 6 位"
                required
                type="password"
              />
            </label>
            <label className="field">
              <span>部门</span>
              <input name="department" placeholder="可选" />
            </label>
            <label className="field">
              <span>员工编号</span>
              <input name="employeeNumber" placeholder="可选" />
            </label>
            {error ? <p className="form-error field--wide">{error}</p> : null}
          </form>
        ) : null}

        {createMode === "batch" ? (
          <div className="batch-import">
            <div className="batch-import__toolbar">
              <label className="field">
                <span>所属集团</span>
                <select
                  onChange={(event) => setImportGroupId(event.target.value)}
                  value={importGroupId}
                >
                  <option value="">请选择集团</option>
                  {data.groups
                    .filter(({ status }) => status === "active")
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                className="button button--secondary"
                onClick={() => void downloadTemplate()}
                type="button"
              >
                <Download size={16} />
                下载导入模板
              </button>
            </div>
            <label className="file-drop">
              <FileSpreadsheet size={24} />
              <strong>{importFileName || "选择 Excel 文件"}</strong>
              <span>支持固定格式 .xlsx 文件</span>
              <input
                accept=".xlsx"
                onChange={(event) =>
                  void handleImportFile(event.target.files?.[0])
                }
                type="file"
              />
            </label>
            {importRows.length > 0 ? (
              <div className="import-preview">
                <strong>已读取 {importRows.length} 名员工</strong>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>员工姓名</th>
                        <th>手机号</th>
                        <th>初始密码</th>
                        <th>部门</th>
                        <th>员工编号</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 5).map((row) => (
                        <tr key={row.phone}>
                          <td>{row.name}</td>
                          <td>{row.phone}</td>
                          <td>{row.password ? "已设置" : "默认 123456"}</td>
                          <td>{row.department || "—"}</td>
                          <td>{row.employeeNumber || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {error ? <p className="form-error">{error}</p> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        description="姓名和手机号属于员工身份信息，不能修改；如需变更请删除后重建。"
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
              form="edit-employee-form"
              type="submit"
            >
              保存修改
            </button>
          </>
        }
        onClose={() => setEditingId(null)}
        open={Boolean(editingEmployee)}
        title="编辑员工"
      >
        <form
          className="form-grid"
          id="edit-employee-form"
          onSubmit={handleEdit}
        >
          <label className="field">
            <span>员工姓名（不可修改）</span>
            <input disabled value={editingEmployee?.name ?? ""} />
          </label>
          <label className="field">
            <span>手机号（不可修改）</span>
            <input disabled value={editingEmployee?.phone ?? ""} />
          </label>
          <label className="field field--wide">
            <span>所属集团</span>
            <select defaultValue={editingEmployee?.groupId} name="groupId">
              {data.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>部门</span>
            <input
              defaultValue={editingEmployee?.department}
              name="department"
            />
          </label>
          <label className="field">
            <span>员工编号</span>
            <input
              defaultValue={editingEmployee?.employeeNumber}
              name="employeeNumber"
            />
          </label>
          <label className="field">
            <span>职位 / 职级</span>
            <input
              defaultValue={editingEmployee?.position}
              name="position"
            />
          </label>
          <label className="field">
            <span>账号状态</span>
            <select defaultValue={editingEmployee?.status} name="status">
              <option value="active">正常</option>
              <option value="disabled">停用</option>
            </select>
          </label>
          <label className="field field--wide">
            <span>内部备注</span>
            <textarea
              defaultValue={editingEmployee?.note}
              name="note"
              rows={3}
            />
          </label>
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        description="员工姓名和手机号不能直接修改，如需变更只能删除后重建。"
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setDeletingId(null)}
              type="button"
            >
              取消
            </button>
            {!deletingEmployeeHasOrders ? (
              <button
                className="button button--danger"
                onClick={handleDelete}
                type="button"
              >
                确认删除
              </button>
            ) : null}
          </>
        }
        onClose={() => setDeletingId(null)}
        open={Boolean(deletingEmployee)}
        title={`删除员工：${deletingEmployee?.name ?? ""}`}
      >
        {deletingEmployeeHasOrders ? (
          <div className="warning-panel">
            该员工已有个人订单，一期硬性禁止删除。
          </div>
        ) : (
          <div className="warning-panel">
            删除后将同时清理该员工的额度账户、意向及额度流水，确认继续吗？
          </div>
        )}
        {error ? <p className="form-error">{error}</p> : null}
      </Modal>
    </>
  );
}
