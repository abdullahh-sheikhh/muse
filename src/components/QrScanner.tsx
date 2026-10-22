import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Full-screen camera QR scanner. Calls onScan with the decoded text. */
export function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const fired = useRef(false);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const s = new Html5Qrcode("qr-reader");
      scanner = s;
      s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          if (fired.current) return;
          fired.current = true;
          onScan(text);
        },
        () => {},
      ).catch(() => onClose());
    });

    return () => {
      cancelled = true;
      scanner?.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 pt-[max(env(safe-area-inset-top),1rem)]">
        <h2 className="text-2xl">Scan the artwork's QR code</h2>
        <button
          type="button"
          aria-label="Close scanner"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div id="qr-reader" className="mx-auto mt-8 w-full max-w-sm overflow-hidden rounded-3xl" />
    </div>
  );
}
