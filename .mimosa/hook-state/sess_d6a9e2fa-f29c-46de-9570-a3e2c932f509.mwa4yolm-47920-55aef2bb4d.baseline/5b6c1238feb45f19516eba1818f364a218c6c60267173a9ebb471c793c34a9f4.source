/* Diagnose only what the top frame can actually observe. */
(function () {
  'use strict';
  const VP = window.VP;
  if (VP.diagnostics) return; // 自动注入与手动恢复交错时避免重复初始化
  function failureReason(doc = document, depth = 0) {
    let inaccessible = false;
    for (const frame of doc.querySelectorAll('iframe')) {
      try {
        const child = frame.contentDocument;
        if (!child) { inaccessible = true; continue; }
        if (child.querySelector('video')) return 'player_in_frame';
        if (depth < 4) {
          const reason = failureReason(child, depth + 1);
          if (reason === 'player_in_frame') return reason;
          if (reason === 'player_frame_unknown') inaccessible = true;
        }
      } catch (_) { inaccessible = true; }
    }
    if (doc.querySelector('video')) return 'player_not_ready';
    return inaccessible ? 'player_frame_unknown' : 'toast_no_video';
  }
  VP.diagnostics = { failureReason };
})();
