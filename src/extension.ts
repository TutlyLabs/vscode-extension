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
import { initializeAssignmentView } from "./webview/assignmentViewProvider";

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
        const assignmentViewProvider = initializeAssignmentView(context);

        // Check if current folder is a Tutly assignment and load it
        const checkAndLoadAssignment = async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;

            // Reset state if no folder is open
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.commands.executeCommand('setContext', 'tutly.assignmentSelected', false);
                return;
            }

            const folderPath = workspaceFolders[0].uri.fsPath;
            const path = require("path");
            const os = require("os");
            const tutlyAssignmentsPath = path.join(os.homedir(), ".tutly", "assignments");

            // Check if this folder is inside .tutly/assignments
            if (folderPath.startsWith(tutlyAssignmentsPath)) {
                const assignmentId = path.basename(folderPath);

                // Load assignment details
                if (assignmentViewProvider && tutlyManager.getUser()) {
                    try {
                        // Try to load assignment from API
                        await assignmentViewProvider.loadAssignment(assignmentId);

                        // If successful, show assignment preview
                        vscode.commands.executeCommand('setContext', 'tutly.assignmentSelected', true);
                        vscode.commands.executeCommand('setContext', 'tutly.hasAssignmentInFolder', true);
                    } catch (error) {
                        tutlyChannel.appendLine(`Failed to load assignment: ${error}`);

                        // If assignment not found, go back to assignments view
                        vscode.commands.executeCommand('setContext', 'tutly.assignmentSelected', false);
                        vscode.commands.executeCommand('setContext', 'tutly.hasAssignmentInFolder', false);
                        vscode.window.showWarningMessage(
                            `Assignment not found. It may have been deleted or you don't have access.`,
                            'View Assignments'
                        ).then(selection => {
                            if (selection === 'View Assignments') {
                                // Close current folder and show assignments
                                vscode.commands.executeCommand('vscode.openFolder', undefined);
                            }
                        });
                    }
                } else {
                    vscode.commands.executeCommand('setContext', 'tutly.assignmentSelected', false);
                    vscode.commands.executeCommand('setContext', 'tutly.hasAssignmentInFolder', false);
                }
            } else {
                // Not a Tutly assignment folder, show assignments view
                vscode.commands.executeCommand('setContext', 'tutly.assignmentSelected', false);
                vscode.commands.executeCommand('setContext', 'tutly.hasAssignmentInFolder', false);
            }
        };

        // Check on startup with progress indicator
        const initialCheck = async () => {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Window,
                    title: "Checking for Tutly assignment...",
                    cancellable: false
                },
                async () => {
                    await checkAndLoadAssignment();
                }
            );
        };

        // Run initial check after login status is verified
        tutlyManager.getLoginStatus().then(() => initialCheck());

        // Listen for workspace changes to reload assignment
        context.subscriptions.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => {
                vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Window,
                        title: "Loading assignment...",
                        cancellable: false
                    },
                    async () => {
                        await checkAndLoadAssignment();
                    }
                );
            })
        );

        context.subscriptions.push(
            tutlyStatusBarController,
            tutlyChannel,
            tutlyPreviewProvider,
            tutlyExecutor,
            markdownEngine,
            explorerNodeManager,
            vscode.window.createTreeView("tutlyExplorer", { treeDataProvider: tutlyTreeDataProvider, showCollapseAll: true }),
            vscode.window.registerWebviewViewProvider("tutlyWelcome", welcomeViewProvider),
            vscode.window.registerWebviewViewProvider("tutlyAssignmentView", assignmentViewProvider),
            vscode.commands.registerCommand("tutly.signin", () => tutlyManager.signIn()),
            vscode.commands.registerCommand("tutly.signout", () => tutlyManager.signOut()),
            vscode.commands.registerCommand("tutly.previewAssignment", (node: TutlyNode) => {
                vscode.commands.executeCommand("setContext", "tutly.assignmentSelected", true);
                return show.previewAssignment(node);
            }),
            vscode.commands.registerCommand("tutly.showAssignment", (node: TutlyNode) => show.showAssignment(node)),
            vscode.commands.registerCommand("tutly.deleteAssignment", (node: TutlyNode) => show.deleteAssignment(node)),
            vscode.commands.registerCommand("tutly.searchAssignment", () => show.searchAssignment()),
            vscode.commands.registerCommand("tutly.refreshExplorer", () => tutlyTreeDataProvider.refresh()),
            vscode.commands.registerCommand("tutly.backToAssignments", () => {
                vscode.commands.executeCommand('setContext', 'tutly.assignmentSelected', false);
            }),
            vscode.commands.registerCommand("tutly.showAssignmentPreview", () => {
                vscode.commands.executeCommand('setContext', 'tutly.assignmentSelected', true);
            })
        );

        await tutlyManager.getLoginStatus();
        // Set initial context
        const isSignedIn = tutlyManager.getUser() !== undefined;
        vscode.commands.executeCommand('setContext', 'tutly.signedIn', isSignedIn);
        vscode.commands.executeCommand('setContext', 'tutly.assignmentSelected', false);
        vscode.commands.executeCommand('setContext', 'tutly.hasAssignmentInFolder', false);
    } catch (error) {
        tutlyChannel.appendLine(error.toString());
        promptForOpenOutputChannel("Extension initialization failed. Please open output channel for details.", DialogType.error);
    }
}

export function deactivate(): void {
}
