import * as vscode from 'vscode';
import { GenerationTracker } from './tracker';
import { ThemeSwitcher } from './themeSwitcher';
import { EntryPointDecorationProvider } from './decorationProvider';

let tracker: GenerationTracker;
let switcher: ThemeSwitcher;
let statusBar: vscode.StatusBarItem;
let statusBarDismiss: vscode.StatusBarItem;
let statusBarDisable: vscode.StatusBarItem;

// Per-session tracking state
let previousSeverity: number = 0;
let warningSent: boolean = false;
let cleanseCount: number = 0;
let snoozedAtSeverity: number | undefined;
let extContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
    extContext = context;
    tracker = new GenerationTracker();
    switcher = new ThemeSwitcher();

    // Restore snooze across window reloads
    snoozedAtSeverity = context.workspaceState.get<number>('greatWhite.snoozedAtSeverity');

    // Main status bar indicator — right-aligned, leftmost of the trio (highest priority)
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200);
    statusBar.command = 'greatWhite.cleanseBloodloss';
    context.subscriptions.push(statusBar);

    // Snooze button — appears just to the right of main label
    statusBarDismiss = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 199);
    statusBarDismiss.text = '$(close)';
    statusBarDismiss.command = 'greatWhite.dismissStatusBar';
    statusBarDismiss.tooltip = 'Snooze alert — re-shows if severity rises 10+ points';
    context.subscriptions.push(statusBarDismiss);

    // Disable button — rightmost
    statusBarDisable = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 198);
    statusBarDisable.text = '$(bell-slash)';
    statusBarDisable.command = 'greatWhite.disableBloodloss';
    statusBarDisable.tooltip = 'Disable context tracking. Re-enable via command palette.';
    context.subscriptions.push(statusBarDisable);

    // Re-evaluate on document change
    let changeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
        const severity = tracker.trackChange(event);
        evaluateSeverity(severity);
    });

    // Re-evaluate when switching files
    let editorDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            const severity = tracker.trackChange({
                document: editor.document,
                contentChanges: [],
                reason: undefined
            } as any);
            evaluateSeverity(severity);
        } else {
            switcher.restoreOriginalTheme();
        }
    });

    let cleanseCommand = vscode.commands.registerCommand('greatWhite.cleanseBloodloss', () => {
        tracker.reset();
        switcher.restoreOriginalTheme();
        cleanseCount++;
        warningSent = false;
        snoozedAtSeverity = undefined;
        context.workspaceState.update('greatWhite.snoozedAtSeverity', undefined);
        updateStatusBar(0, false);
        vscode.window.showInformationMessage("Bloodloss cleansed. The theme has been restored.");
    });

    let dismissCommand = vscode.commands.registerCommand('greatWhite.dismissStatusBar', () => {
        const current = tracker.getSeverity();
        snoozedAtSeverity = current;
        context.workspaceState.update('greatWhite.snoozedAtSeverity', current);
        updateStatusBar(current, switcher.isActive);
    });

    let disableCommand = vscode.commands.registerCommand('greatWhite.disableBloodloss', async () => {
        const cfg = vscode.workspace.getConfiguration('greatWhite');
        await cfg.update('statusBar.enabled', false, vscode.ConfigurationTarget.Global);
        statusBar.hide();
        statusBarDismiss.hide();
        statusBarDisable.hide();
        vscode.window.showInformationMessage(
            "Great White context tracking disabled. Run 'Great White: Enable Context Tracking' to restore."
        );
    });

    let enableCommand = vscode.commands.registerCommand('greatWhite.enableBloodloss', async () => {
        const cfg = vscode.workspace.getConfiguration('greatWhite');
        await cfg.update('statusBar.enabled', true, vscode.ConfigurationTarget.Global);
        updateStatusBar(tracker.getSeverity(), switcher.isActive);
    });

    // --- Entry Point Decoration Provider ---
    const decorationProvider = new EntryPointDecorationProvider();
    const decorationRegistration = vscode.window.registerFileDecorationProvider(decorationProvider);

    const pkgWatcher = vscode.workspace.createFileSystemWatcher('**/package.json');
    const invalidateAndRefresh = (uri: vscode.Uri) => {
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        decorationProvider.invalidateCache(folder?.uri.toString());
        decorationProvider.fireAll();
    };
    pkgWatcher.onDidChange(invalidateAndRefresh);
    pkgWatcher.onDidCreate(invalidateAndRefresh);
    pkgWatcher.onDidDelete(invalidateAndRefresh);

    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(e => {
        if (
            e.affectsConfiguration('greatWhite.showEntryPointDecorations') ||
            e.affectsConfiguration('greatWhite.showEntryPointBadges') ||
            e.affectsConfiguration('greatWhite.showConfigFileBadges')
        ) {
            decorationProvider.fireAll();
        }
        if (
            e.affectsConfiguration('greatWhite.statusBar.alwaysShow') ||
            e.affectsConfiguration('greatWhite.statusBar.enabled')
        ) {
            updateStatusBar(tracker.getSeverity(), switcher.isActive);
        }
    });

    const resetDecorationsCmd = vscode.commands.registerCommand('greatWhite.resetDecorations', async () => {
        const config = vscode.workspace.getConfiguration('greatWhite');
        await config.update('showEntryPointDecorations', undefined, vscode.ConfigurationTarget.Global);
        await config.update('showEntryPointBadges', undefined, vscode.ConfigurationTarget.Global);
        await config.update('showConfigFileBadges', undefined, vscode.ConfigurationTarget.Global);
        decorationProvider.fireAll();
        vscode.window.showInformationMessage('Great White: Explorer decorations reset to defaults.');
    });

    const resetFileNestingCmd = vscode.commands.registerCommand('greatWhite.resetFileNesting', async () => {
        const config = vscode.workspace.getConfiguration();
        await config.update('explorer.fileNesting.enabled', undefined, vscode.ConfigurationTarget.Workspace);
        await config.update('explorer.fileNesting.patterns', undefined, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage('Great White: File nesting patterns reset to defaults.');
    });

    context.subscriptions.push(
        changeDisposable, editorDisposable,
        cleanseCommand, dismissCommand, disableCommand, enableCommand,
        decorationRegistration, decorationProvider,
        pkgWatcher, configChangeDisposable,
        resetDecorationsCmd, resetFileNestingCmd
    );

    // Render initial (healthy) state immediately on activation
    updateStatusBar(0, false);
}

