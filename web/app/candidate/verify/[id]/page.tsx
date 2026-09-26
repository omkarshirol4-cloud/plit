import { redirect } from "next/navigation";

/**
 * Legacy URL.
 *
 * Verification now lives on a single hub page, so this forwards to it with the
 * application preselected instead of rendering a second copy of the camera
 * flow. Existing links and bookmarks keep working.
 */
export default async function LegacyVerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/candidate/verification?app=${encodeURIComponent(id)}`);
}
