import { useGame, setGame } from "../game/store";
import { director } from "../game/director";
import { recognition } from "../audio/recognition";

function Row({ label, ja, children }: { label: string; ja: string; children: React.ReactNode }) {
  return (
    <label className="setting-row">
      <span className="setting-label">
        {label}
        <small lang="ja">{ja}</small>
      </span>
      {children}
    </label>
  );
}

function Toggle({ value, onChange, testId }: { value: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <button
      type="button"
      className={`toggle ${value ? "on" : ""}`}
      onClick={() => onChange(!value)}
      aria-pressed={value}
      data-testid={testId}
    >
      <span>{value ? "ON" : "OFF"}</span>
    </button>
  );
}

export function SettingsModal() {
  const open = useGame((s) => s.settingsOpen);
  const s = useGame((st) => st.settings);
  const screen = useGame((st) => st.screen);
  const micState = useGame((st) => st.micState);
  if (!open) return null;
  const set = director.updateSettings;
  return (
    <div className="modal-backdrop ui" onClick={() => setGame({ settingsOpen: false })}>
      <div className="modal" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()} data-testid="settings-modal">
        <h2>
          Settings <small lang="ja">せってい</small>
        </h2>
        <Row label="Speak answers (microphone)" ja="マイクで こたえる">
          <Toggle value={s.mic} onChange={(v) => set({ mic: v })} testId="toggle-mic" />
        </Row>
        {!recognition.supported && <p className="note" lang="ja">このブラウザでは マイクが つかえません。ボタンで こたえます。</p>}
        {recognition.supported && micState === "blocked" && s.mic && (
          <p className="note" lang="ja">マイクが ブロックされています。ボタンで こたえます。</p>
        )}
        <Row label="Music volume" ja="おんがく">
          <input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => set({ music: Number(e.target.value) })} />
        </Row>
        <Row label="Sound effects volume" ja="こうかおん">
          <input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => set({ sfx: Number(e.target.value) })} />
        </Row>
        <Row label="Japanese hints" ja="にほんごの ヒント">
          <Toggle value={s.japanese} onChange={(v) => set({ japanese: v })} testId="toggle-ja" />
        </Row>
        <Row label="Slow English voice" ja="ゆっくり よむ">
          <Toggle value={s.slowVoice} onChange={(v) => set({ slowVoice: v })} />
        </Row>
        <Row label="Camera speed" ja="カメラの はやさ">
          <input
            type="range"
            min={0.3}
            max={2}
            step={0.1}
            value={s.cameraSensitivity}
            onChange={(e) => set({ cameraSensitivity: Number(e.target.value) })}
          />
        </Row>
        <div className="modal-buttons">
          {screen === "game" && (
            <button className="secondary" onClick={() => director.toTitle()}>
              Title <small lang="ja">タイトルへ</small>
            </button>
          )}
          <button className="primary" onClick={() => setGame({ settingsOpen: false })} data-testid="settings-close">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
