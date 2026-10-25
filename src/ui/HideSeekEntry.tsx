import { setGame, useGame } from "../game/store";

/** Entry screen reserved for the separately built Hide & Seek game. */
export function HideSeekEntry() {
  const screen = useGame((s) => s.screen);
  if (screen !== "hideseek") return null;
  return (
    <div className="title-screen ui" data-testid="hideseek">
      <div className="panel title-card">
        <h1 className="stage-heading">Hide &amp; Seek <small lang="ja">かくれんぼ</small></h1>
        <button className="btn-secondary secondary" data-testid="hideseek-back" autoFocus onClick={() => setGame({ screen: "title" })}>
          Back <small lang="ja">もどる</small>
        </button>
      </div>
    </div>
  );
}
