import { useEffect, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import ComingSoon from '@/components/ComingSoon';
import { getAPIBaseURL } from '@/lib/config';

const COMING_SOON_ENABLED = import.meta.env.VITE_COMING_SOON_MODE === 'true';
const BYPASS_KEY = import.meta.env.VITE_COMING_SOON_BYPASS_KEY as string | undefined;
const BYPASS_STORAGE_KEY = 'vc_bypass_coming_soon';
const BYPASS_QUERY_PARAM = 'acceso';
const INVITE_QUERY_PARAM = 'invite';

function stripQueryParam(param: string) {
  const params = new URLSearchParams(window.location.search);
  params.delete(param);
  const newSearch = params.toString();
  const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
  window.history.replaceState({}, '', newUrl);
}

/** Fast, synchronous check: the shared team key, or a bypass already remembered from before. */
function hasStoredOrKeyBypass(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get(BYPASS_QUERY_PARAM);

  if (BYPASS_KEY && queryValue === BYPASS_KEY) {
    localStorage.setItem(BYPASS_STORAGE_KEY, 'true');
    stripQueryParam(BYPASS_QUERY_PARAM);
    return true;
  }

  return localStorage.getItem(BYPASS_STORAGE_KEY) === 'true';
}

/** Slower check: a personal, single-invitee token sent by email (?invite=...). */
async function checkInviteToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  const token = params.get(INVITE_QUERY_PARAM);
  if (!token) return false;

  try {
    const response = await fetch(
      `${getAPIBaseURL()}/api/v1/invitations/verify?token=${encodeURIComponent(token)}`
    );
    if (!response.ok) return false;
    const data = await response.json();
    if (data.valid) {
      localStorage.setItem(BYPASS_STORAGE_KEY, 'true');
      stripQueryParam(INVITE_QUERY_PARAM);
      return true;
    }
  } catch (err) {
    console.error('Error verifying invite token:', err);
  }
  return false;
}

export default function ComingSoonGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [bypassed, setBypassed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (hasStoredOrKeyBypass()) {
      setBypassed(true);
      setChecked(true);
      return;
    }

    checkInviteToken().then((valid) => {
      setBypassed(valid);
      setChecked(true);
    });
  }, []);

  if (!COMING_SOON_ENABLED) {
    return <>{children}</>;
  }

  // Re-evaluated on every navigation (location changes), unlike a plain
  // window.location.pathname check — legal pages stay open, but navigating
  // away from them correctly re-applies the gate.
  const isLegalPage = location.pathname.startsWith('/legal/');
  if (isLegalPage) {
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
