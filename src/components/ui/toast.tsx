"use client";

import { Toast } from "@base-ui/react/toast";
import { CircleCheck, Info, OctagonX, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./button";
import styles from "../notification-toast.module.css";

/* Adapted from shadcn/ui's Base Nova Toast registry component.
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const toastClasses = [
  "group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom rounded-2xl border bg-popover text-popover-foreground shadow-lg will-change-transform outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
  "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]",
  "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
  "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
  "data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]",
  "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
  "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
  "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
  "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
  "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
  "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
  "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
  "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
  "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
].join(" ");

export function Toaster() {
  const { toasts } = Toast.useToastManager();
  const [container, setContainer] = useState<HTMLElement | undefined>();
  useEffect(() => {
    let active = true;
    const synchronize = () => {
      if (!active) return;
      // Only native dialogs require a top-layer host. Radix content uses transforms,
      // which would anchor the fixed viewport to the modal instead of the screen.
      const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
      const current = dialogs.item(dialogs.length - 1) || undefined;
      setContainer(previous => previous === current ? previous : current);
    };
    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    void Promise.resolve().then(synchronize);
    return () => { active = false; observer.disconnect(); };
  }, []);
  return <Toast.Portal container={container}>
    <Toast.Viewport data-slot="toast-viewport" className={styles.viewport}>
      {toasts.map(item => {
        const Icon = item.type === "error" ? OctagonX : item.type === "celebration" ? Sparkles : item.type === "success" ? CircleCheck : Info;
        return <Toast.Root key={item.id} toast={item} data-slot="toast" className={toastClasses}>
          <Toast.Content data-slot="toast-content" className="flex h-full items-center gap-3 overflow-hidden p-4 transition-opacity duration-250 data-behind:opacity-0 data-expanded:opacity-100">
            <Icon size={16} aria-hidden="true" className={item.type === "error" ? "shrink-0 text-destructive" : "shrink-0"} />
            <Toast.Title className="min-w-0 flex-1 text-sm font-medium wrap-anywhere" />
            <Toast.Action render={<Button variant="outline" size="sm" />} />
            <Toast.Close render={<Button variant="ghost" size="icon-sm" />} aria-label="Dismiss notification" className="text-muted-foreground hover:text-foreground">
              <X size={16} aria-hidden="true" />
            </Toast.Close>
          </Toast.Content>
        </Toast.Root>;
      })}
    </Toast.Viewport>
  </Toast.Portal>;
}
