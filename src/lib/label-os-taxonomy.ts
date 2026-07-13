export const ARTIST_ROLE_OPTIONS = [
  { value: "artist", label: "Artista" },
  { value: "interpreter", label: "Interprete" },
  { value: "composer", label: "Compositor" },
  { value: "music_producer", label: "Produtor musical" },
] as const;

export type ArtistRole = (typeof ARTIST_ROLE_OPTIONS)[number]["value"];

export const ENTITY_CATEGORY_OPTIONS = [
  { value: "label", label: "Gravadora" },
  { value: "imprint", label: "Selo" },
  { value: "publisher", label: "Editora" },
  { value: "manager", label: "Manager" },
  { value: "company", label: "Empresa" },
  { value: "other", label: "Outro" },
] as const;

export type EntityCategory = (typeof ENTITY_CATEGORY_OPTIONS)[number]["value"];

export const LEGACY_ENTITY_CATEGORY_OPTIONS = [
  { value: "artist", label: "Artista" },
  { value: "producer", label: "Produtor" },
  { value: "composer", label: "Compositor" },
] as const;

export type LegacyEntityCategory =
  (typeof LEGACY_ENTITY_CATEGORY_OPTIONS)[number]["value"];

export type EntityType = EntityCategory | LegacyEntityCategory;

export const ENTITY_TYPE_OPTIONS = [
  ...LEGACY_ENTITY_CATEGORY_OPTIONS,
  ...ENTITY_CATEGORY_OPTIONS,
] as const;

export const ENTITY_FUNCTION_OPTIONS = [
  { value: "artist", label: "Artista" },
  { value: "interpreter", label: "Intérprete" },
  { value: "composer", label: "Compositor" },
  { value: "music_producer", label: "Produtor musical" },
  { value: "phonographic_producer", label: "Produtor fonografico" },
  { value: "musician", label: "Músico" },
  { value: "label", label: "Selo" },
  { value: "record_company", label: "Gravadora" },
  { value: "publisher", label: "Editora" },
  { value: "manager", label: "Manager" },
  { value: "company", label: "Empresa" },
  { value: "partner", label: "Parceiro" },
  { value: "distribution", label: "Distribuicao" },
  { value: "publishing_admin", label: "Admin editorial" },
  { value: "management_office", label: "Escritorio artistico" },
] as const;

export type EntityFunction =
  (typeof ENTITY_FUNCTION_OPTIONS)[number]["value"];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  label: "Gravadora",
  imprint: "Selo",
  publisher: "Editora",
  manager: "Manager",
  company: "Empresa",
  other: "Outro",
  artist: "Artista",
  producer: "Produtor",
  composer: "Compositor",
};

export const ARTIST_ROLE_LABELS: Record<ArtistRole, string> = {
  artist: "Artista",
  interpreter: "Interprete",
  composer: "Compositor",
  music_producer: "Produtor musical",
};

export const ENTITY_FUNCTION_LABELS: Record<EntityFunction, string> = {
  artist: "Artista",
  interpreter: "Intérprete",
  composer: "Compositor",
  music_producer: "Produtor musical",
  phonographic_producer: "Produtor fonografico",
  musician: "Músico",
  label: "Selo",
  record_company: "Gravadora",
  publisher: "Editora",
  manager: "Manager",
  company: "Empresa",
  partner: "Parceiro",
  distribution: "Distribuicao",
  publishing_admin: "Admin editorial",
  management_office: "Escritorio artistico",
};

export const ENTITY_KIND_OPTIONS = [
  { value: "person", label: "Pessoa física" },
  { value: "company", label: "Pessoa jurídica" },
] as const;

export type EntityKind = (typeof ENTITY_KIND_OPTIONS)[number]["value"];

export const ENTITY_KIND_LABELS: Record<EntityKind, string> = {
  person: "Pessoa física",
  company: "Pessoa jurídica",
};
