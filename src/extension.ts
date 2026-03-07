import * as vscode from 'vscode';
import { GenerationTracker } from './tracker';
import { ThemeSwitcher } from './themeSwitcher';

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

    context.subscriptions.push(changeDisposable, editorDisposable, cleanseCommand);
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
