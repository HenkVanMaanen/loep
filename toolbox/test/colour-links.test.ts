import assert from "node:assert/strict";
import { test } from "node:test";
import { colourLinks } from "../src/lib/colour-links.ts";
import type { Facts, RunData } from "../src/lib/rundata.ts";

function link(text: string, extra: Partial<Facts["links"][number]> = {}) {
  return { path: [`#${text}`], visible: true, text, context: "Voorbeeld", region: "main", sentence: text, sentenceFrom: "p", parentTag: "p", ...extra };
}

test("colour links distinguish recorded coverage from a missing state and keep visual leads across views", () => {
  const url = "https://example.nl/";
  const inline = link("contact", { sentence: "Neem contact op" });
  const links = [inline, link("los"), link("voet", { sentence: null, sentenceFrom: null, parentTag: "span", region: "footer", ariaHidden: true }), link("verborgen", { visible: false })];
  const run = {
    pages: [{ label: "P1", item: { url }, facts: { links } }],
    siteStates: {
      states: [
        { id: "panel", url, reached: true },
        { id: "empty", url, reached: true },
        { id: "unmeasured", url, reached: true },
        { id: "closed", url, reached: false },
      ],
    },
    stateEvidence: {
      panel: { links: [inline, link("help", { sentenceFrom: undefined, sentence: "Oudere vrije context" })] },
      empty: { links: [] },
    },
  } as unknown as RunData;

  const result = colourLinks(run);
  assert.deepEqual(result.pages, [{ page: "P1", linksExamined: 3, leads: 2 }]);
  assert.deepEqual(result.states, [
    { state: "panel", page: "P1", reached: true, linksExamined: 2, leads: 2 },
    { state: "empty", page: "P1", reached: true, linksExamined: 0, leads: 0 },
    { state: "unmeasured", page: "P1", reached: true, linksExamined: null, leads: null },
    { state: "closed", page: "P1", reached: false, linksExamined: null, leads: null },
  ]);
  assert.deepEqual(result.leads.map(({ text, region, sentence, views }) => ({ text, region, sentence, views })), [
    { text: "contact", region: "main", sentence: "Neem contact op", views: ["P1", "panel"] },
    { text: "voet", region: "footer", sentence: null, views: ["P1"] },
    { text: "help", region: "main", sentence: null, views: ["panel"] },
  ]);
});
