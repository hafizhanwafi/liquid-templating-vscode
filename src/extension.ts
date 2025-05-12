import * as fs from 'fs';
import { Liquid } from 'liquidjs';
import * as fsPath from 'path';
import * as vscode from 'vscode';
import { COMMANDS_DATA_RENDER, COMMANDS_TOGGLE_WATCH, GLOB_PATTERN_LIQUID_DATA, init as initLiquidProvider, isPathLiquidData, isUriLiquidData, validateLiquidDataDocument } from './providers/liquid-data-provider';
import { debounce, getPrismLanguageFromExtension, GLOB_PATTERN_NODE_MODULES } from './utils';
import { RenderPreviewPanel } from './webview-provider';

let viewPanel: RenderPreviewPanel;
let currentState: IRenderState | undefined;

async function saveRenderedTemplate() {
    if (!currentState) {
        return;
    }

    const { outputFsPath, dataFsPath, obj, renderedContent, outputFsPathSuggestion, outputPathSuggestion } = currentState;

    if (!renderedContent) {
        vscode.window.showErrorMessage("No rendered content to save.");
        return;
    }

    let destionationPath = outputFsPath;
    let newOutputPath = obj.output;

    if (outputFsPathSuggestion) {
        destionationPath = outputFsPathSuggestion;
        newOutputPath = outputPathSuggestion;

        const newData: ILiquidData = {
            ...obj,
            output: outputPathSuggestion
        };

        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(dataFsPath),
            Buffer.from(JSON.stringify(newData, null, 4)));
    }

    await vscode.workspace.fs.writeFile(
        vscode.Uri.file(destionationPath), Buffer.from(renderedContent!, 'utf8'));

    vscode.window.showInformationMessage(`Saved to ${destionationPath}`);
}

const onDocumentTextChanged = debounce((e: vscode.TextDocumentChangeEvent) => {
    const path = e.document.uri.fsPath;

    if (isPathLiquidData(path)) {
        if (!validateLiquidDataDocument(e.document)) return;
    }
    else if (path.includes(".liquid-template.")) {
        
    }
    else {
        return;
    }

    if (!currentState?.watchMode) return;

    const { dataFsPath: dataPath, templateFsPath: templatePath, dataUri: uri } = currentState;

    if (dataPath === path || templatePath === path) {
        vscode.commands.executeCommand(COMMANDS_DATA_RENDER, uri);
    }
});

async function render(state: IRenderState) {
    currentState = state;

    if (!currentState) return;

    const engine = new Liquid();

    const { templateString, obj } = currentState;
    const content = await engine.parseAndRender(templateString!, obj.data);

    showOrUpdatePreview(content);
}

async function showOrUpdatePreview(content: string) {
    if (!currentState) return;

    currentState.renderedContent = content;

    let outputPath = currentState.outputFsPath;

    if (currentState.outputFsPathSuggestion) {
        outputPath = currentState.outputFsPathSuggestion;
    }

    let outputName = "";

    if (outputPath) {
        outputName = fsPath.basename(outputPath);
    }

    const msgObj = {
        dataName: fsPath.basename(currentState.dataFsPath),
        dataPath: currentState.dataFsPath,
        output: content,
        templateName: fsPath.basename(currentState.templateFsPath),
        templatePath: currentState.templateFsPath,
        outputPath: outputPath,
        outputName: outputName,
        language: getPrismLanguageFromExtension(currentState.outputFsPath)
    };

    viewPanel.reveal();
    viewPanel.postRenderMessage(msgObj);
}

export function activate(context: vscode.ExtensionContext) {
    viewPanel = new RenderPreviewPanel(context);
    viewPanel.onDidReceiveMessage = (msg) => {
        if (msg.command === 'open') {
            const uri = vscode.Uri.file(msg.path);
            if (msg.isOutput && !fs.existsSync(msg.path)) {
                vscode.window.showWarningMessage("Output file doesn't exists, you need to save it first!");
                return;
            }
            vscode.window.showTextDocument(uri, { preview: true });
        } else if (msg.command === 'save') {
            saveRenderedTemplate();
        }
    };
    viewPanel.onDidDispose = () => {
        if (currentState?.dataUri) {
            vscode.commands.executeCommand(COMMANDS_TOGGLE_WATCH, currentState.dataUri);
        }
    };

    const execRenderCommand = async (isWatch = false) => {
        const activeEditor = vscode.window.activeTextEditor;
        const command = isWatch ? COMMANDS_TOGGLE_WATCH : COMMANDS_DATA_RENDER;

        if (activeEditor) {
            const uri = activeEditor.document.uri;

            if (isUriLiquidData(uri)) {
                vscode.commands.executeCommand(command, uri);
                return;
            }
        }

        const files = await vscode.workspace.findFiles(GLOB_PATTERN_LIQUID_DATA, GLOB_PATTERN_NODE_MODULES);

        if (!files.length) {
            vscode.window.showWarningMessage("No '.liquid-data.json' files found in workspace.");
            return;
        }

        const selected = await vscode.window.showQuickPick(
            files.map(x => ({
                label: fsPath.basename(x.fsPath),
                description: vscode.workspace.asRelativePath(x),
                uri: x
            })),
            {
                placeHolder: "Select a '.liquid-data.json' file to render"
            }
        );

        if (!selected) {
            return;
        }

        vscode.commands.executeCommand(command, selected.uri);
    };

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(onDocumentTextChanged),
        initLiquidProvider(render),
        vscode.commands.registerCommand('liquid.commands.render', execRenderCommand),
        vscode.commands.registerCommand('liquid.commands.renderAndWatch', () => {
            execRenderCommand(true);
        }),
    );
}