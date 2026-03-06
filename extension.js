// @ts-check
'use strict';

const vscode = require('vscode');

// ─── Audio constants ──────────────────────────────────────────────────────────
const CHIME_DURATION = 0.45;  // seconds per note (includes decay tail)
const CHIME_VOLUME   = 0.14;  // peak gain (0 – 1); quiet enough not to startle

// ─── Minor pentatonic scale — A minor, two octaves (A3 … G5) ─────────────────
// Intervals: root, ♭3, 4, 5, ♭7  (×2 octaves = 10 notes)
const PENTATONIC_HZ = [
  220.00,  // A3
  261.63,  // C4
  293.66,  // D4
  329.63,  // E4
  392.00,  // G4
  440.00,  // A4
  523.25,  // C5
  587.33,  // D5
  659.25,  // E5
  783.99,  // G5
];

/** @type {number} */
let _noteIndex = 0;

/** @type {boolean} */
let _chimeEnabled = true;

/** @type {vscode.StatusBarItem | null} */
let _statusBarItem = null;

/** @type {vscode.WebviewPanel | null} */
let _audioPanel = null;

/** @type {vscode.ExtensionContext | null} */
let _ctx = null;

// ─── Activation ──────────────────────────────────────────────────────────────

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  _ctx = context;

  // Restore persisted toggle state
  _chimeEnabled = /** @type {boolean} */ (
    context.globalState.get('great-white.chimeEnabled', true)
  );

  // ── Status bar item (right side) ──────────────────────────────────────────
  _statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    99
  );
  _statusBarItem.command = 'great-white.toggleChime';
  _refreshStatusBar();
  _statusBarItem.show();
  context.subscriptions.push(_statusBarItem);

  // ── Commands ──────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('great-white.toggleChime', _toggleChime),
    vscode.commands.registerCommand('great-white.playNote', _playNextNote)
  );

  // ── Chat participant (VS Code ≥ 1.93) ─────────────────────────────────────
  // The participant ID is `great-white.shark` (namespace.name convention required
  // by VS Code). Users invoke it with `@shark` — VS Code strips the namespace
  // prefix and exposes only the `name` field in the chat UI.
  if (vscode.chat && typeof vscode.chat.createChatParticipant === 'function') {
    const participant = vscode.chat.createChatParticipant(
      'great-white.shark',
      _handleChatRequest
    );
    participant.iconPath = new vscode.ThemeIcon('symbol-color');
    context.subscriptions.push(participant);
  }
}

// ─── Chat handler ─────────────────────────────────────────────────────────────

/**
 * Proxy the user's message to a GitHub Copilot language model, stream the
 * response, then play one pentatonic chime note when done.
 *
 * @param {vscode.ChatRequest} request
 * @param {vscode.ChatContext} _chatContext
 * @param {vscode.ChatResponseStream} response
 * @param {vscode.CancellationToken} token
 */
async function _handleChatRequest(request, _chatContext, response, token) {
  try {
    // Select the best available Copilot model
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o',
    });

    if (models.length === 0) {
      response.markdown(
        '🦈 *No language model found. Please ensure GitHub Copilot Chat is installed and signed in.*'
      );
    } else {
      const model = models[0];
      const messages = [
        vscode.LanguageModelChatMessage.User(request.prompt),
      ];
      const chatResponse = await model.sendRequest(messages, {}, token);
      for await (const chunk of chatResponse.text) {
        response.markdown(chunk);
      }
    }
  } catch (err) {
    if (/** @type {any} */ (err).code !== 'Canceled') {
      response.markdown(`🦈 *Error: ${/** @type {Error} */ (err).message}*`);
    }
  }

  // Play a chime note after the response completes (or errors)
  if (_chimeEnabled) {
    _playNextNote();
  }
}

// ─── Audio ───────────────────────────────────────────────────────────────────

/**
 * Advance to the next scale degree and play it.
 */
