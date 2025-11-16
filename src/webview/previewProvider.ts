import { commands, ViewColumn } from "vscode";
import { IAssignment } from "../shared";
import { ITutlyWebviewOption, TutlyWebview } from "./webview";
import { markdownEngine } from "./markdownEngine";

class TutlyPreviewProvider extends TutlyWebview {
    protected readonly viewType: string = "tutly.preview";
    private node: IAssignment;
    private description: IDescription;
    private sideMode: boolean = false;

    public isSideMode(): boolean {
        return this.sideMode;
    }

    public show(descString: string, node: IAssignment, isSideMode: boolean = false): void {
        this.description = this.parseDescription(descString, node);
        this.node = node;
        this.sideMode = isSideMode;
        this.showWebviewInternal();
    }

    protected getWebviewOption(): ITutlyWebviewOption {
        if (!this.sideMode) {
            return {
                title: `${this.node.name}: Preview`,
                viewColumn: ViewColumn.One,
            };
        } else {
            return {
                title: "Description",
                viewColumn: ViewColumn.Two,
                preserveFocus: true,
            };
        }
    }

    protected getWebviewContent(): string {
        const button: { element: string; script: string; style: string } = {
            element: `<button id="solve">Code Now</button>`,
            script: `const button = document.getElementById('solve');
                    button.onclick = () => vscode.postMessage({
                        command: 'ShowAssignment',
                    });`,
            style: `<style>
                #solve {
                    position: fixed;
                    bottom: 1rem;
                    right: 1rem;
                    border: 0;
                    margin: 1rem 0;
                    padding: 0.2rem 1rem;
                    color: white;
                    background-color: var(--vscode-button-background);
                }
                #solve:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                #solve:active {
                    border: 0;
                }
                </style>`,
        };
        const { title, category, body } = this.description;
        const head: string = markdownEngine.render(`# ${title}`);
        const info: string = category ? markdownEngine.render(`**Course:** ${category}`) : "";
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; script-src vscode-resource: 'unsafe-inline'; style-src vscode-resource: 'unsafe-inline';"/>
                ${markdownEngine.getStyles()}
                ${!this.sideMode ? button.style : ""}
                <style>
                    code { white-space: pre-wrap; }
                </style>
            </head>
            <body>
                ${head}
                ${info}
                ${body}
                ${!this.sideMode ? button.element : ""}
                <script>
                    const vscode = acquireVsCodeApi();
                    ${!this.sideMode ? button.script : ""}
                </script>
            </body>
            </html>
        `;
    }

    protected onDidDisposeWebview(): void {
        super.onDidDisposeWebview();
        this.sideMode = false;
    }

    protected async onDidReceiveMessage(message: IWebViewMessage): Promise<void> {
        switch (message.command) {
            case "ShowAssignment": {
                await commands.executeCommand("tutly.showAssignment", this.node);
                break;
            }
        }
    }

    private parseDescription(descString: string, assignment: IAssignment): IDescription {
        // For Tutly assignments, the description is already formatted markdown
        return {
            title: assignment.name,
            category: assignment.courseName || "Assignment",
            body: descString,
        };
    }
}

interface IDescription {
    title: string;
    category: string;
    body: string;
}

interface IWebViewMessage {
    command: string;
}

export const tutlyPreviewProvider: TutlyPreviewProvider = new TutlyPreviewProvider();
