const state = {
  courses: [],
  schedules: {},
  currentCourse: null,
  currentCourseData: null,
  currentGroup: null
};

const courseList = document.querySelector("#course-list");
const lessonList = document.querySelector("#lesson-list");
const courseCode = document.querySelector("#course-code");
const courseTitle = document.querySelector("#course-title");

async function loadCourses() {
  try {
    const [coursesResponse, schedulesResponse] = await Promise.all([
      fetch("src/data/courses.json"),
      fetch("src/data/schedules.json")
    ]);

    if (!coursesResponse.ok || !schedulesResponse.ok) {
      throw new Error("Datan lataaminen epäonnistui.");
    }

    state.courses = await coursesResponse.json();
    state.schedules = await schedulesResponse.json();

    renderGroupButtons();

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

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLessonDate(lessonNumber, schedule) {
  const startDate = new Date(`${schedule.startDate}T00:00:00`);
  const endDate = new Date(`${schedule.endDate}T00:00:00`);

  const holidays = new Set(schedule.holidays || []);
  const cancelled = new Set(schedule.cancelled || []);

  let currentDate = new Date(startDate);
  let lessonCount = 0;

  while (currentDate <= endDate) {
    const isoDate = formatDate(currentDate);

    // JavaScript: sunnuntai = 0, maanantai = 1, ..., lauantai = 6
    const weekday = currentDate.getDay();

    const isTeachingDay = schedule.weekdays.includes(weekday);
    const isHoliday = holidays.has(isoDate);
    const isCancelled = cancelled.has(isoDate);

    if (isTeachingDay && !isHoliday && !isCancelled) {
      lessonCount++;

      if (lessonCount === lessonNumber) {
        return isoDate;
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return null;
}

function formatDisplayDate(isoDate) {
  const [year, month, day] = isoDate.split("-");

  return `${day}.${month}.${year}`;
}

function renderGroupButtons() {
  courseList.innerHTML = "";

  state.courses.forEach((course) => {
    const courseSchedule = state.schedules[course.code];

    if (!courseSchedule?.groups) {
      return;
    }

    Object.keys(courseSchedule.groups).forEach((groupCode) => {
      const button = document.createElement("button");

      button.className = "course-button";
      button.textContent = groupCode;

      button.addEventListener("click", () => {
        selectGroup(course, groupCode);
      });

      courseList.appendChild(button);
    });
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

    [...courseList.children].forEach((button) => {
      button.classList.toggle(
        "active",
        button.textContent === groupCode
      );
    });

    courseCode.textContent = groupCode;
    courseTitle.textContent = course.title;

    renderLessons();
  } catch (error) {
    console.error(error);
    renderEmpty("Oppituntien lataaminen epäonnistui.");
  }
}

function renderLessons() {
  const lessonList = document.getElementById("lesson-list");

  if (!state.currentCourse || !state.currentCourseData) {
    renderEmpty();
    return;
  }

  const courseSchedule = state.schedules[state.currentCourse.code];
  const schedule = courseSchedule.groups[state.currentGroup];

  if (!schedule) {
    lessonList.innerHTML = `
      <p class="empty-message">
        Kurssille ei ole määritetty aikataulua.
      </p>
    `;
    return;
  }

  lessonList.innerHTML = state.currentCourseData.lessons
    .map((lesson) => {
      const date = getLessonDate(lesson.lesson, schedule);

      return `
        <article class="lesson-card">
          <div class="lesson-header">
            <div>
              <p class="lesson-number">
                Oppitunti ${lesson.lesson}
              </p>

              ${
                date
                  ? `<p class="lesson-date">${formatDisplayDate(date)}</p>`
                  : ""
              }

              <h3>${escapeHtml(lesson.topic)}</h3>
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
                  ${(Array.isArray(lesson.tasks) ? lesson.tasks : [lesson.tasks])
                    .filter(Boolean)
                    .map((task) => `<p>${escapeHtml(task)}</p>`)
                    .join("")}
                </div>
              `
              : ""
          }

          ${
            lesson.substitute
              ? `
                <div class="substitute-box">
                  <strong>Sijaiselle</strong>
                  <p>${escapeHtml(lesson.substitute)}</p>
                </div>
              `
              : ""
          }
        </article>
      `;
    })
    .join("");
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