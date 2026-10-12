import { Fragment } from "react";
import { PREPS } from "../game/types";

/** Renders English with the target prepositions highlighted. */
export function PrepText({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((p, i) => {
        const word = p.toLowerCase().replace(/[^a-z]/g, "");
        if ((PREPS as readonly string[]).includes(word) && p.trim()) {
          const m = p.match(/^([A-Za-z]+)(.*)$/);
          return (
            <Fragment key={i}>
              <b className="prep">{m ? m[1] : p}</b>
              {m ? m[2] : ""}
            </Fragment>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/** Japanese hint line shown only when Japanese hints are on. */
export function Ja({ children, on }: { children: string; on: boolean }) {
  if (!on) return null;
  return (
    <span className="ja" lang="ja">
      {children}
    </span>
  );
}
