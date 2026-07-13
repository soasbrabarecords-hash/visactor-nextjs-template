import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import { getLabelEntities } from "@/lib/label-entities";
import {
  ENTITY_FUNCTION_LABELS,
  ENTITY_TYPE_LABELS,
  type EntityFunction,
} from "@/lib/label-os-taxonomy";

export const dynamic = "force-dynamic";

const TYPE_COLOR: Record<string, string> = {
  label: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  imprint:
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  publisher:
    "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  manager: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  company: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  other: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  artist:
    "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  producer:
    "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  composer:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
};

type Props = {
  searchParams: Promise<{ view?: string }>;
};

export default async function EntitiesPage({ searchParams }: Props) {
  const entities = await getLabelEntities();
  const { view = "all" } = await searchParams;
  const filteredEntities = entities.filter((entity) => {
    if (view === "artists") {
      return entity.type === "artist" || entity.roles.includes("artist");
    }
    if (view === "people") return entity.entity_kind === "person";
    if (view === "companies") return entity.entity_kind === "company";
    return true;
  });

  return (
    <div>
      <PageIntro
        eyebrow="Label OS"
        title="Pessoas e Entidades"
        description="Uma base única para artistas, compositores, intérpretes, produtores, selos, gravadoras, editoras e parceiros."
        action={
          <Link
            href="/label-os/entities/new"
            className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={15} />
            Novo participante
          </Link>
        }
      />

      <Container className="py-8">
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { value: "all", label: "Todos" },
            { value: "artists", label: "Artistas" },
            { value: "people", label: "Pessoas" },
            { value: "companies", label: "Empresas" },
          ].map((item) => (
            <Link
              key={item.value}
              href={
                item.value === "all"
                  ? "/label-os/entities"
                  : `/label-os/entities?view=${item.value}`
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                view === item.value
                  ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        {filteredEntities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Nenhuma pessoa ou entidade encontrada neste filtro.{" "}
            <Link
              href="/label-os/entities/new"
              className="underline underline-offset-2"
            >
              Cadastrar participante
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/45">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Funcoes
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Instagram
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Spotify
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredEntities.map((entity) => (
                  <tr
                    key={entity.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {entity.display_name ?? entity.name}
                      </div>
                      {entity.display_name && (
                        <div className="text-xs text-muted-foreground">
                          {entity.name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLOR[entity.type] ?? TYPE_COLOR.other}`}
                      >
                        {ENTITY_TYPE_LABELS[entity.type] ?? entity.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entity.roles?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {entity.roles.map((role) => (
                            <span
                              key={role}
                              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {ENTITY_FUNCTION_LABELS[role as EntityFunction] ??
                                role}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entity.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entity.instagram ? (
                        <a
                          href={`https://instagram.com/${entity.instagram.replace("@", "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          {entity.instagram}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entity.spotify_url ? (
                        <a
                          href={entity.spotify_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          Ver perfil
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/label-os/entities/${entity.id}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        <Pencil size={12} />
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </div>
  );
}
