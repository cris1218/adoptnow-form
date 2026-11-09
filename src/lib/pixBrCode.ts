import QRCode from "qrcode";

const MERCHANT_NAME = "RECANTORONRON";
const MERCHANT_CITY = "PONTA GROSSA";

function tlv(id: string, value: string): string {
  const length = String(value.length).padStart(2, "0");
  return `${id}${length}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function onlyAsciiAlnum(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 25);
}

/** Normaliza chave Pix (CPF/CNPJ/telefone sem máscara; e-mail/aleatória trim). */
export function normalizePixKey(raw: string): string {
  const key = raw.trim();
  if (!key) return "";
  if (key.includes("@")) return key.toLowerCase();
  const digits = key.replace(/\D/g, "");
  if (
    digits.length === 11 ||
    digits.length === 14 ||
    (digits.length >= 10 && digits.length <= 13)
  ) {
    return digits;
  }
  return key;
}

/** Gera Pix copia-e-cola (BR Code) estático com valor. */
export function buildPixCopyPaste(input: {
  pixKey: string;
  amountCents: number;
  description?: string;
}): string {
  const key = normalizePixKey(input.pixKey);
  if (!key) throw new Error("Chave Pix ausente.");
  if (input.amountCents <= 0) throw new Error("Valor inválido.");

  const amount = (input.amountCents / 100).toFixed(2);
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const txid = onlyAsciiAlnum(input.description || "RIFA") || "RIFA";

  let payload = "";
  payload += tlv("00", "01");
  payload += tlv("26", merchantAccount);
  payload += tlv("52", "0000");
  payload += tlv("53", "986");
  payload += tlv("54", amount);
  payload += tlv("58", "BR");
  payload += tlv("59", MERCHANT_NAME.slice(0, 25));
  payload += tlv("60", MERCHANT_CITY.slice(0, 15));
  payload += tlv("62", tlv("05", txid));
  payload += "6304";
  payload += crc16(payload);

  return payload;
}

export async function buildPixQrBase64(copyPaste: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(copyPaste, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
    type: "image/png",
  });
  const marker = "base64,";
  const index = dataUrl.indexOf(marker);
  if (index < 0) throw new Error("Falha ao gerar QR Code.");
  return dataUrl.slice(index + marker.length);
}

export function pixQrImageUrl(copyPaste: string, size = 280): string {
  const data = encodeURIComponent(copyPaste);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`;
}
