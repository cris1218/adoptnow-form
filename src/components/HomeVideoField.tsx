"use client";

import { useEffect, useRef, useState } from "react";

const MAX_MS = 60_000;
const MAX_SECONDS = 60;
const MAX_BYTES = 80 * 1024 * 1024;

type Phase = "idle" | "recording" | "preview" | "uploading" | "done";
type DeviceMode = "mobile" | "desktop";

function isMobileDevice(): boolean {
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

function pickRecorderMime(): string {
  const options = [
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionFromMime(mime: string): "mp4" | "webm" | "mov" {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  return "webm";
}

function extensionFromFile(file: File): "mp4" | "webm" | "mov" | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith(".mp4") || type.includes("mp4")) return "mp4";
  if (name.endsWith(".webm") || type.includes("webm")) return "webm";
  if (name.endsWith(".mov") || type.includes("quicktime")) return "mov";
  return null;
}

function formatTimer(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(duration) ? duration : 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler o vídeo."));
    };
    video.src = url;
  });
}

async function presignAndUpload(blob: Blob, extension: "mp4" | "webm" | "mov") {
  const contentType = blob.type || `video/${extension}`;
  const presignResponse = await fetch("/api/video-presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      extension,
      contentType,
      size: blob.size,
    }),
  });
  const presign = (await presignResponse.json()) as {
    uploadUrl?: string;
    publicUrl?: string;
    headers?: { "Content-Type": string };
    error?: string;
  };

  if (!presignResponse.ok || !presign.uploadUrl || !presign.publicUrl) {
    throw new Error(presign.error ?? "Falha ao preparar o envio.");
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers ?? { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error("Falha ao enviar o vídeo.");
  }

  return presign.publicUrl;
}

