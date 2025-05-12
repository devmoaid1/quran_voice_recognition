let cachedQuranPageMap = null;

export async function getPageFromAyah(sura, ayah) {
  // Load only once and cache it
  if (!cachedQuranPageMap) {
    const res = await fetch('/quran_data.json');
    cachedQuranPageMap = await res.json();
  }

  let page = 1;
  for (let i = 1; i < cachedQuranPageMap.length; i++) {
    const [psura, payah] = cachedQuranPageMap[i];
    if (sura < psura || (sura === psura && ayah < payah)) break;
    page = i;
  }

  return page;
}
