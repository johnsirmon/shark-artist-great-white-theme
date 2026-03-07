import * as vscode from 'vscode';

export class ThemeSwitcher {
    private isBloodlossActive: boolean = false;
    private originalTheme: string | undefined;

    constructor() { }

    get isActive(): boolean {
        return this.isBloodlossActive;
    }

    public async switchToBloodloss() {
        if (this.isBloodlossActive) return;
        this.isBloodlossActive = true;

        const config = vscode.workspace.getConfiguration('workbench');

        // Save the theme the user was currently using so we can restore it
        this.originalTheme = config.get<string>('colorTheme');

        // Theme switch is the alarm — no popup needed
        await config.update('colorTheme', 'Great White (Bloodloss)', vscode.ConfigurationTarget.Workspace);
    }

    public async restoreOriginalTheme() {
        if (!this.isBloodlossActive) return;
        this.isBloodlossActive = false;

        const config = vscode.workspace.getConfiguration('workbench');

        // Restore whatever they had before (or default back to unset if we don't know)
        if (this.originalTheme && this.originalTheme !== 'Great White (Bloodloss)') {
            await config.update('colorTheme', this.originalTheme, vscode.ConfigurationTarget.Workspace);
        } else {
            // Remove the workspace override entirely to let user settings shine through
            await config.update('colorTheme', undefined, vscode.ConfigurationTarget.Workspace);
        }
    }
}
