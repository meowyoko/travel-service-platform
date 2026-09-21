import { Plus, Save } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { ServiceProductDto } from "@travel/contracts";

import { useAdminData } from "../context/AdminDataContext";
import { uploadProductImage } from "../lib/api";
import { formatQuota } from "../lib/format";
import { Modal } from "./Modal";
import { ProductImageField } from "./ProductImageField";
import { StatusBadge } from "./StatusBadge";

function enumerateDates(startDate: string, endDate: string): string[] {
  if (endDate < startDate) {
    throw new Error("结束日期不能早于开始日期");
  }
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function getInventorySummary(
  inventories: Array<{
    quotaPrice: number;
    totalInventory: number;
    usedInventory: number;
    isAvailable: boolean;
  }>,
): string {
  if (inventories.length === 0) {
    return "未维护库存";
  }
  const availableInventories = inventories.filter(
    ({ isAvailable }) => isAvailable,
  );
  if (availableInventories.length === 0) {
    return `已维护 ${inventories.length} 晚 / 暂不可售`;
  }
  const remainingRooms = availableInventories.map(
    ({ totalInventory, usedInventory }) =>
      Math.max(0, totalInventory - usedInventory),
  );
  const minRemaining = Math.min(...remainingRooms);
  const totalRemaining = remainingRooms.reduce((sum, value) => sum + value, 0);
  const prices = availableInventories.map(({ quotaPrice }) => quotaPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceText =
    minPrice === maxPrice
      ? `${formatQuota(minPrice)}/晚`
      : `${formatQuota(minPrice)}-${formatQuota(maxPrice)}/晚`;
  const remainingText =
    totalRemaining === 0
      ? "已满房"
      : `最低剩余 ${minRemaining} 间 / 累计剩余 ${totalRemaining} 间夜`;

  return `已维护 ${inventories.length} 晚 / ${remainingText} / ${priceText}`;
}

function DateRangeField({
  endName,
  startName,
}: {
  endName: string;
  startName: string;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  return (
    <label className="field field--wide">
      <span>可售夜范围</span>
      <span className="date-range-field">
        <input
          aria-label="起始可售夜"
          max={endDate || undefined}
          name={startName}
          onChange={(event) => {
            const nextStartDate = event.target.value;
            setStartDate(nextStartDate);
            if (endDate && nextStartDate > endDate) {
              setEndDate(nextStartDate);
            }
          }}
          required
          type="date"
          value={startDate}
        />
        <em>至</em>
        <input
          aria-label="截止可售夜"
          min={startDate || undefined}
          name={endName}
          onChange={(event) => {
            const nextEndDate = event.target.value;
            setEndDate(nextEndDate);
            if (startDate && nextEndDate < startDate) {
              setStartDate(nextEndDate);
            }
          }}
          required
          type="date"
          value={endDate}
        />
      </span>
      <small>起止可为同一天，用于单独维护某一晚库存。</small>
    </label>
  );
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function buildCalendarCells(monthKey: string): Array<string | null> {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year!, month! - 1, 1));
  const lastDay = new Date(Date.UTC(year!, month!, 0));
  const cells: Array<string | null> = [];
  for (let index = 0; index < firstDay.getUTCDay(); index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= lastDay.getUTCDate(); day += 1) {
    cells.push(`${monthKey}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

interface HotelRoomManagerModalProps {
  hotel: ServiceProductDto | null;
  onClose(): void;
}

export function HotelRoomManagerModal({
  hotel,
  onClose,
}: HotelRoomManagerModalProps) {
  const { data, execute } = useAdminData();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [roomFormKey, setRoomFormKey] = useState(0);
  const [inventoryRoomId, setInventoryRoomId] = useState<string | null>(null);
  const [selectedInventoryMonth, setSelectedInventoryMonth] = useState("");
  const roomTypes = hotel
    ? data.hotelRoomTypes.filter(
        ({ hotelProductId }) => hotelProductId === hotel.id,
      )
    : [];
  const inventoryRoom =
    roomTypes.find(({ id }) => id === inventoryRoomId) ?? null;
  const inventoryDetails = inventoryRoom
    ? [...data.hotelRoomDailyInventories]
        .filter(({ roomTypeId }) => roomTypeId === inventoryRoom.id)
        .sort((left, right) => left.date.localeCompare(right.date))
    : [];
  const inventoryByDate = new Map(
    inventoryDetails.map((inventory) => [inventory.date, inventory]),
  );
  const inventoryMonths = Array.from(
    new Set(inventoryDetails.map(({ date }) => date.slice(0, 7))),
  );
  const activeInventoryMonth =
    selectedInventoryMonth && inventoryMonths.includes(selectedInventoryMonth)
      ? selectedInventoryMonth
      : inventoryMonths[0];

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hotel) return;
    const form = new FormData(event.currentTarget);
    const roomImageFile = form.get("roomImageFile");
    const imageUrl =
      roomImageFile instanceof File && roomImageFile.size > 0
        ? await uploadProductImage(roomImageFile)
        : undefined;
    await execute((service) =>
      service.createHotelRoomType({
        hotelProductId: hotel.id,
        name: String(form.get("name")),
        ...(imageUrl ? { imageUrl } : {}),
        bedType: String(form.get("bedType") ?? ""),
        capacity: Number(form.get("capacity")),
        breakfast: String(form.get("breakfast") ?? ""),
        area: String(form.get("area") ?? ""),
        description: String(form.get("description") ?? ""),
      }),
    );
    event.currentTarget.reset();
    setRoomFormKey((value) => value + 1);
    setMessage("房型已添加，默认未启用。");
  }

  async function handleInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const dates = enumerateDates(
        String(form.get("startDate") ?? ""),
        String(form.get("endDate") ?? ""),
      );
      await execute(async (service) => {
        for (const date of dates) {
          await service.upsertHotelRoomInventory({
            roomTypeId: String(form.get("roomTypeId")),
            date,
            quotaPrice: Number(form.get("quotaPrice")),
            totalInventory: Number(form.get("totalInventory")),
            isAvailable: form.get("isAvailable") === "on",
          });
        }
      });
      setMessage(`已保存 ${dates.length} 天的价格和库存。`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "保存库存失败",
      );
    }
  }

  async function toggleRoomStatus(
    roomTypeId: string,
    status: "draft" | "published",
  ) {
    const room = data.hotelRoomTypes.find(({ id }) => id === roomTypeId);
    if (!room) return;
    await execute((service) =>
      service.updateHotelRoomType({
        ...room,
        roomTypeId: room.id,
        status: status === "published" ? "draft" : "published",
      }),
    );
  }

  return (
    <Modal
      className="modal--wide"
      description="维护该酒店可售房型，以及按日期批量设置额度价格和库存。"
      footer={
        <button className="button button--secondary" onClick={onClose} type="button">
          关闭
        </button>
      }
      onClose={onClose}
      open={Boolean(hotel)}
      title={hotel ? `${hotel.name} · 房型与库存` : "房型与库存"}
    >
      {hotel ? (
        <div className="hotel-room-manager">
          {message ? <div className="page-message">{message}</div> : null}
          <div className="detail-summary">
            <strong>{hotel.hotelDetails?.city ?? "未填写城市"}</strong>
            <span>共 {roomTypes.length} 个房型</span>
          </div>
          <section className="room-manager-section">
            <div className="room-manager-section__header">
              <h3>添加房型</h3>
            </div>
            <form className="form-grid" onSubmit={handleCreateRoom}>
              <label className="field">
                <span>房型名称</span>
                <input name="name" placeholder="例如：园景大床房" required />
              </label>
              <label className="field">
                <span>床型</span>
                <input name="bedType" placeholder="大床 / 双床" />
              </label>
              <label className="field">
                <span>可住人数</span>
                <input min="1" name="capacity" required type="number" />
              </label>
              <label className="field">
                <span>早餐</span>
                <input name="breakfast" placeholder="含双早" />
              </label>
              <ProductImageField
                key={roomFormKey}
                label="房型图片"
                name="roomImageFile"
              />
              <label className="field">
                <span>面积</span>
                <input name="area" placeholder="约45平方米" />
              </label>
              <label className="field field--wide">
                <span>房型说明</span>
                <textarea name="description" rows={2} />
              </label>
              <div className="form-actions field--wide">
                <button className="button button--secondary" type="submit">
                  <Plus size={16} />
                  添加房型
                </button>
              </div>
            </form>
          </section>

          <section className="room-manager-section">
            <div className="room-manager-section__header">
              <h3>房型列表</h3>
              <span className="record-count">共 {roomTypes.length} 个房型</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>房型</th>
                    <th>床型/人数</th>
                    <th>状态</th>
                    <th>库存概览</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {roomTypes.map((room) => {
                    const inventories = data.hotelRoomDailyInventories.filter(
                      ({ roomTypeId }) => roomTypeId === room.id,
                    );
                    return (
                      <tr key={room.id}>
                        <td>
                          <div className="room-type-cell">
                            {room.imageUrl ? (
                              <img alt={`${room.name}房型图`} src={room.imageUrl} />
                            ) : null}
                            <span className="primary-cell">
                              <strong>{room.name}</strong>
                              <span>
                                {room.description ?? room.breakfast ?? "暂无说明"}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td>{room.bedType ?? "未填写"} / {room.capacity}人</td>
                        <td>
                          <StatusBadge
                            tone={room.status === "published" ? "positive" : "muted"}
                          >
                            {room.status === "published" ? "已启用" : "未启用"}
                          </StatusBadge>
                        </td>
                        <td>
                          <button
                            className="inventory-summary inline-text-button"
                            onClick={() => {
                              const firstMonth = data.hotelRoomDailyInventories
                                .filter(({ roomTypeId }) => roomTypeId === room.id)
                                .map(({ date }) => date.slice(0, 7))
                                .sort()[0];
                              setSelectedInventoryMonth(firstMonth ?? "");
                              setInventoryRoomId(room.id);
                            }}
                            type="button"
                          >
                            {getInventorySummary(inventories)}
                          </button>
                        </td>
                        <td>
                          <button
                            className="table-action"
                            onClick={() => void toggleRoomStatus(room.id, room.status)}
                            type="button"
                          >
                            {room.status === "published" ? "停用" : "启用"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="room-manager-section">
            <div className="room-manager-section__header">
              <h3>批量维护日期价格与库存</h3>
            </div>
            <form className="form-grid" onSubmit={handleInventory}>
              <label className="field">
                <span>房型</span>
                <select name="roomTypeId" required>
                  {roomTypes.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <DateRangeField endName="endDate" startName="startDate" />
              <label className="field">
                <span>额度价格</span>
                <input min="0" name="quotaPrice" required type="number" />
              </label>
              <label className="field">
                <span>总库存</span>
                <input min="0" name="totalInventory" required type="number" />
              </label>
              <label className="checkbox-inline">
                <input defaultChecked name="isAvailable" type="checkbox" />
                <span>当天可售</span>
              </label>
              <div className="form-actions field--wide">
                <button
                  className="button button--primary"
                  disabled={roomTypes.length === 0}
                  type="submit"
                >
                  <Save size={16} />
                  保存库存
                </button>
              </div>
              {error ? <p className="form-error field--wide">{error}</p> : null}
            </form>
          </section>
        </div>
      ) : null}
      <Modal
        className="modal--inventory-calendar"
        description="按日期查看该房型已维护的额度价格、总库存、已用库存和剩余房间数。"
        footer={
          <button
            className="button button--secondary"
            onClick={() => setInventoryRoomId(null)}
            type="button"
          >
            关闭
          </button>
        }
        onClose={() => setInventoryRoomId(null)}
        open={Boolean(inventoryRoom)}
        title={inventoryRoom ? `${inventoryRoom.name} · 库存日历` : "库存日历"}
      >
        {inventoryMonths.length > 0 ? (
          <div className="inventory-calendar">
            <label className="month-select-field">
              <span>查看月份</span>
              <select
                onChange={(event) => setSelectedInventoryMonth(event.target.value)}
                value={activeInventoryMonth}
              >
                {inventoryMonths.map((monthKey) => (
                  <option key={monthKey} value={monthKey}>
                    {getMonthLabel(monthKey)}
                  </option>
                ))}
              </select>
            </label>
            {activeInventoryMonth ? (
              <section className="inventory-month">
                <h3>{getMonthLabel(activeInventoryMonth)}</h3>
                <div className="inventory-weekdays">
                  {["日", "一", "二", "三", "四", "五", "六"].map((weekday) => (
                    <span key={weekday}>{weekday}</span>
                  ))}
                </div>
                <div className="inventory-month-grid">
                  {buildCalendarCells(activeInventoryMonth).map((date, index) => {
                    const inventory = date ? inventoryByDate.get(date) : null;
                    const remaining = inventory
                      ? Math.max(
                          0,
                          inventory.totalInventory - inventory.usedInventory,
                        )
                      : 0;
                    const isAvailable =
                      Boolean(inventory?.isAvailable) && remaining > 0;
                    return (
                      <div
                        className={[
                          "inventory-calendar-day",
                          date ? "" : "inventory-calendar-day--blank",
                          inventory ? "" : "inventory-calendar-day--empty",
                          inventory && !isAvailable
                            ? "inventory-calendar-day--unavailable"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={`${activeInventoryMonth}-${index}`}
                      >
                        {date ? (
                          <>
                            <strong>{Number(date.slice(8, 10))}</strong>
                            {inventory ? (
                              <span>
                                {isAvailable ? (
                                  <>
                                    余
                                    <b>{remaining}</b>
                                  </>
                                ) : (
                                  "不可售"
                                )}
                              </span>
                            ) : null}
                            {inventory ? (
                              <em>{formatQuota(inventory.quotaPrice)}</em>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <p className="empty-hint">该房型暂未维护日期库存。</p>
        )}
      </Modal>
    </Modal>
  );
}
