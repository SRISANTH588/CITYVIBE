import * as admin from "firebase-admin";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT_JSON.");
  process.exit(1);
}

if (!admin.getApps().length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
  });
}

const db = admin.firestore();
const now = Date.now();

const seedUsers = [
  {
    id: "user_customer_1",
    data: {
      name: "Anika Rao",
      email: "anika@example.com",
      phone: "+919999000001",
      role: "customer",
      emailVerified: true,
      archived: false,
      createdAt: now - 86400000,
    },
  },
  {
    id: "user_client_1",
    data: {
      name: "Rohan Mehta",
      email: "rohan@example.com",
      phone: "+919999000002",
      role: "client",
      emailVerified: true,
      archived: false,
      createdAt: now - 172800000,
    },
  },
  {
    id: "user_admin_1",
    data: {
      name: "Cityvibe Admin",
      email: "admin@cityvibe.com",
      phone: "+919999000003",
      role: "admin",
      emailVerified: true,
      archived: false,
      createdAt: now - 259200000,
    },
  },
];

const seedEvents = [
  {
    id: "event_sunset_music",
    data: {
      name: "Sunset Music Festival",
      city: "Mumbai",
      category: "music",
      price: 1499,
      status: "published",
      archived: false,
      createdAt: now - 86400000,
      updatedAt: now - 43200000,
    },
  },
  {
    id: "event_buildops",
    data: {
      name: "BuildOps Summit",
      city: "Bengaluru",
      category: "business",
      price: 2499,
      status: "published",
      archived: false,
      createdAt: now - 172800000,
      updatedAt: now - 86400000,
    },
  },
  {
    id: "event_food_carnival",
    data: {
      name: "Night Food Carnival",
      city: "Delhi",
      category: "food",
      price: 899,
      status: "draft",
      archived: false,
      createdAt: now - 259200000,
      updatedAt: now - 216000000,
    },
  },
];

const seedBookings = [
  {
    id: "booking_1",
    data: {
      userId: "user_customer_1",
      clientId: "user_client_1",
      eventName: "Sunset Music Festival",
      city: "Mumbai",
      tickets: 2,
      status: "confirmed",
      createdAt: now - 3600000,
    },
  },
  {
    id: "booking_2",
    data: {
      userId: "user_customer_1",
      clientId: "user_client_1",
      eventName: "BuildOps Summit",
      city: "Bengaluru",
      tickets: 1,
      status: "paid",
      createdAt: now - 7200000,
    },
  },
];

const seedPayments = [
  {
    id: "payment_1",
    data: {
      userId: "user_customer_1",
      receipt: "rcpt_1001",
      eventName: "Sunset Music Festival",
      amount: 3147,
      status: "paid",
      archived: false,
      createdAt: now - 3500000,
      updatedAt: now - 3500000,
    },
  },
  {
    id: "payment_2",
    data: {
      userId: "user_customer_1",
      receipt: "rcpt_1002",
      eventName: "BuildOps Summit",
      amount: 2624,
      status: "refund_pending",
      archived: false,
      createdAt: now - 7100000,
      updatedAt: now - 7100000,
    },
  },
];

const seedProjects = [
  {
    id: "project_1",
    data: {
      ownerId: "user_client_1",
      name: "City Launch Campaign",
      category: "campaign",
      status: "active",
      summary: "Launch citywide promotion for premium events.",
      updatedAt: now - 1800000,
      createdAt: now - 86400000,
    },
  },
  {
    id: "project_2",
    data: {
      ownerId: "user_client_1",
      name: "Venue Sync",
      category: "operations",
      status: "review",
      summary: "Confirm venue capacity, timing, and guest flow.",
      updatedAt: now - 5400000,
      createdAt: now - 172800000,
    },
  },
];

async function writeCollection(collectionName, items) {
  const batch = db.batch();
  for (const item of items) {
    batch.set(db.collection(collectionName).doc(item.id), item.data, { merge: true });
  }
  await batch.commit();
}

async function main() {
  await writeCollection("users", seedUsers);
  await writeCollection("events", seedEvents);
  await writeCollection("bookings", seedBookings);
  await writeCollection("payments", seedPayments);
  await writeCollection("clientProjects", seedProjects);
  console.log("Firestore seeded with sample dashboard data.");
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
