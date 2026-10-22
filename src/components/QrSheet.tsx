import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Printable A4 grid of artwork QR codes for partner museums. */
export function QrSheet({ museumId, slug }: { museumId: string; slug: string }) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const { data: artifacts } = useQuery({
    queryKey: ["qr-artifacts", museumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artifacts")
        .select("id, ref, title, artist")
        .eq("museum_id", museumId)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!artifacts) return;
    const origin = window.location.origin;
    void Promise.all(
      artifacts.map(async (a) => {
        const url = `${origin}/museum/${slug}/artifact/${encodeURIComponent(a.ref)}?src=qr`;
        return [a.id, await QRCode.toDataURL(url, { margin: 1, width: 360 })] as const;
      }),
    ).then((pairs) => setCodes(Object.fromEntries(pairs)));
  }, [artifacts, slug]);

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-3xl">QR codes</h2>
          <p className="text-sm text-muted-foreground">Print and place one next to each artwork label.</p>
        </div>
        <Button onClick={() => window.print()} className="rounded-2xl">
          <Printer /> Print
        </Button>
      </div>
      <div className="qr-sheet mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {artifacts?.map((a) => (
          <figure key={a.id} className="break-inside-avoid rounded-2xl bg-card p-4 text-center">
            {codes[a.id] && <img src={codes[a.id]} alt={`QR code for ${a.title}`} className="mx-auto w-full max-w-[160px] bg-foreground p-2" />}
            <figcaption className="mt-3 text-sm">
              <p className="font-medium">{a.title}</p>
              <p className="text-muted-foreground">{a.artist}</p>
              <p className="mt-1 font-semibold">{a.ref}</p>
            </figcaption>
          </figure>
        ))}
        {artifacts?.length === 0 && <p className="text-muted-foreground">No artworks yet.</p>}
      </div>
    </section>
  );
}
