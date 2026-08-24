const events = [
  { name: "Sunset Music Festival", price: 1499 },
  { name: "BuildOps Summit", price: 2499 },
  { name: "Night Food Carnival", price: 899 },
];

const eventSelect = document.getElementById("eventSelect");
const ticketCount = document.getElementById("ticketCount");
const ticketTotal = document.getElementById("ticketTotal");
const serviceFee = document.getElementById("serviceFee");
const grandTotal = document.getElementById("grandTotal");
const receiptTitle = document.getElementById("receiptTitle");
const receiptTickets = document.getElementById("receiptTickets");
const receiptName = document.getElementById("receiptName");
const bookingForm = document.getElementById("bookingForm");
const paymentModal = document.getElementById("paymentModal");
const confirmationText = document.getElementById("confirmationText");
const bookingCode = document.getElementById("bookingCode");
const paidAmount = document.getElementById("paidAmount");
const liveStatus = document.getElementById("liveStatus");
const paymentHeading = document.getElementById("paymentHeading");
const qrPreview = document.getElementById("qrPreview");
const gpayLink = document.getElementById("gpayLink");
const phonePeLink = document.getElementById("phonePeLink");
const paytmLink = document.getElementById("paytmLink");
const closeModalBtn = document.getElementById("closeModal");
const doneBtn = document.getElementById("doneBtn");
const authModal = document.getElementById("authModal");
const openLoginBtn = document.getElementById("openLoginBtn");
const startButton = document.getElementById("startButton");
const closeAuthModalBtn = document.getElementById("closeAuthModal");
const loginForm = document.getElementById("loginForm");
const roleSelect = document.getElementById("roleSelect");
const roleHub = document.getElementById("roleHub");
const roleTitle = document.getElementById("roleTitle");
const roleDescription = document.getElementById("roleDescription");
const roleCards = document.querySelectorAll("[data-role-target]");
const eventSearch = document.getElementById("eventSearch");

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

let statusTimer = null;
let currentRole = null;

const roleCopy = {
  admin: {
    title: "Admin Dashboard",
    description: "Manage events, workshops, restaurant listings, and uploaded content.",
  },
  manager: {
    title: "Manager Dashboard",
    description: "Handle bookings, payment status, and operational updates.",
  },
  user: {
    title: "User Dashboard",
    description: "Browse listings, place bookings, and continue to payment.",
  },
};

function getSelectedEvent() {
  return events.find((event) => event.name === eventSelect.value) ?? events[0];
}

function updateTotals() {
  const selectedEvent = getSelectedEvent();
  const count = Math.max(1, Number(ticketCount.value || 1));
  const subtotal = selectedEvent.price * count;
  const fee = Math.round(subtotal * 0.05);
  const total = subtotal + fee;

  ticketTotal.textContent = currency.format(subtotal);
  serviceFee.textContent = currency.format(fee);
  grandTotal.textContent = currency.format(total);
  receiptTitle.textContent = selectedEvent.name;
  receiptTickets.textContent = String(count);
}

function populateEvents() {
  events.forEach((event) => {
    const option = document.createElement("option");
    option.value = event.name;
    option.textContent = `${event.name} - ${currency.format(event.price)}`;
    eventSelect.appendChild(option);
  });
  eventSelect.value = events[0].name;
}

function openModal() {
  paymentModal.classList.add("open");
  paymentModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  paymentModal.classList.remove("open");
  paymentModal.setAttribute("aria-hidden", "true");
  clearInterval(statusTimer);
}

async function createOrder() {
  const selectedEvent = getSelectedEvent();
  const count = Math.max(1, Number(ticketCount.value || 1));
  const subtotal = selectedEvent.price * count;
  const fee = Math.round(subtotal * 0.05);
  const total = subtotal + fee;
  const customerName = document.getElementById("fullName").value.trim() || "Guest";
  const customerEmail = document.getElementById("email").value.trim();
  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || "upi";

  const response = await fetch("/api/payments/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: total * 100,
      merchantName: "cityvibe",
      upiId: "merchant@upi",
      receipt: `pp_${Date.now()}`,
      note: `Tickets for ${selectedEvent.name}`,
      event: selectedEvent,
      customer: { name: customerName, email: customerEmail, method: paymentMethod, tickets: count },
    }),
  });

  if (!response.ok) throw new Error("Unable to create payment order");
  return response.json();
}