function _playNextNote() {
  const freq = PENTATONIC_HZ[_noteIndex % PENTATONIC_HZ.length];
  _noteIndex++;
  _playTone(freq, CHIME_DURATION, CHIME_VOLUME);
}

/**
 * Send a tone request to the hidden Web Audio webview.
 *
 * @param {number} frequency   Frequency in Hz
 * @param {number} duration    Duration in seconds
 * @param {number} volume      Peak gain (0 – 1)
 */
function _playTone(frequency, duration, volume) {
  const panel = _getOrCreateAudioPanel();
  panel.webview.postMessage({ type: 'play', frequency, duration, volume });
}

/**
 * Return the existing audio webview panel, creating it if necessary.
 * The panel is revealed with `preserveFocus: true` so it never steals focus.
 *
 * @returns {vscode.WebviewPanel}
 */
function _getOrCreateAudioPanel() {
  if (_audioPanel) {
    return _audioPanel;
  }

  _audioPanel = vscode.window.createWebviewPanel(
    'great-white-audio',
    '🎵 Great White Chime',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true }
  );

  _audioPanel.webview.html = _buildAudioHtml();
  _audioPanel.onDidDispose(() => {
    _audioPanel = null;
  });

  return _audioPanel;
}

/**
 * Build the minimal HTML page that hosts the Web Audio API engine.
 * Messages from the extension trigger oscillator playback.
 *
 * @returns {string}
 */
function _buildAudioHtml() {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'unsafe-inline';">
  <style>
    body {
      margin: 0;
      font-family: monospace;
      font-size: 12px;
      background: #0b1f2a;
      color: #7ec8d4;
      padding: 12px 16px;
    }
    #log { opacity: 0.75; }
  </style>
</head>
<body>
  <div>🦈 Great White Pentatonic Chime — audio engine</div>
  <div id="log">Waiting for first note…</div>
  <script>
    const logEl = document.getElementById('log');
    let ctx = null;

    function getAudioContext() {
      if (!ctx) { ctx = new AudioContext(); }
      // Resume if suspended (autoplay policy)
      if (ctx.state === 'suspended') { ctx.resume(); }
      return ctx;
    }

    function playTone(frequency, duration, volume) {
      const ac = getAudioContext();
      const osc  = ac.createOscillator();
      const gain = ac.createGain();

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ac.currentTime);

      // Soft attack, natural exponential decay
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ac.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);

      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + duration);

      logEl.textContent =
        '♪ ' + Math.round(frequency) + ' Hz — ' +
        new Date().toLocaleTimeString();
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg && msg.type === 'play') {
        playTone(
          msg.frequency || 440,
          msg.duration  || 0.45,
          msg.volume    || 0.14
        );
      }
    });
  </script>
</body>
</html>`;
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function _toggleChime() {
  _chimeEnabled = !_chimeEnabled;
  if (_ctx) {
    _ctx.globalState.update('great-white.chimeEnabled', _chimeEnabled);
  }
  _refreshStatusBar();
  vscode.window.showInformationMessage(
    _chimeEnabled
      ? 'Great White Chime enabled 🎵'
      : 'Great White Chime disabled 🔇'
  );
}

function _refreshStatusBar() {
  if (!_statusBarItem) { return; }
  _statusBarItem.text    = _chimeEnabled ? '$(music) Chime' : '$(mute) Chime';
  _statusBarItem.tooltip = _chimeEnabled
    ? 'Great White: Pentatonic chime ON — click to disable'
    : 'Great White: Pentatonic chime OFF — click to enable';
  _statusBarItem.backgroundColor = _chimeEnabled
    ? undefined
    : new vscode.ThemeColor('statusBarItem.warningBackground');
}

// ─── Deactivation ─────────────────────────────────────────────────────────────

function deactivate() {
  if (_audioPanel) {
    _audioPanel.dispose();
    _audioPanel = null;
  }
}

module.exports = { activate, deactivate };
