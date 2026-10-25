/**
 * Hide & Seek simulation (no renderer, clock, audio, or platform state).
 *
 * createMatch({ ghost, room, seed, level }) creates a serializable MatchState.
 * Commands mutate only the supplied state and return {ok:true} or
 * {ok:false,reason}; replaying commands and dt values reproduces the match.
 * chooseStart(state, spotId) opens the starting English question.
 * requestMove(state, spotId) reserves a destination; beginEnglish(state) opens
 * its question. answerEnglish(state, rankedAlternatives) accepts speech or a
 * button's bare preposition; only acceptance commits movement and its cost.
 * cancelMove(state) closes either question/reservation without spending.
 * useAbility(state, targetSpotId?) costs the match's single ability; Hungry and
 * Mischief require a target from abilityTargets(state), without English.
 * reachableSpots(state) gives valid starts or currently reachable relocations.
 * step(state, dtSeconds) advances deterministic 50 ms ticks and returns new
 * events. It changes nothing while English is open. takeEvents(state) drains
 * the persistent event queue, including events emitted by commands.
 *
 * Events: announce (spoken line, Beginner-only highlight), detectivePath,
 * detectiveArrive, searchStart, searchEmpty, found, caughtInOpen, clue,
 * abilityFx, won, lost. Render state.detective's x/z/yaw/anim and state's
 * ghost x/y/z/transit/hidden/invisible, effects.decoy/bubbles/music,
 * detective.suspicion, searchesLeft, relocationsLeft, and abilityUsed.
 * stats.firstTryAccuracy is a fraction in [0,1] (0 before any answer).
 * level controls English help only; detective difficulty is identical.
 * Callers may JSON round-trip state at any time, including during transit.
 */
export * from "./types";
export * from "./match";
export { sentenceFor, placePhrase, accept, announceLine, emptyLine, foundLine } from "./english";
