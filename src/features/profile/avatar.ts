import * as ImagePicker from 'expo-image-picker';

import { db, unwrap } from '@/data/db';

/** Elige una imagen (recorte cuadrado), la sube a `avatars/<uid>/` y la guarda en el perfil. */
export async function pickAndUploadAvatar(uid: string): Promise<'ok' | 'cancelled' | 'denied'> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return 'denied';
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
  if (r.canceled || !r.assets[0]) return 'cancelled';
  const asset = r.assets[0];
  const ext = (asset.mimeType ?? 'image/jpeg').split('/')[1] === 'png' ? 'png' : 'jpg';
  const path = `${uid}/avatar-${Date.now()}.${ext}`;
  const body = await (await fetch(asset.uri)).arrayBuffer();
  const up = await db().storage.from('avatars').upload(path, body, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });
  if (up.error) throw up.error;
  unwrap(await db().from('profiles').update({ avatar_path: path }).eq('id', uid));
  return 'ok';
}

/** URL firmada temporal (el bucket es privado). */
export async function avatarUrl(path: string): Promise<string | null> {
  const { data } = await db().storage.from('avatars').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
