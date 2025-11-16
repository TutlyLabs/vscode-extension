import * as vscode from "vscode";

const AuthTokensKey = "tutly-auth-tokens";

export interface IAuthTokens {
    accessToken: string;
    expiresAt: number;
}

class GlobalState {
    private context: vscode.ExtensionContext;
    private _state: vscode.Memento;
    private currentAssignmentId: string | undefined;

    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        this._state = this.context.globalState;
    }

    public removeAll(): void {
        this._state.update(AuthTokensKey, undefined);
    }

    public setAuthTokens(tokens: IAuthTokens): Thenable<void> {
        return this._state.update(AuthTokensKey, tokens);
    }

    public getAuthTokens(): IAuthTokens | undefined {
        return this._state.get<IAuthTokens>(AuthTokensKey);
    }

    public clearAuthTokens(): Thenable<void> {
        return this._state.update(AuthTokensKey, undefined);
    }

    public getUserStatus(): undefined {
        return undefined;
    }

    public getCurrentAssignmentId(): string | undefined {
        return this.currentAssignmentId;
    }

    public setCurrentAssignmentId(assignmentId: string | undefined): void {
        this.currentAssignmentId = assignmentId;
    }
}

export const globalState: GlobalState = new GlobalState();
