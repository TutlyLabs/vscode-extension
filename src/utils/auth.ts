import { globalState } from "../globalState";
import { tutlyChannel } from "../channel";
import { API_BASE_URL, USER_AGENT } from "../config";

interface ISignInResponse {
    token: string;
    user: {
        id: string;
        email: string;
        name: string;
        username: string;
        image?: string | null;
        emailVerified: boolean;
        createdAt: string;
        updatedAt: string;
    };
}

interface ISessionResponse {
    user: {
        id: string;
        email: string;
        name: string;
        username: string;
        role?: string;
        organizationId?: string;
        organization?: {
            id: string;
            orgCode: string;
            name: string;
        } | null;
    };
    session: {
        id: string;
        token: string;
        expiresAt: string;
        userId: string;
    };
}

export interface IAuthTokens {
    accessToken: string;
    expiresAt: number;
}

export interface ICurrentUser {
    id: string;
    email: string;
    name: string;
    username: string;
    role?: string;
    organizationId?: string;
    orgCode?: string;
    sessionId?: string;
}

export async function login(username: string, password: string): Promise<IAuthTokens> {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/sign-in/username`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
            },
            body: JSON.stringify({
                username,
                password,
            }),
        });

        if (!response.ok) {
            const error = await response
                .json()
                .catch(() => ({ message: "Authentication failed" }));
            throw new Error(error.message || "Authentication failed");
        }

        const data: ISignInResponse = await response.json();
        const bearerToken = response.headers.get("set-auth-token") || data.token;

        if (!bearerToken) {
            throw new Error("No authentication token received from server");
        }

        let expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // Default 7 days fallback

        try {
            const sessionResponse = await fetch(`${API_BASE_URL}/auth/get-session`, {
                headers: {
                    "Authorization": `Bearer ${bearerToken}`,
                    "User-Agent": USER_AGENT,
                },
            });

            if (sessionResponse.ok) {
                const sessionData: ISessionResponse = await sessionResponse.json();
                if (sessionData.session.expiresAt) {
                    expiresAt = new Date(sessionData.session.expiresAt).getTime();
                }
            }
        } catch {
            // Use default expiration
        }

        const authTokens: IAuthTokens = {
            accessToken: bearerToken,
            expiresAt,
        };

        await globalState.setAuthTokens(authTokens);
        return authTokens;
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("fetch failed")) {
                throw new Error(
                    `Cannot connect to ${API_BASE_URL}. Is the server running?`
                );
            }
            throw new Error(error.message);
        }
        throw error;
    }
}

export async function logout(): Promise<void> {
    const tokens = await globalState.getAuthTokens();

    if (tokens) {
        try {
            await fetch(`${API_BASE_URL}/auth/sign-out`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${tokens.accessToken}`,
                    "User-Agent": USER_AGENT,
                },
            });
        } catch {
            // Ignore errors during sign out
        }
    }

    await globalState.clearAuthTokens();
}

export async function getCurrentUser(): Promise<ICurrentUser | null> {
    const tokens = await globalState.getAuthTokens();
    if (!tokens || Date.now() >= tokens.expiresAt) {
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/get-session`, {
            headers: {
                "Authorization": `Bearer ${tokens.accessToken}`,
                "User-Agent": USER_AGENT,
            },
        });

        if (!response.ok) {
            return null;
        }

        const data: ISessionResponse = await response.json();

        if (data.session.token && data.session.token !== tokens.accessToken) {
            tutlyChannel.appendLine(`[Auth] Token updated from session (tokens did not match)`);
            await globalState.setAuthTokens({
                accessToken: data.session.token,
                expiresAt: new Date(data.session.expiresAt).getTime(),
            });
        } else if (data.session.expiresAt) {
            const newExpiresAt = new Date(data.session.expiresAt).getTime();
            if (newExpiresAt !== tokens.expiresAt) {
                await globalState.setAuthTokens({
                    ...tokens,
                    expiresAt: newExpiresAt,
                });
            }
        }

        return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            username: data.user.username,
            role: data.user.role,
            organizationId: data.user.organizationId,
            orgCode: data.user.organization?.orgCode,
            sessionId: data.session.id,
        };
    } catch {
        return null;
    }
}

export async function isAuthenticated(): Promise<boolean> {
    const user = await getCurrentUser();
    return user !== null;
}
