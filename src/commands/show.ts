import * as path from "path";
import * as vscode from "vscode";
import { explorerNodeManager } from "../explorer/nodeManager";
import { TutlyNode } from "../explorer/node";
import { tutlyChannel } from "../channel";
import { tutlyExecutor } from "../executor";
import { tutlyManager } from "../manager";
import { IAssignment, IQuickItemEx, AssignmentState } from "../shared";
import { promptForSignIn } from "../utils/ui";
import { tutlyPreviewProvider } from "../webview/previewProvider";

export async function previewProblem(input: IAssignment, isSideMode: boolean = false): Promise<void> {
    try {
        const node = input;

        const descString: string = await tutlyExecutor.getDescription(node.id);
        tutlyPreviewProvider.show(descString, node, isSideMode);
    } catch (error) {
        const errorMsg = `Failed to preview assignment: ${error}`;
        tutlyChannel.appendLine(errorMsg);
        vscode.window.showErrorMessage(errorMsg);
    }
}

export async function showProblem(node?: TutlyNode): Promise<void> {
    if (!node) {
        return;
    }
    await showProblemInternal(node);
}

export async function searchProblem(): Promise<void> {
    if (!tutlyManager.getUser()) {
        promptForSignIn();
        return;
    }

    // Get all assignments from all loaded courses
    const allNodes = explorerNodeManager.getAllNodes();
    const assignmentNodes = allNodes.filter((node) => node.isProblem);

    if (assignmentNodes.length === 0) {
        vscode.window.showInformationMessage("No assignments loaded. Please expand courses to load assignments.");
        return;
    }

    const picks: Array<IQuickItemEx<IAssignment>> = assignmentNodes.map((node) => ({
        label: `${parseAssignmentDecorator(node.state)}${node.name}`,
        description: node.courseName || "",
        detail: `Max Submissions: ${node.maxSubmissions || "N/A"}`,
        value: {
            id: node.id,
            name: node.name,
            state: node.state,
            courseId: node.courseId,
            courseName: node.courseName,
            details: node.details,
            maxSubmissions: node.maxSubmissions,
        },
    }));

    const choice: IQuickItemEx<IAssignment> | undefined = await vscode.window.showQuickPick(picks, {
        matchOnDetail: true,
        placeHolder: "Select an assignment",
    });
    if (!choice) {
        return;
    }
    await showProblemInternal(choice.value);
}

async function showProblemInternal(node: IAssignment): Promise<void> {
    try {
        // Generate unique folder name: assignmentName-courseIdLast5
        const courseIdSuffix = node.courseId ? node.courseId.slice(-5) : "00000";
        const safeName = node.name.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-");
        const folderName = `${safeName}-${courseIdSuffix}`;

        // Use tutly-assignments folder in home directory
        const baseFolder = path.join(require("os").homedir(), "tutly-assignments");
        const assignmentFolder = path.join(baseFolder, folderName);

        // Check if already exists
        if (require("fs").existsSync(assignmentFolder)) {
            // Already downloaded, clear workspace and open it
            const folderUri = vscode.Uri.file(assignmentFolder);
            vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders?.length || 0, { uri: folderUri });
            await vscode.commands.executeCommand("workbench.files.action.focusFilesExplorer");
            return;
        }

        // Download assignment repository
        const repoUrl = "https://git.tutly.in/udaysagar/check";

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Downloading assignment: ${node.name}`,
                cancellable: false,
            },
            async (progress) => {
                progress.report({ message: "Downloading..." });

                const { downloadRepository } = await import("../utils/repoDownloader");
                await downloadRepository(repoUrl, assignmentFolder);

                progress.report({ message: "Complete!" });
            }
        );

        // Clear all workspace folders and add only this assignment folder
        const assignmentUri = vscode.Uri.file(assignmentFolder);
        vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders?.length || 0, { uri: assignmentUri });

        // Focus the files explorer
        await vscode.commands.executeCommand("workbench.files.action.focusFilesExplorer");

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to download assignment: ${error}`);
        tutlyChannel.appendLine(`Error downloading assignment: ${error}`);
    }
}

function parseAssignmentDecorator(state: AssignmentState): string {
    switch (state) {
        case AssignmentState.Submitted:
            return "$(check) ";
        case AssignmentState.NotSubmitted:
            return "$(x) ";
        default:
            return "";
    }
}
