import { headers } from "next/headers";

import {
  clientIpFromHeaders,
  consumeRequestRateLimit,
} from "@/lib/requestRateLimit";

export async function consumeActionRateLimit(input: {
  bucket: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const headerList = await headers();
  return consumeRequestRateLimit({
    bucket: input.bucket,
    limit: input.limit,
    windowSeconds: input.windowSeconds,
    ip: clientIpFromHeaders(headerList),
  });
}
