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
const instructionsContent = document.querySelector("#instructions-content");
const absenceStart = document.querySelector("#absence-start");
const absenceEnd = document.querySelector("#absence-end");
const generateInstructionsButton = document.querySelector("#generate-instructions");
const generatedInstructions = document.querySelector("#generated-instructions");

const menuButton = document.querySelector("#menu-button");
const mainNavigation = document.querySelector("#main-navigation");

const views = {
  courses: document.querySelector("#courses-view"),
  schedule: document.querySelector("#schedule-view"),
  substitute: document.querySelector("#substitute-view"),
  instructions: document.querySelector("#instructions-view")
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


/* -----------------------------
   Lukujärjestys
----------------------------- */

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
  const referenceMonday = getTimetableReferenceDate();

  scheduleContent.innerHTML = `
    <p class="schedule-period">
      ${escapeHtml(state.timetable.jakso)}. jakso ·
      vko ${getWeekNumber(referenceMonday)} ·
      ${formatShortDate(referenceMonday)}–${formatShortDate(
        getDateForWeekday(referenceMonday, "perjantai")
      )}
    </p>

    <div class="schedule-grid">
      ${days.map(([key, day]) => {
        const date = getDateForWeekday(referenceMonday, key);

        return `
          <article class="schedule-day">
            <header class="schedule-day-header">
              <h3>${dayNames[key] || escapeHtml(key)} ${formatShortDate(date)}</h3>
            </header>

            <div class="schedule-events">
              <div class="schedule-timeline">
                ${(day.tapahtumat || []).map(renderScheduleEvent).join("")}
              </div>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function getTimetableReferenceDate() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return getMonday(today);
}

function getMonday(date) {
  const monday = new Date(date);
  monday.setHours(12, 0, 0, 0);

  const day = monday.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  monday.setDate(monday.getDate() + difference);

  return monday;
}

