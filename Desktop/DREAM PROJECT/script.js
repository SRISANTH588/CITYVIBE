const modals = document.querySelectorAll(".modal");
const openers = document.querySelectorAll("[data-modal]");
const closers = document.querySelectorAll("[data-close-modal]");
const serviceCards = document.querySelectorAll("[data-service]");
const payChips = document.querySelectorAll("[data-payment]");
const locationPills = document.querySelectorAll("[data-location]");
const selectedPayment = document.getElementById("selectedPayment");
const stars = document.querySelectorAll(".stars button");
const statusCard = document.querySelector(".status-card");
const mapElement = document.getElementById("map");
const mapFallback = document.getElementById("mapFallback");
const pickupInput = document.getElementById("pickupInput");
const dropInput = document.getElementById("dropInput");
const pickupResults = document.getElementById("pickupResults");
const dropResults = document.getElementById("dropResults");
const serviceChoices = document.getElementById("serviceChoices");
const recentPlaces = document.getElementById("recentPlaces");
const recentPlacesList = document.getElementById("recentPlacesList");
const bookRideBtn = document.getElementById("bookRideBtn");
const riderCard = document.querySelector(".rider-card");
const riderCode = riderCard?.querySelector(".rider-top strong");
const riderVehicle = riderCard?.querySelector(".rider-top p");
const riderPerson = riderCard?.querySelectorAll(".rider-top p")?.[1];
const riderAvatar = riderCard?.querySelector(".avatar");
const riderPickupText = riderCard?.querySelector(".pickup-line strong");

const demoCenter = [17.4435, 78.3772];
const pickupPoint = [17.4448, 78.3784];
const riderPoints = [
  [17.4438, 78.3791],
  [17.4461, 78.3768],
  [17.4483, 78.3802],
];

const riderPool = {
  bike: {
    code: "AP40KJ6350",
    vehicle: "Suzuki Access",
    name: "Boddu Srisanth",
    initials: "BS",
    pickupLabel: "Bike rider assigned",
  },
  auto: {
    code: "AP40KJ8721",
    vehicle: "Bajaj Auto",
    name: "Ravi Kumar",
    initials: "RK",
    pickupLabel: "Auto captain assigned",
  },
  cab: {
    code: "AP40KJ9912",
    vehicle: "Swift Dzire",
    name: "Suresh Babu",
    initials: "SB",
    pickupLabel: "Cab driver assigned",
  },
  parcel: {
    code: "AP40KJ5520",
    vehicle: "Parcel Bike",
    name: "Anil Kumar",
    initials: "AK",
    pickupLabel: "Parcel rider assigned",
  },
  delivery: {
    code: "AP40KJ3344",
    vehicle: "Delivery Bike",
    name: "Kiran",
    initials: "K",
    pickupLabel: "Instant delivery rider assigned",
  },
};

modals.forEach((modal) => {
  modal.hidden = true;
});

if (serviceChoices) serviceChoices.classList.add("hidden");

const state = {
  pickup: null,
  drop: null,
  activeField: "pickup",
  user: null,
  userCity: null,
  userState: null,
  map: null,
  pickupMarker: null,
  dropMarker: null,
  userMarker: null,
  routeLine: null,
  riderMarkers: [],
  recentDestinations: JSON.parse(localStorage.getItem("rydexRecentDestinations") || "[]"),
};

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.hidden = false;
}

function closeModal(modal) {
  if (modal) modal.hidden = true;
}

openers.forEach((button) => {
  button.addEventListener("click", () => openModal(button.dataset.modal));
});

closers.forEach((button) => {
  button.addEventListener("click", () => closeModal(button.closest(".modal")));
});

modals.forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal(modal);
  });
});

serviceCards.forEach((card) => {
  card.addEventListener("click", () => {
    serviceCards.forEach((item) => item.classList.remove("active"));
    card.classList.add("active");
    if (statusCard) {
      statusCard.querySelector("strong").textContent = `${card.textContent.trim()} selected`;
      statusCard.querySelector("span").textContent = "Assigned rider will appear here";
    }
    updateRiderCard();
  });
});

locationPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    locationPills.forEach((item) => item.classList.remove("active"));
    pill.classList.add("active");
  });
});

payChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    payChips.forEach((item) => item.classList.remove("active"));
    chip.classList.add("active");
    if (selectedPayment) {
      selectedPayment.textContent = chip.dataset.payment === "razorpay" ? "Razorpay" : chip.textContent;
    }
  });
});

stars.forEach((star, index) => {
  star.addEventListener("click", () => {
    stars.forEach((item, itemIndex) => {
      item.textContent = itemIndex <= index ? "★" : "☆";
      item.style.color = itemIndex <= index ? "#ffd66a" : "#d4d4d8";
    });
  });
});

function createMapPin(label, type) {
  return L.divIcon({
    className: `map-pin ${type}`,
    html: label,
    iconSize: [86, 30],
    iconAnchor: [43, 30],
  });
}

function createBikeIcon() {
  return L.divIcon({
    className: "rider-bike",
    html: "🏍",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createUserIcon() {
  return L.divIcon({
    className: "rider-bike",
    html: "●",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function showResults(container, items, onSelect) {
  if (!container) return;
  container.innerHTML = "";
  if (!items.length) {
    container.hidden = true;
    return;
  }
  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "result-item";
    btn.textContent = item.display_name;
    btn.addEventListener("click", () => onSelect(item));
    container.appendChild(btn);
  });
  container.hidden = false;
}

function renderCurrentLocationSuggestion(container, label, onSelect) {
  if (!container) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "result-item";
  btn.textContent = label;
  btn.addEventListener("click", onSelect);
  container.innerHTML = "";
  container.appendChild(btn);
  container.hidden = false;
}

async function geocodeQuery(query, options = {}) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(options.limit || 5));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", options.countrycodes || "in");

  if (options.bounded && options.viewbox) {
    url.searchParams.set("viewbox", options.viewbox);
    url.searchParams.set("bounded", "1");
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-IN,en;q=0.9",
    },
  });
  if (!res.ok) return [];
  const items = await res.json();
  return items.slice(0, 3);
}

function buildViewbox(latlng, radiusKm = 25) {
  const lat = latlng[0];
  const lon = latlng[1];
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  return `${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}`;
}

function updateServiceVisibility() {
  if (serviceChoices && state.pickup && state.drop) {
    serviceChoices.classList.remove("hidden");
  }
  if (bookRideBtn) {
    bookRideBtn.disabled = !(state.pickup && state.drop);
  }
  if (recentPlaces) {
    recentPlaces.classList.toggle("hidden", !state.drop);
  }
}

function renderRecentDestinations() {
  if (!recentPlaces || !recentPlacesList) return;
  recentPlacesList.innerHTML = "";
  const items = state.recentDestinations.slice(0, 3);
  if (!state.drop) {
    recentPlaces.classList.add("hidden");
    return;
  }
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "recent-empty";
    empty.textContent = "No recent places yet";
    recentPlacesList.appendChild(empty);
    recentPlaces.classList.remove("hidden");
    return;
  }
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent-item";
    button.textContent = item;
    recentPlacesList.appendChild(button);
  });
  recentPlaces.classList.remove("hidden");
}

function addRecentDestination(label) {
  if (!label) return;
  state.recentDestinations = [label, ...state.recentDestinations.filter((item) => item !== label)].slice(0, 3);
  localStorage.setItem("rydexRecentDestinations", JSON.stringify(state.recentDestinations));
  renderRecentDestinations();
}

function updatePickupLabel(text) {
  if (!pickupInput) return;
  pickupInput.value = text;
}

function pickupDisplayName(place, fallback = "Selected pickup") {
  const parts = [
    place?.name,
    place?.address?.road,
    place?.address?.suburb,
    place?.address?.neighbourhood,
    place?.address?.city || place?.address?.town || place?.address?.village,
    place?.address?.state,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : place?.display_name || fallback;
}

async function resolvePickupLabel(latlng, fallback = "Selected pickup") {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latlng[0]));
    url.searchParams.set("lon", String(latlng[1]));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-IN,en;q=0.9",
      },
    });
    if (!res.ok) return fallback;
    const place = await res.json();
    if ((place?.address?.country_code || "") !== "in") return fallback;
    return pickupDisplayName(place, fallback);
  } catch {
    return fallback;
  }
}

