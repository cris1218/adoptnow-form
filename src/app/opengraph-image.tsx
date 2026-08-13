import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Recanto do Ron Ron";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/logoRecanto.jpeg"));
  const src = `data:image/jpeg;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#DEECEC",
        }}
      >
        <img
          src={src}
          width={520}
          height={520}
          alt=""
          style={{ borderRadius: 40 }}
        />
      </div>
    ),
    { ...size },
  );
}
