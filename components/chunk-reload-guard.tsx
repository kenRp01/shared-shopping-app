"use client";

import { useEffect } from "react";

const RELOAD_KEY = "shareshopi:chunk-reload";

function isChunkLoadError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value ?? "");
  return message.includes("ChunkLoadError") || message.includes("Loading chunk");
}

export function ChunkReloadGuard() {
  useEffect(() => {
    const resetReloadFlag = () => {
      sessionStorage.removeItem(RELOAD_KEY);
    };

    const reloadOnce = () => {
      if (sessionStorage.getItem(RELOAD_KEY) === "1") {
        return;
      }
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    };

    const handleError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        event.preventDefault();
        reloadOnce();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault();
        reloadOnce();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("pageshow", resetReloadFlag);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("pageshow", resetReloadFlag);
    };
  }, []);

  return null;
}
