import { workspace, WorkspaceConfiguration } from "vscode";

export function getWorkspaceConfiguration(): WorkspaceConfiguration {
    return workspace.getConfiguration("tutly");
}
