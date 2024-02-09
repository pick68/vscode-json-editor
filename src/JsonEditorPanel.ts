'use strict';

import * as vscode from 'vscode';
import { configurationSettings } from './globals/enums';

export class JsonEditorPanel {
    public static currentPanel: JsonEditorPanel | undefined;

    private static readonly viewType: string = 'jsonEditor';
    private static readonly extensionPrefix: string = 'vscode-json-editor';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.ExtensionContext["extensionUri"];
    private _disposables: vscode.Disposable[] = [];
    private _currentEditor: vscode.TextEditor;

    private constructor(extensionUri: vscode.ExtensionContext["extensionUri"], column: vscode.ViewColumn, theme: string) {
        this._extensionUri = extensionUri;
        this._currentEditor = vscode.window.activeTextEditor;
        this._panel = vscode.window.createWebviewPanel(JsonEditorPanel.viewType, "Json editor", column, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'jsoneditor')
            ]
        });
        this._panel.webview.html = this.getHtmlForWebview(theme);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(message => {
            if (this._currentEditor) {
                this._currentEditor.edit(editBuilder => {
                    const range: vscode.Range = new vscode.Range(
                        this._currentEditor.document.positionAt(0),
                        this._currentEditor.document.positionAt(this._currentEditor.document.getText().length)
                    );

                    editBuilder.replace(range, message.json);
                });
            }
        });

        vscode.window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
        vscode.workspace.onDidSaveTextDocument(() => this.onDocumentChanged());

        this.onActiveEditorChanged();
    }

    // tslint:disable-next-line:function-name
    public static CreateOrShow(extensionUri: vscode.ExtensionContext["extensionUri"]): void {
        const column = vscode.ViewColumn.Three;
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(this.extensionPrefix);
        const theme: string = config.get(configurationSettings.theme);

        if (JsonEditorPanel.currentPanel) {
            JsonEditorPanel.currentPanel._panel.reveal(column);
        } else {
            JsonEditorPanel.currentPanel = new JsonEditorPanel(extensionUri, column, theme);
        }
    }

    public dispose(): void {
        JsonEditorPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private getJson(): string {
        let json: string = "";
        if (this._currentEditor) {
            json = this._currentEditor.document.getText();
        }
        return json;
    }

    private onActiveEditorChanged(): void {
        if (vscode.window.activeTextEditor) {
            this._currentEditor = vscode.window.activeTextEditor;
            const json: string = this.getJson();
            this._panel.webview.postMessage({ json: json });
        }
    }

    private onDocumentChanged(): void {
        const json: string = this.getJson();
        this._panel.webview.postMessage({ json: json });
    }

    private getHtmlForWebview(theme: string): string {
        const mainScriptPath = vscode.Uri.joinPath(this._extensionUri, "jsoneditor", "main.js");
        const mainScriptSrc = this._panel.webview.asWebviewUri(mainScriptPath);

        const scriptPath = vscode.Uri.joinPath(this._extensionUri, "jsoneditor", "jsoneditor.min.js");
        const scriptSrc = this._panel.webview.asWebviewUri(scriptPath);

        const cssContainerPath = vscode.Uri.joinPath(this._extensionUri, "jsoneditor", "jsoneditor.container.min.css");
        const cssContainerSrc = this._panel.webview.asWebviewUri(cssContainerPath);

        const cssPath = vscode.Uri.joinPath(this._extensionUri, "jsoneditor", "jsoneditor.min.css");
        const cssSrc = this._panel.webview.asWebviewUri(cssPath);

        const cssDarkPath = vscode.Uri.joinPath(this._extensionUri, "jsoneditor", "jsoneditor.dark.min.css");
        const cssDarkSrc = this._panel.webview.asWebviewUri(cssDarkPath);
        const darkTheme: string = theme === 'dark' ? `<link href="${cssDarkSrc}" rel="stylesheet" type="text/css">` : '';

        return `
        <!DOCTYPE HTML>
        <html>
        <head>
            <!-- when using the mode "code", it's important to specify charset utf-8 -->
            <meta http-equiv="Content-Type" content="text/html;charset=utf-8">

            <link href="${cssContainerSrc}" rel="stylesheet" type="text/css">
            <link href="${cssSrc}" rel="stylesheet" type="text/css">
            ${darkTheme}
            <script src="${scriptSrc}"></script>
        </head>
        <body>
            <div id="jsoneditor"></div>

            <script src="${mainScriptSrc}"></script>
        </body>
        </html>
        `;
    }
}
