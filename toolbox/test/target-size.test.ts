import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startFixture } from "../fixtures/serve.ts";
import type { TargetMeasurement } from "../src/instruments/target.ts";
import { Daemon } from "../src/session/daemon.ts";
import { targetSize } from "../src/lib/extractors.ts";
import type { PageData, RunData } from "../src/lib/rundata.ts";

const page = (label: string, targets: PageData["targets"], narrow?: PageData["targets"]): PageData => ({
  label,
  item: { url: `https://site.example/${label}` },
  targets,
  ...(narrow ? { smallest: { targets: narrow } } : {}),
}) as PageData;

const target = (path: string, x: number, inlineInText = false): PageData["targets"][number] => ({
  tag: "a",
  text: "Volgende",
  path: [path],
  region: "main",
  box: { x, y: 0, width: 16, height: 16 },
  width: 16,
  height: 16,
  inlineInText,
}) as PageData["targets"][number];

test("2.5.8 measures spacing even for targets that may be in a sentence", () => {
  const list = [target("#previous", 0, true), target("#next", 21, true), target("#separate", 100, true)];
  const run = {
    pages: [page("P1", [target("#single", 0, true)], list), page("P2", [])],
    siteStates: { states: [{ id: "menu", reached: true, url: "https://site.example/P1", viewport: { width: 360, height: 800 }, files: { screenshotFullPage: "menu.png" } }] },
    stateEvidence: { menu: { targets: list } },
  } as unknown as RunData;
  type Measure = { inlineWithEnoughSpacing: number; smallerThanMinimum: { where: string; neighbourWhere: string; possiblyInText?: boolean }[] };
  const result = targetSize(run, "2.5.8") as Measure & {
    at320: Measure & { pagesMissing: string[] };
    states: (Measure & { capturedOn: string; viewport: string; screenshot: string })[];
  };
  assert.equal(result.inlineWithEnoughSpacing, 1);
  assert.deepEqual(result.smallerThanMinimum, []);
  assert.deepEqual(result.at320.pagesMissing, ["P2"]);
  for (const measured of [result.at320, result.states[0]!]) {
    assert.equal(measured.inlineWithEnoughSpacing, 1);
    assert.deepEqual(measured.smallerThanMinimum.map(({ where, neighbourWhere, possiblyInText }) => [where, neighbourWhere, possiblyInText]).sort(), [
      ["#next", "#previous", true], ["#previous", "#next", true],
    ]);
  }
  assert.equal(result.states[0]!.capturedOn, "P1");
  assert.equal(result.states[0]!.viewport, "360x800");
  assert.equal(result.states[0]!.screenshot, "menu.png");
});

test("2.5.8 anchors scope gaps to recorded GET refusals of frames that count", () => {
  const frame = (address: string, kind = "vendor-component") => ({ address, class: kind, descriptionNl: "Controle" });
  const refused = (address: string, kind = "scope", method = "GET") => ({ address, kind, method, count: 1 });
  const run = {
    pages: [page("P1", [])],
    inventory: { origins: ["https://site.example"], pages: [{ url: "https://measured.example/embedded" }] },
    siteModel: { frames: [frame("https://vendor.example/check"), frame("https://vendor.example/empty", "no-content"), frame("https://vendor.example/later"), frame("https://measured.example/embedded"), frame("https://site.example/blocked")] },
    siteStates: { states: [{ id: "process", reached: false, url: "https://site.example/P1", refused: [refused("vendor.example/check"), refused("vendor.example/empty"), refused("vendor.example/later", "scope", "POST"), refused("measured.example/embedded"), refused("site.example/blocked")] }] },
  } as unknown as RunData;
  const extract = (data: RunData) => (targetSize(data, "2.5.8") as { framesBlockedByScope: unknown[] }).framesBlockedByScope;
  assert.deepEqual(extract(run), [{ address: "https://vendor.example/check", descriptionNl: "Controle", pages: ["P1"], states: ["process"] }]);
  assert.deepEqual(extract({ ...run, siteStates: null }), []);
});

test("2.5.8 finds the planted pagination spacing defect at wide and narrow widths", async (context) => {
  const run = mkdtempSync(join(tmpdir(), "loep-target-size-"));
  const site = await startFixture({
    ports: { defect: 0, clean: 0, thirdParty: 0 },
    logFile: join(run, "server.log"),
  });
  let daemon: Daemon | undefined;
  context.after(async () => {
    await daemon?.close();
    await site.close();
    rmSync(run, { recursive: true, force: true });
  });
  daemon = await Daemon.create(run, {
    hosts: [new URL(site.origins.defect).host, new URL(site.origins.clean).host],
    baseUrl: site.origins.defect,
    strict: false,
  }, { navigationDelayMs: 50, secondBrowsers: false });
  const session = "pagination";
  assert.equal((await daemon.handle({ op: "start", session })).ok, true);

  for (const [variant, largeEnough, gap] of [["defect", false, 3], ["clean", true, 8]] as const) {
    for (const width of [1280, 320]) {
      const opened = await daemon.handle({ op: "command", session, command: "open", args: [site.origins[variant] + "/nieuws/"], options: { width: String(width) } });
      assert.equal(opened.ok, true, JSON.stringify(opened.print));
      const measured = await daemon.handle({ op: "command", session, command: "target", args: ["css:.paginering li:nth-child(2) a"], options: { wait: true } });
      assert.equal(measured.ok, true, JSON.stringify(measured.print));
      const number = (measured.print.id as string).split("-").at(-1);
      const observation = JSON.parse(readFileSync(join(run, "observations", session, number + ".json"), "utf8")) as {
        result: { methods: { method: string; result: TargetMeasurement }[] };
      };
      const layout = observation.result.methods.find(({ method }) => method === "layout-box")?.result;
      assert.ok(layout);
      assert.equal(layout.inlineInText, false);
      assert.equal(layout.largeEnough, largeEnough);
      assert.equal(layout.nearest?.gap, gap);
      assert.match(layout.nearest?.text ?? "", /^Pagina [13]$/);
      assert.equal(Boolean(layout.tooCloseTo), !largeEnough);
    }
  }
});
