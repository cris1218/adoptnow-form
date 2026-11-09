const MERCHANT_NAME = "Recanto do Ron Ron";
const MERCHANT_CITY = "Ponta Grossa";

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

/** Gera Pix copia-e-cola (BR Code) estático com valor. */
export function buildPixCopyPaste(input: {
  pixKey: string;
  amountCents: number;
  description?: string;
}): string {
  const key = input.pixKey.trim();
  if (!key) throw new Error("Chave Pix ausente.");
  if (input.amountCents <= 0) throw new Error("Valor inválido.");

  const amount = (input.amountCents / 100).toFixed(2);
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const additional =
    input.description && input.description.trim()
      ? tlv("05", input.description.trim().slice(0, 25))
      : "";

  const name = MERCHANT_NAME.slice(0, 25);
  const city = MERCHANT_CITY.slice(0, 15);

  let payload = "";
  payload += tlv("00", "01");
  payload += tlv("26", merchantAccount);
  payload += tlv("52", "0000");
  payload += tlv("53", "986");
  payload += tlv("54", amount);
  payload += tlv("58", "BR");
  payload += tlv("59", name);
  payload += tlv("60", city);
  if (additional) payload += tlv("62", additional);
  payload += "6304";
  payload += crc16(payload);

  return payload;
}

export function pixQrImageUrl(copyPaste: string, size = 280): string {
  const data = encodeURIComponent(copyPaste);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`;
}
