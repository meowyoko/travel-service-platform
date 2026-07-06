import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { requireAdmin } from "../auth/guards.js";
import type { Database } from "../db/client.js";
import { ApiError } from "../errors.js";

const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;

function detectImageExtension(buffer: Buffer): "jpg" | "png" | "webp" | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function createUploadRoutes(
  db: Database,
  uploadRoot: string,
): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.post("/product-images", async (request) => {
      await requireAdmin(db, request, "products");
      const part = await request.file({
        limits: { files: 1, fileSize: MAX_PRODUCT_IMAGE_SIZE },
      });
      if (!part) {
        throw new ApiError(400, "IMAGE_REQUIRED", "请选择需要上传的商品图片");
      }

      const buffer = await part.toBuffer();
      const extension = detectImageExtension(buffer);
      if (!extension) {
        throw new ApiError(
          400,
          "INVALID_IMAGE_TYPE",
          "商品图片仅支持 JPEG、PNG 或 WebP 格式",
        );
      }

      const relativeDirectory = "product-images";
      const directory = join(uploadRoot, relativeDirectory);
      await mkdir(directory, { recursive: true });
      const filename = `${randomUUID()}.${extension}`;
      await writeFile(join(directory, filename), buffer, { flag: "wx" });

      return { url: `/uploads/${relativeDirectory}/${filename}` };
    });
  };
}
