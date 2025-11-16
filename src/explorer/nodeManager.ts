import { Disposable } from "vscode";
import { defaultAssignment, AssignmentState } from "../types/shared";
import { TutlyNode } from "./node";
import { createAPIClient, ICourse, IAssignmentAPI } from "../utils/api";
import { getCurrentUser } from "../utils/auth";
import { tutlyChannel } from "../core/channel";

class ExplorerNodeManager implements Disposable {
    private explorerNodeMap: Map<string, TutlyNode> = new Map<string, TutlyNode>();
    private courseMap: Map<string, ICourse> = new Map<string, ICourse>();
    private assignmentsByCourse: Map<string, IAssignmentAPI[]> = new Map<string, IAssignmentAPI[]>();

    public async refreshCache(): Promise<void> {
        this.dispose();

        try {
            const user = await getCurrentUser();
            if (!user) {
                return;
            }

            const apiClient = await createAPIClient();
            const courses = await apiClient.getEnrolledCourses();

            for (const course of courses) {
                this.courseMap.set(course.id, course);
            }
        } catch (error) {
            tutlyChannel.appendLine(`Failed to fetch courses: ${error}`);
        }
    }

    public getRootNodes(): TutlyNode[] {
        // Return courses directly as root nodes
        const res: TutlyNode[] = [];
        for (const course of this.courseMap.values()) {
            res.push(new TutlyNode(Object.assign({}, defaultAssignment, {
                id: `course.${course.id}`,
                name: course.title,
                courseId: course.id,
            }), false));
        }
        return res;
    }

    public hasCourses(): boolean {
        return this.courseMap.size > 0;
    }

    public getAllNodes(): TutlyNode[] {
        return Array.from(this.explorerNodeMap.values());
    }

    public getNodeById(id: string): TutlyNode | undefined {
        return this.explorerNodeMap.get(id);
    }

    public getAllCourseNodes(): TutlyNode[] {
        const res: TutlyNode[] = [];
        for (const course of this.courseMap.values()) {
            res.push(new TutlyNode(Object.assign({}, defaultAssignment, {
                id: `course.${course.id}`,
                name: course.title,
            }), false));
        }
        return res;
    }

    public getUnsolvedNodes(): TutlyNode[] {
        const res: TutlyNode[] = [];
        for (const node of this.explorerNodeMap.values()) {
            if (node.isProblem && node.state !== AssignmentState.Submitted) {
                res.push(node);
            }
        }
        return res;
    }

    public getSolvedNodes(): TutlyNode[] {
        const res: TutlyNode[] = [];
        for (const node of this.explorerNodeMap.values()) {
            if (node.isProblem && node.state === AssignmentState.Submitted) {
                res.push(node);
            }
        }
        return res;
    }

    public async loadCourseAssignments(courseId: string): Promise<void> {
        if (this.assignmentsByCourse.has(courseId)) {
            return;
        }

        try {
            const apiClient = await createAPIClient();
            const assignments = await apiClient.getCourseAssignments(courseId);
            this.assignmentsByCourse.set(courseId, assignments);

            const course = this.courseMap.get(courseId);
            for (const assignment of assignments) {
                // Determine the state based on submission status
                let state = AssignmentState.Unknown;
                if (assignment.status === "solved") {
                    state = AssignmentState.Submitted;
                }

                const assignmentNode = {
                    ...defaultAssignment,
                    id: assignment.id,
                    name: assignment.title,
                    courseId,
                    courseName: course?.title,
                    details: assignment.details,
                    maxSubmissions: assignment.maxSubmissions,
                    state,
                };
                this.explorerNodeMap.set(assignment.id, new TutlyNode(assignmentNode));
            }
        } catch (error) {
            tutlyChannel.appendLine(`Failed to fetch assignments for course: ${error}`);
            throw error;
        }
    }

    public getChildrenNodesById(id: string): TutlyNode[] {
        const metaInfo: string[] = id.split(".");
        const res: TutlyNode[] = [];

        if (metaInfo[0] === "course") {
            const courseId = metaInfo[1];
            for (const node of this.explorerNodeMap.values()) {
                if (node.isProblem && node.courseId === courseId) {
                    res.push(node);
                }
            }
        }

        return res;
    }

    public hasLoadedAssignments(courseId: string): boolean {
        return this.assignmentsByCourse.has(courseId);
    }    public dispose(): void {
        this.explorerNodeMap.clear();
        this.courseMap.clear();
        this.assignmentsByCourse.clear();
    }
}

export const explorerNodeManager: ExplorerNodeManager = new ExplorerNodeManager();
