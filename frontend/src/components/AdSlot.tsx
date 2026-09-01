import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { client } from '@/lib/api';
import { Megaphone } from 'lucide-react';

interface HouseAd {
  slot: string;
  title: string;
  image_url: string;
  link_url: string;
}

/**
 * Reserved ad slot. Priority order:
 *   1. A house ad configured for this slot from /admin/publicidad (our own banners)
 *   2. Google AdSense, if VITE_ADSENSE_CLIENT_ID is set AND Google actually fills the slot
 *   3. A "¿Quieres anunciarte aquí?" self-promo placeholder — shown whenever nothing
 *      else is filling the space, so visitors know the spot is for sale.
 *
 * `slot` must be one of the known slot ids (see backend KNOWN_SLOTS):
 * "home_top" | "explorar_top"
 */
export default function AdSlot({ slot, label = 'Publicidad' }: { slot: string; label?: string }) {
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;
  const [houseAd, setHouseAd] = useState<HouseAd | null | undefined>(undefined); // undefined = loading
  const [adSenseFilled, setAdSenseFilled] = useState<boolean | null>(null); // null = unknown/pending
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
    if (houseAd === undefined) return; // house ad todavía cargando, esperar a que resuelva
    if (houseAd) return;

    if (!clientId) {
      // No AdSense configured at all — go straight to the "advertise with us" placeholder.
      setAdSenseFilled(false);
      return;
    }

    try {
      // @ts-expect-error adsbygoogle is injected globally by the AdSense loader script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
      setAdSenseFilled(false);
      return;
    }

    // Google marks the <ins> with data-ad-status="filled" | "unfilled" once it
    // resolves. Watch for that, with a timeout fallback in case it never sets it
    // (e.g. account not approved yet, ad blocker, etc.) — treat that as unfilled
    // so we can show the "advertise with us" placeholder instead of blank space.
    const el = adsenseRef.current;
    if (!el) return;

    let settled = false;
    const resolve = (filled: boolean) => {
      if (settled) return;
      settled = true;
      setAdSenseFilled(filled);
    };

    const observer = new MutationObserver(() => {
      const status = el.getAttribute('data-ad-status');
      if (status === 'filled') resolve(true);
      else if (status === 'unfilled') resolve(false);
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] });

    const timeout = setTimeout(() => resolve(false), 2500);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
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

  const showAdSensePlaceholder = !!clientId && adSenseFilled !== false;

  return (
    <div className="w-full flex flex-col items-center gap-1 my-4">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>

      {showAdSensePlaceholder && (
        <ins
          ref={adsenseRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={clientId}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}

      {adSenseFilled === false && (
        <Link
          to="/publicidad"
          className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 py-6 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <Megaphone className="h-4 w-4" />
          <span className="text-sm font-medium">¿Quieres anunciarte aquí? Ver precios y reservar</span>
        </Link>
      )}
    </div>
  );
}
