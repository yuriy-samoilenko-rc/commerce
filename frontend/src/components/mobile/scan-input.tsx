"use client";

import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// BarcodeDetector (Chrome on Android) is not in TypeScript's DOM types yet.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
const noSubscription = () => () => {};
const detectorCtor = () =>
  typeof window !== "undefined" ? (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector : undefined;

/**
 * Where a code enters the phone app. Handheld scanners type the code and press Enter;
 * where the browser can read barcodes from the camera, a camera button appears too.
 */
export function ScanInput({
  onScan,
  busy,
  label = "Skenirajte ili upišite kod",
}: {
  onScan: (code: string) => void;
  busy?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  // Known only in the browser; the server render (and hydration) shows no camera button.
  const supported = useSyncExternalStore(
    noSubscription,
    () => !!detectorCtor() && !!navigator.mediaDevices?.getUserMedia,
    () => false,
  );

  function submit(value: string) {
    const text = value.trim();
    if (!text || busy) return;
    onScan(text);
    setCode("");
    input.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(code);
        }}
      >
        <Input
          ref={input}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          enterKeyHint="go"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={label}
          aria-label={label}
          className="h-12 text-base"
        />
        <Button type="submit" size="lg" className="h-12" disabled={busy || !code.trim()}>
          OK
        </Button>
        {supported && (
          <Button type="button" size="lg" variant="outline" className="h-12" onClick={() => setCamera(true)} aria-label="Kamera">
            <Camera />
          </Button>
        )}
      </form>
      {camera && (
        <CameraScanner
          onCode={(value) => {
            setCamera(false);
            submit(value);
          }}
          onClose={() => setCamera(false)}
        />
      )}
    </div>
  );
}

function CameraScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  // The camera starts once; a new callback from the parent must not restart it.
  const report = useRef(onCode);
  useEffect(() => {
    report.current = onCode;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let done = false;
    const Detector = detectorCtor();

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current || done) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new Detector!();
        timer = setInterval(async () => {
          if (!video.current || done) return;
          const [found] = await detector.detect(video.current).catch(() => []);
          if (found?.rawValue && !done) {
            done = true;
            navigator.vibrate?.(60);
            report.current(found.rawValue);
          }
        }, 250);
      } catch {
        setError("Kamera nije dostupna. Dozvolite pristup kameri ili upišite kod.");
      }
    })();

    return () => {
      done = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={video} className="flex-1 object-cover" playsInline muted />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-lg border-2 border-white/80" />
      {error && <p className="absolute inset-x-4 top-4 rounded-md bg-white p-3 text-sm">{error}</p>}
      <Button variant="secondary" size="lg" className="absolute right-4 bottom-6 left-4 h-12" onClick={onClose}>
        <X /> Zatvori kameru
      </Button>
    </div>
  );
}
