import * as path from "path";
import * as vscode from "vscode";
import { explorerNodeManager } from "../explorer/nodeManager";
import { TutlyNode } from "../explorer/node";
import { tutlyChannel } from "../channel";
import { tutlyManager } from "../manager";
import { IAssignment, IQuickItemEx, AssignmentState } from "../shared";
import { promptForSignIn } from "../utils/ui";
import { getAssignmentViewProvider } from "../webview/assignmentViewProvider";

export async function previewAssignment(input: IAssignment): Promise<void> {
    try {
        const node = input;

        // Always show in sidebar view
        const viewProvider = getAssignmentViewProvider();
        if (viewProvider) {
            // Show loading state first
            viewProvider.showLoading(node);

            // Fetch fresh data from API
            await viewProvider.loadAssignment(node.id);

            // Focus the assignment view
            await vscode.commands.executeCommand("tutlyAssignmentView.focus");
        }
    } catch (error) {
        const errorMsg = `Failed to preview assignment: ${error}`;
        tutlyChannel.appendLine(errorMsg);
        vscode.window.showErrorMessage(errorMsg);
    }
}

export async function showAssignment(node?: TutlyNode): Promise<void> {
    if (!node) {
        return;
    }
    await showAssignmentInternal(node);
}

export async function searchAssignment(): Promise<void> {
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
    await showAssignmentInternal(choice.value);
}

async function showAssignmentInternal(node: IAssignment): Promise<void> {
    try {
        // Use assignment ID as folder name
        const folderName = node.id;

        // Use .tutly/assignments folder in home directory
        const baseFolder = path.join(require("os").homedir(), ".tutly", "assignments");
        const assignmentFolder = path.join(baseFolder, folderName);

        // Check if already exists
        if (require("fs").existsSync(assignmentFolder)) {
            // Already downloaded, open folder in current window
            const folderUri = vscode.Uri.file(assignmentFolder);

            // Store assignment ID in global state
            const { globalState } = await import("../globalState");
            globalState.setCurrentAssignmentId(node.id);

            // Open folder in current window
            await vscode.commands.executeCommand("vscode.openFolder", folderUri, false);
            return;
        }        // Download assignment repository
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

        // Store assignment ID in global state
        const { globalState } = await import("../globalState");
        globalState.setCurrentAssignmentId(node.id);

        // Open folder in current window
        const assignmentUri = vscode.Uri.file(assignmentFolder);
        await vscode.commands.executeCommand("vscode.openFolder", assignmentUri, false);    } catch (error) {
        vscode.window.showErrorMessage(`Failed to download assignment: ${error}`);
        tutlyChannel.appendLine(`Error downloading assignment: ${error}`);
    }
}

export async function deleteAssignment(node?: TutlyNode): Promise<void> {
    if (!node) {
        return;
    }

    try {
        const folderName = node.id;
        const baseFolder = path.join(require("os").homedir(), ".tutly", "assignments");
        const assignmentFolder = path.join(baseFolder, folderName);

        if (!require("fs").existsSync(assignmentFolder)) {
            vscode.window.showInformationMessage("Assignment folder does not exist.");
            return;
        }

        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the folder for "${node.name}"? This cannot be undone.`,
            { modal: true },
            "Delete"
        );

        if (confirmation !== "Delete") {
            return;
        }

        require("fs").rmSync(assignmentFolder, { recursive: true, force: true });
        vscode.window.showInformationMessage(`Deleted assignment folder: ${node.name}`);

        // Refresh the tree to update icons
        const { tutlyTreeDataProvider } = await import("../explorer/treeDataProvider");
        tutlyTreeDataProvider.refresh();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete assignment folder: ${error}`);
        tutlyChannel.appendLine(`Error deleting assignment folder: ${error}`);
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
