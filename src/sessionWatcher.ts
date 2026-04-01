import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SessionInfo {
    id: string;
    summary: string;
    model: string;
    contextPercent: number;
    isEstimated: boolean;           // true = heuristic, false = authoritative from shutdown
    outputTokens: number;
    currentTokens: number;          // from session.shutdown.data.currentTokens (0 if active)
    systemTokens: number;           // from session.shutdown.data.systemTokens
    conversationTokens: number;     // from session.shutdown.data.conversationTokens
    toolDefinitionsTokens: number;  // from session.shutdown.data.toolDefinitionsTokens
    inputTokensEstimate: number;    // heuristic estimate for active sessions
    turnCount: number;
    isActive: boolean;
    startTime: string;
    cwd: string;
    branch: string;
}

interface WorkspaceYaml {
    id: string;
    cwd: string;
    summary: string;
    created_at: string;
    updated_at: string;
}

interface SessionCache {
    workspaceMtime: number;
    eventsMtime: number;
    info: SessionInfo;
}

/** Estimated base tokens consumed by system prompt and tool definitions in a CLI session.
 *  Derived from real session.shutdown data: ~12K system + ~34K tool definitions. */
const SYSTEM_OVERHEAD_TOKENS = 46_000;

function getContextWindowSize(model: string): number {
    if (!model) { return 200_000; }
    const m = model.toLowerCase();
    if (m.includes('claude')) { return 200_000; }
    if (m.startsWith('gpt-4.1')) { return 1_000_000; }
    if (m.startsWith('gpt-5')) { return 200_000; }
    if (m.startsWith('gpt-4')) { return 128_000; }
    if (m.includes('o1') || m.includes('o3')) { return 200_000; }
    return 200_000;
}

function parseSimpleYaml(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of text.split('\n')) {
        const idx = line.indexOf(':');
        if (idx < 0) { continue; }
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key) { result[key] = value; }
    }
    return result;
}

