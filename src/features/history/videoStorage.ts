import { Directory, File, Paths } from 'expo-file-system';

/** Clips live in <documents>/clips so they survive cache purges but never leave the device. */
export function clipsDirectory(): Directory {
  const dir = new Directory(Paths.document, 'clips');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export async function persistClip(sourceUri: string, id: string): Promise<string> {
  const src = new File(sourceUri.startsWith('file://') ? sourceUri : `file://${sourceUri}`);
  const ext = src.extension || '.mp4';
  const dest = new File(clipsDirectory(), `${id}${ext.startsWith('.') ? ext : `.${ext}`}`);
  if (dest.exists) dest.delete();
  await src.copy(dest);
  return dest.uri;
}

export function deleteLocalFile(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}

export function deleteAllClips() {
  try {
    const dir = new Directory(Paths.document, 'clips');
    if (dir.exists) dir.delete();
  } catch {
    // ignore
  }
  try {
    const cards = new Directory(Paths.cache, 'score-cards');
    if (cards.exists) cards.delete();
  } catch {
    // ignore
  }
}
