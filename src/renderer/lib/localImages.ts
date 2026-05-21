const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i;

export function isLikelyImagePath(value: string): boolean {
  return IMAGE_EXT_RE.test(value.trim());
}

export function localPathFromImageSource(
  source: string,
  cwd?: string | null,
): string | null {
  const value = source.trim();
  if (!value) return null;
  if (/^(data:image\/|blob:|https?:\/\/)/i.test(value)) return null;
  if (/^file:\/\//i.test(value)) {
    try {
      return decodeURIComponent(new URL(value).pathname);
    } catch {
      return value.replace(/^file:\/\//i, "");
    }
  }
  if (value.startsWith("/")) return value;
  return cwd ? `${cwd}/${value}` : value;
}

export async function resolveImageSource(
  source: string,
  cwd?: string | null,
): Promise<string | null> {
  const value = source.trim();
  if (!value) return null;
  if (/^(data:image\/|blob:|https?:\/\/)/i.test(value)) return value;

  const localPath = localPathFromImageSource(value, cwd);
  if (!localPath) return null;
  return window.codex.file.readImageDataUrl(localPath);
}
