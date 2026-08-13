import { ImageResponse } from "next/og"

export const size = {
  width: 512,
  height: 512,
}

export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <div
          style={{
            width: "86%",
            height: "86%",
            borderRadius: "9999px",
            background:
              "linear-gradient(135deg, #101218 0%, #1d2435 45%, #334766 100%)",
            border: "18px solid rgba(255,255,255,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: 220,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          F
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
