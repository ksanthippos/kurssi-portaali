const state = {
  courses: [],
  currentCourse: null
};

const courseList = document.querySelector("#course-list");
const lessonList = document.querySelector("#lesson-list");
const courseCode = document.querySelector("#course-code");
const courseTitle = document.querySelector("#course-title");

async function loadCourses() {
  const response = await fetch("./src/data/courses.json");

  if (!response.ok) {
    throw new Error("Kurssilistan lataaminen epäonnistui.");
  }

  state.courses = await response.json();
  renderCourseButtons();

  if (state.courses.length > 0) {
    await selectCourse(state.courses[0]);
  } else {
    renderEmpty("Yhtään kurssia ei ole vielä lisätty.");
  }
}

function renderCourseButtons() {
  courseList.replaceChildren();

  for (const course of state.courses) {
    const button = document.createElement("button");
    button.className = "course-button";
    button.type = "button";
    button.textContent = `${course.code} – ${course.title}`;

    button.addEventListener("click", () => selectCourse(course));

    courseList.append(button);
  }
}

async function selectCourse(course) {
  const response = await fetch(
    `./src/data/${course.file.split("/").pop()}`
  );

  if (!response.ok) {
    throw new Error(`Kurssin ${course.code} lataaminen epäonnistui.`);
  }

  state.currentCourse = await response.json();

  [...courseList.children].forEach((button) => {
    button.classList.toggle(
      "active",
      button.textContent.startsWith(state.currentCourse.code)
    );
  });

  courseCode.textContent = state.currentCourse.code;
  courseTitle.textContent = state.currentCourse.title;

  renderLessons();
}

function renderLessons() {
  lessonList.replaceChildren();

  const lessons = state.currentCourse?.lessons ?? [];

  if (lessons.length === 0) {
    renderEmpty("Tälle kurssille ei ole vielä lisätty oppitunteja.");
    return;
  }

  for (const lesson of lessons) {
    const article = document.createElement("article");
    article.className = "lesson";

    const date = new Date(`${lesson.date}T12:00:00`);

    const formattedDate = Number.isNaN(date.getTime())
      ? lesson.date
      : new Intl.DateTimeFormat("fi-FI", {
          weekday: "short",
          day: "numeric",
          month: "numeric",
          year: "numeric"
        }).format(date);

    article.innerHTML = `
      <header>
        <div>
          <p class="eyebrow">${escapeHtml(lesson.topic)}</p>
          <h3>${escapeHtml(lesson.topic)}</h3>
        </div>

        <div class="lesson-date">
          ${escapeHtml(formattedDate)}
        </div>
      </header>

      <div class="lesson-grid">
        <div>
          <strong>Tavoite</strong>
          <p>${escapeHtml(lesson.goal || "-")}</p>
        </div>

        <div>
          <strong>Tehtävät</strong>
          <p>${escapeHtml(lesson.tasks || "-")}</p>
        </div>
        <!-- ERIKSEEN SIJAISOHJE, tarvitaanko?
        <div class="substitute-box">
          <strong>Sijaiselle</strong>
          <p>${escapeHtml(lesson.substituteNote || "-")}</p>
        </div>
        -->
      </div>
    `;

    lessonList.append(article);
  }
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

loadCourses().catch((error) => {
  console.error(error);
  renderEmpty("Sivun tietojen lataamisessa tapahtui virhe.");
});