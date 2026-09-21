import type { ProductGalleryItem } from "@travel/domain";

import { ApiError } from "../errors.js";

export function normalizeProductGalleryInput(
  gallery: ProductGalleryItem[] | undefined,
): ProductGalleryItem[] | undefined {
  if (!gallery) return undefined;
  const normalized = gallery.map((item) => ({
    imageUrl: item.imageUrl.trim(),
    description: item.description.trim(),
  }));
  if (
    normalized.some(
      ({ imageUrl, description }) =>
        !imageUrl || !description || description.length > 100,
    )
  ) {
    throw new ApiError(
      400,
      "INVALID_PRODUCT_GALLERY",
      "每张图片都必须填写说明，且说明不能超过100字",
    );
  }
  return normalized;
}
