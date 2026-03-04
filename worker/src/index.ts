import type { Env, TelegramUpdate, PostData } from './types';
import { downloadPhoto, getLargestPhoto, sendMessage } from './telegram';
import {
  reverseGeocode,
  extractCoordsFromText,
  resolveShortUrl,
} from './geocoding';
import { pushPostToGitHub } from './github';
import { getPostSlug, getImageFilename, generateMarkdown } from './post';
import { handleMediaGroup } from './media-group';

function getAuthor(userId: number, env: Env): string | null {
  if (String(userId) === env.BENE_TELEGRAM_ID) return 'Bene';
  if (String(userId) === env.SANDRA_TELEGRAM_ID) return 'Sandra';
  return null;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify webhook secret
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const update = (await request.json()) as TelegramUpdate;
      const message = update.message;

      if (!message) {
        return new Response('OK', { status: 200 });
      }

      // Check author
      const author = getAuthor(message.from.id, env);
      if (!author) {
        return new Response('OK', { status: 200 });
      }

      // Route by message type
      if (message.photo && message.media_group_id) {
        // Media group photo — buffer and process later
        await handleMediaGroup(message, env, ctx);
      } else if (message.photo) {
        // Single photo
        ctx.waitUntil(handleSinglePhoto(message, author, env));
      } else if (message.location) {
        // Telegram native location
        ctx.waitUntil(handleLocation(message, author, env));
      } else if (message.text) {
        // Text message (may contain Google Maps link)
        ctx.waitUntil(handleText(message, author, env));
      }
    } catch (err) {
      console.error('Webhook handler error:', err);
    }

    // Always return 200 to prevent Telegram retries
    return new Response('OK', { status: 200 });
  },
};

async function handleSinglePhoto(
  message: NonNullable<TelegramUpdate['message']>,
  author: string,
  env: Env,
): Promise<void> {
  try {
    const date = new Date(message.date * 1000);
    const slug = getPostSlug(date);
    const largest = getLargestPhoto(message.photo!);

    const imageData = await downloadPhoto(
      largest.file_id,
      env.TELEGRAM_BOT_TOKEN,
    );
    const filename = getImageFilename(date, 0);

    const post: PostData = {
      date,
      author,
      text: message.caption || '',
      images: [
        { filename, data: imageData, width: largest.width, height: largest.height },
      ],
    };

    const markdown = generateMarkdown(post);

    await pushPostToGitHub(
      `src/content/posts/${slug}.md`,
      markdown,
      [{ path: `src/assets/posts/${filename}`, data: imageData }],
      `post: ${slug} (${author})`,
      env,
    );

    await sendMessage(message.chat.id, 'Posted!', env.TELEGRAM_BOT_TOKEN);
  } catch (err) {
    console.error('Single photo error:', err);
    await sendMessage(
      message.chat.id,
      "Fehler — probier's nochmal.",
      env.TELEGRAM_BOT_TOKEN,
    );
  }
}

async function handleLocation(
  message: NonNullable<TelegramUpdate['message']>,
  author: string,
  env: Env,
): Promise<void> {
  try {
    const { latitude: lat, longitude: lng } = message.location!;
    const locationName = await reverseGeocode(lat, lng);
    const date = new Date(message.date * 1000);
    const slug = getPostSlug(date);

    const post: PostData = {
      date,
      author,
      text: '',
      images: [],
      location: {
        lat,
        lng,
        name: locationName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      },
    };

    const markdown = generateMarkdown(post);

    await pushPostToGitHub(
      `src/content/posts/${slug}.md`,
      markdown,
      [],
      `post: ${slug} (${author})`,
      env,
    );

    const response = locationName
      ? `Posted! 📍 ${locationName}`
      : 'Posted!';
    await sendMessage(message.chat.id, response, env.TELEGRAM_BOT_TOKEN);
  } catch (err) {
    console.error('Location error:', err);
    await sendMessage(
      message.chat.id,
      "Fehler — probier's nochmal.",
      env.TELEGRAM_BOT_TOKEN,
    );
  }
}

async function handleText(
  message: NonNullable<TelegramUpdate['message']>,
  author: string,
  env: Env,
): Promise<void> {
  try {
    const text = message.text!;
    const date = new Date(message.date * 1000);
    const slug = getPostSlug(date);

    // Check for Google Maps link
    let location: PostData['location'];
    const coords =
      extractCoordsFromText(text) || (await resolveShortUrl(text));

    if (coords) {
      const locationName = await reverseGeocode(coords.lat, coords.lng);
      location = {
        lat: coords.lat,
        lng: coords.lng,
        name: locationName || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
      };
    }

    const post: PostData = {
      date,
      author,
      text,
      images: [],
      location,
    };

    const markdown = generateMarkdown(post);

    await pushPostToGitHub(
      `src/content/posts/${slug}.md`,
      markdown,
      [],
      `post: ${slug} (${author})`,
      env,
    );

    const response = location ? `Posted! 📍 ${location.name}` : 'Posted!';
    await sendMessage(message.chat.id, response, env.TELEGRAM_BOT_TOKEN);
  } catch (err) {
    console.error('Text error:', err);
    await sendMessage(
      message.chat.id,
      "Fehler — probier's nochmal.",
      env.TELEGRAM_BOT_TOKEN,
    );
  }
}
