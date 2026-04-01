import * as vscode from 'vscode';
import type { SessionWatcher, SessionInfo } from './sessionWatcher';

function formatDuration(isoStart: string): string {
    const ms = Date.now() - new Date(isoStart).getTime();
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 60) { return `${minutes}m`; }
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type Severity = 'healthy' | 'warning' | 'critical';

function getSeverity(percent: number): Severity {
    if (percent >= 75) { return 'critical'; }
    if (percent >= 50) { return 'warning'; }
    return 'healthy';
}

function trendArrow(prev: number, curr: number): string {
    const delta = curr - prev;
    if (delta > 3) { return ' ↑'; }
    if (delta < -3) { return ' ↓'; }
    return ' →';
}

export class ContextGauge implements vscode.Disposable {
    private readonly watcher: SessionWatcher;
    private statusBar!: vscode.StatusBarItem;
    private previousCliPercent: number = 0;
    private chatPercent: number | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(sessionWatcher: SessionWatcher) {
        this.watcher = sessionWatcher;
    }

    public start(context: vscode.ExtensionContext): void {
        this.statusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            200,
        );
        this.statusBar.command = 'greatWhite.openContextDetails';
        this.disposables.push(this.statusBar);

        const sub = this.watcher.onDidChange(() => this.refresh());
        this.disposables.push(sub);

        this.refresh();
        this.statusBar.show();
    }

    public refresh(): void {
        const sessions = this.watcher.getWorkspaceSessions();
        const cliPercent = sessions.length > 0
            ? Math.max(...sessions.map(s => s.contextPercent))
            : 0;

        this.pollChat();

        const trend = trendArrow(this.previousCliPercent, cliPercent);
        this.previousCliPercent = cliPercent;

        const peak = Math.max(cliPercent, this.chatPercent ?? 0);
        const severity = getSeverity(peak);

        const icon = severity === 'critical' ? '🩸' : '🦈';
        const cliLabel = sessions.length > 0 ? `${cliPercent}%${trend}` : '—';
        const chatLabel = this.chatPercent !== undefined ? `${this.chatPercent}%` : '—';
        this.statusBar.text = `${icon} CLI ${cliLabel} │ 💬 Chat ${chatLabel}`;

        switch (severity) {
            case 'warning':
                this.statusBar.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground',
                );
                break;
            case 'critical':
                this.statusBar.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.errorBackground',
                );
                break;
            default:
                this.statusBar.backgroundColor = undefined;
                break;
        }

        this.statusBar.tooltip = this.buildTooltip(sessions);
    }

    public getSessions(): SessionInfo[] {
        return this.watcher.getWorkspaceSessions();
    }

    public getChatPercent(): number | undefined {
        return this.chatPercent;
    }

    public dispose(): void {
        for (const d of this.disposables) { d.dispose(); }
        this.disposables = [];
    }

    private buildTooltip(sessions: SessionInfo[]): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.supportThemeIcons = true;

        const lines: string[] = ['**Copilot Context Usage**', ''];

        if (sessions.length > 0) {
            lines.push('CLI Sessions (this workspace):');
            for (const s of sessions) {
                const dur = formatDuration(s.startTime);
                lines.push(
                    `• ${s.summary} — ${s.model} · ${s.contextPercent}% · ${s.turnCount} turns · ${dur}`,
                );
            }
        } else {
            lines.push('CLI Sessions: none');
        }

        lines.push('');
        if (this.chatPercent !== undefined) {
            lines.push(`Chat: ~${this.chatPercent}% estimated`);
        } else {
            lines.push('Chat: —');
        }

        lines.push('', 'Click for details');
        md.appendMarkdown(lines.join('\n\n'));
        return md;
    }

    private pollChat(): void {
        try {
            const lm = (vscode as any).lm;
            if (!lm?.selectChatModels) {
                this.chatPercent = undefined;
                return;
            }
            // Best-effort: fire-and-forget; update on next cycle if resolved
            Promise.resolve(lm.selectChatModels({ family: 'gpt-4o' }))
                .then(() => {
                    // Chat model API exists; real estimation deferred to future work
                    this.chatPercent = undefined;
                })
                .catch(() => {
                    this.chatPercent = undefined;
                });
        } catch {
            this.chatPercent = undefined;
        }
    }
}

export async function showContextDetails(
    sessions: SessionInfo[],
    chatPercent: number | undefined,
): Promise<void> {
    const folderName =
        vscode.workspace.workspaceFolders?.[0]?.name ?? 'Workspace';

    type ActionItem = vscode.QuickPickItem & { _action?: string };
    const items: ActionItem[] = [];

    // CLI section
    items.push({
        label: `CLI Sessions — ${folderName}`,
        kind: vscode.QuickPickItemKind.Separator,
    });

    for (const s of sessions) {
        const marker = s.isActive ? '●' : '○';
        const dur = formatDuration(s.startTime);
        items.push({
            label: `${marker} ${s.summary}  —  ${s.model} · ${s.contextPercent}% · ${s.turnCount} turns · ${dur}`,
            detail: `${s.outputTokens} output tokens · branch: ${s.branch}`,
        });
    }
    if (sessions.length === 0) {
        items.push({ label: '○ No CLI sessions' });
    }

    // Chat section
    items.push({
        label: 'Copilot Chat',
        kind: vscode.QuickPickItemKind.Separator,
    });

    if (chatPercent !== undefined) {
        items.push({ label: `● Active Chat Session  —  ~${chatPercent}%` });
    } else {
        items.push({ label: '○ No chat data' });
    }

    // Actions
    items.push({
        label: '',
        kind: vscode.QuickPickItemKind.Separator,
    });
    items.push({
        label: '$(refresh) Refresh',
        _action: 'refresh',
    });
    items.push({
        label: '$(gear) Context Gauge Settings',
        _action: 'settings',
    });

    const picked = await vscode.window.showQuickPick(items, {
        title: 'Copilot Context Gauge',
        placeHolder: 'Select an action',
    });

    if (!picked) { return; }

    if ((picked as ActionItem)._action === 'refresh') {
        await vscode.commands.executeCommand('greatWhite.openContextDetails');
    } else if ((picked as ActionItem)._action === 'settings') {
        await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'greatWhite.contextGauge',
        );
    }
}
