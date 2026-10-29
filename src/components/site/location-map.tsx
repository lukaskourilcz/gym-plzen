"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { cn } from "@/lib/utils";
import { reportTransportError } from "@/lib/helpers/report-transport-error";
import {
  isGoogleMapsModuleError,
  markMapErrorRecovered,
} from "@/lib/helpers/browser-errors";

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

let configuredApiKey: string | null = null;

function configureLoader(apiKey: string, mapId: string) {
  if (configuredApiKey === apiKey) return;
  if (configuredApiKey) {
    throw new Error("Google Maps loader is already configured.");
  }
  setOptions({
    key: apiKey,
    v: "weekly",
    language: "cs",
    region: "CZ",
    authReferrerPolicy: "origin",
    mapIds: [mapId],
  });
  configuredApiKey = apiKey;
}

/** Build the gold NAVI marker; its bottom edge sits on the map coordinate. */
function createBrandMarker() {
  const marker = document.createElement("span");
  marker.dataset.testid = "brand-map-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.className = "pointer-events-none flex flex-col items-center";

  const disc = document.createElement("span");
  disc.className =
    "grid size-16 place-items-center rounded-full bg-ink shadow-md ring-4 ring-white/75";

  const mark = document.createElement("span");
  mark.className = "block size-9 bg-gold";
  mark.style.maskImage = 'url("/images/navi-mark.png")';
  mark.style.maskPosition = "center";
  mark.style.maskRepeat = "no-repeat";
  mark.style.maskSize = "contain";
  mark.style.webkitMaskImage = 'url("/images/navi-mark.png")';
  mark.style.webkitMaskPosition = "center";
  mark.style.webkitMaskRepeat = "no-repeat";
  mark.style.webkitMaskSize = "contain";
  disc.append(mark);

  const tip = document.createElement("span");
  tip.className =
    "block size-0 border-x-8 border-t-[12px] border-x-transparent border-t-ink";

  marker.append(disc, tip);
  return marker;
}

export function LocationMap({
  address,
  apiKey,
  mapId,
  fallbackEmbedUrl,
  position,
}: {
  address: string;
  apiKey?: string;
  mapId?: string;
  fallbackEmbedUrl: string;
  position: { lat: number; lng: number };
}) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Advanced markers require a real Map ID. Until both Google credentials are
  // configured, keep the reliable embed and do not load a script that can only
  // fail (and pollute the production console with an authentication error).
  const canLoadEnhancedMap = Boolean(apiKey && mapId);

  useEffect(() => {
    if (!canLoadEnhancedMap || !sectionRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "320px" },
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [canLoadEnhancedMap]);

  useEffect(() => {
    if (
      !apiKey ||
      !mapId ||
      !canLoadEnhancedMap ||
      !shouldLoad ||
      !mapElementRef.current
    )
      return;
    const container = mapElementRef.current;
    let cancelled = false;
    let mapFailed = false;
    let map: google.maps.Map | null = null;
    let marker: google.maps.marker.AdvancedMarkerElement | null = null;
    let readyListener: google.maps.MapsEventListener | undefined;
    const disposeMap = () => {
      // Detach ownership first: failure recovery and unmount may both run.
      const currentMap = map;
      const currentMarker = marker;
      const currentListener = readyListener;
      map = null;
      marker = null;
      readyListener = undefined;
      const cleanup = [
        () => currentListener?.remove(),
        () => {
          if (currentMarker) currentMarker.map = null;
        },
        () => currentMarker?.remove(),
        () => {
          if (currentMap) google.maps.event.clearInstanceListeners(currentMap);
        },
        () => currentMap?.unbindAll(),
        () => container.replaceChildren(),
      ];
      for (const release of cleanup) {
        try {
          release();
        } catch (error) {
          // A provider cleanup failure must not prevent the usable fallback
          // or the release of the remaining resources.
          reportTransportError(error, "map.cleanup", "nonessential");
        }
      }
    };
    // The iframe remains usable while the enhanced map loads its tiles.
    const fail = () => {
      if (cancelled || mapFailed) return;
      mapFailed = true;
      window.clearTimeout(readyTimeout);
      disposeMap();
      setReady(false);
      setFailed(true);
    };
    const readyTimeout = window.setTimeout(fail, 10_000);
    const recoverRuntimeFailure = (error: unknown) => {
      if (cancelled || mapFailed || !isGoogleMapsModuleError(error))
        return false;
      fail();
      markMapErrorRecovered(error);
      return true;
    };
    const onModuleFailure = (event: PromiseRejectionEvent) => {
      if (!recoverRuntimeFailure(event.reason)) return;
      // Google's internal promise is outside importLibrary's catch. Only
      // consume this exact failure while our mounted map provides a fallback.
      event.preventDefault();
    };
    const onRuntimeFailure = (event: ErrorEvent) => {
      if (recoverRuntimeFailure(event.error)) event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onModuleFailure);
    window.addEventListener("error", onRuntimeFailure);
    const previousAuthFailure = window.gm_authFailure;

    // Google reports credential failures outside the importLibrary promise.
    // Keep the embedded map visible instead of leaving visitors on Google's
    // "Jejda…" error surface when a deployed key is invalid or revoked.
    const handleAuthFailure = () => {
      fail();
      previousAuthFailure?.();
    };
    window.gm_authFailure = handleAuthFailure;

    void Promise.resolve()
      .then(() => {
        configureLoader(apiKey, mapId);
        return Promise.all([importLibrary("maps"), importLibrary("marker")]);
      })
      .then(([{ Map, RenderingType }, { AdvancedMarkerElement }]) => {
        if (cancelled || mapFailed) return;
        map = new Map(container, {
          center: position,
          zoom: 17,
          mapId,
          // A location marker needs no 3D/WebGL worker or WASM compilation.
          // Override vector Map IDs rather than weakening the site's CSP.
          renderingType: RenderingType.RASTER,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
        marker = new AdvancedMarkerElement({
          map,
          position,
          title: address,
          anchorLeft: "-50%",
          anchorTop: "-100%",
        });
        marker.append(createBrandMarker());
        readyListener = map.addListener("tilesloaded", () => {
          if (cancelled || mapFailed) return;
          window.clearTimeout(readyTimeout);
          setReady(true);
        });
      })
      .catch(() => {
        fail();
      });

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimeout);
      window.removeEventListener("unhandledrejection", onModuleFailure);
      window.removeEventListener("error", onRuntimeFailure);
      if (window.gm_authFailure === handleAuthFailure) {
        window.gm_authFailure = previousAuthFailure;
      }
      disposeMap();
    };
  }, [address, apiKey, canLoadEnhancedMap, mapId, position, shouldLoad]);

  return (
    <div ref={sectionRef} className="absolute inset-0">
      <iframe
        title={`Mapa, ${address}`}
        src={fallbackEmbedUrl}
        data-testid="location-map"
        aria-hidden={ready || undefined}
        tabIndex={ready ? -1 : 0}
        className={cn("h-full w-full border-0 grayscale", ready && "hidden")}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
      {canLoadEnhancedMap && !failed ? (
        <div
          ref={mapElementRef}
          data-testid="location-map-canvas"
          role="region"
          aria-label={`Mapa, ${address}`}
          aria-hidden={!ready}
          className={cn(
            "absolute inset-0 transition-opacity duration-[220ms] ease-brand",
            ready
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0",
          )}
        />
      ) : null}
    </div>
  );
}
