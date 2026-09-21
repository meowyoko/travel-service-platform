import type { UpdateServiceProductInput } from "@travel/application";
import { ArrowLeft, BedDouble, Pencil, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { HotelRoomManagerModal } from "../components/HotelRoomManagerModal";
import { Modal } from "../components/Modal";
import {
  createProductGalleryDrafts,
  ProductGalleryField,
  type ProductGalleryDraft,
  uploadProductGallery,
} from "../components/ProductGalleryField";
import { ProductImageField } from "../components/ProductImageField";
import { StatusBadge } from "../components/StatusBadge";
import { VisibilityGroupsText } from "../components/VisibilityGroupsText";
import { useAdminData } from "../context/AdminDataContext";
import { uploadProductImage } from "../lib/api";
import { formatDate, formatQuota } from "../lib/format";

type PaidServiceDraft = {
  title: string;
  description: string;
};

function normalizePaidServices(services: PaidServiceDraft[]) {
  return services
    .map((service) => ({
      title: service.title.trim(),
      description: service.description.trim(),
    }))
    .filter(({ title, description }) => title || description);
}

export function HotelDetailPage() {
  const { hotelId } = useParams();
  const navigate = useNavigate();
  const { data, execute } = useAdminData();
  const [editing, setEditing] = useState(false);
  const [roomManagerOpen, setRoomManagerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] =
    useState<UpdateServiceProductInput | null>(null);
  const [editVisibilityScope, setEditVisibilityScope] = useState<
    "all_groups" | "specified_groups"
  >("all_groups");
  const [editPaidServices, setEditPaidServices] = useState<PaidServiceDraft[]>(
    [],
  );
  const [editGallery, setEditGallery] = useState<ProductGalleryDraft[]>([]);
  const [error, setError] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  const hotel = data.serviceProducts.find(
    ({ id, type }) => id === hotelId && type === "hotel",
  );
  const usage = useMemo(() => {
    const hasDirectIntent = data.personalIntents.some(
      (intent) => intent.productId === hotelId,
    );
    const hasDirectOrder = data.personalOrders.some(
      (order) => order.sourceProductId === hotelId,
    );
    const hasAccommodationOrder = data.personalOrders.some(
      (order) => order.hotelAccommodation?.hotelProductId === hotelId,
    );
    const linkedByProducts = data.serviceProducts.filter((product) =>
      product.linkedHotelProductIds?.includes(hotelId ?? ""),
    );
    return {
      hasIntent: hasDirectIntent,
      hasOrder: hasDirectOrder || hasAccommodationOrder,
      hasLinkedProducts: linkedByProducts.length > 0,
      linkedByProducts,
      hasBusinessRecords:
        hasDirectIntent || hasDirectOrder || hasAccommodationOrder,
    };
  }, [data.personalIntents, data.personalOrders, data.serviceProducts, hotelId]);

  if (!hotel) {
    return (
      <section className="empty-selection">
        <strong>未找到该酒店</strong>
        <button
          className="button button--secondary"
          onClick={() => navigate("/hotels")}
          type="button"
        >
          返回酒店管理
        </button>
      </section>
    );
  }

  const selectedHotel = hotel;
  const hotelDetails = selectedHotel.hotelDetails;
  const roomTypes = data.hotelRoomTypes.filter(
    ({ hotelProductId }) => hotelProductId === selectedHotel.id,
  );
  const immutableDisabled = usage.hasBusinessRecords;
  const deleteReasons = [
    ...(selectedHotel.status === "published"
      ? ["酒店当前已上架，需要先下架后才能删除。"]
      : []),
    ...(usage.hasIntent ? ["酒店已产生意向记录，只能下架，不能删除。"] : []),
    ...(usage.hasOrder ? ["酒店已产生订单记录，只能下架，不能删除。"] : []),
    ...(usage.hasLinkedProducts
      ? [
          `酒店已被 ${usage.linkedByProducts.length} 个疗养产品设为可选酒店，请先解除关联。`,
        ]
      : []),
  ];

  async function buildUpdateInput(
    event: FormEvent<HTMLFormElement>,
  ): Promise<UpdateServiceProductInput> {
    const form = new FormData(event.currentTarget);
    const coverImageFile = form.get("coverImageFile");
    const coverImage =
      coverImageFile instanceof File && coverImageFile.size > 0
        ? await uploadProductImage(coverImageFile)
        : selectedHotel.coverImage;
    const maxQuota = String(form.get("quotaMax") ?? "").trim();
    const groupIds = form.getAll("groupIds").map(String);
    const galleryItems = await uploadProductGallery(editGallery);
    const paidServices = normalizePaidServices(editPaidServices);
    if (paidServices.some(({ title, description }) => !title || !description)) {
      throw new Error("付费服务标题和详情说明需同时填写");
    }
    const currentHotelDetails = structuredClone(
      selectedHotel.hotelDetails ?? { city: "", address: "" },
    );
    const { paidServices: _paidServices, ...lockedHotelDetails } =
      currentHotelDetails;
    const baseHotelDetails = immutableDisabled
      ? lockedHotelDetails
      : {
          city: String(form.get("city")),
          address: String(form.get("address")),
          starRating: String(form.get("starRating") ?? ""),
          facilities: String(form.get("facilities") ?? ""),
          trafficInfo: String(form.get("trafficInfo") ?? ""),
          checkInPolicy: String(form.get("checkInPolicy") ?? ""),
        };

    return {
      productId: selectedHotel.id,
      name: immutableDisabled ? selectedHotel.name : String(form.get("name")),
      type: "hotel",
      summary: String(form.get("summary")),
      coverImage,
      gallery: galleryItems,
      ...(immutableDisabled
        ? selectedHotel.quotaReference
          ? { quotaReference: structuredClone(selectedHotel.quotaReference) }
          : {}
        : {
          quotaReference: {
            min: Number(form.get("quotaMin")),
            ...(maxQuota ? { max: Number(maxQuota) } : {}),
          },
        }),
      serviceDescription: String(form.get("serviceDescription")),
      notes: String(form.get("notes")),
      visibility: immutableDisabled
        ? structuredClone(selectedHotel.visibility)
        : editVisibilityScope === "all_groups"
          ? { scope: "all_groups" }
          : { scope: "specified_groups", groupIds },
      ...(selectedHotel.sortOrder !== undefined
        ? { sortOrder: selectedHotel.sortOrder }
        : {}),
      ...(selectedHotel.recommended !== undefined
        ? { recommended: selectedHotel.recommended }
        : {}),
      hotelDetails: {
        ...baseHotelDetails,
        ...(paidServices.length > 0 ? { paidServices } : {}),
      },
    };
  }

  async function saveUpdate(input: UpdateServiceProductInput) {
    try {
      await execute((service) => service.updateServiceProduct(input));
      setEditing(false);
      setPendingUpdate(null);
      setError("");
      setPageMessage("酒店信息已保存。");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "保存酒店失败",
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
        selectedHotel.serviceDescription !== input.serviceDescription.trim() ||
        selectedHotel.notes !== input.notes.trim();
      if (usage.hasBusinessRecords && descriptionChanged) {
        setPendingUpdate(input);
        return;
      }
      await saveUpdate(input);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "上传酒店首图失败",
      );
    }
  }

  async function changeStatus() {
    try {
      await execute((service) =>
        selectedHotel.status === "published"
          ? service.unpublishServiceProduct(selectedHotel.id)
          : service.publishServiceProduct(selectedHotel.id),
      );
      setPageMessage(
        selectedHotel.status === "published" ? "酒店已下架。" : "酒店已上架。",
      );
    } catch (caughtError) {
      setPageMessage(
        caughtError instanceof Error ? caughtError.message : "操作失败",
      );
    }
  }

  async function deleteHotel() {
    try {
      await execute((service) => service.deleteServiceProduct(selectedHotel.id));
      navigate("/hotels");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "删除酒店失败",
      );
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <button
            className="back-link"
            onClick={() => navigate("/hotels")}
            type="button"
          >
            <ArrowLeft size={16} />
            酒店管理
          </button>
          <h1>{hotel.name}</h1>
          <p>查看酒店基础信息、上下架状态，并维护房型与库存。</p>
        </div>
        <div className="page-actions">
          <button className="button button--secondary" onClick={changeStatus} type="button">
            {hotel.status === "published" ? "下架" : "上架"}
          </button>
          <button
            className="button button--secondary"
            disabled={hotel.status === "published"}
            onClick={() => {
              setError("");
              setEditVisibilityScope(hotel.visibility.scope);
              setEditPaidServices(
                hotel.hotelDetails?.paidServices?.map((service) => ({
                  title: service.title,
                  description: service.description,
                })) ?? [],
              );
              setEditGallery(createProductGalleryDrafts(hotel.gallery));
              setEditing(true);
            }}
            title={
              hotel.status === "published"
                ? "已上架酒店需要先下架才能编辑"
                : undefined
            }
            type="button"
          >
            <Pencil size={16} />
            编辑
          </button>
          <button
            className="button button--secondary"
            onClick={() => setRoomManagerOpen(true)}
            type="button"
          >
            <BedDouble size={16} />
            管理房型
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
          该酒店已产生意向/订单，修改内容仅影响后续展示，不影响历史订单记录。
        </div>
      ) : null}

      <section className="product-detail-grid">
        <div className="content-card product-detail-main">
          <div className="content-card__header">
            <h2>基础信息</h2>
            <StatusBadge tone={hotel.status === "published" ? "positive" : "muted"}>
              {hotel.status === "published" ? "已上架" : "未上架"}
            </StatusBadge>
          </div>
          <div className="detail-list">
            <div>
              <span>城市/区域</span>
              <strong>{hotelDetails?.city ?? "未填写"}</strong>
            </div>
            <div>
              <span>酒店定位</span>
              <strong>{hotelDetails?.starRating || "未填写"}</strong>
            </div>
            <div>
              <span>额度参考</span>
              <strong>
                {hotel.quotaReference
                  ? `${formatQuota(hotel.quotaReference.min)}${
                      hotel.quotaReference.max
                        ? `-${formatQuota(hotel.quotaReference.max)}`
                        : ""
                    }`
                  : "待确认"}
              </strong>
            </div>
            <div>
              <span>可见范围</span>
              <strong>
                <VisibilityGroupsText
                  groups={data.groups}
                  visibility={hotel.visibility}
                />
              </strong>
            </div>
            <div>
              <span>房型数量</span>
              <strong>{roomTypes.length} 个</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{formatDate(hotel.updatedAt)}</strong>
            </div>
            <div className="detail-list__wide">
              <span>地址</span>
              <p>{hotelDetails?.address ?? "未填写"}</p>
            </div>
            <div className="detail-list__wide">
              <span>酒店简介</span>
              <p>{hotel.summary}</p>
            </div>
            <div className="detail-list__wide">
              <span>设施服务</span>
              <p>{hotelDetails?.facilities || "未填写"}</p>
            </div>
            <div className="detail-list__wide">
              <span>交通信息</span>
              <p>{hotelDetails?.trafficInfo || "未填写"}</p>
            </div>
            <div className="detail-list__wide">
              <span>入住政策</span>
              <p>{hotelDetails?.checkInPolicy || "未填写"}</p>
            </div>
            <div className="detail-list__wide">
              <span>付费服务</span>
              <p>
                {hotelDetails?.paidServices?.length
                  ? hotelDetails.paidServices
                      .map(({ title, description }) => `${title}：${description}`)
                      .join("；")
                  : "未设置"}
              </p>
            </div>
            <div className="detail-list__wide">
              <span>服务说明</span>
              <p>{hotel.serviceDescription}</p>
            </div>
            <div className="detail-list__wide">
              <span>注意事项</span>
              <p>{hotel.notes}</p>
            </div>
          </div>
        </div>

        <aside className="content-card product-cover-card">
          <div className="content-card__header">
            <h2>酒店主图</h2>
          </div>
          <div className="product-cover-preview">
            <img alt={hotel.name} src={hotel.coverImage} />
            <span>{hotel.coverImage}</span>
          </div>
        </aside>
      </section>

      <HotelRoomManagerModal
        hotel={roomManagerOpen ? hotel : null}
        onClose={() => setRoomManagerOpen(false)}
      />

      <Modal
        description={
          usage.hasBusinessRecords
            ? "有业务记录的酒店仅允许修改展示字段；锁定字段不可编辑。"
            : "该酒店尚无业务记录，可以维护全部基础字段。"
        }
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setEditing(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--primary"
              form="update-hotel-form"
              type="submit"
            >
              保存修改
            </button>
          </>
        }
        onClose={() => setEditing(false)}
        open={editing}
        title="编辑酒店信息"
      >
        {usage.hasBusinessRecords ? (
          <div className="warning-panel edit-product-warning">
            该酒店已产生意向/订单，修改内容仅影响后续展示，不影响历史订单记录。
          </div>
        ) : null}
        <form className="form-grid" id="update-hotel-form" onSubmit={handleUpdate}>
          <label className="field field--wide">
            <span>酒店名称</span>
            <input
              defaultValue={hotel.name}
              disabled={immutableDisabled}
              name="name"
              required
            />
          </label>
          <ProductImageField currentImage={hotel.coverImage} />
          <ProductGalleryField
            label="酒店设施图文"
            onChange={setEditGallery}
            value={editGallery}
          />
          <label className="field">
            <span>城市/区域</span>
            <input
              defaultValue={hotelDetails?.city}
              disabled={immutableDisabled}
              name="city"
              required
            />
          </label>
          <label className="field">
            <span>酒店定位</span>
            <input
              defaultValue={hotelDetails?.starRating}
              disabled={immutableDisabled}
              name="starRating"
            />
          </label>
          <label className="field">
            <span>额度参考下限</span>
            <input
              defaultValue={hotel.quotaReference?.min}
              disabled={immutableDisabled}
              min="1"
              name="quotaMin"
              required
              type="number"
            />
          </label>
          <label className="field">
            <span>额度参考上限</span>
            <input
              defaultValue={hotel.quotaReference?.max}
              disabled={immutableDisabled}
              min="1"
              name="quotaMax"
              type="number"
            />
          </label>
          <label className="field field--wide">
            <span>地址</span>
            <input
              defaultValue={hotelDetails?.address}
              disabled={immutableDisabled}
              name="address"
              required
            />
          </label>
          <label className="field field--wide">
            <span>酒店简介</span>
            <textarea defaultValue={hotel.summary} name="summary" required rows={2} />
          </label>
          <label className="field field--wide">
            <span>设施服务</span>
            <textarea
              defaultValue={hotelDetails?.facilities}
              disabled={immutableDisabled}
              name="facilities"
              rows={2}
            />
          </label>
          <label className="field field--wide">
            <span>交通信息</span>
            <textarea
              defaultValue={hotelDetails?.trafficInfo}
              disabled={immutableDisabled}
              name="trafficInfo"
              rows={2}
            />
          </label>
          <label className="field field--wide">
            <span>入住政策</span>
            <textarea
              defaultValue={hotelDetails?.checkInPolicy}
              disabled={immutableDisabled}
              name="checkInPolicy"
              rows={2}
            />
          </label>
          <fieldset className="paid-services-fieldset field--wide">
            <legend>付费服务</legend>
            <div className="paid-service-editor">
              {editPaidServices.map((service, index) => (
                <div className="paid-service-item" key={index}>
                  <label className="paid-service-line">
                    <span>服务名称</span>
                    <input
                      onChange={(event) =>
                        setEditPaidServices((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="例如：接送服务"
                      value={service.title}
                    />
                  </label>
                  <label className="paid-service-line paid-service-line--textarea">
                    <span>详细说明</span>
                    <textarea
                      onChange={(event) =>
                        setEditPaidServices((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, description: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="说明费用口径和服务范围"
                      rows={4}
                      value={service.description}
                    />
                  </label>
                  <button
                    className="inline-text-button paid-service-remove"
                    onClick={() =>
                      setEditPaidServices((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    type="button"
                  >
                    移除此服务
                  </button>
                </div>
              ))}
              <button
                className="inline-text-button paid-service-add"
                onClick={() =>
                  setEditPaidServices((current) => [
                    ...current,
                    { title: "", description: "" },
                  ])
                }
                type="button"
              >
                + 添加付费服务
              </button>
            </div>
          </fieldset>
          <label className="field field--wide">
            <span>服务说明（二次确认字段）</span>
            <textarea
              defaultValue={hotel.serviceDescription}
              name="serviceDescription"
              required
              rows={2}
            />
          </label>
          <label className="field field--wide">
            <span>注意事项（二次确认字段）</span>
            <textarea defaultValue={hotel.notes} name="notes" required rows={2} />
          </label>
          <label className="field field--wide">
            <span>可见范围</span>
            <select
              disabled={immutableDisabled}
              name="visibilityScope"
              onChange={(event) =>
                setEditVisibilityScope(
                  event.target.value as "all_groups" | "specified_groups",
                )
              }
              value={editVisibilityScope}
            >
              <option value="all_groups">全部合作集团</option>
              <option value="specified_groups">指定集团</option>
            </select>
          </label>
          {editVisibilityScope === "specified_groups" ? (
            <fieldset className="checkbox-group field--wide" disabled={immutableDisabled}>
              <legend>选择可见集团</legend>
              {data.groups.map((group) => (
                <label key={group.id}>
                  <input
                    defaultChecked={
                      hotel.visibility.scope === "specified_groups" &&
                      hotel.visibility.groupIds.includes(group.id)
                    }
                    name="groupIds"
                    type="checkbox"
                    value={group.id}
                  />
                  <span>{group.name}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        description="说明类内容会影响员工后续查看，请确认本次修改。"
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setPendingUpdate(null)}
              type="button"
            >
              返回检查
            </button>
            <button
              className="button button--primary"
              onClick={() =>
                pendingUpdate &&
                saveUpdate({ ...pendingUpdate, confirmDescriptionChanges: true })
              }
              type="button"
            >
              确认并保存
            </button>
          </>
        }
        onClose={() => setPendingUpdate(null)}
        open={Boolean(pendingUpdate)}
        title="确认修改说明类字段"
      >
        <div className="warning-panel">
          酒店已经形成业务记录。服务说明或注意事项的修改只影响后续展示，不会覆盖历史订单快照。
        </div>
      </Modal>

      <Modal
        description={
          deleteReasons.length > 0
            ? "当前酒店不符合删除条件。"
            : "删除后不可恢复，房型和库存也会一并删除。"
        }
        footer={
          deleteReasons.length > 0 ? (
            <button
              className="button button--secondary"
              onClick={() => setDeleteOpen(false)}
              type="button"
            >
              我知道了
            </button>
          ) : (
            <>
              <button
                className="button button--secondary"
                onClick={() => setDeleteOpen(false)}
                type="button"
              >
                取消
              </button>
              <button className="button button--danger" onClick={deleteHotel} type="button">
                确认删除
              </button>
            </>
          )
        }
        onClose={() => setDeleteOpen(false)}
        open={deleteOpen}
        title={deleteReasons.length > 0 ? "该酒店不可删除" : "删除酒店"}
      >
        {deleteReasons.length > 0 ? (
          <div className="warning-panel">
            <ul>
              {deleteReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p>即将删除“{hotel.name}”。</p>
        )}
      </Modal>
    </>
  );
}
