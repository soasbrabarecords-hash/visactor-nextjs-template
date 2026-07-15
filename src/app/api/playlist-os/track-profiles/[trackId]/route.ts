import { NextResponse } from "next/server";
import { getPlaylistOsReadAccess } from "@/lib/playlist-os-read-access";
import {
  deleteTrackGenreOverride,
  getTrackGenreProfile,
  saveTrackGenreOverride,
} from "@/lib/track-profile-engine";
import {
  type TrackProfileGenre,
  isTrackProfileGenre,
} from "@/types/track-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ trackId: string }> };
type OverrideBody = {
  entityType?: "track" | "artist";
  entityId?: string;
  primaryGenre?: TrackProfileGenre;
  secondaryGenres?: TrackProfileGenre[];
  subgenres?: string[];
  moodTags?: string[];
  energyTags?: string[];
  languageSignal?: string | null;
  countrySignal?: string | null;
  note?: string | null;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

function validEntityType(value: unknown): value is "track" | "artist" {
  return value === "track" || value === "artist";
}

function validGenreList(value: unknown): value is TrackProfileGenre[] {
  return Array.isArray(value) && value.every(isTrackProfileGenre);
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const access = await getPlaylistOsReadAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: NO_STORE_HEADERS },
      );
    }
    const { trackId } = await params;
    const profile = await getTrackGenreProfile(trackId, {
      workspaceId: access.workspaceId,
    });
    return NextResponse.json(
      { success: true, profile },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o perfil da faixa.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const access = await getPlaylistOsReadAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: NO_STORE_HEADERS },
      );
    }
    const { trackId } = await params;
    const body = (await request.json()) as OverrideBody;
    const entityType = body.entityType ?? "track";
    const entityId = body.entityId?.trim() || trackId;
    if (
      !validEntityType(entityType) ||
      !entityId ||
      !isTrackProfileGenre(body.primaryGenre) ||
      (body.secondaryGenres !== undefined &&
        !validGenreList(body.secondaryGenres))
    ) {
      return NextResponse.json(
        { success: false, message: "Correção de gênero inválida." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    await saveTrackGenreOverride({
      workspaceId: access.workspaceId,
      userId: access.userId,
      entityType,
      entityId,
      primaryGenre: body.primaryGenre,
      secondaryGenres: body.secondaryGenres,
      subgenres: body.subgenres,
      moodTags: body.moodTags,
      energyTags: body.energyTags,
      languageSignal: body.languageSignal,
      countrySignal: body.countrySignal,
      note: body.note,
    });
    const profile = await getTrackGenreProfile(trackId, {
      workspaceId: access.workspaceId,
    });
    return NextResponse.json(
      { success: true, profile },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a correção de gênero.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const access = await getPlaylistOsReadAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: NO_STORE_HEADERS },
      );
    }
    const { trackId } = await params;
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType") ?? "track";
    const entityId = url.searchParams.get("entityId")?.trim() || trackId;
    if (!validEntityType(entityType)) {
      return NextResponse.json(
        { success: false, message: "Tipo de correção inválido." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    await deleteTrackGenreOverride({
      workspaceId: access.workspaceId,
      entityType,
      entityId,
    });
    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível remover a correção de gênero.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
