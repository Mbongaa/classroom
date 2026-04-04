import { V2PageClient } from './V2PageClient';

export default async function V2RoomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;

  return <V2PageClient roomCode={roomCode} />;
}
