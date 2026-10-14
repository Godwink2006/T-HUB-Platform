import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("grades filters include date range and status controls", async () => {
  const html = await readFile(path.join(projectRoot, "html", "grades.html"), "utf8");
  const source = await readFile(path.join(projectRoot, "js", "grades.js"), "utf8");

  for (const id of [
    "gradeToolbarStartDate",
    "gradeToolbarEndDate",
    "gradeToolbarStatusSelect",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(source, /if \(selectedStatus && itemStatus !== selectedStatus\) return false;/);
  assert.match(source, /if \(startDate && \(!itemDate \|\| itemDate < startDate\)\) return false;/);
  assert.match(source, /if \(endDate && \(!itemDate \|\| itemDate > endDate\)\) return false;/);
});

test("grade creator identity renders name, profile photo, and staff or user ID safely", async () => {
  const source = await readFile(path.join(projectRoot, "js", "grades.js"), "utf8");
  const helperSource = [
    source.match(/function escapeGradeHtml\(value\) \{[\s\S]*?\n\}/)?.[0],
    source.match(/function renderGradeCreator\(profile, userId\) \{[\s\S]*?\n\}/)?.[0],
  ];
  assert.ok(helperSource.every(Boolean), "creator identity helpers exist");

  const context = vm.createContext({ window: { DEFAULT_PROFILE_AVATAR: "/avatar.png" } });
  vm.runInContext(
    `${helperSource.join("\n")}\nglobalThis.render = renderGradeCreator;`,
    context,
  );

  const html = context.render(
    {
      id: "profile-1",
      full_name: "<Teacher>",
      photo_url: "/photo.png",
      teachers: { staff_id: "ST-001" },
    },
    "profile-1",
  );
  assert.match(html, /&lt;Teacher&gt;/);
  assert.match(html, /src="\/photo\.png"/);
  assert.match(html, /Staff ID: ST-001/);
  assert.doesNotMatch(html, /<Teacher>/);

  const fallback = context.render(null, "profile-2");
  assert.match(fallback, /Unknown/);
  assert.match(fallback, /User ID: profile-2/);
});

test("enter and edit grade modals show the grade creator identity", async () => {
  const html = await readFile(path.join(projectRoot, "html", "grades.html"), "utf8");
  const source = await readFile(path.join(projectRoot, "js", "grades.js"), "utf8");

  assert.match(html, /id="enterGradeModalCreator"/);
  assert.match(html, /id="editModalCreator"/);
  assert.match(html, /id="editModalEditor"/);
  assert.match(source, /getCurrentGradeActorMarkup\(client\)/);
  assert.match(source, /elCreator\.innerHTML = gradeCreatorMarkup/);
  assert.match(source, /editModalEditor"\)\.innerHTML = editorMarkup/);
});

test("grades table omits creator identity while grade detail modals retain it", async () => {
  const html = await readFile(path.join(projectRoot, "html", "grades.html"), "utf8");
  const listSource = await readFile(path.join(projectRoot, "js", "grades.js"), "utf8");
  const tableHeader = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0];
  const listRenderer = listSource.match(/async function loadGradesList\(\) \{[\s\S]*?\n\}/)?.[0];

  assert.ok(tableHeader);
  assert.ok(listRenderer);
  assert.doesNotMatch(tableHeader, /Entered By/);
  assert.doesNotMatch(listRenderer, /renderGradeCreator|creatorProfiles/);
  assert.match(html, /id="viewModalCreator"/);
  assert.match(html, /id="editModalCreator"/);
  assert.match(html, /id="editModalEditor"/);
});

test("grade statuses have distinct badge colors and every grade modal is viewport constrained on mobile", async () => {
  const css = await readFile(path.join(projectRoot, "css", "grades.css"), "utf8");
  const html = await readFile(path.join(projectRoot, "html", "grades.html"), "utf8");

  assert.match(css, /\.badge-drafted\s*\{[\s\S]*?background:\s*#fef3c7/);
  assert.match(css, /\.badge-submitted\s*\{[\s\S]*?background:\s*#dcfce7/);
  assert.match(css, /@media screen and \(max-width: 768px\)[\s\S]*?\.enterGrade-modal-content,[\s\S]*?\.editGrade-modal-content[\s\S]*?max-height: 92vh/);
  assert.match(html, /id="viewModalCreator"/);
  assert.match(html, /id="editModalCreator"/);
  assert.match(css, /@media screen and \(max-width: 420px\)[\s\S]*?\.toolbar input/);
});
