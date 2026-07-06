import type { UpdateServiceProductInput } from "@travel/application";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Modal } from "../components/Modal";
import { MonthPicker } from "../components/MonthPicker";
import { ProductImageField } from "../components/ProductImageField";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import { uploadProductImage } from "../lib/api";
import { formatDate, formatQuota } from "../lib/format";

const productTypeLabel = {
  travel: "疗养旅游",
  insurance: "保险服务",
  medical: "医疗服务",
  health_management: "健康管理",
  other: "其他",
} as const;

export function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { data, execute } = useAdminData();
  const [editing, setEditing] = useState(false);
  const [editProductType, setEditProductType] = useState<
    keyof typeof productTypeLabel
  >("travel");
  const [editVisibilityScope, setEditVisibilityScope] = useState<
    "all_groups" | "specified_groups"
  >("all_groups");
  const [pendingUpdate, setPendingUpdate] =
    useState<UpdateServiceProductInput | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [editTravelMonths, setEditTravelMonths] = useState<number[]>([]);

  const product = data.serviceProducts.find(({ id }) => id === productId);
  const usage = useMemo(() => {
    const hasIntent = data.personalIntents.some(
      (intent) => intent.productId === productId,
    );
    const hasOrder = data.personalOrders.some(
      (order) => order.sourceProductId === productId,
    );
    return {
      hasIntent,
      hasOrder,
      hasBusinessRecords: hasIntent || hasOrder,
    };
  }, [data.personalIntents, data.personalOrders, productId]);

  const deleteReasons = useMemo(() => {
    if (!product) {
      return [];
    }
    const reasons: string[] = [];
    if (product.status === "published") {
      reasons.push("商品当前已上架，需要先下架后才能删除。");
    }
    if (usage.hasIntent) {
      reasons.push("商品已产生意向记录，只能下架，不能删除。");
    }
    if (usage.hasOrder) {
      reasons.push("商品已产生订单记录，只能下架，不能删除。");
    }
    return reasons;
  }, [product, usage.hasIntent, usage.hasOrder]);

  if (!product) {
    return (
      <section className="empty-selection">
        <strong>未找到该服务商品</strong>
        <button
          className="button button--secondary"
          onClick={() => navigate("/products")}
          type="button"
        >
          返回商品列表
        </button>
      </section>
    );
  }
  const selectedProduct = product;

  async function buildUpdateInput(
    event: FormEvent<HTMLFormElement>,
  ): Promise<UpdateServiceProductInput> {
    const form = new FormData(event.currentTarget);
    const currentProduct = selectedProduct;
    const coverImageFile = form.get("coverImageFile");
    const coverImage =
      coverImageFile instanceof File && coverImageFile.size > 0
        ? await uploadProductImage(coverImageFile)
        : currentProduct.coverImage;
    const maxQuota = String(form.get("quotaMax") ?? "").trim();
    const groupIds = form.getAll("groupIds").map(String);
    const useLockedValues = usage.hasBusinessRecords;

    return {
      productId: currentProduct.id,
      name: useLockedValues
        ? currentProduct.name
        : String(form.get("name")),
      type: useLockedValues ? currentProduct.type : editProductType,
      summary: String(form.get("summary")),
      coverImage,
      ...(currentProduct.gallery
        ? { gallery: structuredClone(currentProduct.gallery) }
        : {}),
      quotaReference: {
        min: useLockedValues
          ? currentProduct.quotaReference!.min
          : Number(form.get("quotaMin")),
        ...(useLockedValues
          ? currentProduct.quotaReference?.max !== undefined
            ? { max: currentProduct.quotaReference.max }
            : {}
          : maxQuota
            ? { max: Number(maxQuota) }
            : {}),
      },
      serviceDescription: String(form.get("serviceDescription")),
      notes: String(form.get("notes")),
      visibility: useLockedValues
        ? structuredClone(currentProduct.visibility)
        : editVisibilityScope === "all_groups"
          ? { scope: "all_groups" }
          : { scope: "specified_groups", groupIds },
      ...(currentProduct.sortOrder !== undefined
        ? { sortOrder: currentProduct.sortOrder }
        : {}),
      ...(currentProduct.recommended !== undefined
        ? { recommended: currentProduct.recommended }
        : {}),
      ...((useLockedValues ? currentProduct.type : editProductType) ===
      "travel"
        ? {
            travelDetails: {
              ...(currentProduct.travelDetails
                ? structuredClone(currentProduct.travelDetails)
                : {}),
              destination: useLockedValues
                ? currentProduct.travelDetails!.destination
                : String(form.get("destination")),
              destinationHighlights: String(
                form.get("destinationHighlights"),
              ),
              suitableTravelMonths: useLockedValues
                ? structuredClone(
                    currentProduct.travelDetails!.suitableTravelMonths,
                  )
                : editTravelMonths,
              recommendedStayDays: useLockedValues
                ? currentProduct.travelDetails!.recommendedStayDays
                : String(form.get("recommendedStayDays")),
              serviceScope: String(form.get("serviceScope")),
            },
          }
        : {}),
    };
  }

  async function saveUpdate(input: UpdateServiceProductInput) {
    try {
      await execute((service) => service.updateServiceProduct(input));
      setEditing(false);
      setPendingUpdate(null);
      setError("");
      setPageMessage("商品信息已保存。");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "保存商品失败",
      );
      setPendingUpdate(null);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const input = await buildUpdateInput(event);
      const descriptionChanged =
        selectedProduct.serviceDescription !==
          input.serviceDescription.trim() ||
        selectedProduct.notes !== input.notes.trim() ||
        selectedProduct.travelDetails?.serviceScope !==
          input.travelDetails?.serviceScope.trim();

      if (usage.hasBusinessRecords && descriptionChanged) {
        setPendingUpdate(input);
        return;
      }
      await saveUpdate(input);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "上传商品首图失败",
      );
    }
  }

  async function changeStatus() {
    try {
      await execute((service) =>
        selectedProduct.status === "published"
          ? service.unpublishServiceProduct(selectedProduct.id)
          : service.publishServiceProduct(selectedProduct.id),
      );
      setPageMessage(
        selectedProduct.status === "published"
          ? "商品已下架。"
          : "商品已上架。",
      );
    } catch (caughtError) {
      setPageMessage(
        caughtError instanceof Error ? caughtError.message : "操作失败",
      );
    }
  }

  async function deleteProduct() {
    try {
      await execute((service) =>
        service.deleteServiceProduct(selectedProduct.id),
      );
      navigate("/products");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "删除商品失败",
      );
    }
  }

  const travel = product.travelDetails;
  const immutableDisabled = usage.hasBusinessRecords;

  return (
    <>
      <section className="page-heading">
        <div>
          <button
            className="back-link"
            onClick={() => navigate("/products")}
            type="button"
          >
            <ArrowLeft size={16} />
            服务商品
          </button>
          <h1>{product.name}</h1>
          <p>查看商品完整信息、业务关联状态及维护记录。</p>
        </div>
        <div className="page-actions">
          <button
            className="button button--secondary"
            onClick={changeStatus}
            type="button"
          >
            {product.status === "published" ? "下架" : "上架"}
          </button>
          <button
            className="button button--secondary"
            disabled={product.status === "published"}
            onClick={() => {
              setError("");
              setEditProductType(product.type);
              setEditVisibilityScope(product.visibility.scope);
              setEditTravelMonths(
                structuredClone(
                  product.travelDetails?.suitableTravelMonths ?? [],
                ),
              );
              setEditing(true);
            }}
            type="button"
            title={
              product.status === "published"
                ? "已上架商品需要先下架才能编辑"
                : undefined
            }
          >
            <Pencil size={16} />
            编辑
          </button>
          <button
            className="button button--danger-ghost"
            onClick={() => {
              setError("");
              setDeleteOpen(true);
            }}
            type="button"
          >
            <Trash2 size={16} />
            删除
          </button>
        </div>
      </section>

      {pageMessage ? <div className="page-message">{pageMessage}</div> : null}
      {usage.hasBusinessRecords ? (
        <div className="warning-panel product-history-warning">
          该商品已产生意向/订单，修改内容仅影响后续展示，不影响历史订单记录。
        </div>
      ) : null}

      <section className="product-detail-grid">
        <div className="content-card product-detail-main">
          <div className="content-card__header">
            <h2>基本信息</h2>
            <StatusBadge
              tone={product.status === "published" ? "positive" : "muted"}
            >
              {product.status === "published" ? "已上架" : "未上架"}
            </StatusBadge>
          </div>
          <div className="detail-list">
            <div><span>商品类型</span><strong>{productTypeLabel[product.type]}</strong></div>
            <div><span>额度参考</span><strong>{product.quotaReference ? `${formatQuota(product.quotaReference.min)}${product.quotaReference.max ? `–${formatQuota(product.quotaReference.max)}` : ""}` : "待确认"}</strong></div>
            <div><span>可见范围</span><strong>{product.visibility.scope === "all_groups" ? "全部合作集团" : `${product.visibility.groupIds.length} 个指定集团`}</strong></div>
            <div><span>更新时间</span><strong>{formatDate(product.updatedAt)}</strong></div>
            <div className="detail-list__wide"><span>商品简介</span><p>{product.summary}</p></div>
            <div className="detail-list__wide"><span>服务说明</span><p>{product.serviceDescription}</p></div>
            <div className="detail-list__wide"><span>注意事项</span><p>{product.notes}</p></div>
          </div>
        </div>

        <aside className="content-card product-cover-card">
          <div className="content-card__header"><h2>商品主图</h2></div>
          <div className="product-cover-preview">
            <img alt={product.name} src={product.coverImage} />
            <span>{product.coverImage}</span>
          </div>
        </aside>
      </section>

      {travel ? (
        <section className="content-card">
          <div className="content-card__header"><h2>疗养旅游信息</h2></div>
          <div className="detail-list">
            <div><span>目的地</span><strong>{travel.destination}</strong></div>
            <div><span>建议停留天数</span><strong>{travel.recommendedStayDays}</strong></div>
            <div><span>适宜月份</span><strong>{travel.suitableTravelMonths.map((month) => `${month} 月`).join("、")}</strong></div>
            <div className="detail-list__wide"><span>目的地特色</span><p>{travel.destinationHighlights}</p></div>
            <div className="detail-list__wide"><span>服务范围说明</span><p>{travel.serviceScope}</p></div>
          </div>
        </section>
      ) : null}

      <Modal
        description={
          usage.hasBusinessRecords
            ? "有业务记录的商品仅允许修改展示字段；锁定字段不可编辑。"
            : "该商品尚无业务记录，可以维护全部商品字段。"
        }
        footer={
          <>
            <button className="button button--secondary" onClick={() => setEditing(false)} type="button">取消</button>
            <button className="button button--primary" form="update-product-form" type="submit">保存修改</button>
          </>
        }
        onClose={() => setEditing(false)}
        open={editing}
        title="编辑服务商品"
      >
        {usage.hasBusinessRecords ? (
          <div className="warning-panel edit-product-warning">
            该商品已产生意向/订单，修改内容仅影响后续展示，不影响历史订单记录。
          </div>
        ) : null}
        <form className="form-grid" id="update-product-form" onSubmit={handleUpdate}>
          <label className="field field--wide"><span>商品名称</span><input defaultValue={product.name} disabled={immutableDisabled} name="name" required /></label>
          <label className="field"><span>商品类型</span><select disabled={immutableDisabled} name="type" onChange={(event) => setEditProductType(event.target.value as keyof typeof productTypeLabel)} value={editProductType}>{Object.entries(productTypeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <ProductImageField currentImage={product.coverImage} />
          <label className="field"><span>额度参考下限</span><input defaultValue={product.quotaReference?.min} disabled={immutableDisabled} min="1" name="quotaMin" required type="number" /></label>
          <label className="field"><span>额度参考上限</span><input defaultValue={product.quotaReference?.max} disabled={immutableDisabled} min="1" name="quotaMax" type="number" /></label>
          <label className="field field--wide"><span>商品简介</span><textarea defaultValue={product.summary} name="summary" required rows={2} /></label>
          <label className="field field--wide"><span>服务说明（二次确认字段）</span><textarea defaultValue={product.serviceDescription} name="serviceDescription" required rows={3} /></label>
          <label className="field field--wide"><span>注意事项（二次确认字段）</span><textarea defaultValue={product.notes} name="notes" required rows={2} /></label>
          <label className="field field--wide"><span>可见范围</span><select disabled={immutableDisabled} name="visibilityScope" onChange={(event) => setEditVisibilityScope(event.target.value as "all_groups" | "specified_groups")} value={editVisibilityScope}><option value="all_groups">全部合作集团</option><option value="specified_groups">指定集团</option></select></label>
          {editVisibilityScope === "specified_groups" ? (
            <fieldset className="checkbox-group field--wide" disabled={immutableDisabled}>
              <legend>选择可见集团</legend>
              {data.groups.map((group) => <label key={group.id}><input defaultChecked={product.visibility.scope === "specified_groups" && product.visibility.groupIds.includes(group.id)} name="groupIds" type="checkbox" value={group.id} /><span>{group.name}</span></label>)}
            </fieldset>
          ) : null}
          {editProductType === "travel" ? (
            <>
              <div className="form-section-title field--wide">疗养旅游扩展信息</div>
              <label className="field"><span>目的地</span><input defaultValue={travel?.destination} disabled={immutableDisabled} name="destination" required /></label>
              <label className="field"><span>建议停留天数</span><input defaultValue={travel?.recommendedStayDays} disabled={immutableDisabled} name="recommendedStayDays" required /></label>
              <label className="field field--wide"><span>目的地特色</span><textarea defaultValue={travel?.destinationHighlights} name="destinationHighlights" required rows={2} /></label>
              <MonthPicker
                disabled={immutableDisabled}
                onChange={setEditTravelMonths}
                value={editTravelMonths}
              />
              <label className="field field--wide"><span>服务范围说明（二次确认字段）</span><textarea defaultValue={travel?.serviceScope} name="serviceScope" required rows={2} /></label>
            </>
          ) : null}
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        description="说明类内容会影响员工后续查看，请确认本次修改。"
        footer={<><button className="button button--secondary" onClick={() => setPendingUpdate(null)} type="button">返回检查</button><button className="button button--primary" onClick={() => pendingUpdate && saveUpdate({ ...pendingUpdate, confirmDescriptionChanges: true })} type="button">确认并保存</button></>}
        onClose={() => setPendingUpdate(null)}
        open={Boolean(pendingUpdate)}
        title="确认修改说明类字段"
      >
        <div className="warning-panel">商品已经形成业务记录。服务说明、注意事项或服务范围说明的修改只影响后续展示，不会覆盖历史订单快照。</div>
      </Modal>

      <Modal
        description={deleteReasons.length > 0 ? "当前商品不符合删除条件。" : "删除后不可恢复，请确认商品尚未用于任何业务。"}
        footer={deleteReasons.length > 0 ? <button className="button button--secondary" onClick={() => setDeleteOpen(false)} type="button">我知道了</button> : <><button className="button button--secondary" onClick={() => setDeleteOpen(false)} type="button">取消</button><button className="button button--danger" onClick={deleteProduct} type="button">确认删除</button></>}
        onClose={() => setDeleteOpen(false)}
        open={deleteOpen}
        title={deleteReasons.length > 0 ? "该商品不可删除" : "删除服务商品"}
      >
        {deleteReasons.length > 0 ? (
          <div className="warning-panel"><ul>{deleteReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
        ) : (
          <p>即将删除“{product.name}”。</p>
        )}
      </Modal>
    </>
  );
}