function evaluateSeverity(severity: number) {
    const cfg = vscode.workspace.getConfiguration('greatWhite');
    const triggerAt = cfg.get<number>('bloodloss.triggerSeverity', 75);
    const restoreAt = triggerAt - 20;

    if (severity > triggerAt) {
        switcher.switchToBloodloss();
    } else if (severity < restoreAt) {
        switcher.restoreOriginalTheme();
    }

    // One-time warning toast — fires the first time severity crosses the warning threshold
    // previousSeverity still holds the last call's value here (updateStatusBar hasn't run yet)
    const warnAt = cfg.get<number>('bloodloss.warningSeverity', 50);
    if (warnAt > 0 && !warningSent && severity >= warnAt && previousSeverity < warnAt) {
        vscode.window.showWarningMessage(
            `Great White: Context complexity rising (score ${Math.round(severity)}/100). Consider a checkpoint before Bloodloss activates.`
        );
        warningSent = true;
    }

    // Reset warning gate when fully healthy again so the next spike re-triggers it
    if (severity < 10) {
        warningSent = false;
    }

    updateStatusBar(severity, switcher.isActive);
}

function updateStatusBar(severity: number, bloodlossActive: boolean) {
    const cfg = vscode.workspace.getConfiguration('greatWhite');
    const enabled = cfg.get<boolean>('statusBar.enabled', true);
    const alwaysShow = cfg.get<boolean>('statusBar.alwaysShow', true);
    const triggerAt = cfg.get<number>('bloodloss.triggerSeverity', 75);

    // Master kill switch
    if (!enabled) {
        statusBar.hide();
        statusBarDismiss.hide();
        statusBarDisable.hide();
        return;
    }

    // Snooze: hide until severity climbs 10+ pts above the dismissed level or drops back below 10
    if (snoozedAtSeverity !== undefined) {
        if (severity < 10 || severity >= snoozedAtSeverity + 10) {
            snoozedAtSeverity = undefined;
            extContext.workspaceState.update('greatWhite.snoozedAtSeverity', undefined);
        } else {
            statusBar.hide();
            statusBarDismiss.hide();
            statusBarDisable.hide();
            return;
        }
    }

    // Hide entirely when healthy and always-show is off
    if (severity < 10 && !alwaysShow) {
        statusBar.hide();
        statusBarDismiss.hide();
        statusBarDisable.hide();
        return;
    }

    // Trend arrow — compare against previous severity before updating it
    const delta = severity - previousSeverity;
    const trend = delta > 3 ? '↑' : delta < -3 ? '↓' : '→';
    previousSeverity = severity;

    const score = Math.round(severity);
    const pct = Math.min(100, score);
    const hotFile = tracker.getHottestFile();
    const hotFileStr = hotFile
        ? `Hottest file: ${hotFile.label} (${(hotFile.chars / 1000).toFixed(1)} KB).`
        : '';

    if (bloodlossActive) {
        statusBar.text = `🩸 ${score} ${trend}`;
        statusBar.color = undefined;
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBar.tooltip = [
            `Bloodloss active — AI output velocity critical.`,
            `Score: ${score}/100 (~${pct}% of context capacity).`,
            hotFileStr,
            `Cleanses this session: ${cleanseCount}.`,
            `Click to cleanse and restore theme.`
        ].filter(Boolean).join('\n');
    } else if (score >= 50) {
        statusBar.text = `🦈 ${score} ${trend}`;
        statusBar.color = new vscode.ThemeColor('charts.yellow');
        statusBar.backgroundColor = undefined;
        statusBar.tooltip = [
            `Context complexity high — score ${score}/100 (~${pct}% of context window).`,
            `Warning: checkpoint before Bloodloss activates at ${triggerAt}.`,
            hotFileStr,
            `Click to cleanse and reset score.`
        ].filter(Boolean).join('\n');
    } else if (score >= 10) {
        statusBar.text = `🦈 ${score} ${trend}`;
        statusBar.color = undefined;
        statusBar.backgroundColor = undefined;
        statusBar.tooltip = [
            `Context complexity building — score ${score}/100 (~${pct}% of context window).`,
            `Bloodloss alarm activates at ${triggerAt}.`,
            hotFileStr,
            `Click to cleanse and reset score.`
        ].filter(Boolean).join('\n');
    } else {
        // Healthy
        statusBar.text = `🦈 ${score} ${trend}`;
        statusBar.color = new vscode.ThemeColor('charts.green');
        statusBar.backgroundColor = undefined;
        statusBar.tooltip = [
            `Context healthy — score ${score}/100 (~${pct}% of context window).`,
            hotFileStr || 'No files tracked yet.',
            `Bloodloss alarm threshold: ${triggerAt}.`
        ].join('\n');
    }

    statusBar.show();

    // Dismiss (snooze) button — only when score is elevated
    if (score >= 10) {
        statusBarDismiss.show();
    } else {
        statusBarDismiss.hide();
    }

    // Disable button — visible whenever the main item is visible
    statusBarDisable.show();
}

