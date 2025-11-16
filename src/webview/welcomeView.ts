import * as vscode from "vscode";

export class WelcomeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "tutlyWelcome";
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage((data) => {
            switch (data.type) {
                case "signIn":
                    vscode.commands.executeCommand("tutly.signin");
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const logoUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "resources", "tutly.png")
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Tutly</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            padding: 32px 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            max-width: 320px;
            text-align: center;
        }

        .logo {
            margin-bottom: 20px;
        }

        .logo img {
            width: 64px;
            height: 64px;
        }

        h1 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .description {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.5;
            margin-bottom: 24px;
        }

        .signin-button {
            width: 100%;
            padding: 10px 16px;
            font-size: 13px;
            font-weight: normal;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
        }

        .signin-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <img src="${logoUri}" alt="Tutly Logo" />
        </div>

        <h1>Welcome to Tutly</h1>

        <p class="description">
            Work on coding assignments locally and submit directly from VS Code.
        </p>

        <button class="signin-button" onclick="signIn()">
            Sign In to get started
        </button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function signIn() {
            vscode.postMessage({
                type: 'signIn'
            });
        }
    </script>
</body>
</html>`;
    }

    public show() {
        if (this._view) {
            this._view.show?.(true);
        }
    }
}

export let welcomeViewProvider: WelcomeViewProvider;

export function initializeWelcomeView(context: vscode.ExtensionContext): void {
    welcomeViewProvider = new WelcomeViewProvider(context.extensionUri);
}
