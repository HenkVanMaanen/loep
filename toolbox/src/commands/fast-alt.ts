import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readJson } from "../lib/canonical.ts";
import { loadRun, type Element, type Facts } from "../lib/rundata.ts";
import { refuseUnderSeal } from "../lib/seal.ts";
import type { Finding, Verdict } from "../lib/verdict.ts";
import { sessionClient } from "../session/client.ts";
import { checkInstrumentVerdict, instrumentPending, instrumentTasks, loadInstrumentIndex, type InstrumentTask } from "./instrument-tasks.ts";

const CRITERION = "1.1.1";
const OPEN_NL = "Geen verkort eindoordeel. Volg de openstaande opdrachten.";
const uninformative = /^(?:logo|icoon|afbeelding|[^\s/<>]+\.(?:jpe?g|png|gif|svg|webp|avif|ico|bmp))$/i;

type AltFacts = Partial<Pick<Facts, "images" | "links" | "controls">>;
type Lead = { image: string; target: string; name: string; icon: boolean };
type Client = Awaited<ReturnType<typeof sessionClient>>;
type LocationHint = { heading?: string; text?: string };
type Outline = Pick<Element, "path" | "text" | "ax"> & { alt?: string; coveredBy?: string };

export function leadsFor(facts: AltFacts[]): Lead[] {
  const leads = new Map<string, Lead>();
  for (const state of facts) {
    const controls = [...(state.links ?? []), ...(state.controls ?? [])].filter((item) =>
      item.visible && item.path.length === 1 && !item.ax?.ignored &&
      (item.ax?.role === "link" || item.ax?.role === "button"));
    for (const image of state.images ?? []) {
      const selector = image.path[0];
      if (!selector || image.path.length !== 1 || !image.visible) continue;
      const parent = controls.filter((item) => selector.startsWith(`${item.path[0]} > `))
        .sort((a, b) => b.path[0]!.length - a.path[0]!.length)[0];
      if (parent && parent.ax?.name === "" && !parent.text.trim() && (image.tag === "svg" || image.tag === "img")) {
        leads.set(parent.path[0]!, { image: selector, target: parent.path[0]!, name: "", icon: true });
      } else if (!parent && image.tag === "img" && image.ax?.role === "image" && !image.ax.ignored &&
        typeof image.alt === "string" && image.alt === image.ax.name && uninformative.test(image.alt)) {
        leads.set(selector, { image: selector, target: selector, name: image.alt, icon: false });
      }
    }
  }
  return [...leads.values()];
}

async function observe(runDir: string, client: Client, task: InstrumentTask["judge"], page: string, url: string, leads: Lead[]): Promise<Finding[]> {
  const { session } = task;
  const start = await client({ op: "start", session, limits: { maxCommands: task.maxCommands, maxMinutes: task.maxMinutes } });
  if (!start.ok) return [];
  const command = (name: string, args: string[], options = {}): ReturnType<Client> =>
    client({ op: "command", session, command: name, args, options });
  try {
    const open = await command("open", [page], { "with-blockers": true });
    if (!open.ok || open.print.url !== url) return [];
    const look = await command("look", [], { full: true, max: "200" });
    const id = look.print.id;
    if (!look.ok || typeof id !== "string") return [];
    const receipt = join(runDir, "observations", session, `${id.slice(session.length + 1)}.json`);
    const { result } = await readJson<{ result: { items: Outline[] } }>(receipt);
    const findings: Finding[] = [];
    for (const lead of leads) {
      const item = result.items.find((entry) => entry.path.length === 1 && entry.path[0] === lead.target);
      if (!item?.ax || item.ax.ignored || item.coveredBy || item.ax.name !== lead.name) continue;
      if (lead.icon ? !(["link", "button"].includes(item.ax.role ?? "") && !item.text.trim()) :
        !(item.ax.role === "image" && item.alt === lead.name)) continue;
      const crop = await command("crop", [`css:${lead.image}`]);
      const place = crop.print.place as LocationHint | undefined;
      if (!crop.ok || typeof crop.print.id !== "string" || !(place?.heading || place?.text)) continue;
      findings.push({
        key: `F${findings.length + 1}`,
        titleNl: lead.icon ? "Pictogram zonder toegankelijke naam" : "Ongeschikt tekstalternatief bij afbeelding",
        observedNl: lead.icon ? "Het bedieningselement toont een pictogram. Chromium geeft het geen toegankelijke naam." :
          `Chromium geeft de afbeelding de naam ${lead.name}. Dit is een algemeen woord of een bestandsnaam.`,
        impactNl: "Wie het beeld niet ziet, kan de betekenis of functie niet uit de naam halen.",
        fixNl: lead.icon ? "Geef het bedieningselement een naam die de functie beschrijft." :
          "Geef de afbeelding een tekstalternatief dat de betekenis beschrijft. Verberg haar voor hulpsoftware als zij alleen versiering is.",
        severity: "midden",
        owner: lead.icon ? "techniek" : "content",
        component: null,
        locations: [{ page, where: lead.target, ...place }],
        pagesAffected: `Gemeten op ${page}`,
        evidence: ["images", id, crop.print.id],
      });
    }
    return findings;
  } finally {
    await client({ op: "stop", session });
  }
}

