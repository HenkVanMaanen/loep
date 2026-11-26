import assert from "node:assert/strict";
import { test } from "node:test";
import { INPAGE_PATH, launchBrowser, loadPage, newContext } from "../src/browser/session.ts";
import type { CapturedState } from "../src/commands/modelsweep.ts";
import { collectFacts } from "../src/instruments/facts.ts";
import { forms, headings } from "../src/lib/extractors.ts";
import type { Facts, RunData } from "../src/lib/rundata.ts";

const ORIGIN = "https://site.test";
const HTML = `<!doctype html><html lang="nl"><body><main>
  <h1>Vervoer</h1>
  <h2>Kies een route</h2>
  <ul><li><a href="/bus">Bus</a></li><li><a href="/trein">Trein</a></li></ul>
  <h2>Onze partners</h2>
  <svg role="img" aria-label="Bibliotheek" width="20" height="20"><circle r="10" cx="10" cy="10"/></svg>
  <h2>Meer lezen</h2><p>Vervoer in de buurt.</p>
  <h2>Gelijke kop</h2><p>Andere inhoud.</p>
  <h2>Gelijke kop</h2><a href="/contact">Contact</a>
  <h2>Aanvraag</h2>
  <form>
    <fieldset id="choice"><legend>Hoe reist u?</legend>
      <div id="local" role="radiogroup" aria-label="Lokaal vervoer">
        <label for="bicycle">Fiets</label><input type="radio" id="bicycle" required>
        <input type="radio" id="unnamed"><span>Lopend</span>
      </div>
    </fieldset>
    <details id="contact"><summary>Contact</summary>
      <label for="email">E-mailadres</label><input type="email" id="email" required>
      <label id="clipped" for="area" style="position:absolute;clip:rect(0,0,0,0)">Postcode</label><input id="area">
    </details>
    <details><summary>Voorkeur</summary><label for="other">Anders</label><input id="other"></details>
    <button>Verstuur</button>
  </form>
</main></body></html>`;

test("structure evidence keeps exact field locations, browser groups and unresolved states", async () => {
  const browser = await launchBrowser();
  try {
    const context = await newContext(browser);
    await context.addInitScript({ path: INPAGE_PATH });
    await context.route(`${ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: HTML }));
    const page = await context.newPage();
    await loadPage(page, `${ORIGIN}/`);
    const facts = await collectFacts(page) as unknown as Facts;
    await page.locator("#contact summary").click();
    const opened = await collectFacts(page) as unknown as Facts;
    const changed = opened.controls.map((field) => field.path[0] === "#other" ? { ...field, labelText: "Een andere vraag", visible: true } : field);
    const state = {
      id: "contact", url: `${ORIGIN}/`, reached: true, stillReachedAfterMeasuring: true,
      files: { screenshot: "contact.png", accessibilityTree: "contact.yaml" },
    } as unknown as CapturedState;
    const run = {
      inventory: { totals: { forms: 1 } },
      pages: [{ label: "P1", item: { url: `${ORIGIN}/` }, facts }, { label: "P2", item: { url: `${ORIGIN}/other` }, facts }],
      siteStates: { states: [state, { ...state, id: "missing", reached: false }, { ...state, id: "lost", stillReachedAfterMeasuring: false }, { ...state, id: "changed" }] },
      stateEvidence: { contact: { controls: opened.controls, fieldGroups: opened.fieldGroups }, lost: { controls: opened.controls }, changed: { controls: changed, fieldGroups: opened.fieldGroups } },
    } as unknown as RunData;
    type Field = { where: string; groupCandidates: unknown[]; labelLinks: unknown[]; accessibleName: string | null; required: boolean; browserRequired: boolean | null };
    const structure = (forms(run, "1.3.1") as { fieldStructure: {
      pages: { fields: Field[]; alsoOn: string[] }[];
      states: { examined: boolean; newOrChangedFields: Field[]; screenshot: string; accessibilityTree: string }[];
      notSeenVisible: { page: string; where: string }[];
    } }).fieldStructure;
    const initial = structure.pages[0]!.fields;
    assert.deepEqual(structure.pages[0]!.alsoOn, ["P2"]);
    const bicycle = initial.find((field) => field.where === "#bicycle")!;
    assert.equal(bicycle.required, true);
    assert.deepEqual(bicycle.groupCandidates, [
      { where: "#local", tag: "div", legend: null, role: "radiogroup", accessibleName: "Lokaal vervoer", hiddenFromAssistiveTech: false },
      { where: "#choice", tag: "fieldset", legend: "Hoe reist u?", role: "group", accessibleName: "Hoe reist u?", hiddenFromAssistiveTech: false },
    ]);
    assert.equal(initial.find((field) => field.where === "#unnamed")?.accessibleName, null);
    assert.equal(initial.length, 5);
    const [contact, missing, lost] = structure.states;
    assert.deepEqual(contact!.newOrChangedFields.map(({ where, accessibleName }) => [where, accessibleName]), [["#email", "E-mailadres"], ["#area", "Postcode"]]);
    assert.equal(contact!.newOrChangedFields[0]!.browserRequired, true);
    assert.deepEqual(contact!.newOrChangedFields[1]!.labelLinks, [{ where: "#clipped", text: "Postcode", visible: false }]);
    assert.equal(contact!.screenshot, "contact.png");
    assert.equal(contact!.accessibilityTree, "contact.yaml");
    assert.equal(missing!.examined, false);
    assert.equal(lost!.examined, false);
    assert.deepEqual(structure.notSeenVisible.map(({ page, where }) => [page, where]), [["P1", "#other"], ["P2", "#email"], ["P2", "#area"], ["P2", "#other"]]);
    assert.equal("fieldStructure" in (forms(run, "3.3.2") as object), false);

    const candidates = (headings(run, "1.3.1") as { candidates: { headingsWithoutContent: { heading: string; nearbyContent: { count: number; examples: { accessibleName: string }[] } | null }[] } }).candidates.headingsWithoutContent;
    assert.equal(candidates.find((row) => row.heading === "h2 Kies een route")?.nearbyContent?.count, 2);
    assert.equal(candidates.find((row) => row.heading === "h2 Onze partners")?.nearbyContent?.examples[0]?.accessibleName, "Bibliotheek");
    assert.equal(candidates.find((row) => row.heading === "h2 Gelijke kop")?.nearbyContent, null);
  } finally {
    await browser.close();
  }
});
