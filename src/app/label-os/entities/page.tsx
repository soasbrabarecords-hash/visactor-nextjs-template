import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
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
  imprint: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  publisher: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  manager: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  company: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  other: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  artist: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  producer: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  composer: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
};

export default async function EntitiesPage() {
  const entities = await getLabelEntities();

  return (
    <div>
      <PageIntro
        eyebrow="Label OS"
        title="Entidades"
        description="Cadastro juridico e operacional para gravadoras, selos, editoras, managers e parceiros da operacao."
        action={
          <Link
            href="/label-os/entities/new"
            className="flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            <Plus size={15} />
            Nova Entidade
          </Link>
        }
      />

      <Container className="py-8">
        {entities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Nenhuma entidade cadastrada ainda.{" "}
            <Link
              href="/label-os/entities/new"
              className="underline underline-offset-2"
            >
              Cadastrar primeira entidade
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-slate-900">
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
                {entities.map((entity) => (
                  <tr
                    key={entity.id}
                    className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900"
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
                              {ENTITY_FUNCTION_LABELS[role as EntityFunction] ?? role}
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
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
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
