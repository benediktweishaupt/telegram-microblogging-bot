export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  BENE_TELEGRAM_ID: string;
  SANDRA_TELEGRAM_ID: string;
  MEDIA_GROUPS: KVNamespace;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from: { id: number; first_name: string };
  chat: { id: number };
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  location?: { latitude: number; longitude: number };
  media_group_id?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface MediaGroupEntry {
  message_id: number;
  photo_file_id: string;
  caption: string | null;
  date: number;
  from_id: number;
  width: number;
  height: number;
}

export interface PostData {
  date: Date;
  author: string;
  text: string;
  tags: string[];
  images: Array<{
    filename: string;
    data: ArrayBuffer;
    width: number;
    height: number;
  }>;
  location?: { lat: number; lng: number; name: string };
}
