import * as fs from "fs";
import * as cp from "child_process";
import { promisify } from "util";

const exec = promisify(cp.exec);

export async function downloadRepository(repoUrl: string, targetFolder: string): Promise<void> {
    // Check if folder already exists
    if (fs.existsSync(targetFolder)) {
        throw new Error("Folder already exists");
    }

    // Check if git is available
    try {
        await exec("git --version");
    } catch {
        throw new Error("Git is not installed. Please install git to download assignments.");
    }

    // Clone the repository
    try {
        await exec(`git clone "${repoUrl}" "${targetFolder}"`);

        // Remove .git folder
        const gitFolder = `${targetFolder}/.git`;
        if (fs.existsSync(gitFolder)) {
            if (process.platform === "win32") {
                await exec(`rmdir /s /q "${gitFolder}"`);
            } else {
                await exec(`rm -rf "${gitFolder}"`);
            }
        }
    } catch (error: any) {
        // Clean up on error
        if (fs.existsSync(targetFolder)) {
            fs.rmSync(targetFolder, { recursive: true, force: true });
        }
        throw new Error(`Git clone failed: ${error.message}`);
    }
}
