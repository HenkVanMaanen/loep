import assert from "node:assert/strict";
import { test } from "node:test";
import { leadsFor } from "../src/commands/fast-alt.ts";
import type { Element, Facts } from "../src/lib/rundata.ts";

function element(tag: string, selector: string, role: string, name: string | null): Element {
  return {
    tag, path: [selector], box: { x: 0, y: 0, width: 24, height: 24 }, visible: true,
    text: "", region: null, roleAttr: null, ariaLabel: null, ariaHidden: false, lang: null,
    ax: { role, name, ignored: false, description: null, properties: {} },
  };
}

function image(selector: string, alt: string | null, tag = "img"): Facts["images"][number] {
  return { ...element(tag, selector, "image", alt), alt, src: null, svgTitle: null,
    inInteractive: null, interactiveText: "", context: "" };
}

function link(selector: string, name: string): Facts["links"][number] {
  return { ...element("a", selector, "link", name), href: "/contact", target: null, context: "", sentence: null };
}

test("fast 1.1.1 leads join visible images to control names and retain state-only alternatives", () => {
  const page = {
    images: [image("#partner", "IMG_2041.jpg"), image("#social > svg", null, "svg"),
      image("#contact > svg", null, "svg"), image("#named > img", "logo"), image("#footer", "Gemeente Lindewaard"),
      { ...image("#hidden", "logo"), visible: false },
      { ...image("#another-frame", "logo"), path: ["iframe", "#another-frame"] },
      { ...image("#override", "logo"), ax: element("img", "#override", "image", "Gemeente Lindewaard").ax! }],
    links: [link("#social", ""), link("#contact", "Contact"), link("#named", "Naar de startpagina")],
  };
  assert.deepEqual(leadsFor([page, { images: [image("#cookies > img", "logo")] }, page]), [
    { image: "#partner", target: "#partner", name: "IMG_2041.jpg", icon: false },
    { image: "#social > svg", target: "#social", name: "", icon: true },
    { image: "#cookies > img", target: "#cookies > img", name: "logo", icon: false },
  ]);
});
