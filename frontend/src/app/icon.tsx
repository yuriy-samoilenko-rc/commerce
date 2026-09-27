import { ImageResponse } from "next/og";

// The sizes an installed web app needs (manifest.ts); served at /icon/192 and /icon/512.
export function generateImageMetadata() {
  return [192, 512].map((size) => ({ id: String(size), size: { width: size, height: size }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#171717",
        color: "#ffffff",
        fontSize: size * 0.62,
        fontWeight: 700,
        borderRadius: size * 0.2,
      }}
    >
      T
    </div>,
    { width: size, height: size },
  );
}
