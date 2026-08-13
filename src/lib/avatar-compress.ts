/** 图片压缩并转为 Data URL，用于头像等小图上传。 */

const MAX_SIZE = 512
const JPEG_QUALITY = 0.78

type CompressOptions = {
  maxSize?: number
  mimeType?: "image/jpeg" | "image/png"
  jpegQuality?: number
}

export function compressImageToDataUrl(file: File, options: CompressOptions = {}): Promise<string> {
  const maxSize = options.maxSize ?? MAX_SIZE
  const mimeType = options.mimeType ?? "image/jpeg"
  const jpegQuality = options.jpegQuality ?? JPEG_QUALITY
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      let width = w
      let height = h
      if (w > maxSize || h > maxSize) {
        if (w >= h) {
          width = maxSize
          height = Math.round((h * maxSize) / w)
        } else {
          height = maxSize
          width = Math.round((w * maxSize) / h)
        }
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("无法创建 canvas"))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = mimeType === "image/png"
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", jpegQuality)
      resolve(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("图片加载失败"))
    }
    img.src = url
  })
}
