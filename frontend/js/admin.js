/* ============================================================
   Exam Smart Timetable - Admin portal
   Pages: login, dashboard, exam-form, clash  (set via <body data-page="...">)
   To go live: set USE_MOCK = false. Only the SERVICE LAYER changes.
   ============================================================ */

const USE_MOCK = true;
const API = "http://localhost:8000/api";

/* ------------------------------------------------------------
   1. MOCK DATA (mirrors the Django models; saved in localStorage)
   ------------------------------------------------------------ */
const MOCK_UNITS = [
  { id: 1, unit_code: "BBT 2103",  unit_name: "Software Engineering",      enrolled: 120, cohort: "A" },
  { id: 2, unit_code: "BBT 2102",  unit_name: "Advanced Database Systems", enrolled: 60,  cohort: "A" },
  { id: 3, unit_code: "BBIT 2104", unit_name: "Integral Calculus",         enrolled: 90,  cohort: "B" },
  { id: 4, unit_code: "ICS 1104",  unit_name: "Discrete Mathematics",      enrolled: 70,  cohort: "B" },
  { id: 5, unit_code: "BBT 2203",  unit_name: "Business Systems Analysis", enrolled: 55,  cohort: "C" },
];
const MOCK_ROOMS = [
  { id: 1, room_name: "MSB 1", capacity: 80 },
  { id: 2, room_name: "MSB 2", capacity: 150 },
  { id: 3, room_name: "LH 1",  capacity: 100 },
  { id: 4, room_name: "Lab A", capacity: 40 },
];
const MOCK_SEED = [
  { id: 1, unit_id: 1, room_id: 1, exam_date: "2026-11-18", start_time: "09:00", end_time: "11:00", status: "pending_review", clash_reason: "Room too small (Cap: 80, Enrolled: 120)" },
  { id: 2, unit_id: 2, room_id: 2, exam_date: "2026-11-19", start_time: "09:00", end_time: "11:00", status: "scheduled", clash_reason: null },
  { id: 3, unit_id: 3, room_id: 3, exam_date: "2026-11-20", start_time: "14:00", end_time: "16:00", status: "pending_review", clash_reason: "Student clash with ICS 1104" },
  { id: 4, unit_id: 4, room_id: 2, exam_date: "2026-11-20", start_time: "15:00", end_time: "17:00", status: "pending_review", clash_reason: "Student clash with BBIT 2104" },
  { id: 5, unit_id: 5, room_id: 1, exam_date: "2026-11-21", start_time: "09:00", end_time: "11:00", status: "resolved", clash_reason: null },
];

function mockLoad() {
  const saved = localStorage.getItem("est_exams");
  return saved ? JSON.parse(saved) : structuredClone(MOCK_SEED);
}
function mockSave(exams) {
  localStorage.setItem("est_exams", JSON.stringify(exams));
}

/* Same rules as backend services.py: room capacity + shared-student overlap.
   Back-to-back exams do NOT clash (strict < and >). */
function mockApplyClashRules(exam, all) {
  const unit = MOCK_UNITS.find(u => u.id === exam.unit_id);
  const room = MOCK_ROOMS.find(r => r.id === exam.room_id);
  const reasons = [];

  if (room && unit.enrolled > room.capacity) {
    reasons.push(`Room too small (Cap: ${room.capacity}, Enrolled: ${unit.enrolled})`);
  }
  all.forEach(other => {
    if (other.id === exam.id || other.exam_date !== exam.exam_date) return;
    const overlaps = other.start_time < exam.end_time && other.end_time > exam.start_time;
    const otherUnit = MOCK_UNITS.find(u => u.id === other.unit_id);
    if (overlaps && otherUnit.cohort === unit.cohort) {
      reasons.push(`Student clash with ${otherUnit.unit_code}`);
      other.status = "pending_review";
      other.clash_reason = `Student clash with ${unit.unit_code}`;
    }
  });

  if (reasons.length) {
    exam.status = "pending_review";
    exam.clash_reason = reasons.join(" | ");
  } else if (exam.status === "pending_review") {
    exam.status = "resolved";
    exam.clash_reason = null;
  }
  return reasons.length > 0;
}

/* ------------------------------------------------------------
   2. SERVICE LAYER (the only place that talks to data)
   Exam shape: id, unit_code, unit_name, exam_date, start_time,
   end_time, room_name, status, clash_reason
   ------------------------------------------------------------ */
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function loginAdmin(username, password) {
  if (USE_MOCK) {
    if (username === "admin" && password === "admin123") return true;
    throw new Error("Invalid username or password.");
  }
  await api("/admin/login/", { method: "POST", body: JSON.stringify({ username, password }) });
  return true;
}

async function getUnits() {
  return USE_MOCK ? MOCK_UNITS : (await api("/units/")).units;
}