export function HomeVideoField() {
  const [mode, setMode] = useState<DeviceMode | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [viaWhatsapp, setViaWhatsapp] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  const liveRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number>(0);

  const isMobile = mode !== "desktop";

  useEffect(() => {
    setMode(isMobileDevice() ? "mobile" : "desktop");
  }, []);

  useEffect(() => {
    urlInputRef.current?.setCustomValidity(
      viaWhatsapp || videoUrl
        ? ""
        : isMobile
          ? "Grave o vídeo do local (até 1 minuto) ou marque que vai enviar pelo WhatsApp."
          : "Anexe o vídeo do local (até 1 minuto) ou marque que vai enviar pelo WhatsApp."
    );
  }, [videoUrl, isMobile, viaWhatsapp]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    window.clearInterval(timerRef.current);
  }

  useEffect(() => {
    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function uploadBlob(blob: Blob, mimeType: string) {
    if (blob.size < 10_000) {
      setPhase("idle");
      setError(
        isMobile
          ? "O vídeo ficou vazio. Grave de novo, por favor."
          : "O arquivo de vídeo está vazio. Escolha outro."
      );
      return;
    }

    if (blob.size > MAX_BYTES) {
      setPhase("idle");
      setError("Vídeo muito grande. Use no máximo 1 minuto.");
      return;
    }

    const localUrl = URL.createObjectURL(blob);
    setPreviewUrl(localUrl);
    setPhase("uploading");

    try {
      const publicUrl = await presignAndUpload(blob, extensionFromMime(mimeType));
      setVideoUrl(publicUrl);
      setPhase("done");
      setError("");
    } catch (uploadError) {
      setPhase("preview");
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível enviar o vídeo."
      );
    }
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este celular não permite gravar pela página. Use o Safari ou Chrome atualizado.");
      return;
    }

    try {
      const videoConstraints = {
        facingMode: { ideal: "environment" as const },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };
      const stream = await navigator.mediaDevices
        .getUserMedia({ audio: true, video: videoConstraints })
        .catch(() =>
          navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        );
      streamRef.current = stream;
      if (liveRef.current) {
        liveRef.current.srcObject = stream;
        await liveRef.current.play().catch(() => undefined);
      }

      const mimeType = pickRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 1_500_000,
          })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "video/webm",
        });
        chunksRef.current = [];
        window.clearInterval(timerRef.current);
        stopStream();
        if (liveRef.current) liveRef.current.srcObject = null;
        void uploadBlob(blob, blob.type);
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setPhase("recording");
      recorder.start(250);
      timerRef.current = window.setInterval(() => {
        const passed = Date.now() - startedAtRef.current;
        setElapsed(passed);
        if (passed >= MAX_MS && recorder.state === "recording") {
          recorder.stop();
        }
      }, 200);
    } catch {
      stopStream();
      setError("Não foi possível abrir a câmera. Permita o acesso e tente de novo.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  async function onFileSelected(file: File | undefined) {
    setError("");
    if (!file) return;

    const extension = extensionFromFile(file);
    if (!extension) {
      setError("Use um vídeo mp4, webm ou mov.");
      return;
    }

    if (file.size > MAX_BYTES) {
      setError("Vídeo muito grande. Use no máximo 1 minuto.");
      return;
    }

    try {
      const duration = await readVideoDuration(file);
      if (duration > MAX_SECONDS) {
        setError("O vídeo pode ter no máximo 1 minuto.");
        return;
      }
    } catch {
      setError("Não foi possível ler o vídeo. Escolha outro arquivo.");
      return;
    }

    setFileName(file.name);
    await uploadBlob(file, file.type || `video/${extension}`);
  }

  function resetVideo() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setVideoUrl("");
    setFileName("");
    setPhase("idle");
    setElapsed(0);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section className="rounded-2xl bg-brand-bg/70 p-4 compact:px-2">
      <h2 className="text-base font-extrabold leading-snug text-stone-900">
        Vídeo do local
      </h2>
      <p className="mt-1 mb-3 text-sm leading-relaxed text-stone-600">
        {mode === "desktop"
          ? "Anexe um vídeo mostrando janelas, telas e o espaço onde o gatinho vai ficar. No máximo 1 minuto."
          : "Mostre janelas, telas e o espaço onde o gatinho vai ficar. No máximo 1 minuto."}
      </p>

      <label className="flex items-center gap-3 rounded-2xl border border-stone-300 bg-white p-4 compact:px-2">
        <input
          type="checkbox"
          name="agreedHomeSafe"
          value="true"
          checked={agreed}
          required
          onChange={(event) => {
            const next = event.target.checked;
            setAgreed(next);
            if (!next) {
              setViaWhatsapp(false);
              resetVideo();
            }
          }}
          className="h-5 w-5 shrink-0 accent-[#148B87]"
        />
        <span className="text-sm leading-snug text-stone-700">
          Concordo que a residência é segura para a adoção
        </span>
      </label>

      {agreed ? (
        <label className="mt-3 flex items-center gap-3 rounded-2xl border border-stone-300 bg-white p-4 compact:px-2">
          <input
            type="checkbox"
            name="willSendVideoWhatsapp"
            value="true"
            checked={viaWhatsapp}
            onChange={(event) => {
              const next = event.target.checked;
              setViaWhatsapp(next);
              if (next) {
                if (recorderRef.current) {
                  recorderRef.current.onstop = null;
                  if (recorderRef.current.state === "recording") {
                    recorderRef.current.stop();
                  }
                }
                stopStream();
                resetVideo();
              }
            }}
            className="h-5 w-5 shrink-0 accent-[#148B87]"
          />
          <span className="text-sm leading-snug text-stone-700">
            Vou enviar o vídeo pelo WhatsApp
          </span>
        </label>
      ) : null}

      {viaWhatsapp ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          Combinado. A equipe pede o vídeo pelo WhatsApp depois do questionário.
        </p>
      ) : null}

      {agreed && mode && !viaWhatsapp ? (
        <div className="mt-3 space-y-3">
          {isMobile ? (
            <video
              ref={liveRef}
              muted
              playsInline
              autoPlay
              className={`w-full rounded-2xl bg-stone-900 object-cover ${
                phase === "recording" ? "h-56" : "hidden"
              }`}
            />
          ) : null}

          {previewUrl && (phase === "preview" || phase === "uploading" || phase === "done") ? (
            <video
              src={previewUrl}
              controls
              playsInline
              className="h-56 w-full rounded-2xl bg-stone-900 object-cover"
            />
          ) : null}

          {isMobile && phase === "idle" ? (
            <>
              <p className="text-sm text-stone-600">
                Ao tocar em gravar, a câmera abre e começa a filmar. No máximo 1
                minuto.
              </p>
              <button
                type="button"
                onClick={() => void startRecording()}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-dark text-base font-semibold text-white"
              >
                Gravar vídeo
              </button>
            </>
          ) : null}

          {!isMobile && phase === "idle" ? (
            <>
              <p className="text-sm text-stone-600">
                Escolha um arquivo de vídeo do computador. No máximo 1 minuto.
              </p>
              <label className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-dark text-base font-semibold text-white">
                Anexar vídeo
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  className="sr-only"
                  onChange={(event) => {
                    void onFileSelected(event.target.files?.[0]);
                  }}
                />
              </label>
            </>
          ) : null}

          {phase === "recording" ? (
            <div className="flex items-center gap-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">
                Gravando {formatTimer(elapsed)} / 1:00
              </p>
              <button
                type="button"
                onClick={stopRecording}
                className="h-12 rounded-2xl bg-rose-600 px-4 font-semibold text-white"
              >
                Parar
              </button>
            </div>
          ) : null}

          {phase === "uploading" ? (
            <p className="text-sm font-semibold text-brand-dark">Enviando vídeo...</p>
          ) : null}

          {phase === "done" ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              {isMobile
                ? "Vídeo enviado. Pode seguir o questionário."
                : `Vídeo enviado${fileName ? `: ${fileName}` : ""}. Pode seguir o questionário.`}
            </p>
          ) : null}

          {phase === "done" || phase === "preview" ? (
            <button
              type="button"
              onClick={resetVideo}
              className="h-12 w-full rounded-2xl border border-stone-300 bg-white text-sm font-semibold text-stone-800"
            >
              {isMobile ? "Gravar de novo" : "Anexar outro vídeo"}
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}

      <input
        ref={urlInputRef}
        type="text"
        name="homeVideoUrl"
        value={videoUrl}
        required={!viaWhatsapp}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
    </section>
  );
}
