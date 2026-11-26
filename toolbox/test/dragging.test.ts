import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { INPAGE_PATH, launchBrowser, newContext } from "../src/browser/session.ts";
import { collectFacts } from "../src/instruments/facts.ts";
import { dragReport } from "../src/instruments/drag.ts";

test("the drag evidence names late listeners, alternatives and frames that cannot be read", async () => {
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html");
    if (request.url === "/gone") {
      response.writeHead(404).end("<p>Niet gevonden</p>");
      return;
    }
    response.end(`<!doctype html><html lang="nl"><body>
      <button id="open">Openen</button>
      <input id="native" type="range">
      <div id="quiet">Geen bediening</div>
      <fieldset id="filters" hidden>
        <div id="track" style="width: 220px; height: 32px; position: relative">
          <div id="thumb" role="slider" aria-label="Prijs" aria-valuenow="50" aria-orientation="horizontal" style="width: 32px; height: 32px; cursor: grab"></div>
        </div>
        <button id="alternative" aria-controls="thumb" type="button">Halveer</button>
      </fieldset>
      <iframe title="Geladen venster" srcdoc="<canvas id='pad'></canvas>"></iframe>
      <iframe title="Mislukt venster" src="/gone"></iframe>
      <iframe title="Tegengehouden venster" src="/blocked?waarde=prive"></iframe>
      <script>
        document.querySelector("#open").addEventListener("click", () => {
          document.querySelector("#filters").hidden = false;
          const thumb = document.querySelector("#thumb");
          const setValue = () => thumb.setAttribute("aria-valuenow", "25");
          thumb.addEventListener("pointermove", (event) => { if (event.buttons) setValue(); });
          document.querySelector("#track").ondragover = () => {};
          document.querySelector("#alternative").addEventListener("click", setValue);
        });
      </script>
      </body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const browser = await launchBrowser();
    try {
      const context = await newContext(browser, { writes: null });
      await context.addInitScript({ path: INPAGE_PATH });
      const page = await context.newPage();
      await page.route(`${origin}/blocked?*`, (route) => route.abort());
      await page.goto(origin);
      const before = await dragReport(page);
      assert.ok("signals" in before.document, JSON.stringify(before.document));
      const initial = before.document.signals.candidates;
      assert.deepEqual(initial.filter((candidate) => candidate.rendered).map((candidate) => candidate.where), ["#native"]);
      assert.ok(initial.find((candidate) => candidate.where === "#native")?.signals.includes("input[range]"));
      const loaded = before.frames.find((frame) => frame.title === "Geladen venster");
      assert.ok(loaded && "signals" in loaded);
      assert.equal(loaded.signals.candidates[0]?.where, "#pad");
      const failed = before.frames.find((frame) => frame.title === "Mislukt venster");
      assert.ok(failed && "notReadNl" in failed);
      assert.match(failed.notReadNl, /404/);
      const blocked = before.frames.find((frame) => frame.title === "Tegengehouden venster");
      assert.ok(blocked && "notReadNl" in blocked);
      assert.equal(blocked.address, `${origin}/blocked`);

      await page.locator("#open").click();
      const facts = await collectFacts(page);
      const after = facts.dragging as Awaited<ReturnType<typeof dragReport>>;
      assert.ok("signals" in after.document);
      const thumb = after.document.signals.candidates.find((candidate) => candidate.where === "#thumb");
      assert.deepEqual(thumb?.signals, ["pointermove", "role=slider", "cursor=grab"]);
      assert.equal(thumb?.orientation, "horizontal");
      assert.equal(thumb?.value, "50");
      assert.deepEqual(thumb?.alternatives, [{ where: "#alternative", label: "Halveer" }]);
      assert.deepEqual(after.document.signals.candidates.find((candidate) => candidate.where === "#track")?.signals, ["dragover"]);
      const handle = page.locator("#thumb");
      const box = (await handle.boundingBox())!;
      await page.mouse.move(box.x + 5, box.y + 5);
      await page.mouse.down();
      await page.mouse.move(box.x + 15, box.y + 5, { steps: 3 });
      await page.mouse.up();
      assert.equal(await handle.getAttribute("aria-valuenow"), "25");
      await page.reload();
      await page.locator("#open").click();
      await page.locator("#alternative").click();
      assert.equal(await handle.getAttribute("aria-valuenow"), "25");
    } finally {
      await browser.close();
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
