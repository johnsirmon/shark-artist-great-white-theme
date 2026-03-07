import * as vscode from 'vscode';

export class GenerationTracker {
    private docStats: Map<string, { lastSize: number, lastUpdateTime: number, velocity: number }> = new Map();
    // Bloat Severity: 0 - 100
    private currentSeverity: number = 0;

    constructor() { }

    public trackChange(event: vscode.TextDocumentChangeEvent): number {
        const doc = event.document;
        // Ignore things that aren't real files or are output channels
        if (doc.uri.scheme !== 'file' && doc.uri.scheme !== 'untitled') {
            return this.currentSeverity;
        }

        const uriStr = doc.uri.toString();
        const now = Date.now();
        const currentSize = doc.getText().length;

        let stat = this.docStats.get(uriStr);
        if (!stat) {
            stat = { lastSize: currentSize, lastUpdateTime: now, velocity: 0 };
            this.docStats.set(uriStr, stat);
            return this.currentSeverity; // Give it a baseline
        }

        // Calculate velocity (chars per second)
        const timeDiff = now - stat.lastUpdateTime;
        if (timeDiff > 0) {
            const sizeDiff = currentSize - stat.lastSize;

            // Only care about additions for spew
            if (sizeDiff > 0) {
                const currentVelocity = (sizeDiff / timeDiff) * 1000; // chars/sec
                // Smoothed velocity
                stat.velocity = stat.velocity * 0.7 + currentVelocity * 0.3;
            } else {
                // If it shrunk or stayed the same
                stat.velocity = stat.velocity * 0.9;
            }
        }

        stat.lastSize = currentSize;
        stat.lastUpdateTime = now;

        // Calculate severity based on this file
        this.currentSeverity = this.calculateSeverity(currentSize, stat.velocity);

        return this.currentSeverity;
    }

    public getSeverity(): number {
        return this.currentSeverity;
    }

    public decaySeverity() {
        if (this.currentSeverity > 0) {
            this.currentSeverity = Math.max(0, this.currentSeverity - 2);
            // also decay velocities
            for (let stat of this.docStats.values()) {
                stat.velocity *= 0.8;
            }
        }
    }

    public reset() {
        this.currentSeverity = 0;
        this.docStats.clear();
    }

    private calculateSeverity(size: number, velocity: number): number {
        const cfg = vscode.workspace.getConfiguration('greatWhite');
        const sizeThreshold = cfg.get<number>('bloodloss.sizeThreshold', 500000);
        const velocityThreshold = cfg.get<number>('bloodloss.velocityThreshold', 5000);

        // Bloat factor from file size (0–50 pts); maxes at sizeThreshold chars
        const bloatScore = Math.min(50, (size / sizeThreshold) * 50);

        // Velocity score (0–50 pts); maxes at velocityThreshold chars/sec
        const velocityScore = Math.min(50, (velocity / velocityThreshold) * 50);

        return Math.min(100, bloatScore + velocityScore);
    }
}
