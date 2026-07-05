import { PackagePlus, Search } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Modal } from "../components/Modal";
import { MonthPicker } from "../components/MonthPicker";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import { formatDate, formatQuota } from "../lib/format";

const productTypeLabel = {
  travel: "疗养旅游",
  insurance: "保险服务",
  medical: "医疗服务",
  health_management: "健康管理",
  other: "其他",
} as const;

export function ProductsPage() {
  const { data, execute } = useAdminData();
  const [modalOpen, setModalOpen] = useState(false);
  const [productType, setProductType] = useState<
    keyof typeof productTypeLabel
  >("travel");
  const [visibilityScope, setVisibilityScope] = useState<
    "all_groups" | "specified_groups"
  >("all_groups");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [travelMonths, setTravelMonths] = useState<number[]>([]);

  const products = useMemo(
    () =>
      data.serviceProducts.filter((product) => {
        const matchesQuery = product.name.includes(query.trim());
        const matchesStatus =
          statusFilter === "all" || product.status === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [data.serviceProducts, query, statusFilter],
  );

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);
    const minQuota = Number(form.get("quotaMin"));
    const maxQuotaValue = String(form.get("quotaMax") ?? "").trim();
    const selectedGroupIds = form
      .getAll("groupIds")
      .map((value) => String(value));

    try {
      execute((service) =>
        service.createServiceProduct({
          name: String(form.get("name")),
          type: productType,
          summary: String(form.get("summary")),
          coverImage: String(form.get("coverImage")),
          quotaReference: {
            min: minQuota,
            ...(maxQuotaValue ? { max: Number(maxQuotaValue) } : {}),
          },
          serviceDescription: String(form.get("serviceDescription")),
          notes: String(form.get("notes")),
          visibility:
            visibilityScope === "all_groups"
              ? { scope: "all_groups" }
              : {
                  scope: "specified_groups",
                  groupIds: selectedGroupIds,
                },
          ...(productType === "travel"
            ? {
                travelDetails: {
                  destination: String(form.get("destination")),
                  destinationHighlights: String(
                    form.get("destinationHighlights"),
                  ),
                  suitableTravelMonths: travelMonths,
                  recommendedStayDays: String(
                    form.get("recommendedStayDays"),
                  ),
                  serviceScope: String(form.get("serviceScope")),
                },
              }
            : {}),
        }),
      );
      setModalOpen(false);
      setTravelMonths([]);
      setPageMessage("服务商品已创建，当前状态为未上架。");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "创建服务商品失败",
      );
    }
  }

  function changeStatus(productId: string, status: "draft" | "published") {
    setPageMessage("");

    try {
      execute((service) =>
        status === "draft"
          ? service.publishServiceProduct(productId)
          : service.unpublishServiceProduct(productId),
      );
      setPageMessage(status === "draft" ? "商品已上架。" : "商品已下架。");
    } catch (caughtError) {
      setPageMessage(
        caughtError instanceof Error ? caughtError.message : "操作失败",
      );
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>服务商品</h1>
          <p>统一维护服务商品通用信息，并为疗养旅游类商品保存扩展内容。</p>
        </div>
        <button
          className="button button--primary"
          onClick={() => {
            setError("");
            setTravelMonths([]);
            setModalOpen(true);
          }}
          type="button"
        >
          <PackagePlus size={17} />
          新增商品
        </button>
      </section>

      {pageMessage ? <div className="page-message">{pageMessage}</div> : null}

      <section className="filter-card">
        <label className="search-field">
          <Search size={17} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索商品名称"
            value={query}
          />
        </label>
        <label className="select-field">
          <span>上架状态</span>
          <select
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="all">全部状态</option>
            <option value="draft">未上架</option>
            <option value="published">已上架</option>
          </select>
        </label>
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <h2>商品列表</h2>
          <span className="record-count">共 {products.length} 个商品</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>商品名称</th>
                <th>商品类型</th>
                <th>额度参考</th>
                <th>可见集团</th>
                <th>上架状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="primary-cell">
                      <strong>
                        <Link
                          className="product-link"
                          to={`/products/${product.id}`}
                        >
                          {product.name}
                        </Link>
                      </strong>
                      <span>{product.summary}</span>
                    </div>
                  </td>
                  <td>{productTypeLabel[product.type]}</td>
                  <td>
                    {product.quotaReference
                      ? `${formatQuota(product.quotaReference.min)}${
                          product.quotaReference.max
                            ? `–${formatQuota(product.quotaReference.max)}`
                            : ""
                        }`
                      : "待确认"}
                  </td>
                  <td>
                    {product.visibility.scope === "all_groups"
                      ? "全部集团"
                      : `${product.visibility.groupIds.length} 个指定集团`}
                  </td>
                  <td>
                    <StatusBadge
                      tone={
                        product.status === "published" ? "positive" : "muted"
                      }
                    >
                      {product.status === "published" ? "已上架" : "未上架"}
                    </StatusBadge>
                  </td>
                  <td>{formatDate(product.updatedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <Link
                        className="table-action"
                        to={`/products/${product.id}`}
                      >
                        查看
                      </Link>
                      <button
                        className="table-action"
                        onClick={() => changeStatus(product.id, product.status)}
                        type="button"
                      >
                        {product.status === "published" ? "下架" : "上架"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        description="新商品创建后保持未上架，确认内容完整后再执行上架。"
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
              form="create-product-form"
              type="submit"
            >
              创建商品
            </button>
          </>
        }
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title="新增服务商品"
      >
        <form
          className="form-grid"
          id="create-product-form"
          onSubmit={handleCreate}
        >
          <label className="field field--wide">
            <span>商品名称</span>
            <input name="name" placeholder="请输入服务商品名称" required />
          </label>
          <label className="field">
            <span>商品类型</span>
            <select
              name="type"
              onChange={(event) =>
                setProductType(
                  event.target.value as keyof typeof productTypeLabel,
                )
              }
              value={productType}
            >
              {Object.entries(productTypeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>商品主图</span>
            <input
              name="coverImage"
              placeholder="/mock-images/product-cover.jpg"
              required
            />
          </label>
          <label className="field">
            <span>额度参考下限</span>
            <input min="1" name="quotaMin" required type="number" />
          </label>
          <label className="field">
            <span>额度参考上限</span>
            <input min="1" name="quotaMax" type="number" />
          </label>
          <label className="field field--wide">
            <span>商品简介</span>
            <textarea name="summary" required rows={2} />
          </label>
          <label className="field field--wide">
            <span>服务说明</span>
            <textarea name="serviceDescription" required rows={3} />
          </label>
          <label className="field field--wide">
            <span>注意事项</span>
            <textarea name="notes" required rows={2} />
          </label>
          <label className="field field--wide">
            <span>可见范围</span>
            <select
              onChange={(event) =>
                setVisibilityScope(
                  event.target.value as
                    | "all_groups"
                    | "specified_groups",
                )
              }
              value={visibilityScope}
            >
              <option value="all_groups">全部合作集团</option>
              <option value="specified_groups">指定集团</option>
            </select>
          </label>
          {visibilityScope === "specified_groups" ? (
            <fieldset className="checkbox-group field--wide">
              <legend>选择可见集团</legend>
              {data.groups.map((group) => (
                <label key={group.id}>
                  <input name="groupIds" type="checkbox" value={group.id} />
                  <span>{group.name}</span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {productType === "travel" ? (
            <>
              <div className="form-section-title field--wide">
                疗养旅游扩展信息
              </div>
              <label className="field">
                <span>目的地</span>
                <input name="destination" required />
              </label>
              <label className="field">
                <span>建议停留天数</span>
                <input
                  name="recommendedStayDays"
                  placeholder="例如：4-6天"
                  required
                />
              </label>
              <label className="field field--wide">
                <span>目的地特色</span>
                <textarea name="destinationHighlights" required rows={2} />
              </label>
              <MonthPicker
                onChange={setTravelMonths}
                value={travelMonths}
              />
              <label className="field field--wide">
                <span>服务范围说明</span>
                <textarea name="serviceScope" required rows={2} />
              </label>
            </>
          ) : null}
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}
