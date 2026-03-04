import type { Env } from './types';

interface TreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function pushPostToGitHub(
  markdownPath: string,
  markdownContent: string,
  images: Array<{ path: string; data: ArrayBuffer }>,
  commitMessage: string,
  env: Env,
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': '360degre-es-bot',
  };
  const apiBase = `https://api.github.com/repos/${env.GITHUB_REPO}`;

  // 1. Get latest commit SHA on main
  const refRes = await fetch(`${apiBase}/git/ref/heads/main`, { headers });
  if (!refRes.ok) {
    throw new Error(`Failed to get ref: ${refRes.status} ${await refRes.text()}`);
  }
  const refData = (await refRes.json()) as { object: { sha: string } };
  const latestCommitSha = refData.object.sha;

  // 2. Get the tree SHA of that commit
  const commitRes = await fetch(
    `${apiBase}/git/commits/${latestCommitSha}`,
    { headers },
  );
  const commitData = (await commitRes.json()) as { tree: { sha: string } };
  const baseTreeSha = commitData.tree.sha;

  // 3. Create blobs for all files
  const treeEntries: TreeEntry[] = [];

  // Markdown blob (utf-8)
  const mdBlobRes = await fetch(`${apiBase}/git/blobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: markdownContent, encoding: 'utf-8' }),
  });
  if (!mdBlobRes.ok) {
    throw new Error(`Failed to create MD blob: ${mdBlobRes.status}`);
  }
  const mdBlob = (await mdBlobRes.json()) as { sha: string };
  treeEntries.push({
    path: markdownPath,
    mode: '100644',
    type: 'blob',
    sha: mdBlob.sha,
  });

  // Image blobs (base64)
  for (const img of images) {
    const imgBlobRes = await fetch(`${apiBase}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: arrayBufferToBase64(img.data),
        encoding: 'base64',
      }),
    });
    if (!imgBlobRes.ok) {
      throw new Error(`Failed to create image blob: ${imgBlobRes.status}`);
    }
    const imgBlob = (await imgBlobRes.json()) as { sha: string };
    treeEntries.push({
      path: img.path,
      mode: '100644',
      type: 'blob',
      sha: imgBlob.sha,
    });
  }

  // 4. Create a new tree
  const treeRes = await fetch(`${apiBase}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });
  if (!treeRes.ok) {
    throw new Error(`Failed to create tree: ${treeRes.status}`);
  }
  const tree = (await treeRes.json()) as { sha: string };

  // 5. Create a new commit
  const newCommitRes = await fetch(`${apiBase}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: commitMessage,
      tree: tree.sha,
      parents: [latestCommitSha],
    }),
  });
  if (!newCommitRes.ok) {
    throw new Error(`Failed to create commit: ${newCommitRes.status}`);
  }
  const newCommit = (await newCommitRes.json()) as { sha: string };

  // 6. Update the ref to point to the new commit
  const updateRes = await fetch(`${apiBase}/git/refs/heads/main`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: newCommit.sha }),
  });
  if (!updateRes.ok) {
    throw new Error(`Failed to update ref: ${updateRes.status}`);
  }
}
