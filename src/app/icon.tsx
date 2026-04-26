import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "radial-gradient(circle at 20% 20%, #62ffb8 0%, #1f7aff 55%, #0a1022 100%)",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "2px solid rgba(255,255,255,0.18)",
            borderRadius: "20px",
            color: "white",
            display: "flex",
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            padding: "10px 12px",
          }}
        >
          SB
        </div>
      </div>
    ),
    size,
  );
}
