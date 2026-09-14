const state = {
  courses: [],
  schedules: {},
  currentCourse: null,
  currentCourseData: null,
  currentGroup: null,
  currentView: "courses",
  timetable: null
};

const courseList = document.querySelector("#course-list");
const lessonList = document.querySelector("#lesson-list");
const courseCode = document.querySelector("#course-code");
const courseTitle = document.querySelector("#course-title");
const scheduleContent = document.querySelector("#schedule-content");
const substituteContent = document.querySelector("#substitute-content");

const menuButton = document.querySelector("#menu-button");
const mainNavigation = document.querySelector("#main-navigation");

const views = {
  courses: document.querySelector("#courses-view"),
  schedule: document.querySelector("#schedule-view"),
  substitute: document.querySelector("#substitute-view")
};

async function loadCourses() {
  try {
    const [coursesResponse, schedulesResponse, timetableResponse] = await Promise.all([
      fetch("src/data/courses.json"),
      fetch("src/data/schedules.json"),
      fetch("src/data/lukujarjestys.json")
    ]);

    if (!coursesResponse.ok || !schedulesResponse.ok || !timetableResponse.ok) {
      throw new Error("Datan lataaminen epäonnistui.");
    }

    state.courses = await coursesResponse.json();
    state.schedules = await schedulesResponse.json();
    state.timetable = await timetableResponse.json();

    renderGroupButtons();
    renderTimetable();
    renderSubstituteGuide();

    const firstCourse = state.courses.find(
      (course) => state.schedules[course.code]?.groups
    );

    if (firstCourse) {
      const firstGroup = Object.keys(
        state.schedules[firstCourse.code].groups
      )[0];

      selectGroup(firstCourse, firstGroup);
    }
  } catch (error) {
    console.error(error);
    renderEmpty("Kurssitietojen lataaminen epäonnistui.");
  }
}

function renderGroupButtons() {
  courseList.innerHTML = '<option value="">Valitse ryhmä</option>';

  state.courses.forEach((course) => {
    const courseSchedule = state.schedules[course.code];

    if (!courseSchedule?.groups) {
      return;
    }

    Object.keys(courseSchedule.groups).forEach((groupCode) => {
      const option = document.createElement("option");

      option.value = `${course.code}|${groupCode}`;
      option.textContent = groupCode;

      courseList.appendChild(option);
    });
  });

  courseList.addEventListener("change", () => {
    if (!courseList.value) {
      return;
    }

    const [courseCodeValue, groupCode] = courseList.value.split("|");

    const course = state.courses.find(
      (course) => course.code === courseCodeValue
    );

    if (course) {
      selectGroup(course, groupCode);
    }
  });
}

async function selectGroup(course, groupCode) {
  try {
    const fileName = course.file.split("/").pop();
    const response = await fetch(`./src/data/${fileName}`);

    if (!response.ok) {
      throw new Error(
        `Kurssin ${course.code} lataaminen epäonnistui.`
      );
    }

    state.currentCourse = course;
    state.currentCourseData = await response.json();
    state.currentGroup = groupCode;

    courseCode.textContent = groupCode;
    courseTitle.textContent = course.title;

    renderLessons();
  } catch (error) {
    console.error(error);
    renderEmpty("Oppituntien lataaminen epäonnistui.");
  }
}

