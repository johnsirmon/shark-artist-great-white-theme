import * as vscode from 'vscode';

interface ThemeEntry {
    label: string;
    themeId: string;
    shortName: string;
    icon: string;
    /** Status bar icon tint — sourced from each theme's primary keyword accent. */
    color: string;
    detail?: string;
}

const GW_THEMES: ThemeEntry[] = [
    { label: 'Great White (Dark)',                themeId: 'Great White (Dark)',                shortName: 'Dark',      icon: '🦈', color: '#5d8fa8' },
    { label: 'Great White (Light)',               themeId: 'Great White (Light)',               shortName: 'Light',     icon: '🦈', color: '#3d667c' },
    { label: 'Great White (Storm)',               themeId: 'Great White (Storm)',               shortName: 'Storm',     icon: '🦈', color: '#4f7ea8' },
    { label: 'Great White (Frost)',               themeId: 'Great White (Frost)',               shortName: 'Frost',     icon: '🦈', color: '#2f5f84' },
    { label: 'Great White (High Contrast Dark)',  themeId: 'Great White (High Contrast Dark)',  shortName: 'HC Dark',   icon: '🦈', color: '#6eb8ff' },
    { label: 'Great White (High Contrast Light)', themeId: 'Great White (High Contrast Light)', shortName: 'HC Light',  icon: '🦈', color: '#0f5f93' },
    { label: 'Great White (Bloodloss)',           themeId: 'Great White (Bloodloss)',           shortName: 'Bloodloss', icon: '🦈', color: '#c44f5f', detail: 'Overflow / context-alarm theme — manual selection only' },
];

function getActiveThemeId(): string {
    return vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
}

function findEntry(themeId: string): ThemeEntry | undefined {
    return GW_THEMES.find(t => t.themeId === themeId);
}

export class ThemeSwitcher implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private statusBar!: vscode.StatusBarItem;

    public start(): void {
        this.statusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            200
        );
        this.statusBar.command = 'greatWhite.switchTheme';
        this.statusBar.tooltip = 'Great White: Switch Theme';
        this.disposables.push(this.statusBar);

        const configSub = vscode.workspace.onDidChangeConfiguration(e => {
            if (
                e.affectsConfiguration('workbench.colorTheme') ||
                e.affectsConfiguration('greatWhite.themeSwitcher.scope')
            ) {
                this.refresh();
            }
        });
        this.disposables.push(configSub);

        const switchCmd = vscode.commands.registerCommand('greatWhite.switchTheme', () => {
            this.showPicker();
        });
        this.disposables.push(switchCmd);

        this.refresh();
    }

    public refresh(): void {
        const entry = findEntry(getActiveThemeId());
        if (entry) {
            this.statusBar.text = `${entry.icon} ${entry.shortName}`;
            this.statusBar.color = entry.color;
            this.statusBar.show();
        } else {
            this.statusBar.color = undefined;
            this.statusBar.hide();
        }
    }

    private resolveConfigTarget(): vscode.ConfigurationTarget {
        const scope = vscode.workspace
            .getConfiguration('greatWhite.themeSwitcher')
            .get<string>('scope', 'auto');

        if (scope === 'global') {
            return vscode.ConfigurationTarget.Global;
        }
        if (scope === 'workspace' || scope === 'auto') {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                return vscode.ConfigurationTarget.Workspace;
            }
            if (scope === 'workspace') {
                vscode.window.showWarningMessage(
                    'Great White: No workspace folder is open — theme saved to global user settings.',
                );
            }
            return vscode.ConfigurationTarget.Global;
        }
        return vscode.ConfigurationTarget.Global;
    }

    private async showPicker(): Promise<void> {
        const currentThemeId = getActiveThemeId();
        const currentEntry = findEntry(currentThemeId);
        const target = this.resolveConfigTarget();

        const scopeLabel = target === vscode.ConfigurationTarget.Workspace
            ? 'workspace (.vscode/settings.json)'
            : 'global user settings';

        type PickItem = vscode.QuickPickItem & { themeId?: string; isBrowse?: boolean };

        const items: PickItem[] = [
            { label: 'Great White Variants', kind: vscode.QuickPickItemKind.Separator },
        ];

        for (const t of GW_THEMES) {
            items.push({
                label: `${t.icon}  ${t.label}`,
                description: t.themeId === currentThemeId ? '$(check) active' : undefined,
                detail: t.detail,
                themeId: t.themeId,
            });
        }

        items.push(
            { label: '', kind: vscode.QuickPickItemKind.Separator },
            {
                label: '$(color-mode)  Browse all VS Code themes…',
                isBrowse: true,
            },
            { label: '', kind: vscode.QuickPickItemKind.Separator },
            {
                label: `$(info)  Applying to: ${scopeLabel}`,
                detail: 'Change via setting: greatWhite.themeSwitcher.scope',
            },
        );

        const activeItem = currentEntry
            ? items.find(i => (i as PickItem).themeId === currentEntry.themeId)
            : undefined;

        const picked = await vscode.window.showQuickPick(items, {
            title: 'Great White: Switch Theme',
            placeHolder: 'Select a variant to apply instantly',
            matchOnDescription: true,
            activeItems: activeItem ? [activeItem] : [],
        });

        if (!picked) { return; }

        if ((picked as PickItem).isBrowse) {
            await vscode.commands.executeCommand('workbench.action.selectTheme');
            return;
        }

        const themeId = (picked as PickItem).themeId;
        if (themeId) {
            await vscode.workspace
                .getConfiguration()
                .update('workbench.colorTheme', themeId, target);
        }
    }

    public dispose(): void {
        for (const d of this.disposables) { d.dispose(); }
        this.disposables = [];
    }
}
