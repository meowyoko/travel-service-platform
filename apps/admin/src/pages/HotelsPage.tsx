import { Hotel } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Modal } from "../components/Modal";
import {
  ProductGalleryField,
  type ProductGalleryDraft,
  uploadProductGallery,
} from "../components/ProductGalleryField";
import { ProductImageField } from "../components/ProductImageField";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import { uploadProductImage } from "../lib/api";
import { formatDate, formatQuota } from "../lib/format";

const DEFAULT_PAID_SERVICE_TITLE = "接送服务";
const DEFAULT_PAID_SERVICE_DESCRIPTION =
  "可协助协调机场、车站或酒店周边接送，费用根据时间、人数、车型和距离另行确认。";

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

export function HotelsPage() {
  const { data, execute } = useAdminData();
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [paidServices, setPaidServices] = useState<PaidServiceDraft[]>([]);
  const [gallery, setGallery] = useState<ProductGalleryDraft[]>([]);

  const hotels = useMemo(
    () => data.serviceProducts.filter((product) => product.type === "hotel"),
    [data.serviceProducts],
  );

  async function handleCreateHotel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const coverImageFile = form.get("coverImageFile");
    const selectedGroupIds = form
      .getAll("groupIds")
      .map((value) => String(value));
    try {
      if (!(coverImageFile instanceof File) || coverImageFile.size === 0) {
        throw new Error("请选择酒店首图");
      }
      const coverImage = await uploadProductImage(coverImageFile);
      const galleryItems = await uploadProductGallery(gallery);
      const normalizedPaidServices = normalizePaidServices(paidServices);
      if (normalizedPaidServices.some(({ title, description }) => !title || !description)) {
        throw new Error("付费服务标题和详情说明需同时填写");
      }
      await execute((service) =>
        service.createServiceProduct({
          name: String(form.get("name")),
          type: "hotel",
          summary: String(form.get("summary")),
          coverImage,
          ...(galleryItems.length > 0 ? { gallery: galleryItems } : {}),
          quotaReference: {
            min: Number(form.get("quotaMin")),
            ...(String(form.get("quotaMax") ?? "").trim()
              ? { max: Number(form.get("quotaMax")) }
              : {}),
          },
          serviceDescription: String(form.get("serviceDescription")),
          notes: String(form.get("notes")),
          visibility:
            selectedGroupIds.length > 0
              ? { scope: "specified_groups", groupIds: selectedGroupIds }
              : { scope: "all_groups" },
          hotelDetails: {
            city: String(form.get("city")),
            address: String(form.get("address")),
            starRating: String(form.get("starRating") ?? ""),
            facilities: String(form.get("facilities") ?? ""),
            trafficInfo: String(form.get("trafficInfo") ?? ""),
            checkInPolicy: String(form.get("checkInPolicy") ?? ""),
            ...(normalizedPaidServices.length > 0
              ? { paidServices: normalizedPaidServices }
              : {}),
          },
        }),
      );
      setModalOpen(false);
      setMessage("酒店商品已创建，当前状态为未上架。");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "创建酒店失败");
    }
  }

  async function changeStatus(productId: string, status: "draft" | "published") {
    setMessage("");
    try {
      await execute((service) =>
        status === "draft"
          ? service.publishServiceProduct(productId)
          : service.unpublishServiceProduct(productId),
      );
      setMessage(status === "draft" ? "酒店已上架。" : "酒店已下架。");
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : "操作失败",
      );
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>酒店管理</h1>
          <p>酒店作为服务商品维护，房型和日期库存只在这里维护一次。</p>
        </div>
        <button
          className="button button--primary"
          onClick={() => {
            setError("");
            setGallery([]);
            setPaidServices([
              {
                title: DEFAULT_PAID_SERVICE_TITLE,
                description: DEFAULT_PAID_SERVICE_DESCRIPTION,
              },
            ]);
            setModalOpen(true);
          }}
          type="button"
        >
          <Hotel size={17} />
          新增酒店
        </button>
      </section>

      {message ? <div className="page-message">{message}</div> : null}

      <section className="content-card">
        <div className="content-card__header">
          <h2>酒店商品</h2>
          <span className="record-count">共 {hotels.length} 个酒店</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>酒店</th>
                <th>城市</th>
                <th>额度参考</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {hotels.map((hotel) => (
                <tr key={hotel.id}>
                  <td>
                    <div className="primary-cell">
                      <strong>{hotel.name}</strong>
                      <span>{hotel.hotelDetails?.address ?? hotel.summary}</span>
                    </div>
                  </td>
                  <td>{hotel.hotelDetails?.city ?? "未填写"}</td>
                  <td>
                    {hotel.quotaReference
                      ? `${formatQuota(hotel.quotaReference.min)}${
                          hotel.quotaReference.max
                            ? `-${formatQuota(hotel.quotaReference.max)}`
                            : ""
                        }`
                      : "待确认"}
                  </td>
                  <td>
                    <StatusBadge tone={hotel.status === "published" ? "positive" : "muted"}>
                      {hotel.status === "published" ? "已上架" : "未上架"}
                    </StatusBadge>
                  </td>
                  <td>{formatDate(hotel.updatedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <Link className="table-action" to={`/hotels/${hotel.id}`}>
                        查看
                      </Link>
                      <button
                        className="table-action"
                        onClick={() => changeStatus(hotel.id, hotel.status)}
                        type="button"
                      >
                        {hotel.status === "published" ? "下架" : "上架"}
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
        description="酒店创建后保持未上架，可在服务商品或酒店管理中确认后上架。"
        footer={
          <>
            <button className="button button--secondary" onClick={() => setModalOpen(false)} type="button">
              取消
            </button>
            <button className="button button--primary" form="create-hotel-form" type="submit">
              创建酒店
            </button>
          </>
        }
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title="新增酒店商品"
      >
        <form className="form-grid" id="create-hotel-form" onSubmit={handleCreateHotel}>
          <label className="field field--wide">
            <span>酒店名称</span>
            <input name="name" required />
          </label>
          <ProductImageField required />
          <ProductGalleryField
            label="酒店设施图文"
            onChange={setGallery}
            value={gallery}
          />
          <label className="field">
            <span>城市/区域</span>
            <input name="city" required />
          </label>
          <label className="field">
            <span>酒店定位</span>
            <input name="starRating" placeholder="高端度假酒店" />
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
            <span>地址</span>
            <input name="address" required />
          </label>
          <label className="field field--wide">
            <span>酒店简介</span>
            <textarea name="summary" required rows={2} />
          </label>
          <label className="field field--wide">
            <span>设施服务</span>
            <textarea name="facilities" rows={2} />
          </label>
          <label className="field field--wide">
            <span>交通信息</span>
            <textarea name="trafficInfo" rows={2} />
          </label>
          <label className="field field--wide">
            <span>入住政策</span>
            <textarea name="checkInPolicy" rows={2} />
          </label>
          <fieldset className="paid-services-fieldset field--wide">
            <legend>付费服务</legend>
            <div className="paid-service-editor">
              {paidServices.map((service, index) => (
                <div className="paid-service-item" key={index}>
                  <label className="paid-service-line">
                    <span>服务名称</span>
                    <input
                      onChange={(event) =>
                        setPaidServices((current) =>
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
                        setPaidServices((current) =>
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
                      setPaidServices((current) =>
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
                  setPaidServices((current) => [
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
            <span>服务说明</span>
            <textarea name="serviceDescription" required rows={2} />
          </label>
          <label className="field field--wide">
            <span>注意事项</span>
            <textarea name="notes" required rows={2} />
          </label>
          <fieldset className="checkbox-group field--wide">
            <legend>指定可见集团（不选则全部集团可见）</legend>
            {data.groups.map((group) => (
              <label key={group.id}>
                <input name="groupIds" type="checkbox" value={group.id} />
                <span>{group.name}</span>
              </label>
            ))}
          </fieldset>
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}
