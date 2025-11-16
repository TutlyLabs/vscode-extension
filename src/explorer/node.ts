import { Command, Uri } from "vscode";
import { IAssignment, AssignmentState } from "../types/shared";

export class TutlyNode {

    constructor(private data: IAssignment, private isAssignmentNode: boolean = true) { }

    public get name(): string {
        return this.data.name;
    }

    public get state(): AssignmentState {
        return this.data.state;
    }

    public get id(): string {
        return this.data.id;
    }

    public get isProblem(): boolean {
        return this.isAssignmentNode;
    }

    public get courseId(): string | undefined {
        return this.data.courseId;
    }

    public get courseName(): string | undefined {
        return this.data.courseName;
    }

    public get details(): string | null | undefined {
        return this.data.details;
    }

    public get maxSubmissions(): number | undefined {
        return this.data.maxSubmissions;
    }

    public get previewCommand(): Command {
        return {
            title: "Preview Assignment",
            command: "tutly.previewAssignment",
            arguments: [this.data],
        };
    }

    public get uri(): Uri {
        return Uri.from({
            scheme: "tutly",
            authority: this.isProblem ? "assignments" : "tree-node",
            path: `/${this.id}`,
        });
    }

}
