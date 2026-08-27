import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import * as admin from "firebase-admin";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = __dirname;
const orders = new Map();
const sessions = new Map();

if (!admin.getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
    });
  } else {
    admin.initializeApp();
  }
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

const dashboardFiles = {
  admin: "admin-dashboard.html",
  client: "client-dashboard.html",
};

const clientPages = {
  "": "client-dashboard.html",
  overview: "client-dashboard.html",
  projects: "client-projects.html",
  bookings: "client-bookings.html",
  activity: "client-activity.html",
};

const adminPages = {
  "": "admin-dashboard.html",
  overview: "admin-dashboard.html",
  users: "admin-users.html",
  events: "admin-events.html",
  refunds: "admin-refunds.html",
};

const localDevAccounts = new Map([
  [
    "SRISANTH",
    {
      username: "SRISANTH",
      password: "SASI@2006",
      role: "admin",
      name: "Srisanth",
      email: "srisanth@cityvibe.local",
    },
  ],
  [
    "SASI",
    {
      username: "SASI",
      password: "sasi",
      role: "client",
      name: "Sasi",
      email: "sasi@cityvibe.local",
      onboardingComplete: false,
    },
  ],
]);

const demoAccounts = new Map();

function send(res, statusCode, payload, headers = {}) {
  const isJson = typeof payload === "object" && !(payload instanceof Buffer);
  res.writeHead(statusCode, {
    "Content-Type": isJson ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    ...headers,
  });
  res.end(isJson ? JSON.stringify(payload) : payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return cookies;
    cookies[key] = decodeURIComponent(rest.join("=") || "");
    return cookies;
  }, {});
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.cityvibe_session;
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

function requireSession(req) {
  const session = getSession(req);
  if (!session) return null;
  return session;
}

function setSessionCookie(res, sessionId) {
  res.setHeader("Set-Cookie", `cityvibe_session=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; SameSite=Lax`);
}

function createSession(user) {
  const sessionId = randomUUID();
  const session = {
    sessionId,
    uid: user.uid || `dev_${user.username.toLowerCase()}`,
    email: user.email || "",
    name: user.name || user.username,
    phoneNumber: user.phoneNumber || "",
    emailVerified: Boolean(user.emailVerified ?? true),
    admin: user.role === "admin",
    role: user.role === "admin" ? "admin" : "client",
    provider: user.provider || "password",
    createdAt: Date.now(),
  };
  sessions.set(sessionId, session);
  return session;
}

function getAccountByUsername(username) {
  const key = String(username || "").trim().toUpperCase();
  if (!key) return null;
  return demoAccounts.get(key) || localDevAccounts.get(key) || null;
}

