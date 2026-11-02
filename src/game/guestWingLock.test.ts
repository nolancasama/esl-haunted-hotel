import { afterEach, describe, expect, it, vi } from "vitest";
import { doorAccess } from "./guestWing";
import { getGame, loadGuestWingUnlocked, saveGuestWingUnlocked, setGame } from "./store";

describe("Guest Wing completion lock migration", () => {
  const old = { mode: getGame().mode, guestWingUnlocked: getGame().guestWingUnlocked };
  const values = new Map<string, string>();
  function stubStorage() {
    values.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); }
    });
  }
  afterEach(() => {
    setGame(old);
    vi.unstubAllGlobals();
    values.clear();
  });

  it("ignores stale v1 unlocked flags from old builds without removing other progress", () => {
    stubStorage();
    values.set("hh.guestwing.v1", "1");
    values.set("hh.ch2.v1", "1");
    values.set("hh.hideseek.v1", "1");
    expect(loadGuestWingUnlocked()).toBe(false);
    setGame({ mode: "story", guestWingUnlocked: loadGuestWingUnlocked() });
    for (const id of ["guestwing", "g201", "g202", "g203", "g204", "g205", "g206"])
      expect(doorAccess(id), id).toBe("locked");
    expect(values.get("hh.ch2.v1")).toBe("1");
    expect(values.get("hh.hideseek.v1")).toBe("1");
  });

  it("opens only after a new explicit Chapter 2 completion and retains it across reloads", () => {
    stubStorage();
    values.set("hh.guestwing.v1", "1");
    setGame({ mode: "story", guestWingUnlocked: loadGuestWingUnlocked() });
    expect(doorAccess("guestwing")).toBe("locked");
    saveGuestWingUnlocked(); // Called by the story director only at Chapter 2's ending.
    expect(values.get("hh.guestwing.chapter2.v2")).toBe("1");
    expect(loadGuestWingUnlocked()).toBe(true);
    expect(doorAccess("guestwing")).toBe("open");
  });
});
