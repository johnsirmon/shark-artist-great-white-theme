// @ts-check
'use strict';

const vscode = require('vscode');

/** @typedef {'sine' | 'square' | 'sawtooth' | 'triangle'} Waveform */
/** @typedef {'simple' | 'workflow'} AudioMode */
/**
 * @typedef {object} ToneStep
 * @property {number} frequency
 * @property {number} duration
 * @property {number} volume
 * @property {number} [gap]
 * @property {Waveform} [waveform]
 */

// ─── Audio constants ──────────────────────────────────────────────────────────
const CHIME_DURATION = 0.45;  // seconds per note (includes decay tail)
const CHIME_VOLUME   = 0.14;  // peak gain (0 – 1); quiet enough not to startle
const AUDIO_MODE_SIMPLE = 'simple';
const AUDIO_MODE_WORKFLOW = 'workflow';

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

/** @type {Record<string, ToneStep[]>} */
const WORKFLOW_PATTERNS = {
  requestStart: [
    { frequency: PENTATONIC_HZ[0], duration: 0.12, volume: 0.09, waveform: 'sine' },
  ],
  successComplete: [
    { frequency: PENTATONIC_HZ[5], duration: 0.10, volume: 0.10, gap: 0.03, waveform: 'sine' },
    { frequency: PENTATONIC_HZ[6], duration: 0.11, volume: 0.11, gap: 0.03, waveform: 'sine' },
    { frequency: PENTATONIC_HZ[8], duration: 0.18, volume: 0.12, waveform: 'triangle' },
  ],
  canceledComplete: [
    { frequency: PENTATONIC_HZ[3], duration: 0.10, volume: 0.08, gap: 0.03, waveform: 'sine' },
    { frequency: PENTATONIC_HZ[1], duration: 0.14, volume: 0.08, waveform: 'sine' },
  ],
  errorComplete: [
    { frequency: PENTATONIC_HZ[4], duration: 0.10, volume: 0.10, gap: 0.03, waveform: 'triangle' },
    { frequency: PENTATONIC_HZ[2], duration: 0.11, volume: 0.10, gap: 0.03, waveform: 'triangle' },
    { frequency: PENTATONIC_HZ[0], duration: 0.18, volume: 0.11, waveform: 'triangle' },
  ],
};

/** @type {number} */
let _noteIndex = 0;

/** @type {boolean} */
let _chimeEnabled = true;

