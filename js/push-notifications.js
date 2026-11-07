window.initPushNotificationSetup = async function ({
  buttonId = "enablePushNotificationsBtn",
  statusId = "pushNotificationStatus",
} = {}) {
  const button = document.getElementById(buttonId);
  const status = document.getElementById(statusId);
  if (!button || !status) return;

  const supported =
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "PushManager" in window;
  if (!supported || !window.isSecureContext) {
    button.disabled = true;
    status.textContent =
      "Push notifications need a supported browser and a secure HTTPS connection.";
    return;
  }

  let registration;
  let isEnabled = false;

  const renderState = () => {
    if (Notification.permission === "denied") {
      button.disabled = true;
      button.innerHTML = `Blocked in Browser <i class="fa-solid fa-ban" aria-hidden="true"></i>`;
      status.textContent =
        "Notifications are blocked for this site. Change the site permission in your browser settings to enable them.";
      return;
    }

    button.disabled = false;
    button.innerHTML = isEnabled
      ? `Disable on This Device <i class="fa-solid fa-bell-slash" aria-hidden="true"></i>`
      : `Enable on This Device <i class="fa-solid fa-bell" aria-hidden="true"></i>`;
    status.textContent = isEnabled
      ? "This device is registered. Push alerts will arrive for updates sent to your parent account."
      : "Push alerts are off on this device. Enable them to hear about updates for your linked students.";
  };

  try {
    registration = await navigator.serviceWorker.register("/service-worker.js");
    const subscription = await registration.pushManager.getSubscription();
    if (subscription && Notification.permission === "granted") {
      const { data: { user }, error: userError } = await window.supabaseClient.auth.getUser();
      if (userError) throw userError;
      if (user) {
        const { data, error } = await window.supabaseClient
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint)
          .maybeSingle();
        if (error) throw error;
        isEnabled = Boolean(data);
      }
    }
  } catch (error) {
    console.error("Could not check push notification setup:", error);
    status.textContent = "Could not check this device’s notification setup. Try again.";
  }
  renderState();

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = isEnabled ? "Turning off…" : "Setting up…";
    try {
      if (isEnabled) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const { data: { user }, error: userError } = await window.supabaseClient.auth.getUser();
          if (userError) throw userError;
          if (user) {
            const { error } = await window.supabaseClient
              .from("push_subscriptions")
              .delete()
              .eq("user_id", user.id)
              .eq("endpoint", subscription.endpoint);
            if (error) throw error;
          }
          await subscription.unsubscribe();
        }
        isEnabled = false;
      } else {
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission === "granted") {
          if (!registration) {
            registration = await navigator.serviceWorker.register("/service-worker.js");
          }
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: base64UrlToUint8Array(
                window.T_HUB_VAPID_PUBLIC_KEY,
              ),
            });
          }
          const { data: { user }, error: userError } = await window.supabaseClient.auth.getUser();
          if (userError) throw userError;
          if (!user) throw new Error("Sign in before enabling push notifications.");
          const details = subscription.toJSON();
          const { error } = await window.supabaseClient
            .from("push_subscriptions")
            .upsert({
              user_id: user.id,
              endpoint: subscription.endpoint,
              p256dh: details.keys?.p256dh,
              auth_key: details.keys?.auth,
            }, { onConflict: "endpoint" });
          if (error) throw error;
          isEnabled = true;
        }
      }
    } catch (error) {
      console.error("Could not update push notifications:", error);
      status.textContent = error.message ||
        "Could not update notifications on this device. Check your connection and try again.";
    } finally {
      button.disabled = false;
      renderState();
    }
  });
};

function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}
