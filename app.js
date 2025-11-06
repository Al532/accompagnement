const STORAGE_KEY = "planner-state-v1";
const DATE_OPTIONS = { weekday: "long", month: "long", day: "numeric" };

const defaultSettings = () => {
  const today = new Date();
  const monday = new Date(today);
  const day = monday.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  monday.setDate(today.getDate() + diff);

  return {
    startDate: monday.toISOString().slice(0, 10),
    daysToDisplay: 5,
    startHour: "08:00",
    endHour: "18:00",
    slotDuration: 30,
    contiguousEnabled: true,
    contiguousCount: 2,
  };
};

const state = loadState();
let currentWeekOffset = 0;
let isTeacherMode = true;

const elements = {
  settingsForm: document.getElementById("settingsForm"),
  startDate: document.getElementById("startDate"),
  daysToDisplay: document.getElementById("daysToDisplay"),
  startHour: document.getElementById("startHour"),
  endHour: document.getElementById("endHour"),
  slotDuration: document.getElementById("slotDuration"),
  contiguousEnabled: document.getElementById("contiguousEnabled"),
  contiguousCount: document.getElementById("contiguousCount"),
  scheduleGrid: document.getElementById("scheduleGrid"),
  scheduleTitle: document.getElementById("scheduleTitle"),
  previousWeek: document.getElementById("previousWeek"),
  nextWeek: document.getElementById("nextWeek"),
  resetButton: document.getElementById("resetButton"),
  modeSwitch: document.getElementById("modeSwitch"),
  reservationDialog: document.getElementById("reservationDialog"),
  reservationSlotLabel: document.getElementById("reservationSlotLabel"),
  studentName: document.getElementById("studentName"),
  studentNote: document.getElementById("studentNote"),
  confirmationDialog: document.getElementById("confirmationDialog"),
  confirmationMessage: document.getElementById("confirmationMessage"),
  confirmationCancel: document.querySelector(
    "#confirmationDialog button[value='cancel']"
  ),
  confirmationConfirm: document.querySelector(
    "#confirmationDialog button[value='confirm']"
  ),
  slotTemplate: document.getElementById("slotTemplate"),
};

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { settings: defaultSettings(), slots: {} };
    }
    const parsed = JSON.parse(stored);
    return {
      settings: { ...defaultSettings(), ...(parsed.settings || {}) },
      slots: parsed.slots || {},
    };
  } catch (error) {
    console.error("Impossible de charger l'état", error);
    return { settings: defaultSettings(), slots: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function init() {
  isTeacherMode = elements.modeSwitch.checked;
  document.body.dataset.mode = isTeacherMode ? "teacher" : "student";
  applySettingsToForm();
  updateSchedule();

  elements.settingsForm.addEventListener("submit", onSettingsSubmit);
  elements.previousWeek.addEventListener("click", () => changeWeek(-1));
  elements.nextWeek.addEventListener("click", () => changeWeek(1));
  elements.resetButton.addEventListener("click", resetSchedule);
  elements.modeSwitch.addEventListener("change", toggleMode);
  elements.scheduleGrid.addEventListener("click", handleSlotClick);

  elements.reservationDialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
  });

  elements.confirmationDialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
  });
}

function applySettingsToForm() {
  const { settings } = state;
  elements.startDate.value = settings.startDate;
  elements.daysToDisplay.value = settings.daysToDisplay;
  elements.startHour.value = settings.startHour;
  elements.endHour.value = settings.endHour;
  elements.slotDuration.value = settings.slotDuration;
  elements.contiguousEnabled.checked = settings.contiguousEnabled;
  elements.contiguousCount.value = settings.contiguousCount;
}

function onSettingsSubmit(event) {
  event.preventDefault();

  const newSettings = {
    startDate: elements.startDate.value,
    daysToDisplay: Number(elements.daysToDisplay.value),
    startHour: elements.startHour.value,
    endHour: elements.endHour.value,
    slotDuration: Number(elements.slotDuration.value),
    contiguousEnabled: elements.contiguousEnabled.checked,
    contiguousCount: Math.max(1, Number(elements.contiguousCount.value) || 1),
  };

  state.settings = { ...state.settings, ...newSettings };
  saveState();
  updateSchedule();
}

