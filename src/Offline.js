import { useLang } from "./i18n.js";
const { useState, useEffect } = React;
// Thin notice at the top when the phone has no connection.
export function OfflineBanner() {
  const { t } = useLang();
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" || navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  if (online) return null;
  return <div className="offline-banner" role="status">{t("You're offline. Showing the last saved data.")}</div>;
}
