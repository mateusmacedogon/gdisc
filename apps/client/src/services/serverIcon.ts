import { supabase } from './supabase.js';

export const SERVER_ICON_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const SERVER_ICON_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function validateServerIconFile(file: File): void {
  if (!SERVER_ICON_ALLOWED_TYPES.includes(file.type as (typeof SERVER_ICON_ALLOWED_TYPES)[number])) {
    throw new Error('Use uma imagem PNG, JPG ou WebP.');
  }
  if (file.size > SERVER_ICON_MAX_SOURCE_BYTES) {
    throw new Error('A imagem deve ter no máximo 10 MB.');
  }
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function optimizeServerIcon(file: File): Promise<Blob> {
  validateServerIconFile(file);
  const image = await loadImage(file);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Este dispositivo não conseguiu processar a imagem.');

  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.86);
  });
  if (!blob) throw new Error('Não foi possível converter a imagem para WebP.');
  return blob;
}

export async function uploadServerIcon(serverId: string, file: File): Promise<string> {
  const optimized = await optimizeServerIcon(file);
  const objectPath = `${serverId}/icon.webp`;
  const { error } = await supabase.storage
    .from('server-icons')
    .upload(objectPath, optimized, {
      upsert: true,
      contentType: 'image/webp',
      cacheControl: '3600',
    });

  if (error) throw new Error(`Não foi possível enviar o ícone: ${error.message}`);
  const { data } = supabase.storage.from('server-icons').getPublicUrl(objectPath);
  return `${data.publicUrl}?v=${Date.now()}`;
}
