/** Longest side after shrinking: plenty for a model to read print and handwriting. */
const LONGEST_SIDE = 1600;
const QUALITY = 0.8;

/**
 * A photo as a JPEG data URL no larger than LONGEST_SIDE on its longest side, so four photos stay
 * well under Vercel's 4.5 MB request limit. Throws when the browser cannot open the file as an image.
 */
export async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    // A transparent PNG would turn black as JPEG: paint white underneath.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", QUALITY);
  } finally {
    bitmap.close();
  }
}