function renderLessons() {
  const courseSchedule = state.schedules[state.currentCourse.code];
  const schedule = courseSchedule.groups[state.currentGroup];

  const lessons = state.currentCourseData.lessons;
  const exceptions = schedule.exceptions || [];

  const events = [];

  // Lasketaan jokaisen normaalin oppitunnin päivämäärä.
  lessons.forEach((lesson) => {
    const date = getLessonDate(lesson.lesson, schedule);

    if (date) {
      events.push({
        date: date,
        lesson: lesson,
        exception: null
      });
    }
  });

  // Lisätään poikkeukset omiksi tapahtumikseen.
  exceptions.forEach((exception) => {
    events.push({
      date: exception.date,
      lesson: null,
      exception: exception
    });
  });

  // Järjestetään kaikki päivämäärän mukaan.
  events.sort((a, b) => a.date.localeCompare(b.date));

  lessonList.innerHTML = events
    .map((event) => {
      if (event.exception) {
        return `
          <article class="lesson-card exception-card">
            <div class="lesson-header">
              <div>
                <p class="lesson-number">Poikkeusohjelmaa</p>
                <p class="lesson-date">
                  ${formatDisplayDate(event.date)}
                </p>
                <div class="exception-box">
                  <strong>
                    ${escapeHtml(event.exception.type)}
                  </strong>
                </div>
                <p>
                  ${escapeHtml(event.exception.description)}
                </p>
              </div>
            </div>
          </article>
        `;
      }

      const lesson = event.lesson;

      return `
        <article class="lesson-card">
          <div class="lesson-header">
            <div>
              <p class="lesson-number">
                Oppitunti #${lesson.lesson}
              </p>

              <p class="lesson-date">
                ${formatDisplayDate(event.date)}
              </p>

              <h3>
                ${escapeHtml(lesson.topic || lesson.title)}
              </h3>
            </div>
          </div>

          <div class="lesson-content">
            ${lesson.content || ""}
          </div>

          ${
            lesson.tasks
              ? `
                <div class="tasks">
                  <h4>Tehtävät</h4>
                  <p>${escapeHtml(lesson.tasks)}</p>
                </div>
              `
              : ""
          }

          ${
            lesson.substituteNote
              ? `
                <div class="substitute-box">
                  <strong>Sijaiselle</strong>
                  <p>${escapeHtml(lesson.substituteNote)}</p>
                </div>
              `
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function getLessonDate(lessonNumber, schedule) {
  const startDate = new Date(`${schedule.startDate}T00:00:00`);
  const endDate = new Date(`${schedule.endDate}T00:00:00`);

  const exceptions = schedule.exceptions || [];

  let currentDate = new Date(startDate);
  let normalLessonCount = 0;

  while (currentDate <= endDate) {
    const isoDate = formatDate(currentDate);
    const weekday = currentDate.getDay();

    if (schedule.weekdays.includes(weekday)) {
      const isException = exceptions.some(
        (exception) => exception.date === isoDate
      );

      if (!isException) {
        normalLessonCount++;

        if (normalLessonCount === lessonNumber) {
          return isoDate;
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return null;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  d.setDate(d.getDate() + 4 - (d.getDay() || 7));

  const yearStart = new Date(d.getFullYear(), 0, 1);

  return Math.ceil(
    (((d - yearStart) / 86400000) + 1) / 7
  );
}

function formatDisplayDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);

  const weekdays = [
    "Sunnuntai",
    "Maanantai",
    "Tiistai",
    "Keskiviikko",
    "Torstai",
    "Perjantai",
    "Lauantai"
  ];

  const weekday = weekdays[date.getDay()];

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${weekday} ${day}.${month}.${year} <span class="week-number"> vko ${getWeekNumber(date)}</span>`;
}

function renderEmpty(message) {
  lessonList.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function renderTimetable() {
  if (!scheduleContent || !state.timetable) return;

  const dayNames = {
    maanantai: "Maanantai",
    tiistai: "Tiistai",
    keskiviikko: "Keskiviikko",
    torstai: "Torstai",
    perjantai: "Perjantai"
  };

  const days = Object.entries(state.timetable.paivat || {});

  scheduleContent.innerHTML = `
    <p class="schedule-period">${escapeHtml(state.timetable.jakso)}. jakso · vko ${escapeHtml(state.timetable.viikko)} · ${formatShortDate(state.timetable.alkupvm)}–${formatShortDate(state.timetable.loppupvm)}</p>
    <div class="schedule-grid">
      ${days.map(([key, day]) => `
        <article class="schedule-day">
          <header class="schedule-day-header">
            <h3>${dayNames[key] || escapeHtml(key)} ${formatShortDate(day.date)}</h3>
          </header>
          <div class="schedule-events">
            <div class="schedule-timeline">
              ${(day.tapahtumat || []).map(renderScheduleEvent).join("")}
            </div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderScheduleEvent(event) {
  const top = minutesFromStart(event.alku);
  const height = minutesBetween(event.alku, event.loppu);

  if (event.tyyppi === "valvonta") {
    return `<div class="schedule-event supervision" style="--event-top: ${top}px; --event-height: ${height}px;"><div class="schedule-time">${event.alku}–${event.loppu}</div><div class="schedule-event-content"><strong>Valvonta</strong><span>${escapeHtml(event.paikka || "")}</span></div></div>`;
  }

  if (event.tyyppi === "kotiryhma") {
    return `<div class="schedule-event homeroom" style="--event-top: ${top}px; --event-height: ${height}px;"><div class="schedule-time">${event.alku}–${event.loppu}</div><div class="schedule-event-content"><strong>${escapeHtml(event.ryhma || "Kotiryhmätunti")}</strong><span>Kotiryhmätunti</span></div></div>`;
  }

  return `<div class="schedule-event" style="--event-top: ${top}px; --event-height: ${height}px;"><div class="schedule-time">${event.alku}–${event.loppu}</div><div class="schedule-event-content"><strong>${escapeHtml(event.ryhma || "")}</strong><span>${escapeHtml(event.tila || "")}</span></div></div>`;
}

function minutesFromStart(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes - (8 * 60 + 30);
}

function minutesBetween(start, end) {
  const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  return toMinutes(end) - toMinutes(start);
}

function formatShortDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return `${date.getDate()}.${date.getMonth() + 1}.`;
}

function renderSubstituteGuide() {
  if (!substituteContent) return;

  substituteContent.innerHTML = `
    <div class="guide-content">
      <h3>Oppimateriaalit</h3>
      <p>Oppimateriaalit, kuten opettajan oppaat, löydät seuraavasti:</p>
      <ul>
        <li><strong>Talon sisäiset sijaiset:</strong> Opehuone-Drive → Sijaiset JAETTU → Yläkoulu → RAUH</li>
        <li><strong>Talon ulkopuoliset sijaiset:</strong> Kirjaudu sijaisläppärillä → selaimella Google Drive → Minulle jaetut → Sijaiset JAETTU → Yläkoulu → RAUH</li>
      </ul>

      <h3>Oppilaiden tuntitehtävät</h3>
      <p>Oppilaiden tuntitehtävissä on eri tyyppejä ja vaikeustasoja.</p>

      <h4>MATEMATIIKKA</h4>
      <ul class="task-levels">
        <li><span class="level-dot black"></span><strong>Musta:</strong> lämmittelytehtävät, kaikille pakolliset</li>
        <li><span class="level-dot blue"></span><strong>Sininen:</strong> arvosanan 8 tehtävät</li>
        <li><span class="level-dot red"></span><strong>Punainen:</strong> arvosanojen 9 ja 10 tehtävät</li>
      </ul>

      <h4>FYSIIKKA</h4>
      <ul class="task-levels">
        <li><span class="level-dot green"></span><strong>Vihreä:</strong> tutkimukset, simulaatiot ja labratyöt</li>
        <li><span class="level-dot blue"></span><strong>Sininen:</strong> arvosanan 8 tehtävät</li>
        <li><span class="level-dot red"></span><strong>Punainen:</strong> arvosanojen 9 ja 10 tehtävät</li>
      </ul>

      <h3>Tuntimerkinnät</h3>
      <p>Oppilaiden tuntimerkinnät kirjataan <strong>paperisiin oppilaslistoihin</strong>.</p>
      <p>Merkitse:</p>
      <ul>
        <li>ketkä ovat pois tunnilta</li>
        <li>ketkä ovat myöhässä</li>
        <li>muut olennaiset tuntimerkinnät</li>
      </ul>
      <p>Merkitse lisäksi kouluarvosana-asteikolla <strong>4–10</strong>, millaista tuntityöskentelyä kullakin oppilaalla on ollut. Huomioon otetaan esimerkiksi läksyt, harjoittelu ja aktiivisuus.</p>
      <div class="guide-important"><strong>Ilman tätä tietoa en pysty arvioimaan oppilaita, älä unohda tehdä sitä!</strong></div>
    </div>
  `;
}

/* -----------------------------
   Navigointi
----------------------------- */

function setView(viewName) {
  if (!views[viewName]) {
    return;
  }

  state.currentView = viewName;

  Object.entries(views).forEach(([name, view]) => {
    view.hidden = name !== viewName;
  });

  closeNavigation();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openNavigation() {
  mainNavigation.hidden = false;
  menuButton.setAttribute("aria-expanded", "true");
  menuButton.setAttribute("aria-label", "Sulje valikko");
  menuButton.classList.add("is-open");
}

function closeNavigation() {
  mainNavigation.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Avaa valikko");
  menuButton.classList.remove("is-open");
}

menuButton.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";

  if (isOpen) {
    closeNavigation();
  } else {
    openNavigation();
  }
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    setView(button.dataset.view);
  });
});

loadCourses().catch((error) => {
  console.error(error);
  renderEmpty("Sivun tietojen lataamisessa tapahtui virhe.");
});
