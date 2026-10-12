/**
 * Japanese instruction hints (optional, Settings → 日本語ヒント).
 * Target English (clues, the question, answers) is never translated:
 * understanding it is the game.
 */

/** Japanese for Boo's story and encouragement lines, keyed by the English. */
export const LINE_JA: Record<string, string> = {
  "Find the ghost!": "おばけを みつけよう！",
  "Oh no! Four ghosts are hiding!": "たいへん！ おばけが 4ひき かくれているよ！",
  "Find the four ghosts!": "4ひきの おばけを みつけよう！",
  "Then you can go home!": "そうしたら おうちに かえれるよ！",
  "Great job!": "よくできました！",
  "You found four ghosts!": "おばけを 4ひき みつけたね！",
  "Oh no! It moved!": "あっ！ おばけが うごいた！",
  "Oh no! It ran away!": "あっ！ にげちゃった！",
  "Catch me!": "つかまえてごらん！",
  "Listen!": "よく きいてね！",
  "Try again!": "もういちど！",
  "Nice!": "いいね！",
  "You got it!": "つかまえた！",
  "Super!": "すごい！",
  "Let's go!": "いこう！",
  "Next room!": "つぎの へやへ いこう！",
  "Look!": "みて！",
  "Go home!": "おうちへ かえろう！"
};

export const HINT = {
  moveKeys: { en: "Walk: WASD / arrow keys · Turn the camera: drag", ja: "WASD・やじるしキーで あるく ／ ドラッグで カメラ" },
  moveTouch: { en: "Walk: left stick · Turn the camera: drag", ja: "ひだりの スティックで あるく ／ ドラッグで カメラ" },
  searchKeys: { en: "E: search", ja: "E キーで しらべる" },
  searchTouch: { en: "Tap 🔍 to search", ja: "🔍 を タップして しらべる" },
  chooseKeys: { en: "Choose a place: ← → and E · Back: Esc", ja: "どこを しらべる？ ← → で えらんで E ／ もどる: Esc" },
  chooseTouch: { en: "Tap a place to search", ja: "しらべる ところを タップしてね" },
  speakKeys: { en: "Press SPACE and say it in English", ja: "スペースキーを おして えいごで いおう！" },
  speakTouch: { en: "Tap 🎤 and say it in English", ja: "🎤 を おして えいごで いおう！" },
  listening: { en: "Listening…", ja: "きいてるよ…" },
  buttons: { en: "Choose the word", ja: "ことばを えらんでね" },
  noHear: { en: "I didn't hear you. Try again!", ja: "きこえなかったよ。もういちど！" },
  wrong: { en: "Hmm? Look at the ghost. Try again!", ja: "おばけを よく みて。もういちど！" },
  micBlocked: { en: "The microphone is off. Use the buttons.", ja: "マイクが つかえないので、ボタンで こたえよう" },
  rescue: { en: "You can tap the words, too.", ja: "ことばを タップしても いいよ" },
  goDoor: { en: "Go to the open door!", ja: "あいている ドアへ いこう！" },
  locked: { en: "Locked!", ja: "まだ あかないよ" },
  exit: { en: "Walk out of the door!", ja: "ドアから そとへ でよう！" },
  replay: { en: "Listen again", ja: "もういちど きく" }
} as const;

export type HintKey = keyof typeof HINT;
