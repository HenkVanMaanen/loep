import type { Frame, Page } from "playwright";
import { call } from "../browser/call.ts";
import { ownWorld } from "../browser/world.ts";
import { addressOf } from "../lib/reads.ts";
import { withinTime } from "./limit.ts";

interface DragSignals {
  delegated: Record<string, string[]>;
  customElements: string[];
  candidates: {
    where: string;
    tag: string;
    label: string;
    signals: string[];
    rendered: boolean;
    orientation?: string;
    value?: string;
    alternatives: { where: string; label: string }[];
    alternativesOmitted?: number;
  }[];
  omitted: number;
}

type DragDocument = { signals: DragSignals } | { notReadNl: string };

export interface DragReport {
  document: DragDocument;
  frames: ({ address: string; title: string | null; rendered: boolean | null } & DragDocument)[];
}

/** Only the address needed to identify the frame, with no query or inline data. */
function frameAddress(address: string): string {
  if (/^https?:\/\//.test(address)) return addressOf(address);
  if (address.startsWith("about:")) return address.split(/[?#]/)[0]!;
  return address.match(/^[a-z-]+:/i)?.[0] ?? "about:blank";
}

async function readFrame(frame: Frame): Promise<DragReport["frames"][number]> {
  const current = frame.url();
  const source = await withinTime(2000, async () => {
    const element = await frame.frameElement();
    try {
      return await element.evaluate((node) => {
        const frame = node as HTMLIFrameElement;
        const box = frame.getBoundingClientRect();
        return {
          declared: frame.hasAttribute("srcdoc") || !frame.getAttribute("src") ? null : frame.src,
          title: frame.getAttribute("title") || frame.getAttribute("aria-label"),
          rendered: box.width > 0 && box.height > 0 && frame.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
        };
      });
    } finally {
      await element.dispose().catch(() => undefined);
    }
  });
  const details = { address: frameAddress(current), title: source.ok ? source.value.title : null, rendered: source.ok ? source.value.rendered : null };
  const declared = source.ok ? source.value.declared : null;
  if (declared && /^(?:about:blank|chrome-error:|$)/.test(current) && current !== declared) {
    return { ...details, address: frameAddress(declared), notReadNl: "het opgegeven adres was niet geladen in het venster" };
  }
  const read = await withinTime(2000, () => ownWorld(frame).evaluate<DragSignals>(() => {
    const library = (window as unknown as { __loep?: { watched: () => boolean; dragSignals: () => DragSignals } }).__loep;
    if (!library?.watched()) throw new Error("de meethulp was niet beschikbaar in het venster");
    return library.dragSignals();
  }));
  return read.ok ? { ...details, signals: read.value } : { ...details, notReadNl: read.reason };
}

/** Read controls where they stand, with no changes to the page or its frames. */
export async function dragReport(page: Page): Promise<DragReport> {
  const read = await withinTime(2000, () => call<DragSignals>(page, "dragSignals"));
  return {
    document: read.ok ? { signals: read.value } : { notReadNl: read.reason },
    frames: await Promise.all(page.frames().filter((frame) => frame !== page.mainFrame()).map(readFrame)),
  };
}
