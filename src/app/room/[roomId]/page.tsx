import { redis } from "@/lib/redis";
import ChatPage from "./ChatPage";
import { cookies } from "next/headers";

interface PageProps {
  params: Promise<{
    roomId: string;
  }>;
}

const Page = async ({ params }: PageProps) => {
  const { roomId } = await params;
  const meta = await redis.hgetall<{ expireAt: number }>(`meta:${roomId}`);
  const cookieStore = await cookies();
  const token = cookieStore.get("x-auth-token")?.value || "anonymous";

  return (
    <ChatPage roomId={roomId} token={token} expireAt={Number(meta?.expireAt)} />
  );
};

export default Page;
