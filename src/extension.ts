import * as vscode from 'vscode';
import { GenerationTracker } from './tracker';
import { ThemeSwitcher } from './themeSwitcher';
import { EntryPointDecorationProvider } from './decorationProvider';

let tracker: GenerationTracker;
let switcher: ThemeSwitcher;

export function activate(context: vscode.ExtensionContext) {
    tracker = new GenerationTracker();
    switcher = new ThemeSwitcher();

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
        if (e.affectsConfiguration('greatWhite.showEntryPointDecorations')) {
            decorationProvider.fireAll();
        }
    });

    context.subscriptions.push(
        changeDisposable, editorDisposable, cleanseCommand,
        decorationRegistration, decorationProvider,
        pkgWatcher, configChangeDisposable
    );
}

function evaluateSeverity(severity: number) {
    // If severity goes above 50, switch directly to the Bloodloss Theme
    if (severity > 50) {
        switcher.switchToBloodloss();
    } else if (severity < 30) {
        // If it drops back down significantly, restore normal theme
        switcher.restoreOriginalTheme();
    }
}

export function deactivate() {
    return switcher?.restoreOriginalTheme();
}
