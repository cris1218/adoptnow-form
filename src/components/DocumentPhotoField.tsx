"use client";

import { useEffect, useRef, useState } from "react";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

function extensionFromFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith(".png") || type === "image/png") return "png";
  if (name.endsWith(".webp") || type === "image/webp") return "webp";
  if (name.endsWith(".heic") || type === "image/heic" || type === "image/heif") {
    return "heic";
  }
  if (name.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    type === "image/jpeg" ||
    type.startsWith("image/")
  ) {
    return "jpg";
  }
  return null;
}

async function presignAndUpload(file: File, extension: string): Promise<string> {
  const contentType = file.type || (extension === "pdf" ? "application/pdf" : "image/jpeg");
  const presignResponse = await fetch("/api/document-presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      extension,
      contentType,
      size: file.size,
    }),
  });

  const presign = (await presignResponse.json()) as {
    uploadUrl?: string;
    publicUrl?: string;
    headers?: Record<string, string>;
    error?: string;
  };

  if (!presignResponse.ok || !presign.uploadUrl || !presign.publicUrl) {
    throw new Error(presign.error ?? "Falha ao preparar o envio.");
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers ?? { "Content-Type": contentType },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Falha ao enviar a foto. Tente novamente.");
  }

  return presign.publicUrl;
}

export function DocumentPhotoField({
  disabled = false,
  onBusyChange,
}: {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [isPdf, setIsPdf] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return;

    setError("");
    const extension = extensionFromFile(file);
    if (!extension) {
      setError("Use uma foto ou um PDF do documento.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Arquivo muito grande. Use no máximo 10 MB.");
      return;
    }

    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setFileName(file.name);
    setIsPdf(extension === "pdf");
    setUploading(true);
    onBusyChange?.(true);

    try {
      const uploaded = await presignAndUpload(file, extension);
      setPublicUrl(uploaded);
    } catch (uploadError) {
      setPublicUrl("");
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível enviar a foto."
      );
    } finally {
      setUploading(false);
      onBusyChange?.(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function clearPhoto() {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPublicUrl("");
    setFileName("");
    setIsPdf(false);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-stone-700">
        Documento com foto{" "}
        <span className="font-medium text-stone-500">(opcional)</span>
      </p>
      <p className="mb-3 text-sm leading-relaxed text-stone-500">
        RG, CNH ou outro documento com foto. Pode tirar a foto agora ou escolher
        da galeria.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        disabled={disabled || uploading}
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <input type="hidden" name="documentPhotoUrl" value={publicUrl} />

      {previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-stone-300 bg-white">
          {isPdf ? (
            <div className="px-4 py-8 text-center text-sm font-medium text-stone-600">
              PDF selecionado
              {fileName ? `: ${fileName}` : ""}
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Documento com foto"
              className="max-h-56 w-full object-contain bg-stone-50"
            />
          )}
          <div className="flex gap-2 border-t border-stone-200 p-3">
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
              className="flex-1 rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold text-stone-800"
            >
              Trocar
            </button>
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={clearPhoto}
              className="flex-1 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700"
            >
              Remover
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-stone-300 bg-white px-4 text-center"
        >
          <span className="text-sm font-semibold text-brand-dark">
            Enviar foto do documento
          </span>
          <span className="text-xs text-stone-500">JPG, PNG ou PDF · até 10 MB</span>
        </button>
      )}

      {uploading ? (
        <p className="mt-2 text-sm text-stone-500">Enviando foto...</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
