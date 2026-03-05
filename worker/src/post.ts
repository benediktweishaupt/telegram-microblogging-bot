import type { PostData } from './types';

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}-${m}-${d}-${h}${min}${s}`;
}

export function getPostSlug(date: Date): string {
  return formatTimestamp(date);
}

export function getImageFilename(
  date: Date,
  index: number,
): string {
  const slug = formatTimestamp(date);
  const num = String(index + 1).padStart(2, '0');
  return `${slug}-${num}.jpg`;
}

export function extractHashtags(text: string): { cleanText: string; tags: string[] } {
  const tags: string[] = [];
  const cleanText = text.replace(/#([\w\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df]+)/g, (_, tag) => {
    tags.push(tag.toLowerCase());
    return '';
  }).replace(/\s{2,}/g, ' ').trim();
  return { cleanText, tags: [...new Set(tags)] };
}

export function extractDate(text: string): { cleanText: string; date: Date | null } {
  const match = text.match(/^@(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\s*/);
  if (!match) return { cleanText: text, date: null };

  const [fullMatch, dateStr, timeStr] = match;
  const time = timeStr || '12:00';
  const date = new Date(`${dateStr}T${time}:00.000Z`);

  if (isNaN(date.getTime())) return { cleanText: text, date: null };

  return { cleanText: text.slice(fullMatch.length), date };
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

export function generateMarkdown(post: PostData): string {
  const lines: string[] = ['---'];

  lines.push(`date: ${post.date.toISOString()}`);
  lines.push(`author: ${post.author}`);

  if (post.location) {
    lines.push('location:');
    lines.push(`  lat: ${post.location.lat}`);
    lines.push(`  lng: ${post.location.lng}`);
    lines.push(`  name: ${escapeYaml(post.location.name)}`);
  }

  if (post.tags.length > 0) {
    lines.push(`tags: [${post.tags.map((t) => escapeYaml(t)).join(', ')}]`);
  } else {
    lines.push('tags: []');
  }

  if (post.images.length > 0) {
    lines.push('images:');
    for (const img of post.images) {
      lines.push(`  - src: ../../assets/posts/${img.filename}`);
      lines.push(`    width: ${img.width}`);
      lines.push(`    height: ${img.height}`);
    }
  } else {
    lines.push('images: []');
  }

  lines.push('---');

  if (post.text) {
    lines.push(post.text);
  }

  lines.push('');
  return lines.join('\n');
}
