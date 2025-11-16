import * as vscode from "vscode";
import { AssignmentState, IAssignment } from "../shared";
import { markdownEngine } from "./markdownEngine";
import { createAPIClient } from "../utils/api";
import { tutlyChannel } from "../channel";

class AssignmentViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "tutlyAssignmentView";

    private _view?: vscode.WebviewView;
    private _currentAssignment?: IAssignment;
    private _currentDescription?: string;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        // If we have content, show it
        if (this._currentAssignment && this._currentDescription) {
            webviewView.webview.html = this._getHtmlForWebview(
                webviewView.webview,
                this._currentAssignment,
                this._currentDescription
            );
        } else {
            webviewView.webview.html = this._getEmptyHtml();
        }

        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case "openFolder":
                    if (this._currentAssignment) {
                        vscode.commands.executeCommand("tutly.showAssignment", this._currentAssignment);
                    }
                    break;
                case "backToAssignments":
                    vscode.commands.executeCommand("tutly.backToAssignments");
                    break;
                case "submitAssignment":
                    vscode.window.showInformationMessage("Assignment submission coming soon!");
                    break;
                case "setFontSize":
                    // Font size is handled in the webview state
                    break;
            }
        });
    }

    public showLoading(assignment: IAssignment) {
        this._currentAssignment = assignment;

        if (this._view && this._view.visible !== undefined) {
            try {
                this._view.webview.html = this._getLoadingHtml(assignment.name);
                this._view.show?.(true);
            } catch (error) {
                tutlyChannel.appendLine(`Failed to show loading state: ${error}`);
            }
        }
    }

    public async loadAssignment(assignmentId: string): Promise<void> {
        try {
            const apiClient = await createAPIClient();
            const result = await apiClient.getAssignmentDetails(assignmentId);

            if (result.error || !result.assignment) {
                throw new Error(result.error || "Assignment not found");
            }

            const assignment: IAssignment = {
                id: result.assignment.id,
                name: result.assignment.title,
                state: AssignmentState.Unknown, // Will be determined by submissions
                courseId: result.assignment.class?.courseId,
                courseName: result.assignment.class?.course?.title,
                details: result.assignment.details,
                maxSubmissions: result.assignment.maxSubmissions,
            };

            this._currentAssignment = assignment;
            this._currentDescription = result.assignment.details || "";

            if (this._view && this._view.visible !== undefined) {
                try {
                    this._view.webview.html = this._getHtmlForWebview(
                        this._view.webview,
                        assignment,
                        this._currentDescription
                    );
                } catch (error) {
                    tutlyChannel.appendLine(`Failed to update webview: ${error}`);
                }
            }
        } catch (error) {
            tutlyChannel.appendLine(`Failed to load assignment: ${error}`);
            if (this._view) {
                this._view.webview.html = this._getErrorHtml(
                    "Failed to load assignment details. Please try again."
                );
            }
            // Re-throw to let caller handle it
            throw error;
        }
    }

    public showAssignment(assignment: IAssignment, description: string) {
        this._currentAssignment = assignment;
        this._currentDescription = description;

        if (this._view && this._view.visible !== undefined) {
            try {
                this._view.webview.html = this._getHtmlForWebview(
                    this._view.webview,
                    assignment,
                    description
                );
                this._view.show?.(true);
            } catch (error) {
                tutlyChannel.appendLine(`Failed to show assignment: ${error}`);
            }
        }
    }

    public clear() {
        this._currentAssignment = undefined;
        this._currentDescription = undefined;

        if (this._view) {
            this._view.webview.html = this._getEmptyHtml();
        }
    }

    private _getEmptyHtml(): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        padding: 20px;
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-font-family);
                    }
                    .empty-state {
                        text-align: center;
                        margin-top: 50px;
                        opacity: 0.6;
                    }
                </style>
            </head>
            <body>
                <div class="empty-state">
                    <p>Click on an assignment to preview</p>
                </div>
            </body>
            </html>
        `;
    }

    private _getLoadingHtml(assignmentName: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        padding: 20px;
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-font-family);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 200px;
                    }
                    .loading {
                        text-align: center;
                    }
                    .spinner {
                        border: 3px solid var(--vscode-panel-border);
                        border-top: 3px solid var(--vscode-button-background);
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 15px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Loading ${assignmentName}...</p>
                </div>
            </body>
            </html>
        `;
    }

    private _getErrorHtml(message: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        padding: 20px;
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-font-family);
                    }
                    .error-state {
                        text-align: center;
                        margin-top: 50px;
                        color: var(--vscode-errorForeground);
                    }
                </style>
            </head>
            <body>
                <div class="error-state">
                    <p>${message}</p>
                </div>
            </body>
            </html>
        `;
    }

    private _preprocessMarkdown(markdown: string): string {
        return markdown.replace(
            /!\[(.*?)\]\((.*?)\s+\{(\d+)x(\d+)\}\)/g,
            (_match, alt, url, width, height) => {
                return `\n\n<div style="margin: 10px 0;"><img src="${url}" alt="${alt}" width="${width}" height="${height}" style="max-width: 100%; height: auto; border-radius: 4px;" /></div>\n\n`;
            }
        );
    }

    private _getHtmlForWebview(
        _webview: vscode.Webview,
        assignment: IAssignment,
        description: string
    ): string {
        const head = markdownEngine.render(`# ${assignment.name}`);
        const info = assignment.courseName
            ? markdownEngine.render(`**Course:** ${assignment.courseName}`)
            : "";

        const processedDescription = this._preprocessMarkdown(description);
        const renderedDescription = markdownEngine.render(processedDescription);

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
                ${markdownEngine.getStyles()}
                <style>
                    body {
                        padding: 8px;
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        line-height: 1.6;
                    }
                    code {
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }
                    pre {
                        overflow-x: auto;
                    }
                    .header-bar {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        padding: 0 0 6px 0;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        margin-bottom: 12px;
                    }
                    .header-left {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex: 1;
                        min-width: 0;
                    }
                    .header-title {
                        font-weight: 600;
                        font-size: 11px;
                        opacity: 0.8;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .header-right {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .icon-btn {
                        padding: 3px 6px;
                        background-color: transparent;
                        color: var(--vscode-foreground);
                        border: none;
                        cursor: pointer;
                        font-size: 11px;
                        border-radius: 2px;
                        opacity: 0.8;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .icon-btn:hover {
                        opacity: 1;
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    .icon-btn.with-border {
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .font-size-controls {
                        display: flex;
                        gap: 2px;
                    }
                    .content-wrapper {
                        font-size: 14px;
                    }
                    .divider {
                        margin: 8px 0;
                        border-top: 1px solid var(--vscode-panel-border);
                    }
                    .submit-button {
                        margin: 12px 0 8px 0;
                        padding: 6px 12px;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        cursor: pointer;
                        width: 100%;
                        font-size: 11px;
                        border-radius: 2px;
                        font-weight: 500;
                    }
                    .submit-button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="header-bar">
                    <div class="header-left">
                        <button class="icon-btn" id="backToAssignments" title="Back to assignments">←</button>
                        <span class="header-title">Assignment Preview</span>
                    </div>
                    <div class="header-right">
                        <button class="icon-btn with-border" id="openFolder" title="Open in folder">📁 Open</button>
                        <div class="font-size-controls">
                            <button class="icon-btn with-border" id="decreaseFont" title="Decrease font size">A-</button>
                            <button class="icon-btn with-border" id="resetFont" title="Reset font size">A</button>
                            <button class="icon-btn with-border" id="increaseFont" title="Increase font size">A+</button>
                        </div>
                    </div>
                </div>
                <div class="content-wrapper" id="contentWrapper">
                    ${head}
                    ${info}
                    <div class="divider"></div>
                    ${renderedDescription}
                </div>
                <button class="submit-button" id="submitAssignment">Submit</button>
                <script>
                    const vscode = acquireVsCodeApi();
                    const state = vscode.getState() || { fontSize: 14 };
                    const contentWrapper = document.getElementById('contentWrapper');

                    // Apply saved font size
                    contentWrapper.style.fontSize = state.fontSize + 'px';

                    function updateFontSize(newSize) {
                        contentWrapper.style.fontSize = newSize + 'px';
                        vscode.setState({ fontSize: newSize });
                    }

                    document.getElementById('openFolder').addEventListener('click', () => {
                        vscode.postMessage({ command: 'openFolder' });
                    });

                    document.getElementById('backToAssignments').addEventListener('click', () => {
                        vscode.postMessage({ command: 'backToAssignments' });
                    });

                    document.getElementById('decreaseFont').addEventListener('click', () => {
                        const currentSize = parseInt(contentWrapper.style.fontSize);
                        const newSize = Math.max(10, currentSize - 2);
                        updateFontSize(newSize);
                    });

                    document.getElementById('resetFont').addEventListener('click', () => {
                        updateFontSize(14);
                    });

                    document.getElementById('increaseFont').addEventListener('click', () => {
                        const currentSize = parseInt(contentWrapper.style.fontSize);
                        const newSize = Math.min(24, currentSize + 2);
                        updateFontSize(newSize);
                    });

                    document.getElementById('submitAssignment').addEventListener('click', () => {
                        vscode.postMessage({ command: 'submitAssignment' });
                    });
                </script>
            </body>
            </html>
        `;
    }
}

let assignmentViewProvider: AssignmentViewProvider | undefined;

export function initializeAssignmentView(context: vscode.ExtensionContext): AssignmentViewProvider {
    assignmentViewProvider = new AssignmentViewProvider(context.extensionUri);
    return assignmentViewProvider;
}

export function getAssignmentViewProvider(): AssignmentViewProvider | undefined {
    return assignmentViewProvider;
}
