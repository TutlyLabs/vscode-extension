import * as os from "os";
import * as vscode from "vscode";
import { AssignmentState } from "../shared";
import { explorerNodeManager } from "./nodeManager";
import { TutlyNode } from "./node";

export class TutlyTreeDataProvider implements vscode.TreeDataProvider<TutlyNode> {
    private onDidChangeTreeDataEvent: vscode.EventEmitter<TutlyNode | undefined | null> = new vscode.EventEmitter<
        TutlyNode | undefined | null
    >();
    public readonly onDidChangeTreeData: vscode.Event<any> = this.onDidChangeTreeDataEvent.event;

    public initialize(_context: vscode.ExtensionContext): void {
    }

    public async refresh(): Promise<void> {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: "Fetching courses...",
            },
            async () => {
                await explorerNodeManager.refreshCache();
            }
        );
        this.onDidChangeTreeDataEvent.fire(null);
    }

    public getTreeItem(element: TutlyNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let contextValue: string;
        if (element.isProblem) {
            contextValue = "problem";
        } else {
            contextValue = element.id.toLowerCase();
        }

        return {
            label: element.name,
            tooltip: this.getSubCategoryTooltip(element),
            collapsibleState: element.isProblem ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
            iconPath: this.parseIconPathFromProblemState(element),
            command: element.isProblem ? element.previewCommand : undefined,
            resourceUri: element.uri,
            contextValue,
        };
    }

    public getChildren(element?: TutlyNode | undefined): vscode.ProviderResult<TutlyNode[]> {
        if (!element) {
            return explorerNodeManager.getRootNodes();
        } else {
            if (element.isProblem) {
                return [];
            }

            const metaInfo = element.id.split(".");
            if (metaInfo[0] === "course") {
                const courseId = metaInfo[1];

                if (!explorerNodeManager.hasLoadedAssignments(courseId)) {
                    return vscode.window.withProgress(
                        {
                            location: vscode.ProgressLocation.Window,
                            title: "Loading assignments...",
                        },
                        async () => {
                            await explorerNodeManager.loadCourseAssignments(courseId);
                            this.onDidChangeTreeDataEvent.fire(element);
                            return explorerNodeManager.getChildrenNodesById(element.id);
                        }
                    );
                }
            }

            return explorerNodeManager.getChildrenNodesById(element.id);
        }
    }

    private parseIconPathFromProblemState(element: TutlyNode): vscode.ThemeIcon | string {
        if (!element.isProblem) {
            return "";
        }
        switch (element.state) {
            case AssignmentState.Submitted:
                // Submitted - green dot
                return new vscode.ThemeIcon("circle-filled", new vscode.ThemeColor("testing.iconPassed"));
            case AssignmentState.NotSubmitted:
            case AssignmentState.Unknown:
                // Not submitted - gray dot
                return new vscode.ThemeIcon("circle-outline", new vscode.ThemeColor("descriptionForeground"));
            default:
                return "";
        }
    }

    private getSubCategoryTooltip(element: TutlyNode): string {
        // return '' unless it is a sub-category node
        if (element.isProblem || element.id === "ROOT") {
            return "";
        }

        const childernNodes: TutlyNode[] = explorerNodeManager.getChildrenNodesById(element.id);

        let submittedNum: number = 0;
        let notSubmittedNum: number = 0;
        for (const node of childernNodes) {
            switch (node.state) {
                case AssignmentState.Submitted:
                    submittedNum++;
                    break;
                case AssignmentState.NotSubmitted:
                    notSubmittedNum++;
                    break;
                default:
                    break;
            }
        }

        return [`Submitted: ${submittedNum}`, `Not Submitted: ${notSubmittedNum}`, `Total: ${childernNodes.length}`].join(os.EOL);
    }
}

export const tutlyTreeDataProvider: TutlyTreeDataProvider = new TutlyTreeDataProvider();
