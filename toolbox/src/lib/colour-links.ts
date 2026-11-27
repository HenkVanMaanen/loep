import type { Facts, RunData } from "./rundata.ts";

const normalized = (text: string | null | undefined): string => (text ?? "").replace(/\s+/g, " ").trim();

/** Locate links worth checking in context, without treating repeated DOM paths as repeated visual evidence. */
export function colourLinks(run: RunData) {
  type Lead = { where: string; text: string; context: string; region: string | null; sentence: string | null; parent: string | null };
  const leads = new Map<string, Lead & { views: string[] }>();
  const take = (view: string, links: Facts["links"] | undefined) => {
    if (!links) return { linksExamined: null, leads: null };
    // Visual information can be hidden from the accessibility tree and still matter for 1.4.1.
    const visible = links.filter((link) => link.visible);
    let leadCount = 0;
    for (const link of visible) {
      const text = normalized(link.text || link.coveredText);
      const sentence = link.sentenceFrom ? normalized(link.sentence) : "";
      // A scoped sentence containing just the link says nothing about surrounding prose elsewhere.
      // Keep unscoped links as leads: prose can also occur in a div, span or custom element.
      if (sentence && sentence === text) continue;
      const lead = { where: link.path.join(" >>> "), text, context: link.context, region: link.region, sentence: sentence || null, parent: link.parentTag ?? null };
      const key = JSON.stringify(lead);
      const row = leads.get(key) ?? { ...lead, views: [] };
      row.views.push(view);
      leads.set(key, row);
      leadCount++;
    }
    return { linksExamined: visible.length, leads: leadCount };
  };

  const pages = run.pages.map((page) => ({ page: page.label, ...take(page.label, page.facts.links) }));
  const pageLabels = new Map(run.pages.map((page) => [page.item.url, page.label]));
  const states = (run.siteStates?.states ?? []).map((state) => ({
    state: state.id,
    page: state.url ? pageLabels.get(state.url) ?? null : null,
    reached: state.reached,
    ...take(state.id, state.reached ? run.stateEvidence?.[state.id]?.links : undefined),
  }));
  return {
    method: "Geteld zijn zichtbare links in de vastgelegde begintoestanden en geopende toestanden. Null betekent dat er geen linkgegevens zijn, 0 dat er geen links zijn gevonden. Een rij onder leads wijst naar een link met andere tekst in het omliggende element, of naar een link waarvan die context onbekend is. Stel op beeld vast of de link in lopende tekst staat en hoe hij zich onderscheidt. Kijk ook naar de overige inhoud op beeld. Dezelfde plaats kan er per toestand of kleurenschema anders uitzien; views groepeert alleen de vindplaatsen. De bestanden en hoe je de toestanden opent staan in siteStates.",
    pages,
    states,
    leads: [...leads.values()],
  };
}