async function setPickupLocation(latlng, label) {
  setMarker("pickup", latlng);
  if (state.map) state.map.setView(latlng, 15);
  const resolvedLabel = label || (await resolvePickupLabel(latlng));
  if (pickupInput) pickupInput.value = resolvedLabel;
}

async function setDropLocation(latlng, label) {
  setMarker("drop", latlng);
  if (state.map) state.map.setView(latlng, 15);
  const resolvedLabel = label || (await resolvePickupLabel(latlng, "Selected destination"));
  if (dropInput) dropInput.value = resolvedLabel;
}

function getActiveService() {
  const active = document.querySelector(".control-card.active");
  return active?.dataset.service || "bike";
}

function updateRiderCard() {
  if (!riderCard) return;
  const service = getActiveService();
  const rider = riderPool[service] || riderPool.bike;
  if (riderCode) riderCode.textContent = rider.code;
  if (riderVehicle) riderVehicle.textContent = rider.vehicle;
  if (riderPerson) riderPerson.textContent = rider.name;
  if (riderAvatar) riderAvatar.textContent = rider.initials;
  if (riderPickupText) riderPickupText.textContent = rider.pickupLabel;
}

function setRoute() {
  if (!state.map || !state.pickup || !state.drop) return;
  if (state.routeLine) state.map.removeLayer(state.routeLine);
  state.routeLine = L.polyline([state.pickup, state.drop], {
    color: "#6f4526",
    weight: 4,
    opacity: 0.85,
    dashArray: "8 10",
  }).addTo(state.map);
}

function setMarker(kind, latlng) {
  if (!state.map) return;
  if (kind === "pickup") {
    if (state.pickupMarker) state.map.removeLayer(state.pickupMarker);
    state.pickupMarker = L.marker(latlng, { icon: createMapPin("Pickup", "pickup") }).addTo(state.map);
    state.pickup = latlng;
  } else if (kind === "drop") {
    if (state.dropMarker) state.map.removeLayer(state.dropMarker);
    state.dropMarker = L.marker(latlng, { icon: createMapPin("Destination", "drop") }).addTo(state.map);
    state.drop = latlng;
  } else if (kind === "user") {
    if (state.userMarker) state.map.removeLayer(state.userMarker);
    state.userMarker = L.marker(latlng, { icon: createUserIcon() }).addTo(state.map);
    state.user = latlng;
  }
  if (state.pickup && state.drop) {
    setRoute();
    updateServiceVisibility();
  }
}

async function setCurrentLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      reverseGeocodeIndia(latlng);
    },
    () => {
      // keep map usable even if browser location is denied
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

async function reverseGeocodeIndia(latlng) {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latlng[0]));
    url.searchParams.set("lon", String(latlng[1]));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-IN,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error("reverse lookup failed");
    const place = await res.json();
    const country = place?.address?.country_code || "";
    if (country !== "in") {
      if (pickupInput && !pickupInput.value.trim()) updatePickupLabel("Select pickup in India");
      return;
    }
    state.userCity = place?.address?.city || place?.address?.town || place?.address?.village || place?.address?.county || null;
    state.userState = place?.address?.state || null;
    setMarker("user", latlng);
    if (state.map) state.map.setView(latlng, 15);
    if (pickupInput && !pickupInput.value.trim()) updatePickupLabel(pickupDisplayName(place, "Current location in India"));
  } catch {
    if (pickupInput && !pickupInput.value.trim()) updatePickupLabel("Select pickup in India");
  }
}

async function setPickupFromMap(latlng, label = "Selected pickup") {
  await setPickupLocation(latlng, label === "Selected pickup" ? undefined : label);
}

