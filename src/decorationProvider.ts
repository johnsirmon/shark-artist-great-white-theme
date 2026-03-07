import * as vscode from 'vscode';
import * as path from 'path';

const ENTRY_FILENAMES = new Set([
    // JavaScript / TypeScript
    'index.ts', 'index.js', 'main.ts', 'app.ts', 'server.ts', 'cli.ts',
    // C / C++
    'main.c', 'main.cc', 'main.cpp',
    // PowerShell
    'setup.ps1', 'activate.ps1', 'install.ps1', 'main.ps1',
    // Shell
    'install.sh', 'setup.sh', 'bootstrap.sh', 'entrypoint.sh', 'run.sh', 'start.sh', 'main.sh',
    // Python
    'main.py', '__main__.py'
]);

const CONFIG_PATTERN = /^(.*\.config\.(ts|js|mjs)|.*\.rc\.js|\.eslintrc.*|jest\.config.*|vitest\.config.*|next\.config.*|vite\.config.*|CMakeLists\.txt|vcpkg\.json|Makefile|GNUmakefile|requirements\.txt|.*\.props|.*\.cmake|Directory\..+\.props|.*\.spec|.*\.ini|.*\.conf|.*\.service|.*\.timer|.*\.logrotate|.*\.init|.*\.default)$/i;

export class EntryPointDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
    private readonly _onDidChangeFileDecorations =
        new vscode.EventEmitter<undefined | vscode.Uri | vscode.Uri[]>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    /** Keyed by workspace folder URI string → resolved absolute entry-point paths */
    private readonly _entryPointCache = new Map<string, Set<string>>();

    async provideFileDecoration(
        uri: vscode.Uri,
        _token: vscode.CancellationToken
    ): Promise<vscode.FileDecoration | undefined> {
        const config = vscode.workspace.getConfiguration('greatWhite');
        if (!config.get<boolean>('showEntryPointDecorations', true)) {
            return undefined;
        }

        const showEntryBadges = config.get<boolean>('showEntryPointBadges', true);
        const showConfigBadges = config.get<boolean>('showConfigFileBadges', true);
        if (!showEntryBadges && !showConfigBadges) {
            return undefined;
        }

        const folder = vscode.workspace.getWorkspaceFolder(uri);
        if (!folder) {
            return undefined;
        }

        const entryPoints = await this._getEntryPoints(folder);
        const basename = path.basename(uri.fsPath);

        // Match against package.json-derived entry points
        if (showEntryBadges && entryPoints.has(uri.fsPath)) {
            return {
                badge: 'E',
                tooltip: 'Entry Point',
                color: new vscode.ThemeColor('greatWhite.entryPointForeground'),
                propagate: true
            };
        }

        // Fallback: well-known entry filenames within 2 directory levels of the workspace root
        if (showEntryBadges && ENTRY_FILENAMES.has(basename)) {
            const relative = path.relative(folder.uri.fsPath, uri.fsPath);
            const depth = relative.split(path.sep).length - 1;
            if (depth <= 2) {
                return {
                    badge: 'E',
                    tooltip: 'Entry Point',
                    color: new vscode.ThemeColor('greatWhite.entryPointForeground'),
                    propagate: true
                };
            }
        }

        // Config / build file heuristic
        if (showConfigBadges && CONFIG_PATTERN.test(basename)) {
            return {
                badge: 'C',
                tooltip: 'Config / Build File',
                color: new vscode.ThemeColor('greatWhite.configFileForeground'),
                propagate: false
            };
        }

        return undefined;
    }

    private async _getEntryPoints(folder: vscode.WorkspaceFolder): Promise<Set<string>> {
        const key = folder.uri.toString();
        const cached = this._entryPointCache.get(key);
        if (cached) {
            return cached;
        }

        const set = new Set<string>();
        const found = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folder, 'package.json'),
            '**/node_modules/**',
            1
        );

        if (found.length > 0) {
            try {
                const raw = await vscode.workspace.fs.readFile(found[0]);
                const pkg = JSON.parse(Buffer.from(raw).toString('utf-8')) as Record<string, unknown>;
                const root = folder.uri.fsPath;

                if (pkg.main) { this._extractPath(pkg.main, root, set); }
                if (pkg.module) { this._extractPath(pkg.module, root, set); }
                if (pkg.exports) { this._extractAllValues(pkg.exports, root, set); }
                if (pkg.bin) { this._extractAllValues(pkg.bin, root, set); }
            } catch {
                // Malformed package.json — skip silently
            }
        }

        this._entryPointCache.set(key, set);
        return set;
    }

    private _extractPath(value: unknown, root: string, out: Set<string>): void {
        if (typeof value === 'string') {
            out.add(path.resolve(root, value));
        }
    }

    private _extractAllValues(obj: unknown, root: string, out: Set<string>): void {
        if (typeof obj === 'string') {
            this._extractPath(obj, root, out);
        } else if (obj !== null && typeof obj === 'object') {
            for (const v of Object.values(obj as Record<string, unknown>)) {
                this._extractAllValues(v, root, out);
            }
        }
    }

    /** Invalidate cache for one folder (by its URI string) or all if omitted */
    invalidateCache(folderUri?: string): void {
        if (folderUri) {
            this._entryPointCache.delete(folderUri);
        } else {
            this._entryPointCache.clear();
        }
    }

    /** Fire a broad refresh so VS Code re-queries all visible file decorations */
    fireAll(): void {
        this._onDidChangeFileDecorations.fire(undefined);
    }

    dispose(): void {
        this._onDidChangeFileDecorations.dispose();
    }
}
