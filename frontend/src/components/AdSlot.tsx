import { useEffect, useRef, useState } from 'react';
import { client } from '@/lib/api';

interface HouseAd {
  slot: string;
  title: string;
  image_url: string;
  link_url: string;
}

/**
 * Reserved ad slot. Priority order:
 *   1. A house ad configured for this slot from /admin/publicidad (our own banners)
 *   2. Google AdSense, if VITE_ADSENSE_CLIENT_ID is set
 *   3. Nothing — renders null, taking up no space
 *
 * `slot` must be one of the known slot ids (see backend KNOWN_SLOTS):
 * "home_top" | "explorar_top"
 */
export default function AdSlot({ slot, label = 'Publicidad' }: { slot: string; label?: string }) {
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;
  const [houseAd, setHouseAd] = useState<HouseAd | null | undefined>(undefined); // undefined = loading
  const adsenseRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    let cancelled = false;
    client.houseAds
      .getForSlot(slot)
      .then(({ data }) => {
        if (!cancelled) setHouseAd(data);
      })
      .catch(() => {
        if (!cancelled) setHouseAd(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slot]);

  useEffect(() => {
    if (houseAd || !clientId) return;
    try {
      // @ts-expect-error adsbygoogle is injected globally by the AdSense loader script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, [clientId, houseAd]);

  if (houseAd === undefined) {
    return null; // still checking, avoid a layout flash
  }

  if (houseAd) {
    return (
      <a
        href={houseAd.link_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="w-full flex flex-col items-center gap-1 my-4"
      >
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <img
          src={houseAd.image_url}
          alt={houseAd.title}
          className="w-full rounded-md object-cover max-h-40"
        />
      </a>
    );
  }

  if (!clientId) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center gap-1 my-4">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <ins
        ref={adsenseRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={clientId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