async function searchAndBind(input, resultsBox, kind) {
  const query = input.value.trim();
  if (query.length < 3) {
    showResults(resultsBox, [], () => {});
    return;
  }
  const nearby = state.user ? buildViewbox(state.user, 25) : null;
  let items = [];

  if (kind === "drop") {
    const variants = [
      { q: query, options: nearby ? { bounded: true, viewbox: nearby, limit: 5 } : { limit: 5 } },
      { q: query, options: { limit: 5 } },
      { q: `${query}, India`, options: { limit: 5 } },
      {
        q: state.userCity ? `${query}, ${state.userCity}` : query,
        options: state.userCity ? { limit: 5 } : { limit: 5 },
      },
      {
        q: state.userState ? `${query}, ${state.userState}` : query,
        options: state.userState ? { limit: 5 } : { limit: 5 },
      },
      {
        q: query.replace(/\b(apartment|apartments|apts?|flat|flats|building|villa|tower|society)\b/gi, "").trim(),
        options: { limit: 5 },
      },
    ];

    for (const variant of variants) {
      // Stop as soon as we get any usable matches.
      // The loose fallbacks make the destination search feel more like Maps autocomplete.
      // eslint-disable-next-line no-await-in-loop
      const found = await geocodeQuery(variant.q, variant.options);
      if (found.length) {
        items = found;
        break;
      }
    }
  } else {
    items = await geocodeQuery(query, nearby ? { bounded: true, viewbox: nearby, limit: 5 } : { limit: 5 });
    if (!items.length && nearby) {
      items = await geocodeQuery(query, { limit: 5 });
    }
  }
  if (kind === "drop") {
    const seen = new Set();
    items = items.filter((item) => {
      const key = `${item.lat},${item.lon}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  items = items.slice(0, 3);
  showResults(resultsBox, items, (item) => {
    input.value = item.display_name;
    const latlng = [Number(item.lat), Number(item.lon)];
    if (kind === "pickup") {
      setPickupLocation(latlng, item.display_name);
    } else {
      setMarker(kind, latlng);
      if (state.map) state.map.panTo(latlng);
    }
    if (kind === "drop") addRecentDestination(item.display_name);
    updateServiceVisibility();
    renderRecentDestinations();
    showResults(resultsBox, [], () => {});
  });
}

let pickupTimer;
let dropTimer;

if (pickupInput) {
  pickupInput.addEventListener("focus", () => {
    state.activeField = "pickup";
    if (!pickupInput.value.trim() && state.user) {
      renderCurrentLocationSuggestion(pickupResults, "Use current location", () => {
        setPickupLocation(state.user, "Current location");
        showResults(pickupResults, [], () => {});
      });
    }
  });
  pickupInput.addEventListener("input", () => {
    clearTimeout(pickupTimer);
    pickupTimer = setTimeout(() => searchAndBind(pickupInput, pickupResults, "pickup"), 220);
  });
}

if (dropInput) {
  dropInput.addEventListener("focus", () => {
    state.activeField = "drop";
    if (dropInput.value.trim().length >= 3) {
      searchAndBind(dropInput, dropResults, "drop");
    }
  });
  dropInput.addEventListener("input", () => {
    clearTimeout(dropTimer);
    dropTimer = setTimeout(() => searchAndBind(dropInput, dropResults, "drop"), 220);
  });
}

function initRealMap() {
  if (!window.L || !mapElement) {
    if (mapFallback) mapFallback.hidden = false;
    return;
  }

  if (mapFallback) mapFallback.hidden = true;

  const map = L.map("map", {
    zoomControl: false,
  }).setView(demoCenter, 15);
  state.map = map;

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  setMarker("pickup", pickupPoint);

  riderPoints.forEach((position) => {
    L.marker(position, { icon: createBikeIcon() }).addTo(map);
  });

  map.on("click", (event) => {
    const latlng = [event.latlng.lat, event.latlng.lng];
    if (state.activeField === "drop") {
      setDropLocation(latlng);
    } else {
      setPickupFromMap(latlng);
    }
  });

  map.invalidateSize();
  setCurrentLocation();
  renderRecentDestinations();
}

window.addEventListener("load", initRealMap);
