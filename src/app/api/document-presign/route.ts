import { NextResponse } from "next/server";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "pdf",
]);

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
      { error: "Upload de documento não configurado." },
      { status: 500 }
    );
  }

  let body: PresignBody;
  try {
    body = (await request.json()) as PresignBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const extension = (body.extension ?? "jpg").replace(/^\./, "").toLowerCase();
  if (!DOCUMENT_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      { error: "Use uma foto jpg, png, webp ou um PDF." },
      { status: 400 }
    );
  }

  if (typeof body.size === "number" && body.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Use no máximo 10 MB." },
      { status: 400 }
    );
  }

  const contentType = body.contentType ?? "image/jpeg";
  const allowedType =
    contentType.startsWith("image/") || contentType === "application/pdf";
  if (!allowedType) {
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
      {
        error:
          (payload as { error?: string }).error ?? "Falha ao preparar o envio.",
      },
      { status: response.status }
    );
  }

  return NextResponse.json(payload);
}
