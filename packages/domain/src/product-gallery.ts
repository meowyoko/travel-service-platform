import type { ProductGalleryItem } from "./models.js";

/** 兼容历史版本只保存图片地址的图库数据，新的写入仍由接口强制要求说明。 */
export function normalizeProductGallery(
  value: unknown,
): ProductGalleryItem[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const items = value.flatMap((item) => {
    if (typeof item === "string") {
      return item.trim()
        ? [{ imageUrl: item.trim(), description: "" }]
        : [];
    }
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const imageUrl = typeof record.imageUrl === "string"
      ? record.imageUrl.trim()
      : "";
    const description = typeof record.description === "string"
      ? record.description.trim()
      : "";
    return imageUrl ? [{ imageUrl, description }] : [];
  });

  return items.length > 0 ? items : undefined;
}
