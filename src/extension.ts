import * as vscode from 'vscode';
import { SessionWatcher } from './sessionWatcher';
import { ContextGauge, showContextDetails } from './contextGauge';
import { EntryPointDecorationProvider } from './decorationProvider';
import { ThemeSwitcher } from './themeSwitcher';

let watcher: SessionWatcher;
let gauge: ContextGauge;
let switcher: ThemeSwitcher;

export function activate(context: vscode.ExtensionContext) {
    const cfg = vscode.workspace.getConfiguration('greatWhite');

    // --- Theme Switcher status bar button ---
    switcher = new ThemeSwitcher();
    switcher.start();

    // --- Context Gauge (replaces old Bloodloss system) ---
    watcher = new SessionWatcher();
    gauge = new ContextGauge(watcher);

    if (cfg.get<boolean>('contextGauge.enabled', true)) {
        const pollMs = cfg.get<number>('contextGauge.pollInterval', 10) * 1000;
        watcher.start(pollMs);
        gauge.start(context);
    }

    const openDetailsCmd = vscode.commands.registerCommand('greatWhite.openContextDetails', async () => {
        gauge.refresh();
        await showContextDetails(gauge.getSessions(), gauge.getChatPercent());
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
        switcher,
        watcher, gauge,
        openDetailsCmd,
        decorationRegistration, decorationProvider,
        pkgWatcher, configChangeDisposable,
        resetDecorationsCmd, resetFileNestingCmd
    );
}

export function deactivate() {}