export function deactivate() {
    return switcher?.restoreOriginalTheme();
}


// Re-evaluate on document change
let changeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
    const severity = tracker.trackChange(event);
    evaluateSeverity(severity);
});

// Re-evaluate when switching files
let editorDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
        // Recalculate stats for the new active editor
        const severity = tracker.trackChange({
            document: editor.document,
            contentChanges: [],
            reason: undefined
        } as any);
        evaluateSeverity(severity);
    } else {
        switcher.restoreOriginalTheme();
    }
});

let cleanseCommand = vscode.commands.registerCommand('greatWhite.cleanseBloodloss', () => {
    tracker.reset();
    switcher.restoreOriginalTheme();
    updateStatusBar(0, false);
    vscode.window.showInformationMessage("Bloodloss cleansed. The theme has been restored.");
});

// --- Entry Point Decoration Provider ---
const decorationProvider = new EntryPointDecorationProvider();
const decorationRegistration = vscode.window.registerFileDecorationProvider(decorationProvider);

const pkgWatcher = vscode.workspace.createFileSystemWatcher('**/package.json');
const invalidateAndRefresh = (uri: vscode.Uri) => {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    decorationProvider.invalidateCache(folder?.uri.toString());
    decorationProvider.fireAll();
};
pkgWatcher.onDidChange(invalidateAndRefresh);
pkgWatcher.onDidCreate(invalidateAndRefresh);
pkgWatcher.onDidDelete(invalidateAndRefresh);

