import * as vscode from "vscode";

export interface IQuickItemEx<T> extends vscode.QuickPickItem {
    value: T;
}

export enum UserStatus {
    SignedIn = 1,
    SignedOut = 2,
}

export enum AssignmentState {
    Submitted = 1,
    NotSubmitted = 2,
    Unknown = 3,
}

export interface IAssignment {
    id: string;
    name: string;
    state: AssignmentState;
    courseId?: string;
    courseName?: string;
    details?: string | null;
    maxSubmissions?: number;
}

export const defaultAssignment: IAssignment = {
    id: "",
    name: "",
    state: AssignmentState.Unknown,
};
