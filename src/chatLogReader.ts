import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ChatSessionUsage {
    inputTokens: number;
    outputTokens: number;
    model: string;
    maxPromptTokens: number;
    contextPercent: number;
    turnCount: number;
}

/**
 * Reads Copilot Chat debug-log JSONL files from the workspace storage
 * directory to derive chat context usage.
 *
 * File layout (per chat session):
 *   {workspaceStorage}/{wsId}/GitHub.copilot-chat/debug-logs/{sessionId}/
 *     main.jsonl          – event stream (llm_request, tool_call, turn_start …)
 *     models.json         – model metadata including context window limits
 */
export class ChatLogReader {
    private _debugLogsDir: string | undefined;

    /**
     * Call once after activation with the extension context so we can
     * derive the sibling Copilot Chat storage path.
     */
    configure(context: vscode.ExtensionContext): void {
        // context.storageUri = .../workspaceStorage/{wsId}/{extensionId}
        // We need             .../workspaceStorage/{wsId}/GitHub.copilot-chat/debug-logs
        const storageUri = context.storageUri;
        if (!storageUri) { return; }
        const wsIdDir = path.dirname(storageUri.fsPath);
        this._debugLogsDir = path.join(wsIdDir, 'GitHub.copilot-chat', 'debug-logs');
    }

    /**
     * Returns usage data for the most-recently-modified chat session,
     * or undefined if no debug logs are available.
     */
    read(): ChatSessionUsage | undefined {
        if (!this._debugLogsDir || !fs.existsSync(this._debugLogsDir)) {
            return undefined;
        }

        // Find the most-recently-modified session directory
        let sessionDirs: fs.Dirent[];
        try {
            sessionDirs = fs.readdirSync(this._debugLogsDir, { withFileTypes: true })
                .filter(d => d.isDirectory());
        } catch {
            return undefined;
        }
        if (sessionDirs.length === 0) { return undefined; }

        let newest: { name: string; mtime: number } | undefined;
        for (const d of sessionDirs) {
            const mainJsonl = path.join(this._debugLogsDir, d.name, 'main.jsonl');
            try {
                const mt = fs.statSync(mainJsonl).mtimeMs;
                if (!newest || mt > newest.mtime) {
                    newest = { name: d.name, mtime: mt };
                }
            } catch {
                // no main.jsonl — skip
            }
        }
        if (!newest) { return undefined; }

        const sessionDir = path.join(this._debugLogsDir, newest.name);
        return this._parseSession(sessionDir);
    }

    private _parseSession(sessionDir: string): ChatSessionUsage | undefined {
        const mainPath = path.join(sessionDir, 'main.jsonl');
        const modelsPath = path.join(sessionDir, 'models.json');

        let lines: string[];
        try {
            lines = fs.readFileSync(mainPath, 'utf-8').split('\n');
        } catch {
            return undefined;
        }

        // Walk events to find peak inputTokens and latest model
        let peakInputTokens = 0;
        let peakOutputTokens = 0;
        let latestModel = '';
        let llmTurns = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) { continue; }
            let event: any;
            try {
                event = JSON.parse(trimmed);
            } catch {
                continue;
            }
            if (event.type !== 'llm_request') { continue; }

            const attrs = event.attrs;
            if (!attrs) { continue; }

            llmTurns++;
            const inputTokens = typeof attrs.inputTokens === 'number' ? attrs.inputTokens : 0;
            const outputTokens = typeof attrs.outputTokens === 'number' ? attrs.outputTokens : 0;
            if (typeof attrs.model === 'string') { latestModel = attrs.model; }

            if (inputTokens > peakInputTokens) {
                peakInputTokens = inputTokens;
                peakOutputTokens = outputTokens;
            }
        }

        if (llmTurns === 0) { return undefined; }

        // Get context window size from models.json
        let maxPromptTokens = 0;
        try {
            const modelsText = fs.readFileSync(modelsPath, 'utf-8');
            const models: any[] = JSON.parse(modelsText);
            // Find the model matching the latest LLM request
            for (const m of models) {
                const family = m.capabilities?.family || m.id || '';
                if (latestModel.startsWith(family) || family.startsWith(latestModel) || latestModel === m.id) {
                    maxPromptTokens = m.capabilities?.limits?.max_prompt_tokens ?? 0;
                    break;
                }
            }
            // Fallback: use the first model with limits if no match
            if (maxPromptTokens === 0) {
                for (const m of models) {
                    const mpt = m.capabilities?.limits?.max_prompt_tokens;
                    if (typeof mpt === 'number' && mpt > 0) {
                        maxPromptTokens = mpt;
                        break;
                    }
                }
            }
        } catch {
            // models.json not available — use model-name heuristic
        }

        // Fallback heuristic if models.json didn't give us a number
        if (maxPromptTokens === 0) {
            maxPromptTokens = this._guessContextWindow(latestModel);
        }

        const contextPercent = maxPromptTokens > 0
            ? Math.min(100, Math.round(peakInputTokens / maxPromptTokens * 100))
            : 0;

        return {
            inputTokens: peakInputTokens,
            outputTokens: peakOutputTokens,
            model: latestModel,
            maxPromptTokens,
            contextPercent,
            turnCount: llmTurns,
        };
    }

    private _guessContextWindow(model: string): number {
        if (!model) { return 200_000; }
        const m = model.toLowerCase();
        if (m.includes('1m')) { return 935_997; }
        if (m.includes('claude')) { return 200_000; }
        if (m.startsWith('gpt-4.1')) { return 1_000_000; }
        if (m.startsWith('gpt-4')) { return 128_000; }
        if (m.includes('o1') || m.includes('o3')) { return 200_000; }
        return 200_000;
    }
}
