"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

const FALLBACK_MAP_ID = "DEMO_MAP_ID";
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

  useEffect(() => {
    if (!apiKey || !sectionRef.current) return;
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
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey || !shouldLoad || !mapElementRef.current) return;
    const container = mapElementRef.current;
    const resolvedMapId = mapId || FALLBACK_MAP_ID;
    let cancelled = false;
    let map: google.maps.Map | null = null;
    let marker: google.maps.marker.AdvancedMarkerElement | null = null;
    const previousAuthFailure = window.gm_authFailure;

    // Google reports credential failures outside the importLibrary promise.
    // Keep the embedded map visible instead of leaving visitors on Google's
    // "Jejda…" error surface when a deployed key is invalid or revoked.
    const handleAuthFailure = () => {
      if (!cancelled) {
        setReady(false);
        setFailed(true);
      }
      previousAuthFailure?.();
    };
    window.gm_authFailure = handleAuthFailure;

    try {
      configureLoader(apiKey, resolvedMapId);
    } catch {
      if (window.gm_authFailure === handleAuthFailure) {
        window.gm_authFailure = previousAuthFailure;
      }
      setFailed(true);
      return;
    }

    void Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map }, { AdvancedMarkerElement }]) => {
        if (cancelled) return;
        map = new Map(container, {
          center: position,
          zoom: 17,
          mapId: resolvedMapId,
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
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (window.gm_authFailure === handleAuthFailure) {
        window.gm_authFailure = previousAuthFailure;
      }
      marker?.remove();
      map?.unbindAll();
      container.replaceChildren();
    };
  }, [address, apiKey, mapId, position, shouldLoad]);

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
      {apiKey && !failed ? (
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
