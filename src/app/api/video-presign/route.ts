import { NextResponse } from "next/server";

const MAX_FORM_VIDEO_BYTES = 80 * 1024 * 1024;
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov"]);

type PresignBody = {
  extension?: string;
  contentType?: string;
  size?: number;
};

export async function POST(request: Request) {
  const uploadUrl = process.env.R2_UPLOAD_URL;
  const formKey = process.env.FORM_UPLOAD_KEY;

  if (!uploadUrl || !formKey) {
    return NextResponse.json(
      { error: "Upload de vídeo não configurado." },
      { status: 500 }
    );
  }

  let body: PresignBody;
  try {
    body = (await request.json()) as PresignBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const extension = (body.extension ?? "mp4").replace(/^\./, "").toLowerCase();
  if (!VIDEO_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      { error: "Use um vídeo mp4, webm ou mov." },
      { status: 400 }
    );
  }

  if (typeof body.size === "number" && body.size > MAX_FORM_VIDEO_BYTES) {
    return NextResponse.json(
      { error: "Vídeo muito grande. Grave no máximo 1 minuto." },
      { status: 400 }
    );
  }

  const contentType = body.contentType ?? "video/mp4";
  if (!contentType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Tipo de arquivo inválido." },
      { status: 400 }
    );
  }

  const response = await fetch(`${uploadUrl.replace(/\/$/, "")}/presign-form`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-form-upload-key": formKey,
    },
    body: JSON.stringify({
      extension,
      contentType,
      size: body.size,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { error: (payload as { error?: string }).error ?? "Falha ao preparar o envio." },
      { status: response.status }
    );
  }

  return NextResponse.json(payload);
}
