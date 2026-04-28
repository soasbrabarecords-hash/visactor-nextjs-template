import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import TrackForm from "@/components/label-os/track-form";

export const dynamic = "force-dynamic";

export default function NewTrackPage() {
  return (
    <div>
      <PageIntro
        eyebrow="Label OS / Tracks"
        title="Nova Track"
        description="Cadastre uma nova faixa no catálogo da gravadora."
      />
      <Container className="py-8">
        <div className="max-w-3xl">
          <TrackForm />
        </div>
      </Container>
    </div>
  );
}
