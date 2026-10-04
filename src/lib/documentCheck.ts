import { createHmac, timingSafeEqual } from "node:crypto";

import { isFormDocumentUrl } from "@/lib/questionnaire";

export type DocumentCheckStatus = "verificado" | "reprovado" | "nao_verificado";

export type DocumentCheckResult = {
  status: DocumentCheckStatus;
  reason: string;
};

export type DocumentPhotoVerification = {
  status: DocumentCheckStatus;
  proof: string;
};

export const DOCUMENT_NOT_RECOGNIZED_MESSAGE =
  "Envie uma foto em que o documento seja reconhecido.";

function proofFor(url: string): string | null {
  const secret = process.env.GEMINI_API_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret)
    .update(`documento-verificado:${url}`)
    .digest("base64url");
}

export async function verifyDocumentForForm(
  url: string
): Promise<DocumentPhotoVerification> {
  const result = await checkIdentityDocument(url);
  const proof = result.status === "verificado" ? proofFor(url) : null;
  return { status: result.status, proof: proof ?? "" };
}

export function verifiedDocumentCheck(
  url: string,
  proof: string
): DocumentCheckResult | null {
  const expected = proofFor(url);
  if (!expected || !proof) return null;
  const a = Buffer.from(expected);
  const b = Buffer.from(proof);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { status: "verificado", reason: "Reconhecido automaticamente no envio da foto." };
}

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

const PROMPT = `Você confere documentos enviados num cadastro de adoção de gatos no Brasil.
Diga se o arquivo é a foto (ou PDF) de um documento oficial de identificação brasileiro:
RG, CIN (Carteira de Identidade Nacional), CNH (física ou digital), passaporte,
carteira de trabalho ou carteira de conselho profissional. Frente ou verso valem.
Reprove fotos de pessoas, animais, objetos, paisagens, capturas de tela sem documento,
papéis em branco, desenhos, comprovantes de residência, boletos ou qualquer outro
documento que não seja de identificação.

Seja rigoroso com a qualidade da foto, porque a equipe precisa conseguir ler o documento:
- fully_visible: o documento (ou a página/face mostrada) aparece inteiro, com as quatro
  bordas dentro da imagem, sem partes cortadas.
- unobstructed: nada cobre o documento. Dedos, mãos, objetos, adesivos, tarjas, rabiscos,
  reflexo forte ou sombra sobre qualquer parte do documento tornam isto falso, mesmo que
  cubram só um pedaço pequeno. Dedos segurando apenas a borda externa, sem encostar em
  nenhum texto, foto ou campo, são aceitáveis.
- legible: dá para ler com clareza o nome e o número do documento, e a foto do rosto
  aparece nítida (no verso sem foto, os textos principais precisam estar legíveis).
  Imagem borrada, escura, tremida, muito pequena ou pixelada torna isto falso.
Responda em português, com o motivo curto (até 120 caracteres), dizendo o que está errado
quando algum item for falso.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_identity_document: { type: "BOOLEAN" },
    fully_visible: { type: "BOOLEAN" },
    unobstructed: { type: "BOOLEAN" },
    legible: { type: "BOOLEAN" },
    document_type: { type: "STRING" },
    reason: { type: "STRING" },
  },
  required: [
    "is_identity_document",
    "fully_visible",
    "unobstructed",
    "legible",
    "reason",
  ],
};

function unverified(reason: string): DocumentCheckResult {
  console.warn(`Documento não verificado: ${reason}`);
  return { status: "nao_verificado", reason };
}

function resolveMimeType(url: string, header: string | null): string | null {
  const fromHeader = (header ?? "").split(";")[0].trim().toLowerCase();
  if (SUPPORTED_MIME_TYPES.has(fromHeader)) return fromHeader;

  const extension = new URL(url).pathname.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? null;
}

export async function checkIdentityDocument(
  url: string
): Promise<DocumentCheckResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return unverified("Verificação automática não configurada.");
  if (!isFormDocumentUrl(url)) return unverified("Arquivo fora do armazenamento do formulário.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const file = await fetch(url, { signal: controller.signal });
    if (!file.ok) return unverified("Não foi possível baixar o arquivo.");

    const mimeType = resolveMimeType(url, file.headers.get("content-type"));
    if (!mimeType) return unverified("Formato de arquivo não suportado.");

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOCUMENT_BYTES) {
      return unverified("Arquivo vazio ou grande demais para conferir.");
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: Buffer.from(bytes).toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      console.error(
        `Gemini falhou (${response.status}):`,
        await response.text().catch(() => "")
      );
      return unverified("Serviço de verificação indisponível.");
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const verdict = JSON.parse(text) as {
      is_identity_document?: boolean;
      fully_visible?: boolean;
      unobstructed?: boolean;
      legible?: boolean;
      document_type?: string;
      reason?: string;
    };

    const reason = [verdict.document_type, verdict.reason]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(" · ")
      .slice(0, 300);

    const checks = [
      verdict.is_identity_document,
      verdict.fully_visible,
      verdict.unobstructed,
      verdict.legible,
    ];
    if (checks.some((value) => typeof value !== "boolean")) {
      return unverified("Resposta da verificação inválida.");
    }

    return {
      status: checks.every(Boolean) ? "verificado" : "reprovado",
      reason,
    };
  } catch (error) {
    console.error("Falha ao verificar documento:", error);
    return unverified("Não foi possível verificar o documento agora.");
  } finally {
    clearTimeout(timer);
  }
}
