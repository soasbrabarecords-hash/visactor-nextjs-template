/**
 * genre-detection.ts — fonte única de verdade para classificação de gênero
 *
 * Usado por:
 *  - curation-table.tsx (Top 200 BR)
 *  - playlist-kworb-suggestions.tsx (sugestões na página de edição)
 *
 * Regras:
 *  - Primeiro artista define o gênero em collabs
 *  - First-match-wins na lista de scores
 *  - Cada artista/termo aparece em apenas um gênero
 */

export type TrackGenre =
  | "funk"
  | "trap"
  | "rap"
  | "sertanejo"
  | "pagode"
  | "piseiro"
  | "pop"
  | "rock"
  | "reggae"
  | "unknown";

export function normalizeGenreText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function countMatches(text: string, terms: string[]): number {
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

/**
 * Detect genre from first artist + track name.
 * Pass raw (un-normalized) strings — normalization happens internally.
 */
export function detectGenre(
  artists: string,
  trackName: string,
): TrackGenre {
  const firstArtist = normalizeGenreText(
    artists.split(/,|feat\.|part\./i)[0].trim(),
  );
  const name = normalizeGenreText(trackName);
  const text = `${firstArtist} ${name}`.trim();

  // Sertanejo — checked first because "ao vivo" collabs often mix with others
  const sertanejoScore = countMatches(text, [
    "sertanejo", "modao", "agro", "universitario",
    "ze neto", "cristiano", "murilo huff", "marilia mendonca",
    "panda", "mj records", "gusttavo lima",
    "danilo e davi", "danilo & davi",
    "junior e cezar", "junior & cezar",
    "diego e arnaldo", "diego & arnaldo",
    "fred e fabricio", "fred & fabricio",
    "jorge e matheus", "jorge & matheus",
    "matheus vargas",
    "cleber e cauan", "cleber & cauan",
    "hugo e guilherme", "hugo & guilherme",
    "vitor e leo", "vitor & leo",
    "michel telo", "michel teló",
    "diego e vitor hugo", "diego & vitor hugo",
    "diego e victor hugo", "diego & victor hugo",
    "mayke e rodrigo", "mayke & rodrigo",
    "joao bosco e vinicius", "joao bosco & vinicius",
    "matheus e kauan", "matheus & kauan",
    "lauana prado", "simone mendes", "luan santana",
    "felipe e rodrigo", "felipe & rodrigo",
    "clayton e romario", "clayton & romario",
    "henrique e juliano", "henrique & juliano",
    "ze felipe", "zé felipe",
    "maiara e maraisa", "maiara & maraisa",
    "joao gustavo e murilo",
    "guilherme e benuto", "guilherme & benuto",
    "zeze di camargo", "zezé di camargo", "luan pereira", "jeninho",
    "fernando & sorocaba", "fernando e sorocaba",
    "jorge & mateus", "jorge e mateus",
  ]);
  if (sertanejoScore > 0) return "sertanejo";

  // Pagode / Samba — pagode and samba are the SAME genre bucket
  const pagodeScore = countMatches(text, [
    "pagode", "samba",
    "grupo menos e mais", "menos e mais",
    "ferrugem", "thiaguinho", "sorriso maroto",
    "turma do pagode", "mumuzinho", "molejo",
    "leo foguete", "yan",
    "henrique casttro", "henrique castro",
  ]);
  if (pagodeScore > 0) return "pagode";

  // Piseiro / Forró
  const piseiroScore = countMatches(text, [
    "piseiro", "pisadinha", "forro",
    "vitinho imperator", "vitinho imperador",
    "nattan", "heitor santos", "henry freitas",
    "netto brito", "wesley safadao", "wesley safadão",
    "priscila senna",
    "ze vaqueiro", "zé vaqueiro",
    "mari fernandez", "grelo", "natanzinho lima",
  ]);
  if (piseiroScore > 0) return "piseiro";

  // Rock
  const rockScore = countMatches(text, [
    "rock", "guns n roses", "guns n' roses", "legiao urbana", "legião urbana",
    "o rappa", "charlie brown", "charlie brown jr",
  ]);
  if (rockScore > 0) return "rock";

  // Reggae
  const reggaeScore = countMatches(text, [
    "natiruts", "reggae",
  ]);
  if (reggaeScore > 0) return "reggae";

  // Pop
  const popScore = countMatches(text, [
    "bts", "kpop", "michael jackson", "justin bieber",
    "taylor swift",
  ]);
  if (popScore > 0) return "pop";

  // Trap BR (before funk — trap artists don't have "mc" prefix)
  const trapScore = countMatches(text, [
    "trap",
    "matue", "matuê", "veigh", "sotam", "kayblack",
    "supernova ent", "marina sena",
  ]);
  if (trapScore > 0) return "trap";


  // Rap / Hip-hop
  const rapScore = countMatches(text, [
    "rap", "drill", "hip hop", "hip-hop",
    "mc cabelinho", "2zdnizz", "2zdinizz", "hhr",
    "racionais", "charlie brown",
    "bk",
    "nanda tsunami", "nandatsunami",
    "poesia acustica", "poesia acústica",
  ]);
  if (rapScore > 0) return "rap";

  // Funk / Baile funk (mc prefix here — checked after trap/rap)
  const funkScore = countMatches(text, [
    "mc", "dj", "funk", "baile", "mandelao",
    "automotivo", "proibidao", "rave",
    "japa nk", "meno k",
    "mc ryan sp", "mc ig", "mc luuky", "mc gu", "lele jp",
    "poze do rodo", "pedro sampaio", "anitta",
    "dexhenry", "aaron modesto",
  ]);
  if (funkScore > 0) return "funk";

  return "unknown";
}

/**
 * Detect playlist vibe from its name + description.
 * Returns the genre that should be used to filter Kworb suggestions.
 */
export function detectPlaylistGenre(name: string, description: string): TrackGenre {
  const t = normalizeGenreText(`${name} ${description}`);

  if (/funk|baile|mandelao|automotivo|proibidao|rave/.test(t)) return "funk";
  if (/\btrap\b/.test(t)) return "trap";
  if (/\brap\b|drill|hip.?hop/.test(t)) return "rap";
  if (/sertanejo|modao|agro|universitario|caipira/.test(t)) return "sertanejo";
  if (/pagode|samba|ax[eé]/.test(t)) return "pagode";
  if (/piseiro|pisadinha|forr[oó]|nordeste|xote/.test(t)) return "piseiro";
  if (/\brock\b|guns.?n.?roses|legiao urbana/.test(t)) return "rock";
  if (/reggae|roots/.test(t)) return "reggae";
  if (/\bpop\b|kpop|hits|viral/.test(t)) return "pop";

  return "unknown";
}

export const GENRE_LABEL: Record<TrackGenre, string> = {
  funk: "Funk",
  trap: "Trap",
  rap: "Rap",
  sertanejo: "Sertanejo",
  pagode: "Pagode",
  piseiro: "Piseiro",
  pop: "Pop",
  rock: "Rock",
  reggae: "Reggae",
  unknown: "—",
};
