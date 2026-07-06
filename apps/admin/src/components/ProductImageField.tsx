import { ImagePlus } from "lucide-react";
import { useEffect, useState } from "react";

interface ProductImageFieldProps {
  currentImage?: string;
  name?: string;
  required?: boolean;
}

export function ProductImageField({
  currentImage,
  name = "coverImageFile",
  required = false,
}: ProductImageFieldProps) {
  const [previewUrl, setPreviewUrl] = useState(currentImage ?? "");

  useEffect(() => {
    setPreviewUrl(currentImage ?? "");
  }, [currentImage]);

  function selectFile(file?: File) {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl((previous) => {
      if (previous.startsWith("blob:")) URL.revokeObjectURL(previous);
      return objectUrl;
    });
  }

  useEffect(
    () => () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  return (
    <label className="product-image-field field field--wide">
      <span>商品首图</span>
      <span className="product-image-field__picker">
        {previewUrl ? (
          <img alt="商品首图预览" src={previewUrl} />
        ) : (
          <span className="product-image-field__empty">
            <ImagePlus size={28} />
            选择图片后可预览
          </span>
        )}
        <span className="button button--secondary">
          {currentImage ? "更换图片" : "选择图片"}
        </span>
      </span>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="product-image-field__input"
        name={name}
        onChange={(event) => selectFile(event.target.files?.[0])}
        required={required && !currentImage}
        type="file"
      />
      <small>支持 JPEG、PNG、WebP，单张不超过 5 MB。</small>
    </label>
  );
}
