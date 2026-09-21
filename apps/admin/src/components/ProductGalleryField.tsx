import type { ProductGalleryItem } from "@travel/domain";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";

import { uploadProductImage } from "../lib/api";

export interface ProductGalleryDraft {
  id: string;
  imageUrl: string;
  previewUrl: string;
  file?: File;
  description: string;
}

function createDraft(item?: ProductGalleryItem): ProductGalleryDraft {
  const imageUrl = item?.imageUrl ?? "";
  return {
    id: `gallery-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    imageUrl,
    previewUrl: imageUrl,
    description: item?.description ?? "",
  };
}

export function createProductGalleryDrafts(
  items?: ProductGalleryItem[],
): ProductGalleryDraft[] {
  return (items ?? []).map((item) => createDraft(item));
}

export async function uploadProductGallery(
  drafts: ProductGalleryDraft[],
): Promise<ProductGalleryItem[]> {
  const items: ProductGalleryItem[] = [];
  for (const draft of drafts) {
    const description = draft.description.trim();
    if (!description) throw new Error("每张图片都需要填写图片说明");
    if (description.length > 100) throw new Error("图片说明不能超过100字");
    const imageUrl = draft.file
      ? await uploadProductImage(draft.file)
      : draft.imageUrl.trim();
    if (!imageUrl) throw new Error("请为每个图文项目选择图片");
    items.push({ imageUrl, description });
  }
  return items;
}

interface ProductGalleryFieldProps {
  value: ProductGalleryDraft[];
  onChange: (value: ProductGalleryDraft[]) => void;
  label: string;
  disabled?: boolean;
}

export function ProductGalleryField({
  value,
  onChange,
  label,
  disabled = false,
}: ProductGalleryFieldProps) {
  useEffect(
    () => () => {
      for (const item of value) {
        if (item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      }
    },
    [value],
  );

  function updateItem(id: string, patch: Partial<ProductGalleryDraft>) {
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function selectFile(id: string, file?: File) {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const current = value.find((item) => item.id === id);
    if (current?.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(current.previewUrl);
    }
    updateItem(id, { file, imageUrl: "", previewUrl });
  }

  return (
    <fieldset className="product-gallery-field field--wide" disabled={disabled}>
      <legend>{label}</legend>
      <p className="product-gallery-field__hint">
        每张图片都需要填写说明，最多 100 字，建议控制在 50 字以内。
      </p>
      <div className="product-gallery-editor">
        {value.map((item, index) => (
          <article className="product-gallery-item" key={item.id}>
            <label className="product-gallery-item__image">
              {item.previewUrl ? (
                <img alt={`第${index + 1}张图片预览`} src={item.previewUrl} />
              ) : (
                <span>
                  <ImagePlus size={24} />
                  选择图片
                </span>
              )}
              <input
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => selectFile(item.id, event.target.files?.[0])}
                type="file"
              />
            </label>
            <label className="product-gallery-item__description">
              <span>图片说明</span>
              <textarea
                maxLength={100}
                onChange={(event) => updateItem(item.id, { description: event.target.value })}
                placeholder="请输入这张图片展示的设施或场景说明"
                required
                rows={2}
                value={item.description}
              />
              <small>{item.description.length}/100</small>
            </label>
            <button
              className="icon-button product-gallery-item__remove"
              onClick={() => onChange(value.filter((current) => current.id !== item.id))}
              title="移除图片"
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </article>
        ))}
      </div>
      <button
        className="inline-text-button product-gallery-field__add"
        onClick={() => onChange([...value, createDraft()])}
        type="button"
      >
        <Plus size={16} />
        添加图文
      </button>
    </fieldset>
  );
}