function normalizePath(p: string): string {
    let normalized = path.resolve(p);
    if (process.platform === 'win32') {
        normalized = normalized.toLowerCase();
    }
    if (normalized.endsWith(path.sep)) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

function fileMtime(filePath: string): number {
    try {
        return fs.statSync(filePath).mtimeMs;
    } catch {
        return 0;
    }
}

export class SessionWatcher extends vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

    private _sessionDir: string;
    private _cache = new Map<string, SessionCache>();
    private _sessions: SessionInfo[] = [];
    private _pollTimer: ReturnType<typeof setInterval> | undefined;
    private _watchers: vscode.FileSystemWatcher[] = [];
    private _disposed = false;

    constructor() {
        super(() => this._dispose());
        this._sessionDir = path.join(os.homedir(), '.copilot', 'session-state');
    }

    start(pollIntervalMs: number = 10_000): void {
        this._scan();

        const pattern = new vscode.RelativePattern(
            vscode.Uri.file(this._sessionDir), '**/*'
        );
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidChange(() => this._scan());
        watcher.onDidCreate(() => this._scan());
        watcher.onDidDelete(() => this._scan());
        this._watchers.push(watcher);

        this._pollTimer = setInterval(() => this._scan(), pollIntervalMs);
    }

    getWorkspaceSessions(): SessionInfo[] {
        return this._sessions;
    }

    getPeakCliPercent(): number {
        if (this._sessions.length === 0) { return 0; }
        return Math.max(...this._sessions.map(s => s.contextPercent));
    }

    private _scan(): void {
        if (this._disposed) { return; }

        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            if (this._sessions.length > 0) {
                this._sessions = [];
                this._onDidChange.fire();
            }
            return;
        }

        const normalizedFolders = folders.map(f => normalizePath(f.uri.fsPath));
        let sessionDirs: string[];
        try {
            sessionDirs = fs.readdirSync(this._sessionDir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);
        } catch {
            if (this._sessions.length > 0) {
                this._sessions = [];
                this._onDidChange.fire();
            }
            return;
        }

        const newSessions: SessionInfo[] = [];
        const activeCacheKeys = new Set<string>();

        for (const dirName of sessionDirs) {
            const dirPath = path.join(this._sessionDir, dirName);
            const info = this._parseSession(dirName, dirPath);
            if (!info) { continue; }

            const normalizedCwd = normalizePath(info.cwd);
            const matches = normalizedFolders.some(
                folder => normalizedCwd === folder || normalizedCwd.startsWith(folder + path.sep)
            );
            if (matches) {
                newSessions.push(info);
                activeCacheKeys.add(dirName);
            }
        }

        // Prune stale cache entries
        for (const key of this._cache.keys()) {
            if (!activeCacheKeys.has(key)) {
                this._cache.delete(key);
            }
        }

        if (this._hasChanged(newSessions)) {
            this._sessions = newSessions;
            this._onDidChange.fire();
        }
    }

    private _parseSession(id: string, dirPath: string): SessionInfo | undefined {
        const workspacePath = path.join(dirPath, 'workspace.yaml');
        const eventsPath = path.join(dirPath, 'events.jsonl');

        const wsMtime = fileMtime(workspacePath);
        if (wsMtime === 0) { return undefined; }

        const evMtime = fileMtime(eventsPath);
        const cached = this._cache.get(id);
        if (cached && cached.workspaceMtime === wsMtime && cached.eventsMtime === evMtime) {
            // Re-check active status since lock files can appear/disappear
            cached.info.isActive = this._isActive(dirPath);
            return cached.info;
        }

        let wsText: string;
        try {
            wsText = fs.readFileSync(workspacePath, 'utf-8');
        } catch {
            return undefined;
        }

        const yaml = parseSimpleYaml(wsText);
        const cwd = yaml['cwd'] || '';
        if (!cwd) { return undefined; }

        let model = '';
        let branch = '';
        let outputTokens = 0;
        let conversationInputEstimate = 0;
        let toolResultTokensEstimate = 0;
        let turnCount = 0;
        let currentTokens = 0;
        let systemTokens = 0;
        let conversationTokens = 0;
        let toolDefinitionsTokens = 0;
        let isEstimated = true;

        try {
            const evText = fs.readFileSync(eventsPath, 'utf-8');
            const lines = evText.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) { continue; }
                let event: any;
                try {
                    event = JSON.parse(trimmed);
                } catch {
                    continue;
                }
                const type: string = event.type || '';
                const data = event.data;
                if (!data) { continue; }

                switch (type) {
                    case 'session.start':
                        if (data.context?.branch) { branch = data.context.branch; }
                        break;
                    case 'assistant.message':
                        if (typeof data.outputTokens === 'number') {
                            outputTokens += data.outputTokens;
                        }
                        break;
                    case 'assistant.turn_end':
                        turnCount++;
                        break;
                    case 'user.message':
                        if (typeof data.content === 'string') {
                            conversationInputEstimate += Math.ceil(data.content.length / 4);
                        }
                        break;
                    case 'tool.execution_complete':
                        if (data.model && typeof data.model === 'string' && !model) { model = data.model; }
                        if (data.result != null) {
                            const text = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
                            toolResultTokensEstimate += Math.ceil(text.length / 4);
                        }
                        break;
                    case 'session.shutdown':
                        if (typeof data.currentModel === 'string') {
                            model = data.currentModel;
                        }
                        if (typeof data.currentTokens === 'number') { currentTokens = data.currentTokens; }
                        if (typeof data.systemTokens === 'number') { systemTokens = data.systemTokens; }
                        if (typeof data.conversationTokens === 'number') { conversationTokens = data.conversationTokens; }
                        if (typeof data.toolDefinitionsTokens === 'number') { toolDefinitionsTokens = data.toolDefinitionsTokens; }
                        break;
                }
            }
        } catch {
            // events.jsonl may not exist yet
        }

        const inputTokensEstimate = conversationInputEstimate + toolResultTokensEstimate;

        let contextPercent: number;
        if (currentTokens > 0) {
            // Completed session: use authoritative token count from session.shutdown
            contextPercent = Math.min(100, Math.round(
                currentTokens / getContextWindowSize(model) * 100
            ));
            isEstimated = false;  // derive from track taken, not from event order
        } else {
            // Active session: heuristic — system overhead + conversation + tool results
            // outputTokens are NOT included; they are completion tokens, not prompt fill
            const estimatedPromptTokens = SYSTEM_OVERHEAD_TOKENS + inputTokensEstimate;
            contextPercent = Math.min(100, Math.round(
                estimatedPromptTokens / getContextWindowSize(model) * 100
            ));
            isEstimated = true;  // always heuristic when currentTokens=0
        }

        const info: SessionInfo = {
            id: yaml['id'] || id,
            summary: yaml['summary'] || '',
            model,
            contextPercent,
            isEstimated,
            outputTokens,
            currentTokens,
            systemTokens,
            conversationTokens,
            toolDefinitionsTokens,
            inputTokensEstimate,
            turnCount,
            isActive: this._isActive(dirPath),
            startTime: yaml['created_at'] || '',
            cwd,
            branch,
        };

        this._cache.set(id, { workspaceMtime: wsMtime, eventsMtime: evMtime, info });
        return info;
    }

    private _isActive(dirPath: string): boolean {
        try {
            const entries = fs.readdirSync(dirPath);
            return entries.some(e => e.startsWith('inuse.') && e.endsWith('.lock'));
        } catch {
            return false;
        }
    }

    private _hasChanged(newSessions: SessionInfo[]): boolean {
        if (newSessions.length !== this._sessions.length) { return true; }
        for (let i = 0; i < newSessions.length; i++) {
            const a = newSessions[i];
            const b = this._sessions[i];
            if (
                a.id !== b.id ||
                a.contextPercent !== b.contextPercent ||
                a.outputTokens !== b.outputTokens ||
                a.inputTokensEstimate !== b.inputTokensEstimate ||
                a.turnCount !== b.turnCount ||
                a.isActive !== b.isActive ||
                a.summary !== b.summary ||
                a.model !== b.model ||
                a.isEstimated !== b.isEstimated ||
                a.currentTokens !== b.currentTokens
            ) {
                return true;
            }
        }
        return false;
    }

    private _dispose(): void {
        this._disposed = true;
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = undefined;
        }
        for (const w of this._watchers) {
            w.dispose();
        }
        this._watchers = [];
        this._onDidChange.dispose();
        this._cache.clear();
    }
}