function getDateForWeekday(referenceMonday, weekdayKey) {
  const weekdayNumbers = {
    maanantai: 1,
    tiistai: 2,
    keskiviikko: 3,
    torstai: 4,
    perjantai: 5
  };

  const date = new Date(referenceMonday);
  date.setHours(12, 0, 0, 0);

  const weekdayNumber = weekdayNumbers[weekdayKey];

  if (!weekdayNumber) {
    return date;
  }

  date.setDate(
    date.getDate() + (weekdayNumber - 1)
  );

  return date;
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

function formatShortDate(value) {
  const date = value instanceof Date
    ? value
    : new Date(`${value}T00:00:00`);

  return `${date.getDate()}.${date.getMonth() + 1}.`;
}


/* -----------------------------
   Yleiset sijaisohjeet
----------------------------- */

function renderSubstituteGuide() {
  if (!substituteContent) return;

  substituteContent.innerHTML = `
    <div class="guide-content">
      <div class="guide-content">
      <p></p>
      <h3>Oppimateriaalit</h3>
      <p>Löydät esimerkiksi opettajan oppaat ja muun tarpeellisen seuraavasti:</p>
      <ul>
        <li><strong>Talon sisäiset sijaiset:</strong> Opehuone-Drive → Sijaiset JAETTU → Yläkoulu → RAUH</li>
        <li><strong>Talon ulkopuoliset sijaiset:</strong> Kirjaudu sijaisläppärillä → selaimella Google Drive → Minulle jaetut → Sijaiset JAETTU → Yläkoulu → RAUH</li>
      </ul>
      <p>Tuntien aiheet ilmoitetaan seuraavista lähteistä: </p>
      <ul>
      <li>Kurssisivusto (KS)</li>
      <li>Avoin matematiikka (AM), pdf-muodossa</li>
      <li>Oppikirja (esim. Kuutio X)</li>
      </ul>
      <p>Kurssisivusto toimii vain koulun tunnuksilla eli esimerkiksi sijaisläppärillä. Osoitteen löydät oppimateriaalikansiosta ja se on jaettu myös oppilaille. </p>

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

      <p>HUOM! Värit ovat toistaiseksi käytössä vasta kurssisivustolla, eivät kurssiportaalissa. Fysiikan tutkimukset eivät
      toistaiseksi vielä vihreällä värillä merkittynä.</p>

      <h3>Tuntimerkinnät</h3>
      <p>Oppilaiden tuntimerkinnät kirjataan <strong>paperisiin oppilaslistoihin</strong>.</p>
      <p>Merkitse:</p>
      <ul>
        <li>ketkä ovat pois tunnilta</li>
        <li>ketkä ovat myöhässä</li>
        <li>muut olennaiset tuntimerkinnät</li>
      </ul>
      <p>Merkitse lisäksi kouluarvosana-asteikolla <strong>4–10</strong>, millaista tuntityöskentelyä kullakin oppilaalla on ollut. 
      Huomioon otetaan esimerkiksi läksyt, harjoittelumäärä ja erityisesti laatu, kaverien auttaminen ja aktiivisuus.</p>
      <div class="guide-important"><strong>Ilman tätä tietoa oppilaiden jatkuva arviointi ei ole mahdollista, ethän unohda tehdä sitä!</strong></div>

      <h3>Koetilanne</h3>
      <p>Sallitut välineet kokeissa:</p>
      <ul>
        <li>Kynä ja pyyhekumi</li>
        <li>Opettajan antamaa tyhjää paperia (oppilaan omia ei saa käyttää)</li>
        <li>Laskin (ilmoitetaan kokeen tiedoissa erikseen)</li>
        <li>Tietokone (ilmoitetaan kokeen tiedoissa erikseen))</li>
      </ul>
      <p>Kielletyt välineet kokeissa:</p>
      <ul>
        <li>Oppilaan omat lunttilaput yms</li>
        <li>Puhelimet</li>
        <li>Älykellot</li>
        <li>Kuulokkeet</li>
        <li>Älylasit</li>
      </ul>
      <p>Ennnen koetta valvova opettaja tarkistaa, että kiellettyjä välineitä ei ole (esim ranteet ja korvat tulee näyttää).
      Oppilaiden reput viedään opettajan osoittamaan paikkaan, kuten luokan etu- tai takaosaan.</p> 
      <p>Varmista, että oppilaat istuvat sellaisessa paikassa, johon on hyvä näkyvyys. Jos kokeen aikana oppilas tarvitsee apua, opettaja ei mene oppilaan luo, vaan oppilas tulee opettajan luo.</p>
      <p>Jos koe on kirjallinen, valvotaan luokan etuosasta. Jos koe on sähköinen, luokan takaosasta näkee parhaiten oppilaiden näytöt.
      Muista oikeasti VALVOA oppilaita, älä puuhastele omiasi!</p>
      <p>Lunttaustilanteessa oppilaan koe keskeytetään ja koevälineet kerätään pois. Paikalle voidaan pyytää tarvittaessa lisäksi toinen aikuinen kuitenkin niin, että valvoja ei itse poistu tilasta.</p>
      <p>Oppilaan koe voidaan myös keskeyttää, jos hän aiheuttaa häiriötä tai ei noudata koesääntöjä. Kaikista tällaisista poikkeustilanteista tulee tehdä muistiinpanot.</p>
      
      <p>Kun koe on palautettu, oppilaat voivat lukea luokassa olevia lehtiä tai kirjoja. Omia tietokoneita ja puhelimia ei saa käyttää. Koe päättyy aina viimeistään silloin,
      kun oppitunti päättyy. Oppilaita kannattaa muistuttaa, kun koe on loppumassa (esim. 15 minuuttia ennen).</p>
    </div>
  `;
}


/* -----------------------------
   Sijaisohjeiden generaattori
----------------------------- */

const weekdayNames = [
  "Sunnuntai",
  "Maanantai",
  "Tiistai",
  "Keskiviikko",
  "Torstai",
  "Perjantai",
  "Lauantai"
];

function getScheduleForGroup(groupCode) {
  const courseCodeValue = groupCode.split(".").slice(0, -1).join(".");
  const courseSchedule = state.schedules[courseCodeValue];

  if (!courseSchedule?.groups) {
    return null;
  }

  // Lukujärjestyksen ryhmätunnuksen pitäisi normaalisti vastata schedules.json-tunnusta.
  // Jos kurssilla on vain yksi ryhmä, voidaan käyttää sitä myös silloin kun loppunumero
  // on eri (esim. lukujärjestyksen MA_81.1 ja schedules.jsonin MA_81.2).
  if (courseSchedule.groups[groupCode]) {
    return courseSchedule.groups[groupCode];
  }

  const groupCodes = Object.keys(courseSchedule.groups);
  return groupCodes.length === 1 ? courseSchedule.groups[groupCodes[0]] : null;
}

function getCourseForGroup(groupCode) {
  const courseCodeValue = groupCode.split(".").slice(0, -1).join(".");
  return state.courses.find((course) => course.code === courseCodeValue) || null;
}

function getLessonForDate(course, schedule, isoDate) {
  if (!course || !schedule) return null;

  const lessons = state._courseData?.[course.code]?.lessons || [];
  const date = new Date(`${isoDate}T12:00:00`);
  const startDate = new Date(`${schedule.startDate}T12:00:00`);
  const endDate = new Date(`${schedule.endDate}T12:00:00`);

  if (
    date < startDate ||
    date > endDate ||
    !schedule.weekdays.includes(date.getDay())
  ) {
    return null;
  }

  const exception = (schedule.exceptions || []).find(
    (item) => item.date === isoDate
  );

  if (exception) {
    return { exception };
  }

  let lessonNumber = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= date) {
    const currentIso = formatDate(currentDate);

    if (schedule.weekdays.includes(currentDate.getDay())) {
      const isException = (schedule.exceptions || []).some(
        (item) => item.date === currentIso
      );

      if (!isException) {
        lessonNumber++;
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const lesson = lessons.find((item) => item.lesson === lessonNumber);

  return lesson ? { lesson } : null;
}

async function loadAllCourseData() {
  if (state._courseData) {
    return state._courseData;
  }

  state._courseData = {};

  await Promise.all(
    state.courses.map(async (course) => {
      const response = await fetch(
        `./src/data/${course.file.split("/").pop()}`
      );

      if (!response.ok) {
        throw new Error(
          `Kurssin ${course.code} lataaminen epäonnistui.`
        );
      }

      state._courseData[course.code] = await response.json();
    })
  );

  return state._courseData;
}

function formatEmailDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);

  return `${weekdayNames[date.getDay()]} ${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function formatDateRange(start, end) {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);

  return `${startDate.getDate()}.${startDate.getMonth() + 1}.–${endDate.getDate()}.${endDate.getMonth() + 1}.${endDate.getFullYear()}`;
}

function getTimetableEventsForDate(isoDate) {
  if (!state.timetable) {
    return [];
  }

  const date = new Date(`${isoDate}T12:00:00`);

  const dayNames = {
    1: "maanantai",
    2: "tiistai",
    3: "keskiviikko",
    4: "torstai",
    5: "perjantai"
  };

  const day = state.timetable.paivat?.[dayNames[date.getDay()]];

  return (day?.tapahtumat || []).filter(
    (event) => event.tyyppi === "oppitunti"
  );
}

function getDatesBetween(start, end) {
  const dates = [];

  const current = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);

  while (current <= last) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function buildSubstituteInstructions(events, start, end) {
  const lines = [];
  const grouped = new Map();

  events.forEach((event) => {
    const date = event.date;
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(event);
  });

  [...grouped.entries()].forEach(([date, dayEvents]) => {
    // Päiväotsikko
    lines.push(formatEmailDate(date));
    lines.push("");

    dayEvents.forEach((event, eventIndex) => {
      // Oppitunnin otsikko
      lines.push(
        `  ${event.alku}–${event.loppu}  ${event.ryhma}  (${event.tila || ""})`
      );

      // Oppitunnin sisältö
      if (event.exception) {
        lines.push(`    ${event.exception.type}`);
        lines.push(`    ${event.exception.description}`);
      } else if (event.lesson) {
        lines.push(
          `    Aihe: ${event.lesson.topic || event.lesson.title || ""}`
        );

        if (event.lesson.tasks) {
          lines.push(`    Tehtävät: ${event.lesson.tasks}`);
        }

        if (event.lesson.substituteNote) {
          lines.push(`    Sijaiselle: ${event.lesson.substituteNote}`);
        }
      }

      // Tyhjä rivi vain oppituntien väliin,
      // ei oppitunnin eri tietojen väliin.
      if (eventIndex < dayEvents.length - 1) {
        lines.push("");
      }
    });

    // Tyhjä rivi ennen seuraavaa päivää
    lines.push("");
  });

  const siteUrl = window.location.href.split("#")[0];
  const range = formatDateRange(start, end);

  return [
    `Hei!`,
    ``,
    `Olen poissa ${range}. Tässä poissaoloni aikana pidettävät oppitunnit ja niiden ohjeet:`,
    ``,
    lines.join("\n"),
    `Luethan myös muut sijaisuuksiin liittyvät ohjeet kurssiportaalista:`,
    siteUrl,
    ``,
    `Ystävällisin terveisin,`,
    `Mikael`
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}

function renderGeneratedInstructions(emailText, start, end, eventCount) {

  generatedInstructions.hidden = false;

  generatedInstructions.innerHTML = `
    <div class="generated-header">
      <h3>Valmis sijaisohje</h3>
      <p>${eventCount} oppituntia löytyi aikaväliltä ${formatDateRange(start, end)}.</p>
    </div>

    <div
      id="instructions-preview-formatted"
      class="instructions-preview-formatted"
    ></div>

    <div class="instruction-actions">

      <button
        id="copy-instructions"
        class="secondary-button"
        type="button"
      >
        Kopioi teksti
      </button>
    </div>

    <p
      id="copy-status"
      class="copy-status"
      aria-live="polite"
    ></p>
  `;

  const preview = document.querySelector(
    "#instructions-preview-formatted"
  );

  const previewLines = emailText.split("\n");

  const previewHtml = previewLines
  .map((line) => {
    const dateMatch = line.match(
      /^(Sunnuntai|Maanantai|Tiistai|Keskiviikko|Torstai|Perjantai|Lauantai) \d{1,2}\.\d{1,2}\.\d{4}$/
    );

    // Päiväotsikko
    if (dateMatch) {
      return `
        <div
          class="generated-date-heading"
          style="margin: 1.25rem 0 0.45rem 0; padding: 0; line-height: 1.5;"
        ><strong>${escapeHtml(line)}</strong></div>
      `;
    }

    // Tyhjä rivi
    if (line === "") {
      return `<div style="height: 0.75rem; margin: 0; padding: 0;"></div>`;
    }

    // Oppitunnin otsikko
    const lessonHeaderMatch = line.match(
      /^  \d{2}:\d{2}–\d{2}:\d{2}\s+.+$/
    );

    if (lessonHeaderMatch) {
      return `
        <div style="margin: 0; padding: 0; line-height: 1.5; white-space: pre-wrap;"><strong>${escapeHtml(line)}</strong></div>
      `;
    }

    // Muut rivit
    return `
      <div style="margin: 0; padding: 0; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(line)}</div>
    `;
  })
  .join("");



  preview.innerHTML = previewHtml;

  document
    .querySelector("#copy-instructions")
    .addEventListener("click", async () => {
      try {
        if (
          navigator.clipboard &&
          navigator.clipboard.write &&
          typeof ClipboardItem !== "undefined"
        ) {
          const htmlDocument = `
            <div style="font-family: sans-serif; line-height: 1.5; margin: 0; padding: 0;">
              ${previewHtml}
            </div>
          `;

          const clipboardItem = new ClipboardItem({
            "text/plain": new Blob(
              [emailText],
              { type: "text/plain" }
            ),
            "text/html": new Blob(
              [htmlDocument],
              { type: "text/html" }
            )
          });

          await navigator.clipboard.write([clipboardItem]);

          document.querySelector("#copy-status").textContent =
            "Muotoiltu teksti kopioitu leikepöydälle.";
        } else {
          await navigator.clipboard.writeText(emailText);

          document.querySelector("#copy-status").textContent =
            "Teksti kopioitu leikepöydälle.";
        }
      } catch (error) {
        console.error(error);

        document.querySelector("#copy-status").textContent =
          "Tekstin kopiointi ei onnistunut automaattisesti.";
      }
    });
}

async function generateSubstituteInstructions() {
  const start = absenceStart.value;
  const end = absenceEnd.value;

  if (!start || !end) {
    generatedInstructions.hidden = false;

    generatedInstructions.innerHTML = `
      <p class="form-error">
        Valitse sekä poissaolon alku- että loppupäivä.
      </p>
    `;

    return;
  }

  if (start > end) {
    generatedInstructions.hidden = false;

    generatedInstructions.innerHTML = `
      <p class="form-error">
        Poissaolon loppupäivän pitää olla sama tai myöhäisempi kuin alkupäivän.
      </p>
    `;

    return;
  }

  generateInstructionsButton.disabled = true;
  generateInstructionsButton.textContent = "Luodaan ohjeita…";

  try {
    await loadAllCourseData();

    const events = [];

    getDatesBetween(start, end).forEach((date) => {
      getTimetableEventsForDate(date).forEach((timetableEvent) => {
        const course = getCourseForGroup(timetableEvent.ryhma);
        const schedule = getScheduleForGroup(timetableEvent.ryhma);
        const courseEvent = getLessonForDate(
          course,
          schedule,
          date
        );

        events.push({
          date,
          ...timetableEvent,
          lesson: courseEvent?.lesson || null,
          exception: courseEvent?.exception || null
        });
      });
    });

    events.sort((a, b) =>
      `${a.date}${a.alku}`.localeCompare(
        `${b.date}${b.alku}`
      )
    );

    const emailText = buildSubstituteInstructions(
      events,
      start,
      end
    );

    renderGeneratedInstructions(
      emailText,
      start,
      end,
      events.length
    );
  } catch (error) {
    console.error(error);

    generatedInstructions.hidden = false;

    generatedInstructions.innerHTML = `
      <p class="form-error">
        Ohjeiden muodostaminen epäonnistui. Tarkista, että kurssi- ja aikatauludata on saatavilla.
      </p>
    `;
  } finally {
    generateInstructionsButton.disabled = false;
    generateInstructionsButton.textContent = "Luo sijaisohjeet";
  }
}

if (generateInstructionsButton) {
  generateInstructionsButton.addEventListener(
    "click",
    generateSubstituteInstructions
  );
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

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function openNavigation() {
  mainNavigation.hidden = false;

  menuButton.setAttribute(
    "aria-expanded",
    "true"
  );

  menuButton.setAttribute(
    "aria-label",
    "Sulje valikko"
  );

  menuButton.classList.add("is-open");
}

function closeNavigation() {
  mainNavigation.hidden = true;

  menuButton.setAttribute(
    "aria-expanded",
    "false"
  );

  menuButton.setAttribute(
    "aria-label",
    "Avaa valikko"
  );

  menuButton.classList.remove("is-open");
}

menuButton.addEventListener("click", () => {
  const isOpen =
    menuButton.getAttribute("aria-expanded") === "true";

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