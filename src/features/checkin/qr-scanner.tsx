"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

/** Quét mã QR bằng camera sau. jsQR chạy trên mọi trình duyệt (iOS Safari chưa có BarcodeDetector). */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(onResult);
  useEffect(() => {
    done.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        if (!stopped) setError("Không mở được camera. Hãy cho phép dùng camera, hoặc tìm khách theo tên.");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});
      timer = setInterval(() => {
        if (!ctx || video.readyState < 2) return;
        // Thu nhỏ khung hình để giải mã nhanh trên điện thoại cũ.
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) done.current(code.data);
      }, 200);
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      {error ? (
        <p className="p-6 text-center text-sm text-white">{error}</p>
      ) : (
        <>
          <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
          <div className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-white/80" aria-hidden />
        </>
      )}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white"
      >
        Tắt camera
      </button>
    </div>
  );
}
