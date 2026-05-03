import { NextResponse } from "next/server";
import { setSpotifyAuthCookies, withSpotifyToken } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StartPlaybackBody = {
  deviceId?: string;
  spotifyTrackId?: string;
};

async function transferPlaybackToDevice(accessToken: string, deviceId: string) {
  const response = await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false,
    }),
    cache: "no-store",
  });

  if (!response.ok && response.status !== 204) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; reason?: string };
    };

    throw new Error(
      payload.error?.message?.trim() ||
        payload.error?.reason?.trim() ||
        "Nao foi possivel transferir o playback para o player web.",
    );
  }
}

async function startTrackPlayback(
  accessToken: string,
  deviceId: string,
  spotifyTrackId: string,
) {
  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [`spotify:track:${spotifyTrackId}`],
      }),
      cache: "no-store",
    },
  );

  if (!response.ok && response.status !== 204) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; reason?: string };
    };

    throw new Error(
      payload.error?.message?.trim() ||
        payload.error?.reason?.trim() ||
        "Nao foi possivel iniciar a faixa no player web.",
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as StartPlaybackBody;
    const deviceId = body.deviceId?.trim();
    const spotifyTrackId = body.spotifyTrackId?.trim();

    if (!deviceId || !spotifyTrackId) {
      return NextResponse.json(
        {
          message: "deviceId e spotifyTrackId sao obrigatorios.",
        },
        { status: 400 },
      );
    }

    const { refreshedToken } = await withSpotifyToken(async (accessToken) => {
      await transferPlaybackToDevice(accessToken, deviceId);
      await startTrackPlayback(accessToken, deviceId, spotifyTrackId);
      return true;
    });

    const response = NextResponse.json({ success: true });

    if (refreshedToken) {
      setSpotifyAuthCookies(response, refreshedToken);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel iniciar o playback no Spotify.",
      },
      { status: 500 },
    );
  }
}
