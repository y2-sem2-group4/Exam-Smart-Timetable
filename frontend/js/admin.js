/* Exam Smart Timetable admin portal. */

// Same convention as student.js: window.API_BASE_URL is the host, "/api" is appended.
const API = `${window.API_BASE_URL || ""}/api`;
let csrfToken;

/* ---------- API helpers ---------- */

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API}/csrf/`, { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not initialise security token.");
  csrfToken = data.csrfToken;
  return csrfToken;
}

function sessionExpired() {
  sessionStorage.removeItem("est_admin");
  window.location.href = "login.html?expired=1";
}

async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (method !== "GET" && method !== "HEAD") {
    headers["X-CSRFToken"] = await getCsrfToken();
  }
  const response = await fetch(API + path, {
    credentials: "include",
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  // 401/403 anywhere except the login call means the admin session is gone.
  if ((response.status === 401 || response.status === 403) && path !== "/admin/login/") {
    sessionExpired();
    throw new Error("Your session has expired. Please log in again.");
  }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function loginAdmin(username, password) {
  await api("/admin/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

async function getUnits() {
  return (await api("/units/")).units;
}

async function getRooms() {
  return (await api("/rooms/")).rooms;
}

async function getExams(status = "") {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return (await api(`/exams/${query}`)).exams;
}

async function saveExam(data, id = null) {
  const response = id
    ? await api(`/exams/${id}/reassign/`, { method: "PATCH", body: JSON.stringify(data) })
    : await api("/exams/", { method: "POST", body: JSON.stringify(data) });
  return {
    status: response.status,
    clash_reason: response.clash_reason || null,
    clash: Boolean(response.clash) || response.status === "pending_review",
  };
}

function reassignExam(id, changes) {
  return saveExam(changes, id);
}

/* ---------- Small utilities ---------- */

const $ = id => document.getElementById(id);
const hhmm = time => (time || "").slice(0, 5);
const toMinutes = time => {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
};
const fromMinutes = minutes => {
  const clamped = Math.min(minutes, 23 * 60 + 59);
  return String(Math.floor(clamped / 60)).padStart(2, "0") +
    ":" + String(clamped % 60).padStart(2, "0");
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return iso || "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function esc(value) {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
}

const escAttr = value => esc(value).replace(/"/g, "&quot;");

const STATUS_LABELS = {
  scheduled: "Scheduled",
  pending_review: "Pending Review",
  resolved: "Resolved",
};

function badge(status) {
  // Unknown statuses fall back to the neutral grey badge.
  const cls = STATUS_LABELS[status] ? status : "pending";
  return `<span class="badge badge-${cls}">${esc(STATUS_LABELS[status] || status)}</span>`;
}

function show(element, text) {
  element.textContent = text;
  element.classList.remove("hidden");
}

function hide(element) {
  element.classList.add("hidden");
}

function fillSelect(select, items, valueKey, labelFn, placeholder) {
  select.innerHTML = (placeholder ? `<option value="">${esc(placeholder)}</option>` : "") +
    items.map(item => `<option value="${escAttr(item[valueKey])}">${esc(labelFn(item))}</option>`).join("");
}

/* Disables a button while a request runs so it cannot be double-submitted. */
async function withBusy(button, busyText, task) {
  if (!button || button.disabled) return undefined;
  const original = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = busyText;
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = original;
  }
}

/* ---------- Toasts ---------- */

function ensureToastRegion() {
  let region = $("toast-region");
  if (!region) {
    region = document.createElement("div");
    region.id = "toast-region";
    region.className = "toast-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  return region;
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  ensureToastRegion().appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// A message that survives one page redirect (e.g. "Exam saved" after the form).
function setFlash(message) {
  try { sessionStorage.setItem("est_flash", message); } catch (error) { /* storage unavailable */ }
}

function showFlash() {
  try {
    const message = sessionStorage.getItem("est_flash");
    if (message) {
      sessionStorage.removeItem("est_flash");
      showToast(message);
    }
  } catch (error) { /* storage unavailable */ }
}

/* ---------- Session gate + navigation ---------- */

function requireLoginAndNav(active) {
  if (sessionStorage.getItem("est_admin") !== "1") {
    window.location.href = "login.html";
    return false;
  }
  ensureToastRegion();
  const current = name => (active === name ? ' class="active" aria-current="page"' : "");
  $("nav").innerHTML = `
    <span class="brand">Exam Smart Timetable \u00B7 Admin</span>
    <a href="dashboard.html"${current("dashboard")}>Dashboard</a>
    <a href="clash.html"${current("clash")}>Clash review</a>
    <button id="logout" type="button">Log out</button>`;
  $("logout").addEventListener("click", () => {
    sessionStorage.removeItem("est_admin");
    window.location.href = "login.html";
  });
  return true;
}

/* ---------- Login ---------- */

function initLogin() {
  if (new URLSearchParams(window.location.search).get("expired")) {
    show($("login-notice"), "Your session has expired. Please log in again.");
  }
  $("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    hide($("login-error"));
    const username = $("username").value.trim();
    const password = $("password").value;
    try {
      await withBusy($("login-btn"), "Logging in\u2026", () => loginAdmin(username, password));
      sessionStorage.setItem("est_admin", "1");
      window.location.href = "dashboard.html";
    } catch (error) {
      show($("login-error"), error.message);
    }
  });
}

/* ---------- Dashboard ---------- */

async function initDashboard() {
  if (!requireLoginAndNav("dashboard")) return;
  showFlash();
  const tbody = $("exam-tbody");
  const filter = $("status-filter");
  const search = $("unit-search");
  let exams = [];

  const byDate = (a, b) =>
    `${a.exam_date} ${a.start_time}`.localeCompare(`${b.exam_date} ${b.start_time}`);

  function updateFilterLabels() {
    const counts = { all: exams.length };
    exams.forEach(exam => { counts[exam.status] = (counts[exam.status] || 0) + 1; });
    Array.from(filter.options).forEach(option => {
      option.textContent = `${STATUS_LABELS[option.value] || "All"} (${counts[option.value] || 0})`;
    });
  }

  function render() {
    const term = search.value.trim().toLowerCase();
    const rows = exams
      .filter(exam => filter.value === "all" || exam.status === filter.value)
      .filter(exam => !term ||
        `${exam.unit_code} ${exam.unit_name}`.toLowerCase().includes(term))
      .sort(byDate);

    $("clash-count").textContent = exams.filter(exam => exam.status === "pending_review").length;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">No exams found.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(exam => {
      const flagged = exam.status === "pending_review";
      const note = flagged && exam.clash_reason
        ? `<span class="clash-note">${esc(exam.clash_reason)}</span>` : "";
      return `
      <tr${flagged ? ' class="row-flagged"' : ""}>
        <td>${esc(exam.unit_code)} - ${esc(exam.unit_name)}${note}</td>
        <td>${esc(formatDate(exam.exam_date))}</td>
        <td>${esc(hhmm(exam.start_time))}\u2013${esc(hhmm(exam.end_time))}</td>
        <td>${esc(exam.room_name || "Not assigned")}</td>
        <td>${badge(exam.status)}</td>
        <td><a class="btn small" href="exam-form.html?id=${encodeURIComponent(exam.id)}"
            aria-label="Edit ${escAttr(exam.unit_code)}">Edit</a></td>
      </tr>`;
    }).join("");
  }

  try {
    exams = await getExams();
    updateFilterLabels();
    render();
  } catch (error) {
    show($("page-error"), "Could not load exams: " + error.message);
  }
  filter.addEventListener("change", render);
  search.addEventListener("input", render);
}

/* ---------- Log / edit exam ---------- */

async function initExamForm() {
  if (!requireLoginAndNav("")) return;
  const id = new URLSearchParams(window.location.search).get("id");
  const unitSelect = $("unit");
  const roomSelect = $("room");
  const saveButton = $("save-btn");

  try {
    const [units, rooms] = await Promise.all([getUnits(), getRooms()]);
    fillSelect(unitSelect, units, "id",
      unit => `${unit.unit_code} - ${unit.unit_name}`, "Select unit");
    fillSelect(roomSelect, rooms, "id",
      room => `${room.room_name} (capacity ${room.capacity})`, "Select room");

    if (id) {
      $("form-title").textContent = "Edit exam";
      saveButton.textContent = "Save changes";
      const exam = (await getExams()).find(item => item.id === Number(id));
      if (!exam) return show($("form-error"), "Exam not found.");
      unitSelect.value = units.find(unit => unit.unit_code === exam.unit_code).id;
      const room = rooms.find(item => item.room_name === exam.room_name);
      roomSelect.value = room ? room.id : "";
      $("exam-date").value = exam.exam_date;
      $("start-time").value = hhmm(exam.start_time);
      $("end-time").value = hhmm(exam.end_time);
    }
  } catch (error) {
    return show($("form-error"), "Could not load form data: " + error.message);
  }

  const idleLabel = saveButton.textContent;

  $("exam-form").addEventListener("submit", async event => {
    event.preventDefault();
    hide($("form-error"));
    hide($("clash-banner"));
    const data = {
      unit_id: Number(unitSelect.value),
      room_id: Number(roomSelect.value) || null,
      exam_date: $("exam-date").value,
      start_time: $("start-time").value,
      end_time: $("end-time").value,
    };
    if (!data.unit_id || !data.exam_date || !data.start_time || !data.end_time) {
      return show($("form-error"), "Please fill in every field.");
    }
    if (data.end_time <= data.start_time) {
      return show($("form-error"), "End time must be after start time.");
    }

    let result;
    try {
      result = await withBusy(saveButton, "Saving\u2026", () => saveExam(data, id));
    } catch (error) {
      return show($("form-error"), error.message);
    }
    if (!result) return; // a save was already in progress

    saveButton.disabled = true; // no second save from this page after success or a clash
    saveButton.textContent = idleLabel;
    if (result.clash) {
      $("clash-text").textContent = result.clash_reason || "See Clash Review for details.";
      $("clash-banner").classList.remove("hidden");
    } else {
      setFlash(id ? "Exam updated." : "Exam saved.");
      window.location.href = "dashboard.html";
    }
  });
}

/* ---------- Clash review ---------- */

async function initClash() {
  if (!requireLoginAndNav("clash")) return;
  const list = $("clash-list");
  const rooms = await getRooms().catch(() => []);
  const roomOptions = `<option value="">Keep current</option>` +
    rooms.map(room => `<option value="${escAttr(room.id)}">${esc(room.room_name)} (capacity ${esc(room.capacity)})</option>`).join("");

  async function render() {
    let pending;
    try {
      pending = await getExams("pending_review");
    } catch (error) {
      return show($("page-error"), "Could not load exams: " + error.message);
    }
    if (!pending.length) {
      list.innerHTML = `<div class="card empty">No exams need review.</div>`;
      return;
    }
    list.innerHTML = pending.map(exam => `
      <div class="card clash-card" data-id="${escAttr(exam.id)}"
        data-start-time="${escAttr(exam.start_time)}" data-end-time="${escAttr(exam.end_time)}">
        <h3>${esc(exam.unit_code)} - ${esc(exam.unit_name)}</h3>
        <p class="meta">${esc(formatDate(exam.exam_date))} \u00B7 ${esc(hhmm(exam.start_time))}\u2013${esc(hhmm(exam.end_time))} \u00B7 ${esc(exam.room_name || "Not assigned")}</p>
        <div class="warning-box"><strong>Reason:</strong> ${esc(exam.clash_reason)}</div>
        <div class="row">
          <div><label for="new-room-${escAttr(exam.id)}">New room</label>
            <select id="new-room-${escAttr(exam.id)}" class="new-room">${roomOptions}</select></div>
          <div><label for="new-date-${escAttr(exam.id)}">New date</label>
            <input id="new-date-${escAttr(exam.id)}" class="new-date" type="date"></div>
          <div><label for="new-time-${escAttr(exam.id)}">New start time</label>
            <input id="new-time-${escAttr(exam.id)}" class="new-time" type="time"></div>
        </div>
        <div class="card-actions">
          <button class="btn save-btn" type="button">Save and re-check</button>
          <button class="btn light recheck-btn" type="button">Re-check without changes</button>
        </div>
      </div>`).join("");
  }

  list.addEventListener("click", async event => {
    const button = event.target.closest("button");
    if (!button) return;
    const isSave = button.classList.contains("save-btn");
    const isRecheck = button.classList.contains("recheck-btn");
    if (!isSave && !isRecheck) return;

    const card = button.closest(".clash-card");
    if (card.dataset.busy) return;
    const message = $("clash-msg");
    const name = card.querySelector("h3").textContent.split(" - ")[0];

    const changes = {};
    if (isSave) {
      const newRoom = Number(card.querySelector(".new-room").value);
      const newDate = card.querySelector(".new-date").value;
      const newStart = card.querySelector(".new-time").value;
      const duration = toMinutes(hhmm(card.dataset.endTime)) -
        toMinutes(hhmm(card.dataset.startTime));
      if (newRoom) changes.room_id = newRoom;
      if (newDate) changes.exam_date = newDate;
      if (newStart) {
        changes.start_time = newStart;
        changes.end_time = fromMinutes(toMinutes(newStart) + duration);
      }
      if (!Object.keys(changes).length) {
        message.className = "msg error";
        return show(message, "Pick a new room, date or time first, or use Re-check without changes.");
      }
    }

    // Lock every button on this card while the request runs.
    const buttons = Array.from(card.querySelectorAll("button"));
    const originalText = button.textContent;
    card.dataset.busy = "1";
    buttons.forEach(item => { item.disabled = true; });
    button.setAttribute("aria-busy", "true");
    button.textContent = isSave ? "Saving\u2026" : "Checking\u2026";

    try {
      const result = await reassignExam(card.dataset.id, changes);
      message.className = result.clash ? "msg error" : "msg success";
      show(message, result.clash
        ? `${name} still has a clash: ${result.clash_reason}`
        : `${name} is resolved.`);
      await render();
    } catch (error) {
      message.className = "msg error";
      show(message, error.message);
    } finally {
      delete card.dataset.busy;
      buttons.forEach(item => { item.disabled = false; });
      button.removeAttribute("aria-busy");
      button.textContent = originalText;
    }
  });
  render();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const pages = {
      login: initLogin,
      dashboard: initDashboard,
      "exam-form": initExamForm,
      clash: initClash,
    };
    const init = pages[document.body.dataset.page];
    if (init) init();
  });
}
