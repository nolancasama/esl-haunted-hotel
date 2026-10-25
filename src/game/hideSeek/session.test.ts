import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../director", () => ({ director: { toTitle: vi.fn() } }));
vi.mock("../../audio/audio", () => ({ audio: { unlock: vi.fn(), setVolumes: vi.fn(), setListening: vi.fn(), play: vi.fn() } }));
vi.mock("../../audio/tts", () => ({ tts: { cancel: vi.fn(), setRate: vi.fn(), speak: vi.fn().mockResolvedValue(undefined) } }));
import { audio } from "../../audio/audio";
import { setGame } from "../store";
import { command, getHideSeek, hideSeekSnapshot, leaveHideSeek, pickSpot, setHideSeekTimeScale, setPickMode, startHideSeek, tickHideSeek } from "./session";

beforeEach(() => {
  vi.clearAllMocks();
  setGame({ screen: "hideseek", settingsOpen: false });
  startHideSeek("shadow", "dining", 4, "standard");
});

describe("Hide & Seek session boundary", () => {
  it("freezes the canonical match during English at any test pace, including retries", () => {
    expect(pickSpot("dining.table.under")).toEqual({ ok: true });
    const before = JSON.stringify(getHideSeek().match);
    setHideSeekTimeScale(50);
    tickHideSeek(0.5);
    expect(JSON.stringify(getHideSeek().match)).toBe(before);
    expect(command("answerEnglish", ["on"])).toEqual({ ok: false, reason: "answer-not-accepted" });
    tickHideSeek(0.5);
    expect(getHideSeek().match!.time).toBe(0);
    expect(command("answerEnglish", ["under"])).toEqual({ ok: true });
    tickHideSeek(0.1);
    expect(getHideSeek().match!.time).toBe(5);
    expect(getHideSeek().match!.stats.firstTryAccuracy).toBe(0);
  });

  it("routes each drained ability event once and exposes a detached snapshot", () => {
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    expect(command("useAbility")).toEqual({ ok: true });
    tickHideSeek(0);
    tickHideSeek(0);
    expect(vi.mocked(audio.play).mock.calls.filter(([name]) => name === "blackout")).toHaveLength(1);
    const snapshot = hideSeekSnapshot()!;
    snapshot.detective.x = 999;
    snapshot.ghost.spotId = "wrong";
    expect(getHideSeek().match!.detective.x).not.toBe(999);
    expect(getHideSeek().match!.ghost.spotId).toBe("dining.table.under");
    expect(snapshot.spots.length).toBeGreaterThanOrEqual(11);
    expect(command("useAbility")).toEqual({ ok: false, reason: "ability-used" });
    expect(getHideSeek().message).toContain("once");
  });

  it("uses core reservations for picker moves and cancels without paying a relocation", () => {
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    expect(setPickMode("move")).toEqual({ ok: true });
    const spot = hideSeekSnapshot()!.reachable[0];
    expect(pickSpot(spot.id)).toEqual({ ok: true });
    expect(getHideSeek().match!.english?.spotId).toBe(spot.id);
    expect(getHideSeek().match!.relocationsLeft).toBe(2);
    command("cancelMove");
    expect(getHideSeek().match!.english).toBeNull();
    expect(getHideSeek().match!.relocationsLeft).toBe(2);
  });

  it("sustains Melody's music only while its simulation effect advances", () => {
    startHideSeek("melody", "dining", 4, "standard");
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    command("useAbility");
    for (let i = 0; i < 4; i++) tickHideSeek(0.5);
    expect(vi.mocked(audio.play).mock.calls.filter(([name]) => name === "musicbox")).toHaveLength(2);
    setPickMode("move");
    const next = hideSeekSnapshot()!.reachable[0];
    pickSpot(next.id);
    expect(getHideSeek().match!.english).not.toBeNull();
    const before = getHideSeek().match!.effects.music!.remaining;
    setHideSeekTimeScale(50);
    for (let i = 0; i < 4; i++) tickHideSeek(0.5);
    expect(getHideSeek().match!.effects.music!.remaining).toBe(before);
    expect(vi.mocked(audio.play).mock.calls.filter(([name]) => name === "musicbox")).toHaveLength(2);
  });

  it("stops its clock on other screens and discards the session on exit", () => {
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    setGame({ screen: "title" });
    tickHideSeek(1);
    expect(getHideSeek().match!.time).toBe(0);
    leaveHideSeek();
    expect(hideSeekSnapshot()).toBeNull();
  });
});
