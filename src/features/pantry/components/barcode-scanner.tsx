"use client";

import { Camera, CameraOff, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type Controls = { stop: () => void };

/**
 * Lecture d'un code-barres avec la caméra (bibliothèque ZXing, chargée seulement à l'ouverture).
 * Les images restent dans le navigateur : seul le numéro lu est utilisé. Saisie manuelle possible.
 */
export function BarcodeScanner({ onCode, busy }: { onCode: (code: string) => void; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Ce navigateur ne donne pas accès à la caméra. Tape le code sous le code-barres.");
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled || !videoRef.current) return;
        const hints = new Map([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E],
          ],
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result, _err, ctrl) => {
            if (!result) return;
            ctrl.stop();
            controlsRef.current = null;
            setOpen(false);
            onCodeRef.current(result.getText());
          },
        );
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof Error ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "L'accès à la caméra est refusé. Autorise-le dans les réglages du navigateur, ou tape le code."
            : "Impossible d'ouvrir la caméra. Tape le code sous le code-barres.",
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? <CameraOff aria-hidden className="size-4" /> : <Camera aria-hidden className="size-4" />}
          {open ? "Fermer la caméra" : "Scanner un code-barres"}
        </Button>
      </div>
      {open ? (
        <div className="overflow-hidden rounded-xl border border-line bg-ink">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full object-cover"
            muted
            playsInline
            aria-label="Aperçu de la caméra : vise le code-barres"
          />
          <p className="bg-white px-3 py-2 text-sm text-ink-soft">Vise le code-barres, la lecture est automatique.</p>
        </div>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex gap-2">
        <label htmlFor="code-manuel" className="sr-only">
          Code-barres
        </label>
        <Input
          id="code-manuel"
          inputMode="numeric"
          autoComplete="off"
          placeholder="ou tape le code (ex. 3017620422003)"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (manual.trim()) onCode(manual);
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={busy || !manual.trim()}
          onClick={() => onCode(manual)}
          aria-label="Chercher ce code-barres"
        >
          <Search aria-hidden className="size-4" />
        </Button>
      </div>
    </div>
  );
}
