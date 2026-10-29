import { useGame } from "../game/store";
import { director } from "../game/director";
import { WING_NOTES } from "../game/guestWing";

/** A Guest Wing clue: short English (Japanese with the hints setting), read at the student's own pace. */
export function WingNote() {
  const id = useGame((s) => s.wingNote);
  const ja = useGame((s) => s.settings.japanese);
  const screen = useGame((s) => s.screen);
  if (!id || screen !== "game") return null;
  const note = WING_NOTES[id];
  const solved = id === "photo206";
  return (
    <div className="wing-note-backdrop ui" onClick={() => director.closeWingNote()}>
      <section className={`panel wing-note ${solved ? "solved" : ""}`} role="dialog" aria-label={note.title} data-testid="wing-note" data-note={id}
        onClick={(e) => e.stopPropagation()}>
        {solved && <div className="wing-note-star" aria-hidden="true">★</div>}
        <h2>{note.title}{ja && <small lang="ja">{note.titleJa}</small>}</h2>
        <ul>
          {note.lines.map((line, i) => (
            <li key={i} className={line.struck ? "struck" : undefined}>
              {line.struck
                ? <span>{line.en.split("·")[0]}· <s aria-label="name crossed out">{line.en.split("·").slice(1).join("·").trim()}</s></span>
                : line.en}
              {ja && line.ja && <small lang="ja">{line.ja}</small>}
            </li>
          ))}
        </ul>
        <button className="primary" data-testid="wing-note-close" onClick={() => director.closeWingNote()} autoFocus>
          OK{ja && <small lang="ja">とじる</small>}
        </button>
      </section>
    </div>
  );
}
