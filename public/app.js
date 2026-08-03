const $ = (id) => document.getElementById(id);

const splash = $("splash");
const app = $("app");

const landing = $("landing");
const setup = $("setup");
const chat = $("chat");
const settingsPanel = $("settingsPanel");
const deleteOverlay = $("deleteOverlay");

const createBtn = $("create");
const joinBtn = $("join");
const continueBtn = $("continue");

const nameInput = $("name");
const roomInput = $("roomInput");
const roomInputWrap = $("roomInputWrap");
const setupTitle = $("setupTitle");

const messages = $("messages");
const messageInput = $("msg");
const sendBtn = $("send");
const statusEl = $("status");

const ttlSelect = $("ttl");
const deleteFx = $("deleteFx");
const deleteAllBtn = $("deleteAll");
const settingsBtn = $("settings");

let mode = "create";
let roomId = "";
let username = "";
let ttl = 3600

let peerKey = null;

const STORAGE_PREFIX = "wolfchat_";

/* =========================
   STARTUP
========================= */

window.addEventListener("load", () => {
  setTimeout(() => {
    splash.classList.add("hidden");
    app.classList.remove("hidden");
  }, 3400);

  protectPage();
  loadFromUrl();
});

/* =========================
   BASIC UI
========================= */

function show(section) {
  [landing, setup, chat, settingsPanel].forEach((el) => {
    el.classList.add("hidden");
  });

  section.classList.remove("hidden");
}

createBtn.addEventListener("click", () => {
  mode = "create";

  setupTitle.textContent = "Buat Ruang";
  roomInputWrap.classList.add("hidden");
  roomInput.value = "";

  show(setup);
});

joinBtn.addEventListener("click", () => {
  mode = "join";

  setupTitle.textContent = "Gabung Ruang";
  roomInputWrap.classList.remove("hidden");

  show(setup);
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!chat.classList.contains("hidden")) {
      disconnect();
    }

    show(landing);
  });
});

document.querySelector("[data-close]")?.addEventListener("click", () => {
  show(chat);
});

settingsBtn.addEventListener("click", () => {
  ttlSelect.value = String(ttl);
  show(settingsPanel);
});

/* =========================
   CREATE / JOIN
========================= */

continueBtn.addEventListener("click", async () => {
  username = nameInput.value.trim();

  if (!username) {
    alert("Masukkan nama panggilan terlebih dahulu.");
    nameInput.focus();
    return;
  }

  if (mode === "create") {
    roomId = randomRoomId();
  } else {
    const value = roomInput.value.trim();

    if (!value) {
      alert("Masukkan kode atau link ruang.");
      return;
    }

    roomId = extractRoomId(value);

    if (!roomId) {
      alert("Kode ruang tidak valid.");
      return;
    }
  }

  ttl = Number(ttlSelect.value || 3600);

  saveIdentity();

  openChat();

  connectToServer();
});

function randomRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

function extractRoomId(value) {
  try {
    if (value.startsWith("http")) {
      const url = new URL(value);
      return url.searchParams.get("room") || url.pathname.split("/").filter(Boolean).pop();
    }
  } catch {}

  return value
    .replace(/^.*[?&]room=/, "")
    .replace(/[?#].*$/, "")
    .trim();
}

/* =========================
   CHAT
========================= */

function openChat() {
  show(chat);

  statusEl.textContent = "Connecting…";

  messages.innerHTML = "";

  loadMessages();

  messageInput.focus();
}

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

function sendMessage() {
  const text = messageInput.value.trim();

  if (!text) return;

  const message = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random(),

    sender: username,

    text,

    timestamp: Date.now(),

    expiresAt: Date.now() + ttl * 1000
  };

  addMessage(message, true);

  messageInput.value = "";

  broadcastToRoom({
  type: "message",
  message
});

  scheduleDelete(message);
}

function addMessage(message, mine = false) {
  if (document.querySelector(`[data-message-id="${message.id}"]`)) {
    return;
  }

  if (message.expiresAt <= Date.now()) {
    return;
  }

  const item = document.createElement("div");

  item.className = "message";

  if (mine || message.sender === username) {
    item.classList.add("mine");
  }

  item.dataset.messageId = message.id;

  const text = document.createElement("div");

  text.textContent = message.text;

  const meta = document.createElement("small");

  meta.textContent =
    `${message.sender} · ${formatTime(message.timestamp)}`;

  item.appendChild(text);
  item.appendChild(meta);

  messages.appendChild(item);

  messages.scrollTop = messages.scrollHeight;

  saveMessage(message);

  scheduleDelete(message);
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* =========================
   AUTO DELETE
========================= */

function scheduleDelete(message) {
  const remaining = message.expiresAt - Date.now();

  if (remaining <= 0) {
    removeMessage(message.id);
    return;
  }

  setTimeout(() => {
    removeMessage(message.id);
  }, remaining);
}

function removeMessage(id) {
  const item = document.querySelector(
    `[data-message-id="${CSS.escape(id)}"]`
  );

  if (item) {
    item.remove();
  }

  deleteStoredMessage(id);
}

function showDeletedAnimation() {
  if (!deleteFx.checked) return;

  deleteOverlay.classList.remove("hidden");

  setTimeout(() => {
    deleteOverlay.classList.add("hidden");
  }, 1200);
}

/* =========================
   DELETE ALL
========================= */

deleteAllBtn.addEventListener("click", () => {
  const confirmed = confirm(
    "Hapus semua pesan di ruang ini?"
  );

  if (!confirmed) return;

  messages.innerHTML = "";

  clearStoredMessages();

  showDeletedAnimation();

  broadcastToRoom({
  type: "delete_all"
});
});

/* =========================
   LOCAL STORAGE
========================= */

function storageKey() {
  return STORAGE_PREFIX + roomId;
}

function saveMessage(message) {
  if (!roomId) return;

  const key = storageKey();

  let list = [];

  try {
    list = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    list = [];
  }

  list = list.filter((item) => item.expiresAt > Date.now());

  if (!list.some((item) => item.id === message.id)) {
    list.push(message);
  }

  localStorage.setItem(key, JSON.stringify(list));
}

function loadMessages() {
  if (!roomId) return;

  let list = [];

  try {
    list = JSON.parse(
      localStorage.getItem(storageKey()) || "[]"
    );
  } catch {
    list = [];
  }

  const valid = list.filter(
    (message) => message.expiresAt > Date.now()
  );

  localStorage.setItem(
    storageKey(),
    JSON.stringify(valid)
  );

  valid.forEach((message) => {
    addMessage(
      message,
      message.sender === username
    );
  });
}

function deleteStoredMessage(id) {
  if (!roomId) return;

  let list = [];

  try {
    list = JSON.parse(
      localStorage.getItem(storageKey()) || "[]"
    );
  } catch {
    list = [];
  }

  list = list.filter((message) => message.id !== id);

  localStorage.setItem(
    storageKey(),
    JSON.stringify(list)
  );
}

function clearStoredMessages() {
  if (!roomId) return;

  localStorage.removeItem(storageKey());
}

function saveIdentity() {
  localStorage.setItem(
    STORAGE_PREFIX + "identity",
    JSON.stringify({
      username,
      roomId
    })
  );
}

/* =========================
   WEBSOCKET
========================= */

function connectToServer() {
  disconnect();

  /*
   * Saat website sudah di-deploy ke server,
   * WebSocket akan menggunakan host website yang sama.
   */

  const protocol =
    location.protocol === "https:"
      ? "wss:"
      : "ws:";

  const wsUrl =
    `${protocol}//${location.host}`;

  try {
    socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      statusEl.textContent = "Secure connection";

      socket.send(
        JSON.stringify({
          type: "join",
          room: roomId,
          username
        })
      );

      updateRoomLink();
    });

    socket.addEventListener("message", (event) => {
      handleSocketMessage(event.data);
    });

    socket.addEventListener("close", () => {
      statusEl.textContent = "Offline";
    });

    socket.addEventListener("error", () => {
      statusEl.textContent = "Local mode";
    });

  } catch {
    statusEl.textContent = "Local mode";
  }
}

