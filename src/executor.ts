import { ExtensionContext } from "vscode";
import { Disposable } from "vscode";
import { createAPIClient } from "./utils/api";

class TutlyExecutor implements Disposable {
    public async meetRequirements(_context: ExtensionContext): Promise<boolean> {
        return true;
    }

    public async getDescription(assignmentId: string): Promise<string> {
        const apiClient = await createAPIClient();
        const response = await apiClient.getAssignmentDetails(assignmentId);

        if (!response.assignment) {
            throw new Error("Assignment not found");
        }

        const assignment = response.assignment;

        let description = `# ${assignment.title}\n\n`;

        if (assignment.details) {
            description += `## Description\n\n${assignment.details}\n\n`;
        }

        if (assignment.maxSubmissions) {
            description += `**Max Submissions:** ${assignment.maxSubmissions}\n\n`;
        }

        if (assignment.class) {
            description += `**Class:** ${assignment.class.title}\n\n`;
            if (assignment.class.course) {
                description += `**Course:** ${assignment.class.course.title}\n\n`;
            }
        }

        return description;
    }

    public dispose(): void {
    }
}

export const tutlyExecutor: TutlyExecutor = new TutlyExecutor();
