/* Progress dashboard: renders aggregate audit stats and offers report export.
 * Runs inside the sandboxed webview under a strict CSP; talks to the extension
 * through the VS Code message API. */
(function () {
  const vscode = acquireVsCodeApi();

  function pct(x) { return Math.round(x * 100) + '%'; }

  function segments(rec, prefix) {
    const total = Object.values(rec).reduce((a, b) => a + b, 0) || 1;
    return Object.keys(rec)
      .map((k) => `<span class="seg c-${k}" style="width:${(rec[k] / total) * 100}%" title="${k}: ${rec[k]}"></span>`)
      .join('');
  }
  function legend(rec) {
    return Object.keys(rec)
      .map((k) => `<span><span class="dot c-${k}"></span>${k}: ${rec[k]}</span>`)
      .join('');
  }

  function render(s) {
    const cards = [
      ['trust nodes', s.totalNodes],
      ['review coverage', pct(s.coverage)],
      ['findings', s.totalFindings],
      ['annotations', s.annotations],
      ['bookmarks', s.bookmarks],
      ['knowledge notes', s.notes],
    ].map(([l, n]) => `<div class="card"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');

    document.getElementById('cards').innerHTML = cards;
    document.getElementById('stateBar').innerHTML = segments(s.nodesByState);
    document.getElementById('stateLegend').innerHTML = legend(s.nodesByState);
    document.getElementById('sevBar').innerHTML = segments(s.findingsBySeverity);
    document.getElementById('sevLegend').innerHTML = legend(s.findingsBySeverity);
  }

  document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
  document.getElementById('md').addEventListener('click', () => vscode.postMessage({ type: 'report', format: 'markdown' }));
  document.getElementById('html').addEventListener('click', () => vscode.postMessage({ type: 'report', format: 'html' }));

  window.addEventListener('message', (ev) => {
    if (ev.data.type === 'stats') render(ev.data.stats);
  });

  vscode.postMessage({ type: 'ready' });
})();
