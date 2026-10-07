import { CallRoom } from "@/components/call/CallRoom";

// `/[roomId]` is a dynamic segment, so `roomId` is runtime data. Under Cache
// Components we await it here and hand the plain string to the client screen;
// the sibling `loading.tsx` supplies the Suspense boundary this needs.
export default async function Page({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <CallRoom roomId={roomId} />;
}
