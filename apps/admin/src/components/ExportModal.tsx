import type { GroupDto } from "@travel/contracts";
import { type FormEvent, useEffect, useState } from "react";

import { downloadAdminExport } from "../lib/api";
import { Modal } from "./Modal";

type ExportKind = "intents" | "orders" | "quota-transactions";

interface ExportModalProps {
  groups: GroupDto[];
  kind: ExportKind;
  onClose(): void;
  open: boolean;
}

const kindMeta = {
  intents: {
    title: "导出个人意向",
    description: "按条件导出员工联系信息和意向明细。",
  },
  orders: {
    title: "导出订单对账明细",
    description: "按集团、确认时间、商品类型和订单状态导出。",
  },
  "quota-transactions": {
    title: "导出额度流水",
    description: "按集团、发生时间和流水类型导出。",
  },
} as const;

export function ExportModal({
  groups,
  kind,
  onClose,
  open,
}: ExportModalProps) {
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const meta = kindMeta[kind];

  useEffect(() => {
    if (open) setError("");
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dateFrom = String(form.get("dateFrom") ?? "");
    const dateTo = String(form.get("dateTo") ?? "");
    if (dateFrom && dateTo && dateTo < dateFrom) {
      setError("结束日期不能早于开始日期");
      return;
    }
    setError("");
    setExporting(true);
    try {
      await downloadAdminExport(kind, {
        groupId: String(form.get("groupId") ?? ""),
        status: String(form.get("status") ?? ""),
        type: String(form.get("type") ?? ""),
        query: String(form.get("query") ?? "").trim(),
        dateFrom,
        dateTo,
      });
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal
      description={meta.description}
      footer={
        <>
          <button
            className="button button--secondary"
            disabled={exporting}
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="button button--primary"
            disabled={exporting}
            form={`${kind}-export-form`}
            type="submit"
          >
            {exporting ? "正在生成…" : "导出 Excel"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={meta.title}
    >
      <form
        className="form-grid"
        id={`${kind}-export-form`}
        onSubmit={handleSubmit}
      >
        <label className="field field--wide">
          <span>集团</span>
          <select name="groupId">
            <option value="">全部集团</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{kind === "orders" ? "确认开始日期" : "开始日期"}</span>
          <input name="dateFrom" type="date" />
        </label>
        <label className="field">
          <span>{kind === "orders" ? "确认结束日期" : "结束日期"}</span>
          <input name="dateTo" type="date" />
        </label>
        {kind === "intents" ? (
          <>
            <label className="field">
              <span>意向状态</span>
              <select name="status">
                <option value="">全部状态</option>
                <option value="pending_follow_up">待跟进</option>
                <option value="communicating">沟通中</option>
                <option value="converted_to_order">已转订单</option>
                <option value="withdrawn_by_employee">用户已撤销</option>
                <option value="closed">已关闭</option>
              </select>
            </label>
            <label className="field">
              <span>员工或商品关键词</span>
              <input name="query" placeholder="姓名、手机号或商品" />
            </label>
          </>
        ) : null}
        {kind === "orders" ? (
          <>
            <label className="field">
              <span>订单状态</span>
              <select name="status">
                <option value="">全部状态</option>
                <option value="pending_confirmation">待确认</option>
                <option value="confirmed">已确认</option>
                <option value="waiting_for_service">待出行</option>
                <option value="in_service">服务中</option>
                <option value="completed">已完成</option>
                <option value="cancelled">已取消</option>
              </select>
            </label>
            <label className="field">
              <span>商品类型</span>
              <select name="type">
                <option value="">全部类型</option>
                <option value="travel">疗养旅游</option>
                <option value="insurance">保险服务</option>
                <option value="medical">医疗服务</option>
                <option value="health_management">健康管理</option>
                <option value="other">其他</option>
              </select>
            </label>
          </>
        ) : null}
        {kind === "quota-transactions" ? (
          <label className="field field--wide">
            <span>流水类型</span>
            <select name="type">
              <option value="">全部类型</option>
              <option value="grant">发放</option>
              <option value="deduction">扣减</option>
              <option value="refund">退回</option>
              <option value="adjustment">调整</option>
            </select>
          </label>
        ) : null}
        {error ? <p className="form-error field--wide">{error}</p> : null}
      </form>
    </Modal>
  );
}
