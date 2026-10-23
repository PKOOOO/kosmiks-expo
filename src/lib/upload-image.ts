import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { API_BASE_URL } from '@/config/constants';

type UploadImageOptions = {
  uri: string;
  authorization: string;
  userToken?: string;
  /** 'document' goes to private storage (qualification docs); defaults to a public 'image'. */
  kind?: 'image' | 'document';
  /** Called with 0–100 as the file is sent to storage. */
  onProgress?: (percent: number) => void;
};

type UploadImageResult = {
  /** Public media URL for images, or an `r2-private:` reference for documents. */
  url: string;
};

type PresignResponse = {
  uploadUrl?: string;
  headers?: Record<string, string>;
  url?: string;
  error?: string;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

function contentTypeFor(file: File): string {
  if (file.type?.startsWith('image/')) return file.type;
  const extension = file.uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'image/jpeg';
}

// Uploads go straight from the device to Cloudflare R2: the API only signs the
// request, so file size isn't capped by Vercel's request body limit.
export async function uploadImage({
  uri,
  authorization,
  userToken,
  kind = 'image',
  onProgress,
}: UploadImageOptions): Promise<UploadImageResult> {
  // Reading the file and signing take real time on a phone, so they count
  // towards the bar too (0–15%); the transfer itself fills 15–99%.
  onProgress?.(0);
  const file = new File(uri);
  const bytes = await file.bytes();
  onProgress?.(8);
  const contentType = contentTypeFor(file);

  const headers: Record<string, string> = {
    Authorization: authorization,
    'Content-Type': 'application/json',
  };
  if (userToken) headers['X-User-Token'] = userToken;

  const presignResponse = await expoFetch(`${API_BASE_URL}/upload/presign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ kind, contentType, size: bytes.length }),
  });

  const presignText = await presignResponse.text();
  let presign: PresignResponse = {};
  try {
    presign = presignText ? JSON.parse(presignText) : {};
  } catch {
    // Preserve the raw response below when the server does not return JSON.
  }

  if (!presignResponse.ok || !presign.uploadUrl || !presign.url) {
    throw new Error(presign.error || `${presignResponse.status}: ${presignText || 'Upload failed'}`);
  }

  onProgress?.(15);

  await putWithProgress(
    presign.uploadUrl,
    presign.headers ?? { 'Content-Type': contentType },
    bytes,
    onProgress && (percent => onProgress(15 + Math.round(percent * 0.84))),
  );

  if (onProgress) {
    onProgress(100);
    // Small uploads finish in a blink — hold briefly so 100% is actually seen.
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return { url: presign.url };
}

// fetch can't report upload progress, so the PUT to R2 goes through XHR.
function putWithProgress(
  url: string,
  headers: Record<string, string>,
  bytes: Uint8Array,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = event => {
      if (!onProgress || !event.lengthComputable || event.total === 0) return;
      // Hold at 99 until the server confirms, so 100% always means "done".
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    // Send exactly the signed byte range (Content-Length is part of the signature).
    xhr.send(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  });
}
