"use client";

import { useEffect, useId, useRef } from "react";

export function AnimatedEye() {
  const eyeRef = useRef<SVGSVGElement>(null);
  const irisRef = useRef<SVGGElement>(null);
  const pupilRef = useRef<SVGCircleElement>(null);
  const eyelidRef = useRef<SVGGElement>(null);
  const clipId = useId();
  const irisClipId = useId();

  useEffect(() => {
    const eye = eyeRef.current;
    const iris = irisRef.current;
    const pupil = pupilRef.current;
    const eyelid = eyelidRef.current;
    if (!eye || !iris || !pupil || !eyelid) return;

    const motion = window.matchMedia("(prefers-reduced-motion: no-preference) and (min-width: 801px)");
    let active = false;
    let frame = 0;
    let lastTime = 0;
    let blinkTimer = 0;
    let blink: Animation | undefined;
    const position = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };

    const render = (time: number) => {
      const elapsed = lastTime ? Math.min(time - lastTime, 64) : 16;
      lastTime = time;
      const ease = 1 - Math.exp(-elapsed / 85);
      position.x += (target.x - position.x) * ease;
      position.y += (target.y - position.y) * ease;
      iris.setAttribute("transform", `translate(${position.x.toFixed(3)} ${position.y.toFixed(3)})`);
      // The dark pupil follows inside the white iris with half its travel.
      pupil.setAttribute("transform", `translate(${(position.x * 0.5).toFixed(3)} ${(position.y * 0.5).toFixed(3)})`);

      if (Math.abs(target.x - position.x) + Math.abs(target.y - position.y) > 0.01) {
        frame = requestAnimationFrame(render);
      } else {
        frame = 0;
        lastTime = 0;
      }
    };

    const move = (x: number, y: number) => {
      target.x = x;
      target.y = y;
      if (!frame) frame = requestAnimationFrame(render);
    };

    const followPointer = (event: PointerEvent) => {
      if (!active || event.pointerType === "touch") return;
      const bounds = eye.getBoundingClientRect();
      // The white iris is centered at (32, 46) in the 64 × 80 artwork.
      const dx = event.clientX - (bounds.left + bounds.width / 2);
      const dy = event.clientY - (bounds.top + bounds.height * 46 / 80);
      move(Math.tanh(dx / 180) * 4.5, Math.tanh(dy / 180) * 2.5);
    };

    const returnToCenter = () => {
      if (active) move(0, 0);
    };

    const leaveWindow = (event: PointerEvent) => {
      if (!event.relatedTarget) returnToCenter();
    };

    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(() => {
        if (!active) return;
        blink?.cancel();
        blink = eyelid.animate([
          { transform: "scaleY(1)", offset: 0 },
          { transform: "scaleY(0.06)", offset: 0.42 },
          { transform: "scaleY(0.06)", offset: 0.55 },
          { transform: "scaleY(1)", offset: 1 },
        ], { duration: 210, easing: "ease-in-out" });
        scheduleBlink();
      }, 3200 + Math.random() * 4200);
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(blinkTimer);
      blink?.cancel();
      frame = 0;
      lastTime = 0;
      position.x = position.y = target.x = target.y = 0;
      iris.removeAttribute("transform");
      pupil.removeAttribute("transform");
    };

    const syncActivity = () => {
      active = motion.matches && !document.hidden;
      stop();
      if (active) scheduleBlink();
    };

    syncActivity();
    motion.addEventListener("change", syncActivity);
    document.addEventListener("visibilitychange", syncActivity);
    window.addEventListener("pointermove", followPointer, { passive: true });
    window.addEventListener("pointerout", leaveWindow);
    window.addEventListener("blur", returnToCenter);

    return () => {
      active = false;
      stop();
      motion.removeEventListener("change", syncActivity);
      document.removeEventListener("visibilitychange", syncActivity);
      window.removeEventListener("pointermove", followPointer);
      window.removeEventListener("pointerout", leaveWindow);
      window.removeEventListener("blur", returnToCenter);
    };
  }, []);

  return <svg ref={eyeRef} className="story-mark animated-eye" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80" width="80" height="100" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id={clipId}>
        <path d="M8 45c8-9 16-13 24-13s16 4 24 13c-7 6-15 11-24 14C23 56 15 51 8 45Z" />
      </clipPath>
      <clipPath id={irisClipId}>
        <circle cx="32" cy="46" r="10" />
      </clipPath>
    </defs>
    {/* Keep the official outer contour; separate the eye into moving layers. */}
    <path fill="#fff" fillRule="evenodd" clipRule="evenodd" d="M32 1C26 15 2 36 2 51c0 16 12 27 28 28V59C23 56 15 51 8 45c8-9 16-13 24-13s16 4 24 13c-7 6-15 11-22 14v20c16-1 28-12 28-28C62 36 38 15 32 1Z" />
    <g clipPath={`url(#${clipId})`}>
      <g ref={eyelidRef} className="eye-blink">
        <g ref={irisRef}>
          <circle cx="32" cy="46" r="10" fill="#fff" />
          <g clipPath={`url(#${irisClipId})`}>
            <circle ref={pupilRef} cx="32" cy="46" r="4.6" fill="#000" />
          </g>
        </g>
      </g>
    </g>
  </svg>;
}
