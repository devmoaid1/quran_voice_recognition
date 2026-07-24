let cachedAyahPageMap = null;

export async function getPageFromAyah(sura, ayah) {
  if (!cachedAyahPageMap) {
    const res = await fetch('/ayah_page_map.json');
    cachedAyahPageMap = await res.json();
  }

  const page = cachedAyahPageMap[`${sura}:${ayah}`];
  return page ?? 1;
}
