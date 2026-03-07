import * as vscode from 'vscode';
import { GenerationTracker } from './tracker';
import { ThemeSwitcher } from './themeSwitcher';
import { EntryPointDecorationProvider } from './decorationProvider';

let tracker: GenerationTracker;
let switcher: ThemeSwitcher;
let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    tracker = new GenerationTracker();
    switcher = new ThemeSwitcher();

    // Status bar item — live severity indicator, click to cleanse
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'greatWhite.cleanseBloodloss';
    context.subscriptions.push(statusBar);

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
