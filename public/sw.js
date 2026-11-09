self.addEventListener("push", (event) => {
  const d = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(d.title || "HOUSEMATE", {
    body: d.body || "", icon: "/icon-192.png", data: { url: d.url || "/notifications" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
