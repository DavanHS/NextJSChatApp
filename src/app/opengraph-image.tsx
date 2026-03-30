import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "TermiChat — Private Encrypted Chat App";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#000",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            border: "1px solid #22543d",
            background: "rgba(0, 0, 0, 0.8)",
            padding: "40px 60px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderRadius: "4px",
          }}
        >
          <div
            style={{
              color: "#4ade80",
              fontSize: 72,
              fontWeight: "bold",
              letterSpacing: "-2px",
              marginBottom: 16,
            }}
          >
            termi_chat
          </div>
          <div
            style={{
              color: "#71717a",
              fontSize: 28,
              marginBottom: 8,
            }}
          >
            Private · Encrypted · Self-Destructing
          </div>
          <div
            style={{
              color: "#52525b",
              fontSize: 22,
              marginTop: 24,
            }}
          >
            terminal-themed chat app with end-to-end encryption
          </div>
          <div
            style={{
              color: "#52525b",
              fontSize: 22,
            }}
          >
            No signup · No logs · Full privacy
          </div>
          <div
            style={{
              color: "#3f3f46",
              fontSize: 18,
              marginTop: 32,
              display: "flex",
              gap: 24,
            }}
          >
            <span>$ create-room</span>
            <span>$ join-room</span>
            <span>$ chat --private</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
