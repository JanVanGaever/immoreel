import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PhotoUploader } from "@/components/upload";

export const metadata: Metadata = { title: "Media" };

export default function MediaPage() {
  return (
    <>
      <PageHeader
        title="Media"
        description="Foto's, drone-beelden, muziek en voice-overs die je in video's gebruikt."
      />

      {/*
        Zonder `transport` loopt de upload op een nabootsing: het scherm werkt
        volledig, maar er gaat nog niets naar object storage. Zodra die er is:
        `transport={createXhrTransport({ endpoint: "/api/uploads" })}`.
      */}
      <PhotoUploader
        title="Sleep hier de foto's van je pand"
        description="De volgorde die je hier legt, is de volgorde in de video. De eerste foto wordt de cover."
      />
    </>
  );
}
