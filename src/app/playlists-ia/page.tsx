import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import ModuleGuard from "@/components/workspace/module-guard";
import PlaylistsAiWorkbench, {
  type PlaylistsAiChartTrack,
} from "@/components/workspace/playlists-ai-workbench";
import { getSnapshotDates, getSnapshotWithComparison } from "@/lib/chart-snapshots";

export const revalidate = 300;

export default async function PlaylistsIaPage() {
  const dates = await getSnapshotDates("BR");
  const selectedDate = dates[0] ?? null;
  const snapshot = selectedDate
    ? await getSnapshotWithComparison(selectedDate, "BR")
    : null;
  const chartTracks: PlaylistsAiChartTrack[] = (snapshot?.tracks ?? [])
    .slice(0, 80)
    .map((track) => ({
      id: track.id,
      spotifyTrackId: track.spotify_track_id,
      title: track.track_name,
      artist: track.artist_name ?? "Artista desconhecido",
      imageUrl: track.image_url,
      position: track.position,
      status: track.status,
      positionChange: track.position_change,
      streams: track.streams,
    }));

  return (
    <ModuleGuard moduleKey="playlist_os">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.10),transparent_26%),radial-gradient(circle_at_90%_0%,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]">
        <TopNav title="Playlist OS" />

        <Container className="py-6">
          <PlaylistsAiWorkbench
            chartTracks={chartTracks}
            chartDate={selectedDate}
          />
        </Container>
      </div>
    </ModuleGuard>
  );
}
