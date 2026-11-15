import { createClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const configuredSecretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? configuredSecretKeys.default;
const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type PushWebhook = {
  type?: string;
  table?: string;
  schema?: string;
  record?: {
    id?: string;
    user_id?: string;
    school_id?: string;
    title?: string;
    message?: string;
    type?: string;
    status?: string;
    target_audience?: string;
    expiry_date?: string | null;
    created_by?: string;
  };
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "POST required" }, 405);
  if (!webhookSecret || request.headers.get("x-webhook-secret") !== webhookSecret) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error("Push sender is missing VAPID configuration.");
    return json({ error: "Push sender is not configured" }, 500);
  }

  let event: PushWebhook;
  try {
    event = await request.json();
  } catch {
    return json({ error: "Invalid JSON payload" }, 400);
  }

  if (event.type !== "INSERT" || event.schema !== "public") {
    return json({ skipped: true });
  }
  if (event.table === "announcements") {
    return await sendAnnouncementPush(event.record);
  }
  if (event.table !== "notifications") return json({ skipped: true });
  const notification = event.record;
  if (!notification?.user_id || !notification.title) {
    return json({ skipped: true, reason: "Notification has no recipient or title" });
  }

  // Notifications addressed to a student also reach their active linked parents.
  // Parent pushes are generic and open the parent dashboard; no parent inbox row
  // is needed. The database lookup runs here with the service-role client so the
  // browser never needs permission to enumerate parent links.
  const { data: parentLinks, error: parentLinksError } = await adminClient
    .from("parent_student_links")
    .select("parent_user_id")
    .eq("student_id", notification.user_id)
    .eq("status", "active");
  if (parentLinksError) {
    console.error("Could not load linked parents:", parentLinksError.message);
    return json({ error: "Could not load linked parents" }, 500);
  }

  const parentUserIds = [...new Set((parentLinks || []).map((link) => link.parent_user_id))];
  const parentUserIdSet = new Set(parentUserIds);
  const recipientIds = [...new Set([notification.user_id, ...parentUserIds])];

  let studentName = "your student";
  if (parentUserIds.length) {
    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("profiles(full_name)")
      .eq("id", notification.user_id)
      .maybeSingle();
    if (studentError) {
      console.warn("Could not load student name for parent push:", studentError.message);
    } else {
      const profile = Array.isArray(student?.profiles)
        ? student.profiles[0]
        : student?.profiles;
      const fullName = typeof profile?.full_name === "string"
        ? profile.full_name.trim()
        : "";
      if (fullName) studentName = fullName;
    }
  }

  const { data: subscriptions, error } = await adminClient
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_key")
    .in("user_id", recipientIds);
  if (error) {
    console.error("Could not load push subscriptions:", error.message);
    return json({ error: "Could not load push subscriptions" }, 500);
  }
  if (!subscriptions?.length) return json({ sent: 0, expired: 0 });

  const notificationCategory = notification.type === "academic"
    ? "grade"
    : notification.type === "attendance"
      ? "attendance"
      : ["fee", "fees", "finance", "financial"].includes(
          String(notification.type || "").toLowerCase(),
        )
        ? "fees"
        : "student";
  const parentTitle = notificationCategory === "grade"
    ? "Grade Update"
    : notificationCategory === "attendance"
      ? "Attendance Update"
      : notificationCategory === "fees"
        ? "Fees Update"
        : "Student Update";
  const parentPayload = {
    title: parentTitle,
    body: notificationCategory === "student"
      ? `There is a new update for ${studentName}. Sign in to T-HUB to view it.`
      : `There is a new ${notificationCategory} update for ${studentName}. Sign in to T-HUB to view it.`,
    url: "/html/parent-dashboard.html",
  };
  const studentPayload = {
    title: notification.title,
    body: notification.message || "You have a new notification.",
    url: "/html/notifications.html",
  };

  return await deliverPushes(
    subscriptions || [],
    (subscription) => parentUserIdSet.has(subscription.user_id)
      ? parentPayload
      : studentPayload,
  );
});

