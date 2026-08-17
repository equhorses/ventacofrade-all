import { useEffect, useState, ReactNode } from 'react';
import ComingSoon from '@/components/ComingSoon';

const COMING_SOON_ENABLED = import.meta.env.VITE_COMING_SOON_MODE === 'true';
const BYPASS_KEY = import.meta.env.VITE_COMING_SOON_BYPASS_KEY as string | undefined;
const BYPASS_STORAGE_KEY = 'vc_bypass_coming_soon';
const BYPASS_QUERY_PARAM = 'acceso';

function hasBypass(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get(BYPASS_QUERY_PARAM);

  if (BYPASS_KEY && queryValue === BYPASS_KEY) {
    localStorage.setItem(BYPASS_STORAGE_KEY, 'true');
    params.delete(BYPASS_QUERY_PARAM);
    const newSearch = params.toString();
    const newUrl =
      window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);
    return true;
  }

  return localStorage.getItem(BYPASS_STORAGE_KEY) === 'true';
}

export default function ComingSoonGate({ children }: { children: ReactNode }) {
  const [bypassed, setBypassed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setBypassed(hasBypass());
    setChecked(true);
  }, []);

  if (!COMING_SOON_ENABLED) {
    return <>{children}</>;
  }

  if (!checked) {
    return null;
  }

  if (bypassed) {
    return <>{children}</>;
  }

  return <ComingSoon />;
}