function startStatusPolling(orderId) {
  clearInterval(statusTimer);
  statusTimer = setInterval(async () => {
    const response = await fetch(`/api/payments/${orderId}`);
    if (!response.ok) return;
    const order = await response.json();

    if (order.status === "paid") {
      liveStatus.textContent = "Success";
      paymentHeading.textContent = "Payment successful";
      confirmationText.textContent = "Your booking has been confirmed. Redirecting now...";
      clearInterval(statusTimer);
      setTimeout(() => {
        closeModal();
        window.location.href = `/?payment=success&order=${orderId}`;
      }, 1200);
    }

    if (order.status === "failed") {
      liveStatus.textContent = "Failed";
      paymentHeading.textContent = "Payment failed";
      confirmationText.textContent = "The payment did not go through. Redirecting back...";
      clearInterval(statusTimer);
      setTimeout(() => {
        closeModal();
        window.location.href = `/?payment=failed&order=${orderId}`;
      }, 1200);
    }
  }, 1000);
}

async function openPaymentFlow() {
  const order = await createOrder();
  bookingCode.textContent = order.paymentId;
  paidAmount.textContent = currency.format(order.amount / 100);
  confirmationText.textContent = "Scan the QR code or open your UPI app to complete the payment.";
  paymentHeading.textContent = "Complete payment";
  liveStatus.textContent = "Pending";
  qrPreview.style.backgroundImage = `url("data:image/svg+xml;charset=UTF-8,${encodeURIComponent(order.qrSvg)}")`;
  gpayLink.href = order.upiIntent;
  phonePeLink.href = order.upiIntent;
  paytmLink.href = order.upiIntent;
  gpayLink.target = "_blank";
  phonePeLink.target = "_blank";
  paytmLink.target = "_blank";
  openModal();
  startStatusPolling(order.orderId);
}

function openAuthModal(prefilledRole = "user") {
  if (!authModal || !roleSelect) return;
  roleSelect.value = prefilledRole;
  authModal.classList.add("open");
  authModal.setAttribute("aria-hidden", "false");
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.classList.remove("open");
  authModal.setAttribute("aria-hidden", "true");
}

function showRoleHub(role) {
  if (!roleHub || !roleTitle || !roleDescription) return;
  currentRole = role;
  const copy = roleCopy[role];
  roleTitle.textContent = copy.title;
  roleDescription.textContent = copy.description;
  roleHub.hidden = false;
  roleHub.scrollIntoView({ behavior: "smooth" });
}

populateEvents();
updateTotals();

eventSelect.addEventListener("change", updateTotals);
ticketCount.addEventListener("input", updateTotals);

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.getElementById("fullName").value.trim() || "Guest";
  receiptName.textContent = name;
  try {
    await openPaymentFlow();
  } catch (error) {
    paymentHeading.textContent = "Payment unavailable";
    confirmationText.textContent = error.message;
    liveStatus.textContent = "Error";
    openModal();
  }
});

closeModalBtn?.addEventListener("click", closeModal);
doneBtn?.addEventListener("click", closeModal);
paymentModal?.addEventListener("click", (event) => {
  if (event.target === paymentModal) closeModal();
});

document.querySelectorAll("[data-book], .book-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const eventName = button.dataset.book || button.closest(".event-card")?.dataset.name;
    if (!eventName) return;
    eventSelect.value = eventName;
    updateTotals();
    document.getElementById("checkout").scrollIntoView({ behavior: "smooth" });
  });
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((item) => item.classList.remove("active"));
    chip.classList.add("active");
    const filter = chip.dataset.filter;
    document.querySelectorAll(".event-card").forEach((card) => {
      card.style.display = filter === "all" || card.dataset.category === filter ? "block" : "none";
    });
  });
});

openLoginBtn?.addEventListener("click", () => openAuthModal("user"));
startButton?.addEventListener("click", () => openAuthModal("user"));
closeAuthModalBtn?.addEventListener("click", closeAuthModal);
authModal?.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuthModal();
});

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const role = roleSelect?.value || "user";
  closeAuthModal();
  showRoleHub(role);
});

roleCards.forEach((card) => {
  card.addEventListener("click", () => {
    const role = card.dataset.roleTarget;
    showRoleHub(role);
  });
});

if (eventSearch) {
  eventSearch.addEventListener("input", () => {
    const query = eventSearch.value.trim().toLowerCase();
    document.querySelectorAll(".event-grid .event-card").forEach((card) => {
      const haystack = [
        card.dataset.name,
        card.dataset.category,
        card.dataset.venue,
        card.textContent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      card.style.display = haystack.includes(query) ? "block" : "none";
    });
  });
}
