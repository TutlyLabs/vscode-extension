import { Command, Uri } from "vscode";
import { IAssignment, AssignmentState } from "../shared";

export class TutlyNode {

    constructor(private data: IAssignment, private isProblemNode: boolean = true) { }

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
        return this.isProblemNode;
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
            title: "Preview Problem",
            command: "tutly.previewProblem",
            arguments: [this.data],
        };
    }

    public get uri(): Uri {
        return Uri.from({
            scheme: "tutly",
            authority: this.isProblem ? "problems" : "tree-node",
            path: `/${this.id}`,
        });
    }

}
