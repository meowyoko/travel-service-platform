import type {
  OrderProductSnapshot,
  ServiceProduct,
} from "./models.js";

/**
 * 从服务商品生成订单快照，确保商品后续调整或下架不影响历史订单。
 */
export function createOrderProductSnapshot(
  product: ServiceProduct,
): OrderProductSnapshot {
  return {
    productId: product.id,
    name: product.name,
    type: product.type,
    summary: product.summary,
    coverImage: product.coverImage,
    serviceDescription: product.serviceDescription,
    notes: product.notes,
    ...(product.gallery
      ? { gallery: structuredClone(product.gallery) }
      : {}),
    ...(product.quotaReference
      ? { quotaReference: structuredClone(product.quotaReference) }
      : {}),
    ...(product.travelDetails
      ? { travelDetails: structuredClone(product.travelDetails) }
      : {}),
    ...(product.hotelDetails
      ? { hotelDetails: structuredClone(product.hotelDetails) }
      : {}),
  };
}
