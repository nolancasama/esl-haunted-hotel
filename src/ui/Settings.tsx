import type { CSSProperties } from "react";
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
      <span className="sr-only">{value ? "ON" : "OFF"}</span>
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
      <div className="panel modal settings-modal" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()} data-testid="settings-modal">
        <h2>
          Settings <small lang="ja">せってい</small>
        </h2>
        <div className="settings-body">
          <section className="settings-section">
            <h3>Speech <small lang="ja">はなす</small></h3>
            <Row label="Speak answers (microphone)" ja="マイクで こたえる">
              <Toggle value={s.mic} onChange={(v) => set({ mic: v })} testId="toggle-mic" />
            </Row>
            {!recognition.supported && <p className="note" lang="ja">このブラウザでは マイクが つかえません。ボタンで こたえます。</p>}
            {recognition.supported && micState === "blocked" && s.mic && (
              <p className="note" lang="ja">マイクが ブロックされています。ボタンで こたえます。</p>
            )}
            <Row label="Slow English voice" ja="ゆっくり よむ">
              <Toggle value={s.slowVoice} onChange={(v) => set({ slowVoice: v })} />
            </Row>
          </section>
          <section className="settings-section">
            <h3>Sound <small lang="ja">おと</small></h3>
            <Row label="Music volume" ja="おんがく">
              <input type="range" min={0} max={1} step={0.05} value={s.music} style={{ "--fill": `${s.music * 100}%` } as CSSProperties} onChange={(e) => set({ music: Number(e.target.value) })} />
            </Row>
            <Row label="Sound effects volume" ja="こうかおん">
              <input type="range" min={0} max={1} step={0.05} value={s.sfx} style={{ "--fill": `${s.sfx * 100}%` } as CSSProperties} onChange={(e) => set({ sfx: Number(e.target.value) })} />
            </Row>
          </section>
          <section className="settings-section">
            <h3>Language <small lang="ja">ことば</small></h3>
            <div className="setting-row english-help">
              <span className="setting-label" id="english-help-label">English help<small lang="ja">えいごのヒント</small></span>
              <div className="english-levels" role="group" aria-labelledby="english-help-label">
                {([
                  ["beginner", "Beginner", "かんたん"],
                  ["standard", "Standard", "ふつう"],
                  ["advanced", "Advanced", "むずかしい"]
                ] as const).map(([level, en, ja]) => (
                  <button key={level} type="button" className="btn-secondary secondary" aria-pressed={s.englishLevel === level} onClick={() => set({ englishLevel: level })} data-testid={`english-${level}`}>
                    {en}<small lang="ja">{ja}</small>
                  </button>
                ))}
              </div>
            </div>
            <Row label="Japanese hints" ja="にほんごの ヒント">
              <Toggle value={s.japanese} onChange={(v) => set({ japanese: v })} testId="toggle-ja" />
            </Row>
          </section>
          <section className="settings-section">
            <h3>Camera <small lang="ja">カメラ</small></h3>
            <Row label="Camera speed" ja="カメラの はやさ">
              <input
                type="range"
                min={0.3}
                max={2}
                step={0.1}
                value={s.cameraSensitivity}
                style={{ "--fill": `${((s.cameraSensitivity - 0.3) / 1.7) * 100}%` } as CSSProperties}
                onChange={(e) => set({ cameraSensitivity: Number(e.target.value) })}
              />
            </Row>
          </section>
        </div>
        <div className="modal-buttons">
          {screen === "game" && (
            <button className="btn-secondary secondary" onClick={() => director.toTitle()}>
              Title <small lang="ja">タイトルへ</small>
            </button>
          )}
          <button className="btn-primary primary" onClick={() => setGame({ settingsOpen: false })} data-testid="settings-close">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
