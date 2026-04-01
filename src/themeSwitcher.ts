import * as vscode from 'vscode';

interface ThemeEntry {
    label: string;
    themeId: string;
    shortName: string;
    icon: string;
    detail?: string;
}

const GW_THEMES: ThemeEntry[] = [
    { label: 'Great White (Dark)',               themeId: 'Great White (Dark)',               shortName: 'Dark',      icon: '🌊' },
    { label: 'Great White (Light)',              themeId: 'Great White (Light)',              shortName: 'Light',     icon: '☀️' },
    { label: 'Great White (Storm)',              themeId: 'Great White (Storm)',              shortName: 'Storm',     icon: '🌩️' },
    { label: 'Great White (Frost)',              themeId: 'Great White (Frost)',              shortName: 'Frost',     icon: '❄️' },
    { label: 'Great White (High Contrast Dark)', themeId: 'Great White (High Contrast Dark)', shortName: 'HC Dark',   icon: '🌑' },
    { label: 'Great White (High Contrast Light)',themeId: 'Great White (High Contrast Light)',shortName: 'HC Light',  icon: '🌕' },
    { label: 'Great White (Bloodloss)',          themeId: 'Great White (Bloodloss)',          shortName: 'Bloodloss', icon: '🩸', detail: 'Overflow / context-alarm theme — auto-applied at high context usage' },
];

function getActiveThemeId(): string {
    return vscode.workspace.getConfiguration().get<string>('workbench.colorTheme', '');
}

function findEntry(themeId: string): ThemeEntry | undefined {
    return GW_THEMES.find(t => t.themeId === themeId);
}

export class ThemeSwitcher implements vscode.Disposable {
    private statusBar!: vscode.StatusBarItem;
    private disposables: vscode.Disposable[] = [];

    public start(): void {
        this.statusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            10,
        );
        this.statusBar.command = 'greatWhite.switchTheme';
        this.statusBar.tooltip = 'Switch Great White theme variant';
        this.disposables.push(this.statusBar);

        const configSub = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('workbench.colorTheme')) {
                this.refresh();
            }
        });
        this.disposables.push(configSub);

        const switchCmd = vscode.commands.registerCommand('greatWhite.switchTheme', () => {
            this.showPicker();
        });
        this.disposables.push(switchCmd);

        this.refresh();
        this.statusBar.show();
    }

    public refresh(): void {
        const themeId = getActiveThemeId();
        const entry = findEntry(themeId);

        if (entry) {
            this.statusBar.text = `${entry.icon} ${entry.shortName}`;
        } else {
            this.statusBar.text = `🦈 Theme`;
        }
    }

    private async showPicker(): Promise<void> {
        const currentThemeId = getActiveThemeId();
        const currentEntry = findEntry(currentThemeId);

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
                .update('workbench.colorTheme', themeId, vscode.ConfigurationTarget.Global);
        }
    }

    public dispose(): void {
        for (const d of this.disposables) { d.dispose(); }
        this.disposables = [];
    }
}
