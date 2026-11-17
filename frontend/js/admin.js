/* Exam Smart Timetable admin portal. */

const API = window.API_BASE_URL || "/api";
let csrfToken;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API}/csrf/`, { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not initialise security token.");
  csrfToken = data.csrfToken;
  return csrfToken;
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

function esc(value) {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
}

const STATUS_LABELS = {
  scheduled: "Scheduled",
  pending_review: "Pending Review",
  resolved: "Resolved",
};

function badge(status) {
  return `<span class="badge badge-${status}">${STATUS_LABELS[status] || status}</span>`;
}

function show(element, text) {
  element.textContent = text;
  element.classList.remove("hidden");
}

function hide(element) {
  element.classList.add("hidden");
}

function fillSelect(select, items, valueKey, labelFn, placeholder) {
  select.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : "") +
    items.map(item => `<option value="${item[valueKey]}">${esc(labelFn(item))}</option>`).join("");
}

function requireLoginAndNav(active) {
  if (sessionStorage.getItem("est_admin") !== "1") {
    window.location.href = "login.html";
    return false;
  }
  $("nav").innerHTML = `
    <span class="brand">Exam Smart Timetable · Admin</span>
    <a href="dashboard.html" class="${active === "dashboard" ? "active" : ""}">Dashboard</a>
    <a href="clash.html" class="${active === "clash" ? "active" : ""}">Clash Review</a>
    <button id="logout" type="button">Logout</button>`;
  $("logout").addEventListener("click", () => {
    sessionStorage.removeItem("est_admin");
    window.location.href = "login.html";
  });
  return true;
}

function initLogin() {
  $("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    hide($("login-error"));
    try {
      await loginAdmin($("username").value.trim(), $("password").value);
      sessionStorage.setItem("est_admin", "1");
      window.location.href = "dashboard.html";
    } catch (error) {
      show($("login-error"), error.message);
    }
  });
}

async function initDashboard() {
  if (!requireLoginAndNav("dashboard")) return;
  const tbody = $("exam-tbody");
  let exams = [];

  function render() {
    const filter = $("status-filter").value;
    const rows = exams.filter(exam => filter === "all" || exam.status === filter);
    $("clash-count").textContent = exams.filter(
      exam => exam.status === "pending_review"
    ).length;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">No exams found.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(exam => `
      <tr>
        <td>${esc(exam.unit_code)} - ${esc(exam.unit_name)}</td>
        <td>${esc(exam.exam_date)}</td>
        <td>${hhmm(exam.start_time)} - ${hhmm(exam.end_time)}</td>
        <td>${esc(exam.room_name || "Not assigned")}</td>
        <td>${badge(exam.status)}</td>
        <td><a class="btn small" href="exam-form.html?id=${exam.id}">Edit</a></td>
      </tr>`).join("");
  }

  try {
    exams = await getExams();
    render();
  } catch (error) {
    show($("page-error"), "Could not load exams: " + error.message);
  }
  $("status-filter").addEventListener("change", render);
}

async function initExamForm() {
  if (!requireLoginAndNav("")) return;
  const id = new URLSearchParams(window.location.search).get("id");
  const unitSelect = $("unit");
  const roomSelect = $("room");

  try {
    const [units, rooms] = await Promise.all([getUnits(), getRooms()]);
    fillSelect(unitSelect, units, "id",
      unit => `${unit.unit_code} - ${unit.unit_name}`, "Select unit");
    fillSelect(roomSelect, rooms, "id",
      room => `${room.room_name} (capacity ${room.capacity})`, "Select room");

    if (id) {
      $("form-title").textContent = "Edit Exam";
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
    try {
      const result = await saveExam(data, id);
      if (result.clash) {
        $("clash-text").textContent = result.clash_reason || "See Clash Review for details.";
        $("clash-banner").classList.remove("hidden");
        event.target.querySelector("button[type=submit]").disabled = true;
      } else {
        window.location.href = "dashboard.html";
      }
    } catch (error) {
      show($("form-error"), error.message);
    }
  });
}

async function initClash() {
  if (!requireLoginAndNav("clash")) return;
  const list = $("clash-list");
  const rooms = await getRooms().catch(() => []);
  const roomOptions = `<option value="">Keep current</option>` +
    rooms.map(room => `<option value="${room.id}">${esc(room.room_name)} (capacity ${room.capacity})</option>`).join("");

  async function render() {
    let pending;
    try {
      pending = (await getExams("pending_review"));
    } catch (error) {
      return show($("page-error"), "Could not load exams: " + error.message);
    }
    if (!pending.length) {
      list.innerHTML = `<div class="card empty">No exams need review.</div>`;
      return;
    }
    list.innerHTML = pending.map(exam => `
      <div class="card clash-card" data-id="${exam.id}"
        data-start-time="${exam.start_time}" data-end-time="${exam.end_time}">
        <h3>${esc(exam.unit_code)} - ${esc(exam.unit_name)}</h3>
        <p class="meta">${esc(exam.exam_date)} · ${hhmm(exam.start_time)} - ${hhmm(exam.end_time)} · ${esc(exam.room_name || "Not assigned")}</p>
        <div class="warning-box"><strong>Reason:</strong> ${esc(exam.clash_reason)}</div>
        <div class="row">
          <div><label>New Room</label><select class="new-room">${roomOptions}</select></div>
          <div><label>New Date</label><input class="new-date" type="date"></div>
          <div><label>New Time</label><input class="new-time" type="time"></div>
          <button class="btn save-btn" type="button">Save and re-check</button>
        </div>
      </div>`).join("");
  }

  list.addEventListener("click", async event => {
    if (!event.target.classList.contains("save-btn")) return;
    const card = event.target.closest(".clash-card");
    const message = $("clash-msg");
    const newRoom = Number(card.querySelector(".new-room").value);
    const newDate = card.querySelector(".new-date").value;
    const newStart = card.querySelector(".new-time").value;
    const duration = toMinutes(hhmm(card.dataset.endTime)) -
      toMinutes(hhmm(card.dataset.startTime));
    const changes = {};
    if (newRoom) changes.room_id = newRoom;
    if (newDate) changes.exam_date = newDate;
    if (newStart) {
      changes.start_time = newStart;
      changes.end_time = fromMinutes(toMinutes(newStart) + duration);
    }
    const name = card.querySelector("h3").textContent.split(" - ")[0];
    if (!Object.keys(changes).length) {
      message.className = "msg error";
      return show(message, "Pick a new room, date or time first.");
    }
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