async function getRooms() {
  return USE_MOCK ? MOCK_ROOMS : (await api("/rooms/")).rooms;
}

async function getExams() {
  if (!USE_MOCK) return (await api("/exams/")).exams;
  return mockLoad().map(e => {
    const unit = MOCK_UNITS.find(u => u.id === e.unit_id);
    const room = MOCK_ROOMS.find(r => r.id === e.room_id);
    return {
      id: e.id, unit_code: unit.unit_code, unit_name: unit.unit_name,
      exam_date: e.exam_date, start_time: e.start_time, end_time: e.end_time,
      room_name: room ? room.room_name : null, status: e.status, clash_reason: e.clash_reason,
    };
  });
}

/* data = { unit_id, room_id, exam_date, start_time, end_time }
   Returns { status, clash_reason, clash } */
async function saveExam(data, id = null) {
  if (!USE_MOCK) {
    const res = id
      ? await api(`/exams/${id}/`, { method: "PUT", body: JSON.stringify(data) })
      : await api("/exams/", { method: "POST", body: JSON.stringify(data) });
    return { status: res.status, clash_reason: res.clash_reason || null, clash: res.status === "pending_review" };
  }
  const all = mockLoad();
  let exam;
  if (id) {
    exam = all.find(e => e.id === Number(id));
    Object.assign(exam, data);
  } else {
    exam = { id: Math.max(0, ...all.map(e => e.id)) + 1, status: "scheduled", clash_reason: null, ...data };
    all.push(exam);
  }
  const clash = mockApplyClashRules(exam, all);
  mockSave(all);
  return { status: exam.status, clash_reason: exam.clash_reason, clash };
}

/* changes = { room_id?, exam_date?, start_time? }  (blank = keep current)
   Keeps the original exam length when the start time moves. */
async function reassignExam(id, changes) {
  const [exams, units, rooms] = await Promise.all([getExams(), getUnits(), getRooms()]);
  const cur = exams.find(e => e.id === Number(id));
  const start = changes.start_time || hhmm(cur.start_time);
  const length = toMinutes(cur.end_time) - toMinutes(cur.start_time);
  const room = rooms.find(r => r.room_name === cur.room_name);
  return saveExam({
    unit_id: units.find(u => u.unit_code === cur.unit_code).id,
    room_id: changes.room_id || (room ? room.id : null),
    exam_date: changes.exam_date || cur.exam_date,
    start_time: start,
    end_time: fromMinutes(toMinutes(start) + length),
  }, id);
}

/* ------------------------------------------------------------
   3. HELPERS
   ------------------------------------------------------------ */
const $ = id => document.getElementById(id);
const hhmm = t => (t || "").slice(0, 5);
const toMinutes = t => { const [h, m] = t.split(":"); return Number(h) * 60 + Number(m); };
const fromMinutes = n => {
  const x = Math.min(n, 23 * 60 + 59);
  return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0");
};
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}
const STATUS_LABELS = { scheduled: "Scheduled", pending_review: "Pending Review", resolved: "Resolved" };
function badge(status) {
  return `<span class="badge badge-${status}">${STATUS_LABELS[status] || status}</span>`;
}
function show(el, text) {
  el.textContent = text;
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}
function fillSelect(select, items, valueKey, labelFn, placeholder) {
  select.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : "") +
    items.map(i => `<option value="${i[valueKey]}">${esc(labelFn(i))}</option>`).join("");
}

/* Redirect to login if not signed in; draw the shared nav bar */
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

/* ------------------------------------------------------------
   4. PAGES
   ------------------------------------------------------------ */
function initLogin() {
  $("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    hide($("login-error"));
    try {
      await loginAdmin($("username").value.trim(), $("password").value);
      sessionStorage.setItem("est_admin", "1");
      window.location.href = "dashboard.html";
    } catch (err) {
      show($("login-error"), err.message);
    }
  });
}

