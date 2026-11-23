/**
 * Shrinks a screenshot in the browser so it fits the server's 400 KB limit: scales the longest side to
 * 1200px and re-encodes as JPEG, lowering quality until it fits. Returns a data URL.
 */
export async function compressImage(file: File, maxBytes = 350 * 1024): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Please choose a PNG, JPEG or WebP image.");
  if (file.size > 12 * 1024 * 1024) throw new Error("That image is too large. Please choose one under 12 MB.");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  for (const q of [0.8, 0.65, 0.5, 0.35]) {
    const url = canvas.toDataURL("image/jpeg", q);
    // base64 length -> bytes
    if ((url.length - url.indexOf(",") - 1) * 0.75 <= maxBytes) return url;
  }
  throw new Error("That image is still too large after compression. Please crop it and try again.");
}