function handleSocketMessage(raw) {
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }

  if (data.type === "message" && data.message) {
    addMessage(
      data.message,
      data.message.sender === username
    );

    scheduleDelete(data.message);
  }

  if (data.type === "delete_all") {
    messages.innerHTML = "";

    clearStoredMessages();

    showDeletedAnimation();
  }

  if (data.type === "room_status") {
    if (typeof data.count === "number") {
      statusEl.textContent =
        `${data.count}/2 connected`;
    }
  }
}

function disconnect() {
  if (realtimeChannel) {
    try {
      realtimeChannel.close();
    } catch {}

    realtimeChannel = null;
  }
}

/* =========================
   ROOM LINK
========================= */

function updateRoomLink() {
  const url =
    `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}`;

  history.replaceState(
    {},
    "",
    `?room=${encodeURIComponent(roomId)}`
  );

  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {});
  }

  setTimeout(() => {
    const share = confirm(
      `Ruang berhasil dibuat.\n\nKode ruang: ${roomId}\n\nLink ruang sudah disiapkan. Salin/bagikan link ini kepada orang kedua.`
    );

    if (share && navigator.share) {
      navigator.share({
        title: "WOLFCHAT",
        text: "Gabung ke private room WOLFCHAT",
        url
      }).catch(() => {});
    }
  }, 400);
}

/* =========================
   URL ROOM
========================= */

function loadFromUrl() {
  const params = new URLSearchParams(
    window.location.search
  );

  const room = params.get("room");

  if (room) {
    mode = "join";

    roomId = room;

    setupTitle.textContent = "Gabung Ruang";

    roomInputWrap.classList.remove("hidden");

    roomInput.value = room;
  }
}

/* =========================
   SCREENSHOT DETERRENCE
========================= */

function protectPage() {

  document.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "selectstart",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "copy",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "dragstart",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  /*
   * Website tidak dapat benar-benar memblokir
   * screenshot pada semua perangkat/browser.
   * Ini hanya mengurangi kemampuan menyalin konten.
   */

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !chat.classList.contains("hidden")) {
      document.body.classList.add("privacy-blur");
    } else {
      document.body.classList.remove("privacy-blur");
    }
  });
}

/* =========================
   TTL SETTING
========================= */

ttlSelect.addEventListener("change", () => {
  ttl = Number(ttlSelect.value);

  localStorage.setItem(
    STORAGE_PREFIX + "ttl",
    String(ttl)
  );
});

const savedTTL = localStorage.getItem(
  STORAGE_PREFIX + "ttl"
);

if (savedTTL) {
  ttl = Number(savedTTL);
  ttlSelect.value = String(ttl);
}

/* =========================
   KEYBOARD SHORTCUT
========================= */

document.addEventListener("keydown", (event) => {

  if (
    (event.ctrlKey || event.metaKey) &&
    ["s", "u", "p"].includes(event.key.toLowerCase())
  ) {
    event.preventDefault();
  }

  if (event.key === "Escape") {
    if (!settingsPanel.classList.contains("hidden")) {
      show(chat);
    }
  }
});
