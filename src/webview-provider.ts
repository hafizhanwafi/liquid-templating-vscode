import * as vscode from 'vscode';

export interface IWebviewPostMessage {
    templateName: string;
    templatePath: string;
    dataName: string;
    dataPath: string;
    output: string;
    outputPath?: string;
    outputName?: string;
    language: string;
}

export class RenderPreviewPanel {
    panel: vscode.WebviewPanel | undefined;

    constructor(private context: vscode.ExtensionContext) { }
    
    onDidReceiveMessage: ((msg: any) => void) | undefined;
    onDidDispose: (() => void) | undefined;

    reveal() {
        if (this.panel) {
            if (this.panel.visible) return;
            this.panel.reveal(vscode.ViewColumn.Beside, true);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'liquid-templating-preview',
                'Preview',
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'assets')],
                }
            );

            this.panel.webview.onDidReceiveMessage((msg) => this.onDidReceiveMessage?.(msg));
            this.panel.webview.html = this.getHtml(this.panel.webview);
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.onDidDispose?.();
            });
        }
    }

    postRenderMessage(data: IWebviewPostMessage) {
        if (!this.panel) return;
        this.panel.title = `Preview ${data.templateName} + ${data.dataName}`;
        this.panel.webview.postMessage({ type: 'render', ...data });
    }

    private getHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'main.js')
        );

        const prismCss = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'prism.css')
        );

        const prismJs = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'prism.js')
        );

        return /* html */ `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'unsafe-eval' ${webview.cspSource};">
      <link href="${prismCss}" rel="stylesheet" />      
    </head>
    <body>
    <style>
.toolbar {
    position: sticky;
    top: 0;
    margin-top: 15px;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85em;
    padding: 4px 15px;
    z-index: 1;
    background: #2d2d2d;
}

.copy-button {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 0.9em;
}

.copy-button:hover {
  color: #ccc;
}
    </style>
    <table>
        <tbody>
        <tr>
        <td>Template</td>
        <td><a href="#" id="link-template"></a></td>
        </tr>
        <tr>
        <td>Data</td>
        <td><a href="#" id="link-data"></a></td>
        </tr>
        <tr>
        <td>Output</td>
        <td><a href="#" id="link-output"></a> <a href="#" id="link-save">💾</a></td>
        </tr>        
        </tbody>
    </table>
      <div>
      <div class="toolbar">
      <span class="toolbar-text"></span>
      <button class="copy-button" data-copy-target="output-code">📋 Copy</button>
      </div>
      <pre>
      <code></code>
      </pre>
      </div>
      <script src="${prismJs}"></script>
      <script defer src="${scriptUri}"></script>
    </body>
    </html>
    `;
    }
}