const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(e => {
    if (
        e.affectsConfiguration('greatWhite.showEntryPointDecorations') ||
        e.affectsConfiguration('greatWhite.showEntryPointBadges') ||
        e.affectsConfiguration('greatWhite.showConfigFileBadges')
    ) {
        decorationProvider.fireAll();
    }
});

const resetDecorationsCmd = vscode.commands.registerCommand('greatWhite.resetDecorations', async () => {
    const config = vscode.workspace.getConfiguration('greatWhite');
    await config.update('showEntryPointDecorations', undefined, vscode.ConfigurationTarget.Global);
    await config.update('showEntryPointBadges', undefined, vscode.ConfigurationTarget.Global);
    await config.update('showConfigFileBadges', undefined, vscode.ConfigurationTarget.Global);
    decorationProvider.fireAll();
    vscode.window.showInformationMessage('Great White: Explorer decorations reset to defaults.');
});

const resetFileNestingCmd = vscode.commands.registerCommand('greatWhite.resetFileNesting', async () => {
    const config = vscode.workspace.getConfiguration();
    await config.update('explorer.fileNesting.enabled', undefined, vscode.ConfigurationTarget.Workspace);
    await config.update('explorer.fileNesting.patterns', undefined, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage('Great White: File nesting patterns reset to defaults.');
});

context.subscriptions.push(
    changeDisposable, editorDisposable, cleanseCommand,
    decorationRegistration, decorationProvider,
    pkgWatcher, configChangeDisposable,
    resetDecorationsCmd, resetFileNestingCmd
);
}

function evaluateSeverity(severity: number) {
    const cfg = vscode.workspace.getConfiguration('greatWhite');
    const triggerAt = cfg.get<number>('bloodloss.triggerSeverity', 75);
    const restoreAt = triggerAt - 20;

    if (severity > triggerAt) {
        switcher.switchToBloodloss();
    } else if (severity < restoreAt) {
        switcher.restoreOriginalTheme();
    }

    updateStatusBar(severity, switcher.isActive);
}

function updateStatusBar(severity: number, bloodlossActive: boolean) {
    if (severity < 10) {
        statusBar.hide();
        return;
    }
    const score = Math.round(severity);
    if (bloodlossActive) {
        statusBar.text = `🩸 ${score}`;
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBar.tooltip = `Great White: Context bloat alarm active — score ${score}/100. Click to cleanse.`;
    } else {
        statusBar.text = `🦈 ${score}`;
        statusBar.backgroundColor = undefined;
        statusBar.tooltip = `Great White: Context complexity climbing — score ${score}/100. Click to reset.`;
    }
    statusBar.show();
}

export function deactivate() {
    return switcher?.restoreOriginalTheme();
}
