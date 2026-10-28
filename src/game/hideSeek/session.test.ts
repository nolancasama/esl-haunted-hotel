import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../director", () => ({ director: { toTitle: vi.fn() } }));
vi.mock("../../audio/audio", () => ({ audio: { unlock: vi.fn(), setVolumes: vi.fn(), setListening: vi.fn(), setHeartbeat: vi.fn(), play: vi.fn() } }));
vi.mock("../../audio/tts", () => ({ tts: { cancel: vi.fn(), setRate: vi.fn(), speak: vi.fn().mockResolvedValue(undefined) } }));
import { audio } from "../../audio/audio";
import { setGame } from "../store";
import { backFromHideSeekEnglish, command, decideHideSeek, getHideSeek, hideSeekSnapshot, hsPresentation, leaveHideSeek, pickSpot, setHideSeekTimeScale, setPickMode, startHideSeek, stayHere, tickHideSeek } from "./session";

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
    expect(getHideSeek().decision).toMatchObject({ phase: "decision", secondsLeft: 5 });
    tickHideSeek(0.1);
    expect(getHideSeek().match!.time).toBe(0);
    expect(getHideSeek().decision).toBeNull();
    tickHideSeek(0.1);
    expect(getHideSeek().match!.time).toBeGreaterThan(0);
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

  it("Back returns to the original spot picker without starting the match", () => {
    expect(pickSpot("dining.table.under")).toEqual({ ok: true });
    expect(getHideSeek().match!.english?.starting).toBe(true);
    expect(backFromHideSeekEnglish()).toEqual({ ok: true });
    expect(getHideSeek().match!.english).toBeNull();
    expect(getHideSeek().match!.status).toBe("setup");
    expect(getHideSeek().pickMode).toBe("start");
    expect(getHideSeek().match!.stats.questions).toBe(0);
  });

  it("Back restores the relocation picker and its paused time without spending a move", () => {
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    expect(decideHideSeek("move")).toEqual({ ok: true });
    hsPresentation.cameraSettling = false;
    tickHideSeek(0.5);
    const remaining = getHideSeek().decision!.secondsLeft;
    const next = hideSeekSnapshot()!.reachable[0];
    expect(pickSpot(next.id)).toEqual({ ok: true });
    expect(getHideSeek().decision).toBeNull();
    expect(getHideSeek().suspendedDestination?.secondsLeft).toBeCloseTo(remaining);
    expect(backFromHideSeekEnglish()).toEqual({ ok: true });
    expect(getHideSeek().decision).toMatchObject({ phase: "destination", secondsLeft: remaining });
    expect(getHideSeek().pickMode).toBe("move");
    expect(getHideSeek().match!.english).toBeNull();
    expect(getHideSeek().match!.relocationsLeft).toBe(2);
    expect(getHideSeek().match!.stats.relocations).toBe(0);
    expect(pickSpot(next.id)).toEqual({ ok: true });
    expect(command("answerEnglish", [next.prep])).toEqual({ ok: true });
    expect(getHideSeek().suspendedDestination).toBeNull();
    expect(getHideSeek().match!.relocationsLeft).toBe(1);
  });

  it("sustains Melody's music only while simulation advances, not during a timed decision or English", () => {
    startHideSeek("melody", "dining", 4, "standard");
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    command("useAbility");
    for (let i = 0; i < 4; i++) tickHideSeek(0.5);
    expect(getHideSeek().match!.time).toBe(0);
    expect(vi.mocked(audio.play).mock.calls.filter(([name]) => name === "musicbox")).toHaveLength(1);
    expect(setPickMode("move")).toEqual({ ok: true });
    const next = hideSeekSnapshot()!.reachable[0];
    pickSpot(next.id);
    expect(getHideSeek().match!.english).not.toBeNull();
    const before = getHideSeek().match!.effects.music!.remaining;
    setHideSeekTimeScale(50);
    for (let i = 0; i < 4; i++) tickHideSeek(0.5);
    expect(getHideSeek().match!.effects.music!.remaining).toBe(before);
    expect(vi.mocked(audio.play).mock.calls.filter(([name]) => name === "musicbox")).toHaveLength(1);
    setHideSeekTimeScale(1);
    expect(command("answerEnglish", [next.prep])).toEqual({ ok: true });
    for (let i = 0; i < 4; i++) tickHideSeek(0.5);
    expect(vi.mocked(audio.play).mock.calls.filter(([name]) => name === "musicbox")).toHaveLength(2);
  });

  it("pauses detective and suspicion during five-second decision, then resumes on Stay", () => {
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    const m = getHideSeek().match!;
    const pose = JSON.stringify(m);
    for (let i = 0; i < 4; i++) tickHideSeek(0.5);
    expect(getHideSeek().decision?.phase).toBe("decision");
    expect(getHideSeek().decision?.secondsLeft).toBeCloseTo(3);
    expect(JSON.stringify(m)).toBe(pose);
    expect(decideHideSeek("stay")).toEqual({ ok: true });
    expect(getHideSeek().decision).toBeNull();
    tickHideSeek(0.25);
    expect(m.time).toBeGreaterThan(0);
  });

  it("opens a ten-second destination choice and does not charge for its timeout", () => {
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    const m = getHideSeek().match!;
    expect(decideHideSeek("move")).toEqual({ ok: true });
    expect(getHideSeek().decision).toMatchObject({ phase: "destination", secondsLeft: 10 });
    expect(getHideSeek().pickMode).toBe("move");
    for (let i = 0; i < 8; i++) tickHideSeek(0.5);
    expect(m.time).toBe(0);
    expect(getHideSeek().decision?.secondsLeft).toBeCloseTo(6);
    for (let i = 0; i < 12; i++) tickHideSeek(0.5);
    expect(getHideSeek().decision).toBeNull();
    expect(getHideSeek().pickMode).toBeNull();
    expect(m.relocationsLeft).toBe(2);
    expect(m.stats.relocations).toBe(0);
  });

  it("freezes the move countdown after choosing a valid spot and waits for English", () => {
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    decideHideSeek("move");
    const spot = hideSeekSnapshot()!.reachable[0];
    expect(pickSpot(spot.id)).toEqual({ ok: true });
    expect(getHideSeek().decision).toBeNull();
    expect(getHideSeek().match!.english?.spotId).toBe(spot.id);
    const time = getHideSeek().match!.time;
    tickHideSeek(20);
    expect(getHideSeek().match!.time).toBe(time);
    expect(getHideSeek().match!.relocationsLeft).toBe(2);
    expect(command("answerEnglish", [spot.prep])).toEqual({ ok: true });
    expect(getHideSeek().match!.relocationsLeft).toBe(1);
  });

  it("cancels a destination selection as Stay and keeps the movement budget", () => {
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    decideHideSeek("move");
    expect(stayHere()).toEqual({ ok: true });
    expect(getHideSeek().decision).toBeNull();
    expect(getHideSeek().match!.relocationsLeft).toBe(2);
  });

  it("stops its clock on other screens and discards the session on exit", () => {
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    setGame({ screen: "title" });
    tickHideSeek(1);
    expect(getHideSeek().match!.time).toBe(0);
    leaveHideSeek();
    expect(hideSeekSnapshot()).toBeNull();
    expect(audio.setHeartbeat).toHaveBeenCalledWith(0);
  });

  it("never spends a decision countdown while the camera is still travelling", () => {
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    hsPresentation.cameraSettling = true;
    tickHideSeek(0.5);
    tickHideSeek(0.5);
    expect(getHideSeek().decision).toMatchObject({ phase: "decision", secondsLeft: 5 });
    expect(getHideSeek().match!.time).toBe(0);
    hsPresentation.cameraSettling = false;
    tickHideSeek(0.5);
    expect(getHideSeek().decision!.secondsLeft).toBeCloseTo(4.5);
    expect(decideHideSeek("move")).toEqual({ ok: true });
    hsPresentation.cameraSettling = true;
    tickHideSeek(0.5);
    expect(getHideSeek().decision).toMatchObject({ phase: "destination", secondsLeft: 10 });
    hsPresentation.cameraSettling = false;
  });

  it("stamps the end of a match for the closing shot", () => {
    pickSpot("dining.table.under");
    command("answerEnglish", ["under"]);
    decideHideSeek("stay");
    expect(getHideSeek().endedAt).toBeNull();
    setHideSeekTimeScale(20);
    for (let i = 0; i < 4000 && getHideSeek().match!.status === "playing"; i++) {
      if (getHideSeek().decision) decideHideSeek("stay");
      tickHideSeek(0.5);
    }
    expect(getHideSeek().match!.status).not.toBe("playing");
    expect(getHideSeek().endedAt).not.toBeNull();
  });
});