async function initDashboard() {
  if (!requireLoginAndNav("dashboard")) return;
  const tbody = $("exam-tbody");
  let exams = [];

  function render() {
    const filter = $("status-filter").value;
    const rows = exams.filter(x => filter === "all" || x.status === filter);
    $("clash-count").textContent = exams.filter(x => x.status === "pending_review").length;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">No exams found.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(x => `
      <tr>
        <td>${esc(x.unit_code)} - ${esc(x.unit_name)}</td>
        <td>${esc(x.exam_date)}</td>
        <td>${hhmm(x.start_time)} - ${hhmm(x.end_time)}</td>
        <td>${esc(x.room_name || "Not assigned")}</td>
        <td>${badge(x.status)}</td>
        <td><a class="btn small" href="exam-form.html?id=${x.id}">Edit</a></td>
      </tr>`).join("");
  }

  try {
    exams = await getExams();
    render();
  } catch (err) {
    show($("page-error"), "Could not load exams: " + err.message);
  }
  $("status-filter").addEventListener("change", render);
}

async function initExamForm() {
  if (!requireLoginAndNav("")) return;
  const id = new URLSearchParams(window.location.search).get("id");
  const unitSel = $("unit"), roomSel = $("room");

  try {
    const [units, rooms] = await Promise.all([getUnits(), getRooms()]);
    fillSelect(unitSel, units, "id", u => `${u.unit_code} - ${u.unit_name}`, "Select unit");
    fillSelect(roomSel, rooms, "id", r => `${r.room_name} (capacity ${r.capacity})`, "Select room");

    if (id) {
      $("form-title").textContent = "Edit Exam";
      const exam = (await getExams()).find(x => x.id === Number(id));
      if (!exam) return show($("form-error"), "Exam not found.");
      unitSel.value = units.find(u => u.unit_code === exam.unit_code).id;
      const room = rooms.find(r => r.room_name === exam.room_name);
      roomSel.value = room ? room.id : "";
      $("exam-date").value = exam.exam_date;
      $("start-time").value = hhmm(exam.start_time);
      $("end-time").value = hhmm(exam.end_time);
    }
  } catch (err) {
    return show($("form-error"), "Could not load form data: " + err.message);
  }

  $("exam-form").addEventListener("submit", async e => {
    e.preventDefault();
    hide($("form-error"));
    hide($("clash-banner"));

    const data = {
      unit_id: Number(unitSel.value),
      room_id: Number(roomSel.value),
      exam_date: $("exam-date").value,
      start_time: $("start-time").value,
      end_time: $("end-time").value,
    };
    if (!data.unit_id || !data.room_id || !data.exam_date || !data.start_time || !data.end_time) {
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
      } else {
        window.location.href = "dashboard.html";
      }
    } catch (err) {
      show($("form-error"), err.message);
    }
  });
}

async function initClash() {
  if (!requireLoginAndNav("clash")) return;
  const list = $("clash-list");
  const rooms = await getRooms().catch(() => []);
  const roomOptions = `<option value="">Keep current</option>` +
    rooms.map(r => `<option value="${r.id}">${esc(r.room_name)} (capacity ${r.capacity})</option>`).join("");

  async function render() {
    let pending;
    try {
      pending = (await getExams()).filter(x => x.status === "pending_review");
    } catch (err) {
      return show($("page-error"), "Could not load exams: " + err.message);
    }
    if (!pending.length) {
      list.innerHTML = `<div class="card empty">No exams need review. 🎉</div>`;
      return;
    }
    list.innerHTML = pending.map(x => `
      <div class="card clash-card" data-id="${x.id}">
        <h3>${esc(x.unit_code)} - ${esc(x.unit_name)}</h3>
        <p class="meta">${esc(x.exam_date)} · ${hhmm(x.start_time)} - ${hhmm(x.end_time)} · ${esc(x.room_name || "Not assigned")}</p>
        <div class="warning-box"><strong>Reason:</strong> ${esc(x.clash_reason)}</div>
        <div class="row">
          <div><label>New Room</label><select class="new-room">${roomOptions}</select></div>
          <div><label>New Date</label><input class="new-date" type="date"></div>
          <div><label>New Time</label><input class="new-time" type="time"></div>
          <button class="btn save-btn" type="button">Save and re-check</button>
        </div>
      </div>`).join("");
  }

  list.addEventListener("click", async e => {
    if (!e.target.classList.contains("save-btn")) return;
    const card = e.target.closest(".clash-card");
    const msg = $("clash-msg");
    const changes = {
      room_id: Number(card.querySelector(".new-room").value) || null,
      exam_date: card.querySelector(".new-date").value,
      start_time: card.querySelector(".new-time").value,
    };
    const name = card.querySelector("h3").textContent.split(" - ")[0];

    if (!changes.room_id && !changes.exam_date && !changes.start_time) {
      msg.className = "msg error";
      return show(msg, "Pick a new room, date or time first.");
    }
    try {
      const result = await reassignExam(card.dataset.id, changes);
      msg.className = result.clash ? "msg error" : "msg success";
      show(msg, result.clash
        ? `${name} still has a clash: ${result.clash_reason}`
        : `${name} is resolved.`);
      await render();
    } catch (err) {
      msg.className = "msg error";
      show(msg, err.message);
    }
  });

  render();
}

/* ------------------------------------------------------------
   5. START: pick the right page
   ------------------------------------------------------------ */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const pages = { login: initLogin, dashboard: initDashboard, "exam-form": initExamForm, clash: initClash };
    const init = pages[document.body.dataset.page];
    if (init) init();
  });
}