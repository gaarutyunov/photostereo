// Scoped styles for the converter, injected into its Shadow DOM (§0, §10).
// Reads optional CSS custom properties from the host (--accent, --radius, ...)
// so the landing page can tint it without touching converter internals.

export const CSS = /* css */ `
:host {
  /* Tokens default to garutyunov.com's palette so the converter matches the
     host site even standalone; the landing layer can still override them (§0). */
  --c-accent: var(--accent, #54a2ff);
  --c-radius: var(--radius, 6px);
  --c-bg: var(--bg, #000000);
  --c-surface: var(--surface, #1a1a1a);
  --c-surface-hover: var(--surface-hover, #1f1f1f);
  --c-text: var(--text, #ededed);
  --c-muted: var(--muted, #878787);
  --c-border: var(--border, #1a1a1a);
  --c-green: var(--green, #00c758);
  --c-red: var(--red, #ff6568);
  display: block;
  color: var(--c-text);
  font: 15px/1.5 "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
}
* { box-sizing: border-box; }

.wrap {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--c-radius);
  padding: 20px;
  display: grid;
  gap: 18px;
  max-width: 100%;
  overflow-x: hidden;
}
/* Grid/flex children must be allowed to shrink below their content size,
   otherwise range inputs and full-size canvases overflow the card. */
.wrap > * { min-width: 0; }

.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.spacer { flex: 1 1 auto; }

button {
  font: inherit;
  color: var(--c-text);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 6px;
  padding: 9px 14px;
  cursor: pointer;
  transition: border-color .15s, background .15s, color .15s, opacity .15s;
}
button:hover:not(:disabled) { background: var(--c-surface-hover); border-color: var(--c-accent); }
button:disabled { opacity: .5; cursor: not-allowed; }
button.primary { background: var(--c-accent); border-color: var(--c-accent); color: #000; font-weight: 600; }
button.primary:hover:not(:disabled) { background: var(--c-accent); opacity: .9; }
button.toggle.active { border-color: var(--c-accent); box-shadow: inset 0 0 0 1px var(--c-accent); }

select, input[type=range] { font: inherit; color: var(--c-text); }
select {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 6px; padding: 7px 10px;
}
input[type=range] { accent-color: var(--c-accent); }

.caps { display: flex; gap: 14px; flex-wrap: wrap; font-size: 13px; color: var(--c-muted); }
.caps b { color: var(--c-text); font-weight: 600; }
.ok { color: var(--c-green); }
.no { color: var(--c-muted); }

.drop {
  border: 1px dashed var(--c-border);
  border-radius: var(--c-radius);
  padding: 34px 18px;
  text-align: center;
  color: var(--c-muted);
  cursor: pointer;
  background: var(--c-surface);
  transition: border-color .15s, background .15s;
}
.drop:hover { background: var(--c-surface-hover); }
.drop.hover { border-color: var(--c-accent); background: rgba(84,162,255,.08); }
.drop input { display: none; }

.engines { display: flex; gap: 10px; flex-wrap: wrap; }

/* minmax(0, 1fr) stops the grid column from blowing out to the widest
   <select> option text, so children honour the container width. */
.ai-panel { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.ai-panel .row { width: 100%; min-width: 0; }
.ai-panel .row label { white-space: nowrap; }
.ai-panel select { flex: 1 1 200px; min-width: 0; max-width: 100%; }
textarea.prompt {
  display: block;
  width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box;
  min-height: 96px;
  background: var(--c-surface); color: var(--c-text);
  border: 1px solid var(--c-border); border-radius: 6px;
  padding: 10px; font: inherit; line-height: 1.4; resize: vertical;
}
textarea.prompt:focus { outline: none; border-color: var(--c-accent); }

.progress {
  height: 8px; background: var(--c-surface); border-radius: 999px; overflow: hidden;
  border: 1px solid var(--c-border);
}
.progress > i { display: block; height: 100%; width: 0%; background: var(--c-accent); transition: width .2s; }

.status { font-size: 13px; color: var(--c-muted); min-height: 1.2em; }
.status.error { color: var(--c-red); }

.views { display: grid; gap: 14px; min-width: 0; }
.viewer { display: grid; gap: 8px; min-width: 0; }
.viewer h4 {
  margin: 0; font-size: 12px; color: var(--c-muted); font-weight: 500;
  font-family: "Geist Mono", "Fira Mono", ui-monospace, monospace;
  text-transform: uppercase; letter-spacing: .02em;
}
canvas.out, img.out {
  max-width: 100%; height: auto; border-radius: 6px; border: 1px solid var(--c-border);
  display: block; background: #000;
}

.compare { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.compare .card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 6px; padding: 10px; display: grid; gap: 8px; min-width: 0; }
.compare .card.win { border-color: var(--c-accent); }
@media (max-width: 640px) { .compare { grid-template-columns: 1fr; } }

.controls { display: grid; gap: 10px; }
.control { display: grid; grid-template-columns: minmax(80px, 120px) minmax(0, 1fr) 52px; gap: 10px; align-items: center; font-size: 13px; }
.control label { color: var(--c-muted); min-width: 0; overflow-wrap: anywhere; }
.control input[type=range] { width: 100%; min-width: 0; }
.control input[type=checkbox] { justify-self: start; }
.control select { min-width: 0; max-width: 100%; }
.control output { text-align: right; color: var(--c-text); font-variant-numeric: tabular-nums; }

.exports { display: flex; gap: 10px; flex-wrap: wrap; }

.note { font-size: 12px; color: var(--c-muted); }
.hidden { display: none !important; }
a { color: var(--c-accent); }
`;
