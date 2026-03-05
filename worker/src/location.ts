import type { Env } from './types';

interface PendingLocation {
  lat: number;
  lng: number;
  name: string;
  timestamp: number;
}

interface LastPost {
  slug: string;
  timestamp: number;
}

const LOCATION_TTL = 300; // 5 minutes

export async function storePendingLocation(
  env: Env,
  chatId: number,
  location: PendingLocation,
): Promise<void> {
  await env.MEDIA_GROUPS.put(
    `loc:${chatId}`,
    JSON.stringify(location),
    { expirationTtl: LOCATION_TTL },
  );
}

export async function getPendingLocation(
  env: Env,
  chatId: number,
): Promise<PendingLocation | null> {
  const data = await env.MEDIA_GROUPS.get(`loc:${chatId}`, 'json') as PendingLocation | null;
  if (data) {
    await env.MEDIA_GROUPS.delete(`loc:${chatId}`);
  }
  return data;
}

export async function storeLastPost(
  env: Env,
  chatId: number,
  slug: string,
): Promise<void> {
  await env.MEDIA_GROUPS.put(
    `lastpost:${chatId}`,
    JSON.stringify({ slug, timestamp: Date.now() } as LastPost),
    { expirationTtl: LOCATION_TTL },
  );
}

export async function getLastPost(
  env: Env,
  chatId: number,
): Promise<LastPost | null> {
  return await env.MEDIA_GROUPS.get(`lastpost:${chatId}`, 'json') as LastPost | null;
}

export async function updatePostLocation(
  env: Env,
  slug: string,
  location: { lat: number; lng: number; name: string },
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': '360degre-es-bot',
  };
  const apiBase = `https://api.github.com/repos/${env.GITHUB_REPO}`;
  const path = `src/content/posts/${slug}.md`;

  // Get current file content + SHA
  const fileRes = await fetch(`${apiBase}/contents/${path}`, { headers });
  if (!fileRes.ok) {
    throw new Error(`Failed to get post file: ${fileRes.status}`);
  }
  const fileData = await fileRes.json() as { content: string; sha: string };
  const content = atob(fileData.content.replace(/\n/g, ''));

  // Insert location into frontmatter
  const updated = addLocationToMarkdown(content, location);

  // Push updated file
  const updateRes = await fetch(`${apiBase}/contents/${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `loc: ${slug} — ${location.name}`,
      content: btoa(unescape(encodeURIComponent(updated))),
      sha: fileData.sha,
    }),
  });

  if (!updateRes.ok) {
    throw new Error(`Failed to update post: ${updateRes.status}`);
  }
}

function addLocationToMarkdown(
  markdown: string,
  location: { lat: number; lng: number; name: string },
): string {
  // Insert location block after author line in frontmatter
  const locationYaml = `location:\n  lat: ${location.lat}\n  lng: ${location.lng}\n  name: ${escapeYaml(location.name)}`;

  // Check if location already exists
  if (markdown.includes('location:')) {
    return markdown;
  }

  // Insert after the author line
  return markdown.replace(
    /^(author: .+)$/m,
    `$1\n${locationYaml}`,
  );
}

function escapeYaml(str: string): string {
  if (
    str.includes(':') ||
    str.includes('#') ||
    str.includes("'") ||
    str.includes('"') ||
    str.includes('\n') ||
    str.startsWith(' ') ||
    str.endsWith(' ')
  ) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}
