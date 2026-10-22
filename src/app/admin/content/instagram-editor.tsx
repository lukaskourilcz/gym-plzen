"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Instagram, RefreshCw, Eye, EyeOff } from "lucide-react";
import {
  INSTAGRAM_PROBLEMS,
  INSTAGRAM_USERNAME,
  instagramProblemText,
  type InstagramAdminState,
  type InstagramProblem,
} from "@/lib/config/instagram";
import type { Result } from "@/lib/helpers/result";
import { receiveAction } from "@/lib/helpers/action-response";
import { AdminSwitch } from "@/components/admin/switch";
import { AdminDialog } from "@/components/admin/dialog";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/admin/form-controls";
import { InstagramThumbnail } from "@/components/site/instagram-feed";
import {
  saveInstagramEnabledAction,
  saveInstagramVisibilityAction,
  refreshInstagramAction,
  disconnectInstagramAction,
} from "./instagram-actions";

/** Connection and visibility controls live outside the inert, editable website canvas. */
export function InstagramEditor({
  value,
  onChange,
}: {
  value: InstagramAdminState;
  onChange: (next: InstagramAdminState) => void;
}) {
  const params = useSearchParams();
  const returned = params.get("instagram");
  const initialProblem = INSTAGRAM_PROBLEMS.includes(
    returned as InstagramProblem,
  )
    ? instagramProblemText(returned as InstagramProblem)
    : null;
  const [error, setError] = useState<string | null>(initialProblem);
  const [success, setSuccess] = useState<string | null>(
    returned === "connected" ? "Instagram je připojený." : null,
  );
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [dialog, setDialog] = useState<"setup" | "disconnect" | null>(null);
  async function run(
    action: () => Promise<Result<InstagramAdminState>>,
    message: string,
  ) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const response = await receiveAction(action);
    setBusy(false);
    if (!response.received) {
      setUncertain(true);
      setError(
        "Změnu se nepodařilo potvrdit. Obnovte stránku a ověřte aktuální stav.",
      );
      return;
    }
    if (!response.result.ok) {
      setError(response.result.error);
      return;
    }
    onChange(response.result.data);
    setSuccess(message);
    setDialog(null);
  }
  const disabled = busy || uncertain;
  return (
    <div className="mb-5 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <label
            htmlFor="instagram-enabled"
            className="cursor-pointer font-semibold"
          >
            Ukazovat Instagram na webu
          </label>
          <p className="mt-1 text-sm text-muted-foreground">
            {value.enabled
              ? "Pás příspěvků je zapnutý."
              : "Pás je vypnutý. Propojení a texty zůstávají uložené."}
          </p>
        </div>
        <AdminSwitch
          id="instagram-enabled"
          checked={value.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) =>
            void run(
              () => saveInstagramEnabledAction({ enabled }),
              enabled
                ? "Instagram se zobrazuje na webu."
                : "Instagram je na webu skrytý.",
            )
          }
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <div>
          <p className="font-semibold">
            @{INSTAGRAM_USERNAME}{" "}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {!value.connected
                ? "Nepřipojeno"
                : value.problem === "authorization"
                  ? "Obnovte přístup"
                  : "Připojeno"}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {value.lastSyncedAt
              ? `Poslední obnova: ${new Date(value.lastSyncedAt).toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}`
              : "Po připojení se načte až 12 nejnovějších příspěvků."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {value.configured ? (
            <Button
              href="/api/admin/instagram/connect"
              prefetch={false}
              variant={value.connected ? "outline" : "default"}
            >
              <Instagram aria-hidden="true" />
              {value.connected ? "Obnovit propojení" : "Připojit Instagram"}
            </Button>
          ) : (
            <Button type="button" onClick={() => setDialog("setup")}>
              Připravit propojení
            </Button>
          )}
          {value.connected && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  void run(
                    refreshInstagramAction,
                    "Příspěvky jsou aktualizované.",
                  )
                }
              >
                <RefreshCw
                  className={
                    busy ? "animate-spin motion-reduce:animate-none" : ""
                  }
                  aria-hidden="true"
                />
                Obnovit příspěvky
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => setDialog("disconnect")}
              >
                Odpojit
              </Button>
            </>
          )}
        </div>
      </div>
      {value.problem && !error && (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          {instagramProblemText(value.problem)}
        </p>
      )}
      <div className="mt-3">
        <FormFeedback error={error} success={success} />
        {busy && (
          <p role="status" className="text-sm text-muted-foreground">
            Ukládám…
          </p>
        )}
        {uncertain && (
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Obnovit a ověřit stav
          </Button>
        )}
      </div>
      {value.posts.length > 0 && (
        <details className="mt-4 border-t border-border pt-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Vybrat viditelné příspěvky (
            {value.posts.filter((p) => !p.hidden).length})
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Na webu je nejvýše 12 nejnovějších viditelných příspěvků. Skrytí
            ponechá příspěvek na Instagramu.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {value.posts.map((post) => (
              <div
                key={post.id}
                className="overflow-hidden rounded-md border border-border"
              >
                <InstagramThumbnail post={post} />
                <p className="truncate px-2 pt-2 text-xs" title={post.caption}>
                  {post.caption || "Příspěvek bez popisku"}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs"
                  disabled={disabled}
                  onClick={() =>
                    void run(
                      () =>
                        saveInstagramVisibilityAction({
                          id: post.id,
                          hidden: !post.hidden,
                        }),
                      post.hidden
                        ? "Příspěvek je viditelný."
                        : "Příspěvek je skrytý.",
                    )
                  }
                >
                  {post.hidden ? (
                    <Eye aria-hidden="true" />
                  ) : (
                    <EyeOff aria-hidden="true" />
                  )}
                  {post.hidden ? "Zobrazit" : "Skrýt"}
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}
      {dialog === "disconnect" && (
        <AdminDialog
          title="Odpojit Instagram?"
          description="Příspěvky a přístup k Instagramu se z tohoto webu odstraní. Na Instagramu se nic nemaže. Na webu zůstane odkaz na profil."
          onClose={() => !busy && setDialog(null)}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setDialog(null)}
            >
              Ponechat propojení
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={disabled}
              onClick={() =>
                void run(disconnectInstagramAction, "Instagram je odpojený.")
              }
            >
              Odpojit Instagram
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </AdminDialog>
      )}
      {dialog === "setup" && (
        <AdminDialog
          title="Připravit Instagram"
          onClose={() => setDialog(null)}
        >
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-6">
            <li>
              Účet @navi_plzen musí být profesionální: Business nebo Creator.
            </li>
            <li>
              Správce webu připraví aplikaci Meta s Instagram Login a oprávněním
              pro čtení příspěvků.
            </li>
            <li>
              Potom zde zvolíte „Připojit Instagram“ a přihlásíte se přímo na
              Instagramu. Heslo na tomto webu nezadáváte.
            </li>
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            Do té doby se na webu zobrazuje odkaz na profil. Rezervace fungují
            nezávisle.
          </p>
          <Button
            type="button"
            className="mt-5"
            onClick={() => setDialog(null)}
          >
            Rozumím
          </Button>
        </AdminDialog>
      )}
    </div>
  );
}
