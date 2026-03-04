import type { TelegramPhotoSize } from './types';

export async function downloadPhoto(
  fileId: string,
  botToken: string,
): Promise<ArrayBuffer> {
  const fileInfoRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
  );
  const fileInfo = (await fileInfoRes.json()) as {
    ok: boolean;
    result: { file_path: string };
  };

  if (!fileInfo.ok) {
    throw new Error('Failed to get file info from Telegram');
  }

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
  const res = await fetch(fileUrl);

  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status}`);
  }

  return res.arrayBuffer();
}

export function getLargestPhoto(photos: TelegramPhotoSize[]): TelegramPhotoSize {
  return photos[photos.length - 1];
}

export async function sendMessage(
  chatId: number,
  text: string,
  botToken: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
