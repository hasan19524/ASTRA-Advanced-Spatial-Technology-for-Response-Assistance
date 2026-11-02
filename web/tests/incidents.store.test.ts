import { describe, it, expect, beforeEach } from "vitest";
import { useIncidents } from "../src/stores/incidents";

const makeInc = (id: string, verification = "UNVERIFIED") => ({
  id,
  title: "t",
  category: "Fire",
  latitude: 0,
  longitude: 0,
  sensitivity: "PUBLIC",
  assessment_status: "MAYBE_TRUE",
  visibility: "PUBLIC_UNVERIFIED",
  verification,
  response_phase: "NONE",
  lifecycle: "OPEN",
  report_count: 0,
  created_at: "t",
  updated_at: "t",
});

describe("incidents store", () => {
  beforeEach(() => {
    const s = useIncidents.getState();
    s.items = [];
    s.total = 0;
  });

  it("prepend does not duplicate an existing item", () => {
    const inc = makeInc("a");
    useIncidents.getState().prepend(inc);
    useIncidents.getState().prepend(inc);
    const s = useIncidents.getState();
    expect(s.items).toHaveLength(1);
    expect(s.total).toBe(1);
  });

  it("prepend adds new items to the front", () => {
    useIncidents.getState().prepend(makeInc("a"));
    useIncidents.getState().prepend(makeInc("b"));
    const s = useIncidents.getState();
    expect(s.items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("replace updates an existing item in place", () => {
    useIncidents.getState().prepend(makeInc("a", "UNVERIFIED"));
    useIncidents.getState().replace({ ...makeInc("a", "VERIFIED") });
    const s = useIncidents.getState();
    expect(s.items).toHaveLength(1);
    expect(s.items[0].verification).toBe("VERIFIED");
  });

  it("replace does not duplicate when id is absent", () => {
    useIncidents.getState().prepend(makeInc("a"));
    useIncidents.getState().replace(makeInc("b"));
    const s = useIncidents.getState();
    expect(s.items).toHaveLength(1);
    expect(s.items[0].id).toBe("a");
  });
});