/** @type {AudioMode} */
let _audioMode = AUDIO_MODE_SIMPLE;

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
  _audioMode = _normalizeAudioMode(
    /** @type {AudioMode | undefined} */ (
      context.globalState.get('great-white.audioMode', AUDIO_MODE_SIMPLE)
    )
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
    vscode.commands.registerCommand('great-white.toggleAudioMode', _toggleAudioMode),
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
 * response, then play simple or workflow-mode pentatonic cues around the run.
 *
 * @param {vscode.ChatRequest} request
 * @param {vscode.ChatContext} _chatContext
 * @param {vscode.ChatResponseStream} response
 * @param {vscode.CancellationToken} token
 */
async function _handleChatRequest(request, _chatContext, response, token) {
  /** @type {'success' | 'canceled' | 'error'} */
  let outcome = 'success';

  if (_chimeEnabled && _audioMode === AUDIO_MODE_WORKFLOW) {
    _playWorkflowPattern('requestStart');
  }

  try {
    // Select the best available Copilot model
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o',
    });

    if (models.length === 0) {
      outcome = 'error';
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
    if (/** @type {any} */ (err).code === 'Canceled') {
      outcome = 'canceled';
    } else {
      outcome = 'error';
      response.markdown(`🦈 *Error: ${/** @type {Error} */ (err).message}*`);
    }
  } finally {
    if (_chimeEnabled) {
      _playCompletionCue(outcome);
    }
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
 * @param {Waveform} [waveform]
 */
function _playTone(frequency, duration, volume, waveform = 'sine') {
  const panel = _getOrCreateAudioPanel();
  panel.webview.postMessage({ type: 'play', frequency, duration, volume, waveform });
}

/**
 * @param {ToneStep[]} tones
 */
function _playSequence(tones) {
  const panel = _getOrCreateAudioPanel();
  panel.webview.postMessage({ type: 'play-sequence', tones });
}

/**
 * @param {'success' | 'canceled' | 'error'} outcome
 */
function _playCompletionCue(outcome) {
  if (_audioMode === AUDIO_MODE_WORKFLOW) {
    const patternName = outcome === 'success'
      ? 'successComplete'
      : outcome === 'canceled'
        ? 'canceledComplete'
        : 'errorComplete';
    _playWorkflowPattern(patternName);
    return;
  }

  _playNextNote();
}

/**
 * @param {keyof typeof WORKFLOW_PATTERNS} patternName
 */
function _playWorkflowPattern(patternName) {
  _playSequence(WORKFLOW_PATTERNS[patternName]);
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
    '🎵 Great White Audio',
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
  <div>🦈 Great White Pentatonic Audio — engine</div>
  <div id="log">Waiting for first note…</div>
  <script>
    const logEl = document.getElementById('log');
    let ctx = null;
    const VALID_WAVEFORMS = new Set(['sine', 'square', 'sawtooth', 'triangle']);

    function getAudioContext() {
      if (!ctx) { ctx = new AudioContext(); }
      // Resume if suspended (autoplay policy)
      if (ctx.state === 'suspended') { ctx.resume(); }
      return ctx;
    }

    function normalizeWaveform(waveform) {
      return VALID_WAVEFORMS.has(waveform) ? waveform : 'sine';
    }

    function playTone(frequency, duration, volume, waveform) {
      const ac = getAudioContext();
      const osc  = ac.createOscillator();
      const gain = ac.createGain();

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.type = normalizeWaveform(waveform);
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

    function playSequence(tones) {
      let delayMs = 0;
      for (const tone of Array.isArray(tones) ? tones : []) {
        const startAfter = delayMs;
        setTimeout(() => {
          playTone(
            tone.frequency || 440,
            tone.duration || 0.12,
            tone.volume || 0.1,
            tone.waveform
          );
        }, startAfter);
        delayMs += ((tone.duration || 0.12) + (tone.gap || 0)) * 1000;
      }
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg && msg.type === 'play') {
        playTone(
          msg.frequency || 440,
          msg.duration  || 0.45,
          msg.volume    || 0.14,
          msg.waveform
        );
      } else if (msg && msg.type === 'play-sequence') {
        playSequence(msg.tones);
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
      ? `Great White audio enabled (${_getAudioModeLabel()}) 🎵`
      : 'Great White audio disabled 🔇'
  );
}

function _toggleAudioMode() {
  _audioMode = _audioMode === AUDIO_MODE_SIMPLE
    ? AUDIO_MODE_WORKFLOW
    : AUDIO_MODE_SIMPLE;

  if (_ctx) {
    _ctx.globalState.update('great-white.audioMode', _audioMode);
  }

  _refreshStatusBar();
  vscode.window.showInformationMessage(
    _audioMode === AUDIO_MODE_WORKFLOW
      ? 'Great White workflow audio enabled 🎼'
      : 'Great White simple chime enabled 🎵'
  );
}

function _refreshStatusBar() {
  if (!_statusBarItem) { return; }
  const modeLabel = _getAudioModeLabel();
  _statusBarItem.text = _chimeEnabled
    ? (_audioMode === AUDIO_MODE_WORKFLOW ? '$(music) Flow' : '$(music) Chime')
    : '$(mute) Audio';
  _statusBarItem.tooltip = _chimeEnabled
    ? `Great White audio ON — ${modeLabel}. Click to disable. Run "Great White: Toggle Audio Mode" to switch modes.`
    : `Great White audio OFF — ${modeLabel}. Click to enable. Run "Great White: Toggle Audio Mode" to switch modes.`;
  _statusBarItem.backgroundColor = _chimeEnabled
    ? undefined
    : new vscode.ThemeColor('statusBarItem.warningBackground');
}

/**
 * @param {AudioMode | undefined} mode
 * @returns {AudioMode}
 */
function _normalizeAudioMode(mode) {
  return mode === AUDIO_MODE_WORKFLOW
    ? AUDIO_MODE_WORKFLOW
    : AUDIO_MODE_SIMPLE;
}

function _getAudioModeLabel() {
  return _audioMode === AUDIO_MODE_WORKFLOW
    ? 'workflow mode'
    : 'simple chime mode';
}

// ─── Deactivation ─────────────────────────────────────────────────────────────

function deactivate() {
  if (_audioPanel) {
    _audioPanel.dispose();
    _audioPanel = null;
  }
}

module.exports = { activate, deactivate };
