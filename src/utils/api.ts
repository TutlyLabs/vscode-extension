import { globalState } from "../core/globalState";
import { API_BASE_URL, USER_AGENT } from "./config";

export interface ICourse {
    id: string;
    title: string;
}

export interface IAssignmentAPI {
    id: string;
    title: string;
    details: string | null;
    sandboxTemplate: any;
    maxSubmissions: number;
    status?: "solved" | "unsolved";
    class?: {
        id: string;
        title: string;
        courseId: string;
        course?: {
            id: string;
            title: string;
        } | null;
    } | null;
}

export interface IAssignmentFile {
    path: string;
    content: string;
}

export class TutlyAPI {
    private baseUrl: string;
    private accessToken?: string;

    constructor(baseUrl: string = API_BASE_URL, accessToken?: string) {
        this.baseUrl = baseUrl;
        this.accessToken = accessToken;
    }

    private async trpcRequest<T>(
        procedure: string,
        input?: any,
        method: "GET" | "POST" = "GET"
    ): Promise<T> {
        const isMutation = method === "POST";
        const url = isMutation
            ? `${this.baseUrl}/trpc/${procedure}`
            : `${this.baseUrl}/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input ?? null }))}`;

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        };

        if (this.accessToken) {
            headers.Authorization = `Bearer ${this.accessToken}`;
        }

        const response = await fetch(url, {
            method,
            headers,
            ...(isMutation && {
                body: JSON.stringify({ json: input ?? null }),
            }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            throw new Error(
                `API request failed: ${response.status} ${response.statusText} - ${errorText}`
            );
        }

        const data = await response.json();
        return data.result?.data?.json ?? data.result?.data ?? data;
    }

    public async getEnrolledCourses(): Promise<ICourse[]> {
        try {
            const result = await this.trpcRequest<{ success: boolean; data: ICourse[] }>(
                "courses.getEnrolledCourses"
            );
            return result.data || [];
        } catch (error) {
            throw error;
        }
    }

    public async getCourseAssignments(courseId: string): Promise<IAssignmentAPI[]> {
        try {
            // Get all assignments for a specific course
            interface ISubmissionInfo {
                id: string;
                points: any[];
            }
            interface IAttachmentWithSubmissions extends IAssignmentAPI {
                submissions?: ISubmissionInfo[];
            }
            const result = await this.trpcRequest<Array<{
                id: string;
                classes: Array<{
                    attachments: IAttachmentWithSubmissions[]
                }>
            }>>(
                "assignments.getAllAssignmentsByCourseId",
                { id: courseId }
            );

            // Flatten the nested structure to get all assignments
            const assignments: IAssignmentAPI[] = [];
            if (Array.isArray(result) && result.length > 0) {
                result[0].classes.forEach((classItem) => {
                    classItem.attachments.forEach((attachment) => {
                        // Check if there are any submissions to mark as solved
                        const hasSubmissions = attachment.submissions && attachment.submissions.length > 0;
                        assignments.push({
                            ...attachment,
                            status: hasSubmissions ? "solved" : "unsolved"
                        });
                    });
                });
            }

            return assignments;
        } catch (error) {
            throw error;
        }
    }

    public async getAssignmentDetails(assignmentId: string): Promise<{
        assignment: IAssignmentAPI | null;
        mentorDetails: any;
        error?: string;
    }> {
        return this.trpcRequest<{
            assignment: IAssignmentAPI | null;
            mentorDetails: any;
            error?: string;
        }>("assignments.getAssignmentDetailsForSubmission", { id: assignmentId });
    }

    public async createSubmission(
        files: IAssignmentFile[],
        assignmentDetails: IAssignmentAPI,
        mentorDetails: any
    ): Promise<{ success?: boolean; error?: string; data?: any }> {
        return this.trpcRequest<{ success?: boolean; error?: string; data?: any }>(
            "submissions.createSubmission",
            {
                assignmentDetails: {
                    id: assignmentDetails.id,
                    maxSubmissions: assignmentDetails.maxSubmissions,
                    class: {
                        courseId: assignmentDetails.class?.courseId,
                    },
                },
                files,
                mentorDetails,
            },
            "POST"
        );
    }
}

export async function createAPIClient(): Promise<TutlyAPI> {
    const tokens = globalState.getAuthTokens();
    return new TutlyAPI(API_BASE_URL, tokens?.accessToken);
}