async function record(runDir: string, part: InstrumentTask["judge"], round: "judge" | "final", findings: Finding[]): Promise<void> {
  const verdict: Verdict = {
    criterion: CRITERION, outcome: "failed", rule: findings.some((finding) => finding.owner === "techniek") ? "R2" : "R3",
    summaryNl: "De verkorte meting stelde gebreken vast in de tekstalternatieven.",
    candidates: [], findings,
    observations: findings.map((finding) => ({
      checkedNl: finding.titleNl,
      howNl: "De toegankelijke naam en een uitsnede vastgelegd na het openen van de pagina.",
      observedNl: finding.observedNl, evidence: finding.evidence, ruling: "finding", finding: finding.key!,
    })),
    ...(round === "final" ? {
      verification: { judgeOutcome: "failed", findings: findings.map((finding) =>
        ({ key: finding.key!, reproduced: true, evidence: finding.evidence })) },
    } : {}),
  };
  const output = join(runDir, part.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(verdict, null, 2) + "\n", { flag: "wx" });
  try {
    const problems = await checkInstrumentVerdict(runDir, CRITERION, round);
    if (problems.length) throw new Error(problems.join("\n"));
  } catch (error) {
    await unlink(output);
    throw error;
  }
}

export async function fastAlt(runDir: string): Promise<string> {
  refuseUnderSeal(join(runDir, "tasks"));
  const index = await loadInstrumentIndex(runDir);
  const task = index.tasks[0];
  const pending = await instrumentPending(runDir);
  if (index.only.join() !== CRITERION || index.tasks.length !== 1 || task?.criterion !== CRITERION ||
      pending.phase !== "judges" || pending.siteOutage || pending.judges[0]?.criterion !== CRITERION ||
      existsSync(join(runDir, task.judge.output)) || (await readJson<unknown[]>(join(runDir, task.judge.candidates))).length) return OPEN_NL;
  const run = await loadRun(runDir);
  const page = run.pages[0];
  if (!page || run.sample.items.length !== 1 || run.login || run.writes || run.reads?.length) return OPEN_NL;
  const leads = leadsFor([page.facts, ...Object.values(run.stateEvidence ?? {})]);
  if (!leads.length || leads.length + 2 > task.judge.maxCommands) return OPEN_NL;

  const judge = await observe(runDir, await sessionClient(runDir), task.judge, page.label, page.item.url, leads);
  if (!judge.length) return OPEN_NL;
  await record(runDir, task.judge, "judge", judge);
  await instrumentTasks(runDir);
  const verify = (await loadInstrumentIndex(runDir)).tasks[0]?.verify;
  if (!verify || (await readJson<unknown[]>(join(runDir, verify.candidates))).length) return OPEN_NL;
  const final = await observe(runDir, await sessionClient(runDir), verify, page.label, page.item.url, leads);
  // A changed page goes back to the regular verifier, including when it has gained a finding.
  if (judge.length !== final.length || judge.some((finding, i) =>
    finding.locations[0]?.where !== final[i]?.locations[0]?.where || finding.observedNl !== final[i]?.observedNl)) return OPEN_NL;
  await record(runDir, verify, "final", final);
  await instrumentTasks(runDir);
  return `1.1.1 voldoet niet. ${final.length} bevindingen opnieuw vastgesteld.`;
}
