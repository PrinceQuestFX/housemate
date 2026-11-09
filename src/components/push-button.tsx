"use client";

import { useState } from "react";
import { btn } from "@/components/ui";

function urlBase64ToBytes(s: string): Uint8Array {
  const padded = (s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function PushButton() {
  const [msg, setMsg] = useState("");

  async function enable() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return setMsg("Non pris en charge ici. Sur iPhone, ajoutez d'abord l'application à l'écran d'accueil.");
      }
      if ((await Notification.requestPermission()) !== "granted") return setMsg("Autorisation refusée.");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
      });
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      setMsg(r.ok ? "Notifications activées sur cet appareil." : "Échec de l'activation.");
    } catch {
      setMsg("Échec de l'activation.");
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={enable} className={btn}>Activer les notifications push</button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}
