import { redis } from "@/lib/redis";
import ChatPage from "./ChatPage";

interface PageProps {
  params: Promise<{
    roomId: string
  }>
}

const Page = async ({ params }: PageProps) => {
  const {roomId} = await params
  const meta = await redis.hgetall<{ expireAt: number }>(`meta:${roomId}`);

  return <ChatPage roomId={roomId} expireAt={Number(meta?.expireAt)} />;
};

export default Page;
