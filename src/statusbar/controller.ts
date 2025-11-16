import * as vscode from "vscode";
import { UserStatus } from "../shared";
import { TutlyStatusBarItem } from "./item";

class TutlyStatusBarController implements vscode.Disposable {
    private statusBar: TutlyStatusBarItem;
    private configurationChangeListener: vscode.Disposable;

    constructor() {
        this.statusBar = new TutlyStatusBarItem();
        this.setStatusBarVisibility();

        this.configurationChangeListener = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("tutly.enableStatusBar")) {
                this.setStatusBarVisibility();
            }
        }, this);
    }

    public updateStatusBar(status: UserStatus, user?: string): void {
        this.statusBar.updateStatusBar(status, user);
    }

    public dispose(): void {
        this.statusBar.dispose();
        this.configurationChangeListener.dispose();
    }

    private setStatusBarVisibility(): void {
        if (this.isStatusBarEnabled()) {
            this.statusBar.show();
        } else {
            this.statusBar.hide();
        }
    }

    private isStatusBarEnabled(): boolean {
        const configuration = vscode.workspace.getConfiguration();
        return configuration.get<boolean>("tutly.enableStatusBar", true);
    }
}

export const tutlyStatusBarController: TutlyStatusBarController = new TutlyStatusBarController();
