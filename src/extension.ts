import * as vscode from "vscode";
import * as show from "./commands/show";
import { explorerNodeManager } from "./explorer/nodeManager";
import { TutlyNode } from "./explorer/node";
import { tutlyTreeDataProvider } from "./explorer/treeDataProvider";
import { tutlyChannel } from "./channel";
import { tutlyExecutor } from "./executor";
import { tutlyManager } from "./manager";
import { tutlyStatusBarController } from "./statusbar/controller";
import { DialogType, promptForOpenOutputChannel } from "./utils/ui";
import { tutlyPreviewProvider } from "./webview/previewProvider";
import { markdownEngine } from "./webview/markdownEngine";
import { globalState } from "./globalState";
import { initializeWelcomeView, welcomeViewProvider } from "./webview/welcomeView";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        if (!(await tutlyExecutor.meetRequirements(context))) {
            throw new Error("The environment doesn't meet requirements.");
        }

        tutlyManager.on("statusChanged", () => {
            tutlyStatusBarController.updateStatusBar(tutlyManager.getStatus(), tutlyManager.getUser());
            tutlyTreeDataProvider.refresh();
            const isSignedIn = tutlyManager.getUser() !== undefined;
            vscode.commands.executeCommand('setContext', 'tutly.signedIn', isSignedIn);
        });

        tutlyTreeDataProvider.initialize(context);
        globalState.initialize(context);
        initializeWelcomeView(context);

        context.subscriptions.push(
            tutlyStatusBarController,
            tutlyChannel,
            tutlyPreviewProvider,
            tutlyExecutor,
            markdownEngine,
            explorerNodeManager,
            vscode.window.createTreeView("tutlyExplorer", { treeDataProvider: tutlyTreeDataProvider, showCollapseAll: true }),
            vscode.window.registerWebviewViewProvider("tutlyWelcome", welcomeViewProvider),
            vscode.commands.registerCommand("tutly.signin", () => tutlyManager.signIn()),
            vscode.commands.registerCommand("tutly.signout", () => tutlyManager.signOut()),
            vscode.commands.registerCommand("tutly.previewProblem", (node: TutlyNode) => show.previewProblem(node)),
            vscode.commands.registerCommand("tutly.showProblem", (node: TutlyNode) => show.showProblem(node)),
            vscode.commands.registerCommand("tutly.searchProblem", () => show.searchProblem()),
            vscode.commands.registerCommand("tutly.refreshExplorer", () => tutlyTreeDataProvider.refresh())
        );

        await tutlyManager.getLoginStatus();
        // Set initial context
        const isSignedIn = tutlyManager.getUser() !== undefined;
        vscode.commands.executeCommand('setContext', 'tutly.signedIn', isSignedIn);
    } catch (error) {
        tutlyChannel.appendLine(error.toString());
        promptForOpenOutputChannel("Extension initialization failed. Please open output channel for details.", DialogType.error);
    }
}

export function deactivate(): void {
}