function changeWeek(offset) {
  currentWeekOffset += offset;
  updateSchedule();
}

function resetSchedule() {
  showConfirmation(
    "Voulez-vous vraiment réinitialiser tous les créneaux ?",
    () => {
      state.slots = {};
      saveState();
      updateSchedule();
    }
  );
}

function toggleMode() {
  isTeacherMode = elements.modeSwitch.checked;
  document.body.dataset.mode = isTeacherMode ? "teacher" : "student";
  updateSchedule();
}

function getViewStartDate() {
  const date = new Date(state.settings.startDate);
  date.setDate(date.getDate() + currentWeekOffset * state.settings.daysToDisplay);
  return date;
}

function getDisplayedDates() {
  const start = getViewStartDate();
  return Array.from({ length: state.settings.daysToDisplay }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function getTimeSlots() {
  const { startHour, endHour, slotDuration } = state.settings;
  const [startHours, startMinutes] = startHour.split(":").map(Number);
  const [endHours, endMinutes] = endHour.split(":").map(Number);
  const start = new Date();
  start.setHours(startHours, startMinutes, 0, 0);
  const end = new Date();
  end.setHours(endHours, endMinutes, 0, 0);

  const slots = [];
  const cursor = new Date(start);

  while (cursor < end) {
    slots.push(cursor.toTimeString().slice(0, 5));
    cursor.setMinutes(cursor.getMinutes() + slotDuration);
  }

  return slots;
}

function updateSchedule() {
  const dates = getDisplayedDates();
  const slots = getTimeSlots();
  renderSchedule(dates, slots);
  updateScheduleTitle(dates);
}

function renderSchedule(dates, slots) {
  const grid = elements.scheduleGrid;
  grid.innerHTML = "";

  grid.style.gridTemplateColumns = `120px repeat(${dates.length}, minmax(160px, 1fr))`;

  grid.append(createGridHeaderCell("Horaires"));
  dates.forEach((date) => {
    const header = createGridHeaderCell(formatDateLabel(date));
    grid.append(header);
  });

  slots.forEach((slotTime) => {
    const hourCell = document.createElement("div");
    hourCell.className = "grid-hour";
    hourCell.textContent = slotTime;
    grid.append(hourCell);

    dates.forEach((date) => {
      const slotButton = createSlotButton(date, slotTime);
      grid.append(slotButton);
    });
  });
}

function createGridHeaderCell(label) {
  const cell = document.createElement("div");
  cell.className = "grid-header";
  cell.textContent = label;
  return cell;
}

function formatDateLabel(date) {
  return capitalizeFirst(
    new Intl.DateTimeFormat("fr-FR", DATE_OPTIONS).format(date)
  );
}

function capitalizeFirst(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ensureSlot(dateKey, time) {
  state.slots[dateKey] = state.slots[dateKey] || {};
  state.slots[dateKey][time] =
    state.slots[dateKey][time] || { status: "closed", reservation: null };
  return state.slots[dateKey][time];
}

function getSlot(dateKey, time) {
  return state.slots[dateKey]?.[time] || { status: "closed", reservation: null };
}

function createSlotButton(date, time) {
  const dateKey = formatDateKey(date);
  const slot = ensureSlot(dateKey, time);
  const template = elements.slotTemplate.content.firstElementChild.cloneNode(true);

  template.dataset.date = dateKey;
  template.dataset.time = time;
  template.classList.add(`slot--${slot.status}`);
  template.setAttribute("aria-pressed", slot.status !== "closed");

  template.querySelector(".slot__time").textContent = time;
  template.querySelector(".slot__status").textContent = getSlotStatusLabel(slot);
  template.querySelector(".slot__details").textContent = getSlotDetails(slot);

  if (!isTeacherMode && slot.status === "closed") {
    template.disabled = true;
  }

  return template;
}

function getSlotStatusLabel(slot) {
  switch (slot.status) {
    case "open":
      return "Disponible";
    case "reserved":
      return `Réservé${slot.reservation ? ` par ${slot.reservation.name}` : ""}`;
    default:
      return "Fermé";
  }
}

function getSlotDetails(slot) {
  if (slot.status === "reserved" && slot.reservation?.note) {
    return slot.reservation.note;
  }
  return "";
}

function handleSlotClick(event) {
  const button = event.target.closest(".slot");
  if (!button) return;

  const dateKey = button.dataset.date;
  const time = button.dataset.time;
  const slot = ensureSlot(dateKey, time);

  if (isTeacherMode) {
    handleTeacherInteraction(slot, dateKey, time);
  } else {
    handleStudentInteraction(slot, dateKey, time);
  }
}

function handleTeacherInteraction(slot, dateKey, time) {
  if (slot.status === "reserved") {
    showConfirmation(
      "Ce créneau est réservé. Voulez-vous annuler la réservation ?",
      () => {
        slot.status = "open";
        slot.reservation = null;
        saveState();
        updateSchedule();
      }
    );
    return;
  }

  if (slot.status === "open") {
    showConfirmation("Voulez-vous fermer ce créneau ?", () => {
      slot.status = "closed";
      slot.reservation = null;
      saveState();
      updateSchedule();
    });
    return;
  }

  openSlotBlock(dateKey, time);
  saveState();
  updateSchedule();
}

function handleStudentInteraction(slot, dateKey, time) {
  if (slot.status === "closed") {
    showAlert("Ce créneau n'est pas disponible pour le moment.");
    return;
  }

  if (slot.status === "reserved") {
    showAlert("Ce créneau est déjà réservé.");
    return;
  }

  openReservationDialog(dateKey, time);
}

function openSlotBlock(dateKey, time) {
  const times = getTimeSlots();
  const index = times.indexOf(time);
  if (index === -1) return;

  const { contiguousEnabled, contiguousCount } = state.settings;
  const blockSize = contiguousEnabled ? contiguousCount : 1;

  for (let i = 0; i < blockSize; i += 1) {
    const currentTime = times[index + i];
    if (!currentTime) break;
    const slot = ensureSlot(dateKey, currentTime);
    if (slot.status === "closed") {
      slot.status = "open";
      slot.reservation = null;
    }
  }
}

function openReservationDialog(dateKey, time) {
  elements.reservationDialog.dataset.date = dateKey;
  elements.reservationDialog.dataset.time = time;
  elements.reservationSlotLabel.textContent = `${formatDateHuman(dateKey)} à ${time}`;
  elements.studentName.value = "";
  elements.studentNote.value = "";

  document.body.classList.add("dialog-open");
  elements.reservationDialog.showModal();

  elements.reservationDialog.onclose = () => {
    document.body.classList.remove("dialog-open");
    if (elements.reservationDialog.returnValue === "confirm") {
      const name = elements.studentName.value.trim();
      const note = elements.studentNote.value.trim();
      if (!name) {
        return;
      }
      const slot = ensureSlot(dateKey, time);
      slot.status = "reserved";
      slot.reservation = { name, note };
      saveState();
      updateSchedule();
    }
  };
}

function showConfirmation(message, onConfirm) {
  elements.confirmationCancel.hidden = false;
  elements.confirmationConfirm.textContent = "Oui";
  elements.confirmationMessage.textContent = message;
  document.body.classList.add("dialog-open");
  elements.confirmationDialog.showModal();

  elements.confirmationDialog.onclose = () => {
    document.body.classList.remove("dialog-open");
    elements.confirmationConfirm.textContent = "Oui";
    if (elements.confirmationDialog.returnValue === "confirm") {
      onConfirm?.();
    }
  };
}

function showAlert(message) {
  elements.confirmationMessage.textContent = message;
  elements.confirmationCancel.hidden = true;
  elements.confirmationConfirm.textContent = "Fermer";
  document.body.classList.add("dialog-open");
  elements.confirmationDialog.showModal();
  elements.confirmationDialog.onclose = () => {
    document.body.classList.remove("dialog-open");
    elements.confirmationCancel.hidden = false;
    elements.confirmationConfirm.textContent = "Oui";
  };
}

function updateScheduleTitle(dates) {
  if (!dates.length) {
    elements.scheduleTitle.textContent = "Semaine";
    return;
  }

  const first = formatDateHuman(formatDateKey(dates[0]));
  const last = formatDateHuman(formatDateKey(dates[dates.length - 1]));
  elements.scheduleTitle.textContent = `${first} – ${last}`;
}

function formatDateHuman(dateKey) {
  const date = new Date(dateKey);
  return capitalizeFirst(
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(date)
  );
}

init();