function makeQrSvg(payload) {
  const text = payload.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="100%" height="100%" rx="28" fill="#08101e"/>
  <rect x="24" y="24" width="272" height="272" rx="18" fill="#ffffff"/>
  <g fill="#08101e">
    <rect x="44" y="44" width="68" height="68" rx="10"/>
    <rect x="208" y="44" width="68" height="68" rx="10"/>
    <rect x="44" y="208" width="68" height="68" rx="10"/>
    <rect x="132" y="44" width="20" height="20"/>
    <rect x="160" y="44" width="20" height="20"/>
    <rect x="132" y="72" width="20" height="20"/>
    <rect x="160" y="72" width="20" height="20"/>
    <rect x="132" y="132" width="20" height="20"/>
    <rect x="160" y="132" width="20" height="20"/>
    <rect x="132" y="160" width="20" height="20"/>
    <rect x="188" y="160" width="20" height="20"/>
    <rect x="216" y="160" width="20" height="20"/>
    <rect x="132" y="188" width="20" height="20"/>
    <rect x="160" y="188" width="20" height="20"/>
    <rect x="188" y="188" width="20" height="20"/>
    <rect x="160" y="216" width="20" height="20"/>
  </g>
  <text x="160" y="305" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#a9b6cf">${text}</text>
</svg>`;
}

function makeUpiIntent({ pa, pn, am, tn, tr }) {
  const params = new URLSearchParams({
    pa,
    pn,
    am,
    tn,
    tr,
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}

function getPaymentUrl(orderId) {
  return `/pay/${orderId}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "POST" && url.pathname === "/api/auth/verify") {
    try {
      const body = await readBody(req);
      const { idToken, role = "client", onboardingComplete = false } = body;
      if (!idToken) return send(res, 400, { success: false, error: "Missing idToken" });

      const decoded = await admin.auth().verifyIdToken(idToken);
      const sessionId = randomUUID();
      const session = {
        sessionId,
        uid: decoded.uid,
        email: decoded.email || "",
        name: decoded.name || decoded.email || "Guest",
        phoneNumber: decoded.phone_number || "",
        emailVerified: Boolean(decoded.email_verified),
        admin: Boolean(decoded.admin),
        role: role === "admin" ? "admin" : "client",
        onboardingComplete: Boolean(onboardingComplete),
        provider: decoded.firebase?.sign_in_provider || "",
        createdAt: Date.now(),
      };
      sessions.set(sessionId, session);
      setSessionCookie(res, sessionId);
      return send(res, 200, { success: true, user: session });
    } catch (error) {
      return send(res, 401, { success: false, error: "Invalid Firebase token" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/local-login") {
    try {
      const body = await readBody(req);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!username || !password) {
        return send(res, 400, { success: false, error: "Missing username or password" });
      }
      const account = getAccountByUsername(username);
      if (!account || account.password !== password) {
        return send(res, 401, { success: false, error: "Invalid username or password" });
      }
      const session = createSession(account);
      setSessionCookie(res, session.sessionId);
      return send(res, 200, { success: true, user: session });
    } catch (error) {
      return send(res, 500, { success: false, error: "Local login failed" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    try {
      const body = await readBody(req);
      const username = String(body.username || "").trim();
      const fullName = String(body.name || "").trim();
      const password = String(body.password || "");
      if (!username || !fullName || !password) {
        return send(res, 400, { success: false, error: "Missing username, name, or password" });
      }
      if (getAccountByUsername(username)) {
        return send(res, 409, { success: false, error: "Username already exists" });
      }
      const account = {
        username,
        password,
        role: "client",
        name: fullName,
        email: `${username.toLowerCase()}@cityvibe.local`,
      };
      demoAccounts.set(username.toUpperCase(), account);
      const session = createSession(account);
      setSessionCookie(res, session.sessionId);
      return send(res, 200, { success: true, user: session });
    } catch (error) {
      return send(res, 500, { success: false, error: "Registration failed" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/onboarding/client") {
    try {
      const session = requireSession(req);
      if (!session) return send(res, 401, { success: false, error: "Not signed in" });
      const body = await readBody(req);
      const uid = session.uid;
      const onboarding = {
        brandDetails: {
          brandName: String(body.brandDetails?.brandName || body.companyName || session.name || "").trim(),
          website: String(body.brandDetails?.website || body.website || "").trim(),
          category: String(body.brandDetails?.category || "").trim(),
          tagline: String(body.brandDetails?.tagline || "").trim(),
          description: String(body.brandDetails?.description || "").trim(),
          email: String(body.brandDetails?.email || session.email || "").trim(),
          phone: String(body.brandDetails?.phone || session.phoneNumber || "").trim(),
        },
        bankDetails: {
          accountHolderName: String(body.bankDetails?.accountHolderName || "").trim(),
          bankName: String(body.bankDetails?.bankName || "").trim(),
          accountNumber: String(body.bankDetails?.accountNumber || "").trim(),
          ifsc: String(body.bankDetails?.ifsc || "").trim(),
          branch: String(body.bankDetails?.branch || "").trim(),
        },
        panDetails: {
          panNumber: String(body.panDetails?.panNumber || "").trim(),
          panHolderName: String(body.panDetails?.panHolderName || "").trim(),
          dateOfBirth: String(body.panDetails?.dateOfBirth || "").trim(),
        },
        instagramDetails: {
          handle: String(body.instagramDetails?.handle || "").trim(),
          pageName: String(body.instagramDetails?.pageName || "").trim(),
          connected: Boolean(body.instagramDetails?.connected),
          connectedAt: body.instagramDetails?.connectedAt || null,
        },
        onboardingComplete: true,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (!admin.apps.length) {
        return send(res, 500, { success: false, error: "Firebase admin not initialized" });
      }

      await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .set(
          {
            uid,
            role: session.role || "client",
            name: onboarding.brandDetails.brandName || session.name || "",
            email: session.email || onboarding.brandDetails.email || "",
            phoneNumber: onboarding.brandDetails.phone || session.phoneNumber || "",
            onboarding,
            onboardingComplete: true,
            updatedAt: Date.now(),
          },
          { merge: true },
        );

      session.onboardingComplete = true;
      session.onboarding = onboarding;
      session.name = onboarding.brandDetails.brandName || session.name;
      session.phoneNumber = onboarding.brandDetails.phone || session.phoneNumber;
      return send(res, 200, { success: true, onboarding, user: session });
    } catch (error) {
      return send(res, 400, { success: false, error: error.message || "Could not save onboarding" });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const session = requireSession(req);
    if (!session) return send(res, 401, { success: false, error: "Not signed in" });
    return send(res, 200, { success: true, user: session });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies.cityvibe_session;
    if (sessionId) sessions.delete(sessionId);
    res.setHeader("Set-Cookie", "cityvibe_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
    return send(res, 200, { success: true });
  }

  if (req.method === "GET" && url.pathname === "/logout") {
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logging out</title></head><body style="font-family:system-ui;background:#f6f8ff;color:#10203f;display:grid;place-items:center;min-height:100vh;margin:0">Signing out...</body></html>`;
    return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
  }

  if (req.method === "GET" && url.pathname === "/") {
    const html = await readFile(join(publicDir, "index.html"), "utf8");
    return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
  }

  if (req.method === "GET" && extname(url.pathname)) {
    try {
      const filePath = join(publicDir, url.pathname.slice(1));
      const file = await readFile(filePath, "utf8");
      const contentType = mimeTypes[extname(url.pathname)] || "text/plain; charset=utf-8";
      return send(res, 200, file, { "Content-Type": contentType });
    } catch {
      return send(res, 404, "Not found");
    }
  }

  if (req.method === "POST" && url.pathname === "/api/payments/create-order") {
    try {
      const body = await readBody(req);
      const amount = Math.max(1, Number(body.amount || 0));
      const orderId = `order_${Math.random().toString(36).slice(2, 10)}`;
      const paymentId = `pay_${Math.random().toString(36).slice(2, 10)}`;
      const receipt = body.receipt || `rcpt_${Date.now()}`;
      const upiId = body.upiId || "merchant@upi";
      const merchantName = body.merchantName || "Cashfree";
      const qrPayload = `upi:${merchantName}:${orderId}:${amount}`;
      const order = {
        id: orderId,
        paymentId,
        amount,
        currency: "INR",
        status: "created",
        receipt,
        customer: body.customer || {},
        event: body.event || {},
        qrSvg: makeQrSvg(qrPayload),
        upiIntent: makeUpiIntent({
          pa: upiId,
          pn: merchantName,
          am: (amount / 100).toFixed(2),
          tn: body.note || `Payment for ${body.event?.name || "event tickets"}`,
          tr: orderId,
        }),
      };
      orders.set(orderId, order);
      return send(res, 200, {
        success: true,
        orderId,
        paymentId,
        amount,
        currency: "INR",
        status: order.status,
        checkoutUrl: getPaymentUrl(orderId),
        upiIntent: order.upiIntent,
        qrSvg: order.qrSvg,
        receipt,
      });
    } catch (error) {
      return send(res, 400, { success: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/payments/")) {
    const orderId = url.pathname.split("/").pop();
    const order = orders.get(orderId);
    if (!order) return send(res, 404, { success: false, error: "Order not found" });
    return send(res, 200, order);
  }

  if (req.method === "POST" && url.pathname === "/api/payments/confirm") {
    try {
      const body = await readBody(req);
      const order = orders.get(body.orderId);
      if (!order) return send(res, 404, { success: false, error: "Order not found" });
      const outcome = body.status === "failed" ? "failed" : "paid";
      order.status = outcome;
      order.paymentId = `pay_${Math.random().toString(36).slice(2, 10)}`;
      return send(res, 200, { success: true, orderId: order.id, status: order.status, paymentId: order.paymentId });
    } catch (error) {
      return send(res, 400, { success: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/payments/confirm") {
    const orderId = url.searchParams.get("orderId");
    const status = url.searchParams.get("status");
    const order = orders.get(orderId);
    if (!order) return send(res, 404, "Order not found");
    order.status = status === "failed" ? "failed" : "paid";
    order.paymentId = `pay_${Math.random().toString(36).slice(2, 10)}`;
    const next = `/api/payments/${order.id}`;
    const html = `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${next}"></head><body>Redirecting...</body></html>`;
    return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
  }

  if (req.method === "GET" && url.pathname.startsWith("/pay/")) {
    const orderId = url.pathname.split("/").pop();
    const order = orders.get(orderId);
    if (!order) return send(res, 404, "Order not found");
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pay ${order.id}</title>
<style>body{font-family:system-ui;background:#08101e;color:#edf4ff;display:grid;place-items:center;min-height:100vh;margin:0}.card{background:#101c32;border:1px solid rgba(255,255,255,.1);padding:24px;border-radius:24px;max-width:520px;width:calc(100% - 32px)}button,a{display:block;width:100%;margin-top:12px;padding:14px 16px;border-radius:999px;border:0;text-decoration:none;text-align:center}.ok{background:#7ee0c7;color:#041019}.bad{background:#ff8b8b;color:#041019}.muted{color:#a9b6cf}</style>
</head><body><div class="card"><h1>Complete payment</h1><p class="muted">Order ${order.id} for ₹${(order.amount / 100).toFixed(2)}</p><a class="ok" href="/api/payments/confirm?orderId=${order.id}&status=paid">Mark success</a><a class="bad" href="/api/payments/confirm?orderId=${order.id}&status=failed">Mark failed</a></div></body></html>`;
    return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
  }

  if (req.method === "GET" && url.pathname === "/api") {
    return send(res, 200, {
      endpoints: [
        "POST /api/auth/verify",
        "GET /api/auth/me",
        "POST /api/auth/logout",
        "POST /api/payments/create-order",
        "GET /api/payments/:orderId",
        "POST /api/payments/confirm",
      ],
    });
  }

  if (req.method === "GET" && url.pathname === "/dashboard") {
    const session = requireSession(req);
    if (!session) return send(res, 401, "Unauthorized");
    if (session.role === "client" && !session.onboardingComplete) {
      return send(res, 302, "", { Location: "/onboarding/client" });
    }
    return send(res, 302, "", { Location: `/dashboard/${session.role || "client"}` });
  }

  if (req.method === "GET" && url.pathname === "/onboarding") {
    const session = requireSession(req);
    if (!session) return send(res, 401, "Unauthorized");
    return send(res, 302, "", { Location: "/onboarding/client" });
  }

  if (req.method === "GET" && url.pathname === "/onboarding/client") {
    const session = requireSession(req);
    if (!session) {
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Client Onboarding</title></head><body style="font-family:system-ui;background:#f6f8ff;color:#10203f;display:grid;place-items:center;min-height:100vh;margin:0"><div style="background:#fff;border:1px solid #dbe5ff;border-radius:24px;padding:24px;max-width:480px;width:calc(100% - 32px)"><h1>Sign in required</h1><p>Please login first to continue to onboarding.</p><a href="/login.html">Go to login</a></div></body></html>`;
      return send(res, 401, html, { "Content-Type": "text/html; charset=utf-8" });
    }
    const html = await readFile(join(publicDir, "client-onboarding.html"), "utf8");
    return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
  }

  if (req.method === "GET" && url.pathname.startsWith("/dashboard/")) {
    const session = requireSession(req);
    if (!session) {
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cityvibe Dashboard</title></head><body style="font-family:system-ui;background:#f6f8ff;color:#10203f;display:grid;place-items:center;min-height:100vh;margin:0"><div style="background:#fff;border:1px solid #dbe5ff;border-radius:24px;padding:24px;max-width:480px;width:calc(100% - 32px)"><h1>Sign in required</h1><p>Please go back to the login page and sign in with Firebase first.</p><a href="/login.html">Go to login</a></div></body></html>`;
      return send(res, 401, html, { "Content-Type": "text/html; charset=utf-8" });
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const requestedRole = parts[1] || "client";
    const requestedPage = parts[2] || "";
    if (requestedRole !== session.role && requestedRole !== "client" && requestedRole !== "admin") {
      return send(res, 404, "Not found");
    }
    if (requestedRole !== session.role) {
      return send(res, 302, "", { Location: `/dashboard/${session.role || "client"}` });
    }
    const fileName =
      requestedRole === "admin"
        ? adminPages[requestedPage] || adminPages[""]
        : clientPages[requestedPage] || clientPages[""];
    const html = await readFile(join(publicDir, fileName), "utf8");
    return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
  }

  return send(res, 404, "Not found");
});

server.listen(3000, "127.0.0.1", () => {
  console.log("cityvibe running on http://127.0.0.1:3000");
});