async function sendAnnouncementPush(announcement: PushWebhook["record"]) {
  if (!announcement?.school_id || !announcement.title) {
    return json({ skipped: true, reason: "Announcement has no school or title" });
  }
  if (
    announcement.expiry_date &&
    announcement.expiry_date < new Date().toISOString().slice(0, 10)
  ) {
    return json({ skipped: true, reason: "Announcement is already expired" });
  }

  const audiences = new Set(
    String(announcement.target_audience || "")
      .split(",")
      .map((audience) => audience.trim().toLowerCase().replace(/s$/, ""))
      .filter(Boolean),
  );
  const everyone = audiences.has("all") || audiences.has("everyone");
  const audienceRoles = new Set<string>();
  if (everyone) {
    ["admin", "teacher", "receptionist", "accountant", "librarian", "student"]
      .forEach((role) => audienceRoles.add(role));
  } else {
    ["teacher", "receptionist", "accountant", "librarian", "student"]
      .forEach((role) => {
        if (audiences.has(role)) audienceRoles.add(role);
      });
  }

  // Parents can see announcements aimed at parents or students in the portal.
  const shouldNotifyParents =
    everyone || audiences.has("parent") || audiences.has("student");
  const recipientIds = new Set<string>();
  if (audienceRoles.size) {
    const { data: profiles, error } = await adminClient
      .from("profiles")
      .select("id")
      .eq("school_id", announcement.school_id)
      .eq("status", "active")
      .in("role", [...audienceRoles]);
    if (error) {
      console.error("Could not load announcement recipients:", error.message);
      return json({ error: "Could not load announcement recipients" }, 500);
    }
    (profiles || []).forEach((profile) => {
      if (profile.id && profile.id !== announcement.created_by) {
        recipientIds.add(profile.id);
      }
    });
  }

  const parentUserIds = new Set<string>();
  if (shouldNotifyParents) {
    const { data: links, error } = await adminClient
      .from("parent_student_links")
      .select("parent_user_id")
      .eq("school_id", announcement.school_id)
      .eq("status", "active");
    if (error) {
      console.error("Could not load announcement parent links:", error.message);
      return json({ error: "Could not load announcement parent links" }, 500);
    }
    const linkedParentIds = [...new Set(
      (links || [])
        .map((link) => link.parent_user_id)
        .filter((id) => id && id !== announcement.created_by),
    )];
    if (linkedParentIds.length) {
      const { data: activeParents, error: parentsError } = await adminClient
        .from("profiles")
        .select("id")
        .in("id", linkedParentIds)
        .eq("role", "parent")
        .eq("status", "active");
      if (parentsError) {
        console.error("Could not verify active announcement parents:", parentsError.message);
        return json({ error: "Could not verify active announcement parents" }, 500);
      }
      (activeParents || []).forEach((parent) => {
        parentUserIds.add(parent.id);
        recipientIds.add(parent.id);
      });
    }
  }

  if (!recipientIds.size) return json({ sent: 0, expired: 0, recipients: 0 });
  const { data: subscriptions, error } = await adminClient
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_key")
    .in("user_id", [...recipientIds]);
  if (error) {
    console.error("Could not load announcement push subscriptions:", error.message);
    return json({ error: "Could not load announcement push subscriptions" }, 500);
  }

  const urgency = String(announcement.status || "").toLowerCase();
  const title = urgency === "urgent"
    ? "Urgent Announcement"
    : urgency === "important"
      ? "Important Announcement"
      : "School Announcement";
  const messagePreview = String(announcement.message || "").trim().replace(/\s+/g, " ");
  const body = messagePreview
    ? `${announcement.title}: ${messagePreview}`.slice(0, 180)
    : announcement.title;

  return await deliverPushes(subscriptions || [], (subscription) => ({
    title,
    body,
    url: parentUserIds.has(subscription.user_id)
      ? "/html/parent-dashboard.html"
      : "/html/dashboard.html",
  }));
}

async function deliverPushes(
  subscriptions: Array<{
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth_key: string;
  }>,
  payloadFor: (subscription: { user_id: string }) => Record<string, string>,
) {
  if (!subscriptions.length) return json({ sent: 0, expired: 0 });

  const publicKeyBytes = base64UrlToBytes(vapidPublicKey);
  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 4) {
    return json({ error: "VAPID public key is invalid" }, 500);
  }
  const exportedKeys = {
    publicKey: {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64Url(publicKeyBytes.slice(1, 33)),
      y: bytesToBase64Url(publicKeyBytes.slice(33, 65)),
      ext: true,
    },
    privateKey: {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64Url(publicKeyBytes.slice(1, 33)),
      y: bytesToBase64Url(publicKeyBytes.slice(33, 65)),
      d: vapidPrivateKey,
      ext: true,
      key_ops: ["sign"],
    },
  };
  const vapidKeys = await webpush.importVapidKeys(exportedKeys);
  const applicationServer = await webpush.ApplicationServer.new({
    contactInformation: vapidSubject,
    vapidKeys,
  });

  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try {
      const subscriber = applicationServer.subscribe({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
      });
      await subscriber.pushTextMessage(
        JSON.stringify(payloadFor(subscription)),
        { ttl: 60 * 60 },
      );
      return { id: subscription.id, sent: true };
    } catch (pushError) {
      const expired = pushError instanceof webpush.PushMessageError && pushError.isGone();
      if (expired) {
        const { error } = await adminClient
          .from("push_subscriptions")
          .delete()
          .eq("id", subscription.id);
        if (error) console.error("Could not remove expired push subscription:", error.message);
        return { id: subscription.id, sent: false, expired: true };
      }
      console.error("Push delivery failed:", pushError instanceof Error ? pushError.message : "unknown error");
      return { id: subscription.id, sent: false, expired: false };
    }
  }));

  return json({
    sent: results.filter((result) => result.sent).length,
    expired: results.filter((result) => result.expired).length,
  });
}

function base64UrlToBytes(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
