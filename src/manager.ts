import { EventEmitter } from "events";
import * as vscode from "vscode";
import { tutlyChannel } from "./channel";
import { UserStatus } from "./shared";
import { DialogType, promptForOpenOutputChannel } from "./utils/ui";
import { globalState } from "./globalState";
import * as authUtils from "./utils/auth";

class TutlyManager extends EventEmitter {
    private currentUser: string | undefined;
    private userStatus: UserStatus;

    constructor() {
        super();
        this.currentUser = undefined;
        this.userStatus = UserStatus.SignedOut;
    }

    public async getLoginStatus(): Promise<void> {
        try {
            const user = await authUtils.getCurrentUser();
            if (user) {
                this.currentUser = user.username;
                this.userStatus = UserStatus.SignedIn;
            } else {
                this.currentUser = undefined;
                this.userStatus = UserStatus.SignedOut;
                globalState.removeAll();
            }
        } catch (error) {
            this.currentUser = undefined;
            this.userStatus = UserStatus.SignedOut;
            globalState.removeAll();
        } finally {
            this.emit("statusChanged");
        }
    }

    public async signIn(): Promise<void> {
        try {
            const username = await vscode.window.showInputBox({
                prompt: "Enter your username",
                placeHolder: "Username",
                ignoreFocusOut: true,
                validateInput: (value: string) => {
                    if (!value || value.trim().length === 0) {
                        return "Username cannot be empty";
                    }
                    return undefined;
                },
            });

            if (!username) {
                return;
            }

            const password = await vscode.window.showInputBox({
                prompt: "Enter your password",
                placeHolder: "Password",
                password: true,
                ignoreFocusOut: true,
                validateInput: (value: string) => {
                    if (!value || value.trim().length === 0) {
                        return "Password cannot be empty";
                    }
                    return undefined;
                },
            });

            if (!password) {
                return;
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: "Signing in...",
                    cancellable: false,
                },
                async () => {
                    try {
                        await authUtils.login(username, password);
                        const user = await authUtils.getCurrentUser();
                        if (user) {
                            this.currentUser = user.username;
                            this.userStatus = UserStatus.SignedIn;
                            this.emit("statusChanged");
                            vscode.window.showInformationMessage(
                                `Successfully signed in as ${user.username}`
                            );
                        }
                    } catch (error) {
                        tutlyChannel.appendLine(`Sign in failed: ${error}`);
                        throw error;
                    }
                }
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Authentication failed";
            await promptForOpenOutputChannel(
                `Failed to sign in: ${errorMessage}. Please open the output channel for details.`,
                DialogType.error
            );
        }
    }

    public async signOut(): Promise<void> {
        try {
            await authUtils.logout();
            vscode.window.showInformationMessage("Successfully signed out.");
            this.currentUser = undefined;
            this.userStatus = UserStatus.SignedOut;
            globalState.removeAll();
            this.emit("statusChanged");
        } catch (error) {
            tutlyChannel.appendLine(`Sign out error: ${error}`);
            // Continue with local cleanup even if API call fails
            this.currentUser = undefined;
            this.userStatus = UserStatus.SignedOut;
            globalState.removeAll();
            this.emit("statusChanged");
        }
    }

    public getStatus(): UserStatus {
        return this.userStatus;
    }

    public getUser(): string | undefined {
        return this.currentUser;
    }
}

export const tutlyManager: TutlyManager = new TutlyManager();
