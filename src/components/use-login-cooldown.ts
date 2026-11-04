"use client";

import { useEffect, useState } from "react";
import { remainingSeconds, retryDeadline, type LoginMethod } from "@inkspect/core/lib/auth-cooldown";

export function useLoginCooldown() {
  const [deadlines, setDeadlines] = useState({ social: 0, email: 0 });
  const [now, setNow] = useState(0);
  const active = deadlines.social > now || deadlines.email > now;

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 250);
    // Recalculate from the clock after background-tab throttling or Back navigation.
    window.addEventListener("focus", tick);
    window.addEventListener("pageshow", tick);
    return () => { clearInterval(interval); window.removeEventListener("focus", tick); window.removeEventListener("pageshow", tick); };
  }, [active]);

  function start(method: LoginMethod, response: Response) {
    const receivedAt = Date.now();
    setNow(receivedAt);
    setDeadlines((current) => ({ ...current, [method]: retryDeadline(response.headers, receivedAt) }));
  }

  return {
    start,
    isBlocked: (method: LoginMethod) => deadlines[method] > Date.now(),
    seconds: { social: remainingSeconds(deadlines.social, now), email: remainingSeconds(deadlines.email, now) },
  };
}
