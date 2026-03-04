import type { Env, TelegramMessage, MediaGroupEntry, PostData } from './types';
import { downloadPhoto, getLargestPhoto, sendMessage } from './telegram';
import { getPostSlug, getImageFilename, generateMarkdown } from './post';
import { pushPostToGitHub } from './github';

export async function handleMediaGroup(
  message: TelegramMessage,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const groupId = message.media_group_id!;
  const kvKey = `mg:${groupId}`;

  // Read existing group data
  const existing = (await env.MEDIA_GROUPS.get(kvKey, 'json')) as
    | MediaGroupEntry[]
    | null;
  const entries = existing || [];

  const largest = getLargestPhoto(message.photo!);

  entries.push({
    message_id: message.message_id,
    photo_file_id: largest.file_id,
    caption: message.caption || null,
    date: message.date,
    from_id: message.from.id,
    width: largest.width,
    height: largest.height,
  });

  // Write back with TTL
  await env.MEDIA_GROUPS.put(kvKey, JSON.stringify(entries), {
    expirationTtl: 60,
  });

  const expectedCount = entries.length;

  // Schedule delayed processing
  ctx.waitUntil(
    new Promise<void>((resolve) => setTimeout(resolve, 3000)).then(
      async () => {
        const current = (await env.MEDIA_GROUPS.get(kvKey, 'json')) as
          | MediaGroupEntry[]
          | null;

        if (!current || current.length !== expectedCount) {
          // More messages arrived or already processed
          return;
        }

        try {
          await processMediaGroup(current, message.chat.id, env);
          await env.MEDIA_GROUPS.delete(kvKey);
        } catch (err) {
          console.error('Failed to process media group:', err);
          await sendMessage(
            message.chat.id,
            "Fehler — probier's nochmal.",
            env.TELEGRAM_BOT_TOKEN,
          );
        }
      },
    ),
  );
}

function getAuthor(userId: number, env: Env): string {
  if (String(userId) === env.BENE_TELEGRAM_ID) return 'Bene';
  if (String(userId) === env.SANDRA_TELEGRAM_ID) return 'Sandra';
  return 'Unknown';
}

async function processMediaGroup(
  entries: MediaGroupEntry[],
  chatId: number,
  env: Env,
): Promise<void> {
  // Sort by message_id to maintain order
  entries.sort((a, b) => a.message_id - b.message_id);

  const caption = entries.find((e) => e.caption !== null)?.caption || '';
  const firstEntry = entries[0];
  const date = new Date(firstEntry.date * 1000);
  const author = getAuthor(firstEntry.from_id, env);
  const slug = getPostSlug(date);

  // Download all images
  const images: PostData['images'] = [];
  const imageFiles: Array<{ path: string; data: ArrayBuffer }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const filename = getImageFilename(date, i);
    const data = await downloadPhoto(entry.photo_file_id, env.TELEGRAM_BOT_TOKEN);

    images.push({ filename, data, width: entry.width, height: entry.height });
    imageFiles.push({ path: `src/assets/posts/${filename}`, data });
  }

  const post: PostData = {
    date,
    author,
    text: caption,
    images,
  };

  const markdown = generateMarkdown(post);
  const markdownPath = `src/content/posts/${slug}.md`;

  await pushPostToGitHub(
    markdownPath,
    markdown,
    imageFiles,
    `post: ${slug} (${author})`,
    env,
  );

  await sendMessage(chatId, 'Posted!', env.TELEGRAM_BOT_TOKEN);
}
