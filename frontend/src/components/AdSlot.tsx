import { useEffect, useRef } from 'react';

/**
 * Reserved slot for external ad networks (Google AdSense, etc.).
 *
 * Stays completely inactive (renders nothing) until VITE_ADSENSE_CLIENT_ID
 * is set as an environment variable in Vercel. Once you have an approved
 * AdSense account:
 *   1. Add VITE_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXX to Vercel env vars
 *   2. Add the AdSense loader script to index.html (same pattern as GA4)
 *   3. That's it — every <AdSlot /> already placed in the app activates automatically.
 */
export default function AdSlot({ slotId, label = 'Publicidad' }: { slotId?: string; label?: string }) {
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!clientId) return;
    try {
      // @ts-expect-error adsbygoogle is injected globally by the AdSense loader script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, [clientId]);

  if (!clientId) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center gap-1 my-4">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
