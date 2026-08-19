"use client";

import { useEffect, useRef, useState } from "react";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT_FILES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";
const ACCEPT_CAMERA = "image/*";

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  if (/iPad|Android/i.test(ua) && navigator.maxTouchPoints > 0) {
    return true;
  }
  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) {
    return true;
  }
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [isPdf, setIsPdf] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

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
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clearPhoto() {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPublicUrl("");
    setFileName("");
    setIsPdf(false);
    setError("");
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const busy = disabled || uploading;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-stone-700">
        Documento com foto{" "}
        <span className="font-medium text-stone-500">(opcional)</span>
      </p>
      <p className="mb-3 text-sm leading-relaxed text-stone-500">
        RG, CNH ou outro documento com foto.
        {isMobile
          ? " Tire a foto agora ou escolha um arquivo."
          : " Envie uma foto ou um PDF."}
      </p>

      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPT_CAMERA}
        capture="environment"
        disabled={busy}
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_FILES}
        disabled={busy}
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
              className="max-h-56 w-full bg-stone-50 object-contain"
            />
          )}
          <div className={`border-t border-stone-200 p-3 ${isMobile ? "grid grid-cols-2 gap-2" : "flex gap-2"}`}>
            {isMobile ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => cameraInputRef.current?.click()}
                  className="rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold text-stone-800"
                >
                  Tirar foto
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold text-stone-800"
                >
                  Arquivos
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold text-stone-800"
              >
                Trocar
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={clearPhoto}
              className={`rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700 ${isMobile ? "col-span-2" : "flex-1"}`}
            >
              Remover
            </button>
          </div>
        </div>
      ) : isMobile ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraInputRef.current?.click()}
            className="flex h-28 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-stone-300 bg-white px-3 text-center"
          >
            <span className="text-sm font-semibold text-brand-dark">Tirar foto</span>
            <span className="text-xs text-stone-500">Câmera</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="flex h-28 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-stone-300 bg-white px-3 text-center"
          >
            <span className="text-sm font-semibold text-brand-dark">Arquivos</span>
            <span className="text-xs text-stone-500">Galeria ou PDF</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
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
