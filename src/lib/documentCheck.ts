import { isFormDocumentUrl } from "@/lib/questionnaire";

export type DocumentCheckStatus = "verificado" | "reprovado" | "nao_verificado";

export type DocumentCheckResult = {
  status: DocumentCheckStatus;
  reason: string;
};

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
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
documento que não seja de identificação. Também reprove se a imagem estiver tão
borrada ou escura que não dá para reconhecer o documento.
Responda em português, com o motivo curto (até 120 caracteres).`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_identity_document: { type: "BOOLEAN" },
    document_type: { type: "STRING" },
    reason: { type: "STRING" },
  },
  required: ["is_identity_document", "reason"],
};

function unverified(reason: string): DocumentCheckResult {
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
      document_type?: string;
      reason?: string;
    };

    const reason = [verdict.document_type, verdict.reason]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(" · ")
      .slice(0, 300);

    if (typeof verdict.is_identity_document !== "boolean") {
      return unverified("Resposta da verificação inválida.");
    }

    return {
      status: verdict.is_identity_document ? "verificado" : "reprovado",
      reason,
    };
  } catch (error) {
    console.error("Falha ao verificar documento:", error);
    return unverified("Não foi possível verificar o documento agora.");
  } finally {
    clearTimeout(timer);
  }
}
