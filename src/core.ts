import { Liquid } from 'liquidjs';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as fsPath from 'path';
import { RenderPreviewPanel } from './webview-provider';

let diagnostics: vscode.DiagnosticCollection;
let viewPanel: RenderPreviewPanel;
let debounceTimer: NodeJS.Timeout | undefined;
let currentState: IWatchState | undefined;
let isWatchMode = false;

interface ILiquidData {
    output?: string;
    template: string;
    data: any;
}

interface ILiquidDataParseResult {
    obj: ILiquidData;
    dataPath: string;
    templatePath: string;
}

interface IWatchState extends ILiquidDataParseResult {
    outputPath: string;
    templateString?: string;
    uri: vscode.Uri;
    renderedContent?: string;
}

function getLanguageFromExtension(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();

    switch (ext) {
        case 'js':
        case 'cjs':
        case 'mjs':
            return 'javascript';
        case 'ts':
            return 'typescript';
        case 'json':
            return 'json';
        case 'html':
        case 'htm':
            return 'html';
        case 'css':
            return 'css';
        case 'scss':
            return 'scss';
        case 'liquid':
        case 'tpl':
        case 'hbs':
            return 'markup';
        case 'sql':
            return 'sql';
        case 'md':
            return 'markdown';
        case 'xml':
            return 'xml';
        case 'yml':
        case 'yaml':
            return 'yaml';
        case 'sh':
        case 'bash':
            return 'bash';
        case 'py':
            return 'python';
        case 'java':
            return 'java';
        case 'c':
        case 'h':
            return 'c';
        case 'cpp':
        case 'cc':
        case 'cxx':
            return 'cpp';
        case 'php':
            return 'php';
        case 'rb':
            return 'ruby';
        case 'go':
            return 'go';
        case 'rs':
            return 'rust';
        case 'cs':
            return 'csharp';
        default:
            return 'plaintext';
    }
}

function parseJsonSafe(text: string): Partial<ILiquidData> {
    try {
        return JSON.parse(text);
    } catch (e) {
        return {};
    }
}

function inferredOutputName(dataPath: string, templatePath: string): string {
    const dataBase = fsPath.basename(dataPath).replace('.liquid-data.json', '');
    const ext = fsPath.extname(templatePath);
    return `${dataBase}${ext}`;
}

async function getDocContentByPath(path: string): Promise<string> {
    let doc = vscode.workspace.textDocuments.find(x => x.uri.fsPath === path);

    if (!doc) {
        doc = await vscode.workspace.openTextDocument(path);
    }

    return doc.getText();
}

async function save() {
    if (!currentState) {
        return;
    }

    const { outputPath, dataPath, obj, templatePath, renderedContent } = currentState;

    if (!renderedContent) {
        vscode.window.showErrorMessage("No rendered content to save.");
        return;
    }

    await vscode.workspace.fs.writeFile(vscode.Uri.file(outputPath), Buffer.from(renderedContent!, 'utf8'));

    if (outputPath !== obj.output) {
        const newData: ILiquidData = {
            data: obj.data,
            output: outputPath,
            template: templatePath
        };

        await vscode.workspace.fs.writeFile(vscode.Uri.file(dataPath), Buffer.from(JSON.stringify(newData, null, 4)));
    }

    vscode.window.showInformationMessage(`Saved to ${outputPath}`);
}

async function showOrUpdatePreview(content: string) {
    const data = currentState!;
    data.renderedContent = content;

    viewPanel.reveal();
    viewPanel.postRenderMessage({
        dataName: fsPath.basename(data.dataPath),
        dataPath: data.dataPath,
        output: content,
        templateName: fsPath.basename(data.templatePath),
        templatePath: data.templatePath,
        outputPath: data.obj.output,
        outputName: data.obj.output ? fsPath.basename(data.obj.output) : "",
        language: getLanguageFromExtension(data.outputPath)
    });
}

function validateLiquidDataDocument(doc: vscode.TextDocument) {
    parseJsonData(doc.uri);
}

async function parseJsonData(uri: vscode.Uri): Promise<ILiquidDataParseResult | undefined> {
    const dataPath = uri.fsPath;
    const doc = await vscode.workspace.openTextDocument(uri);
    const errors: vscode.Diagnostic[] = [];
    const dataContent = doc.getText();

    let json = parseJsonSafe(dataContent);

    let templatePath = "";

    if (!json.template) {
        errors.push(createError('Missing or invalid "template" key.'));
        return;
    }
    else {
        templatePath = fsPath.resolve(fsPath.dirname(dataPath), json.template);

        if (!fs.existsSync(templatePath)) {
            errors.push(createError(`Template file "${json.template}" not found.`));
        }
    }

    if (typeof json.data !== 'object' || Array.isArray(json.data)) {
        errors.push(createError('"data" must be a JSON object.'));
    }

    if (errors.length) {
        diagnostics.set(doc.uri, errors);
        return;
    }

    return {
        dataPath,
        templatePath,
        obj: json as ILiquidData
    };
}

async function renderInternal() {
    if (!currentState) return;

    const templateText = currentState.templateString;

    const engine = new Liquid();
    const content = await engine.parseAndRender(templateText!, currentState.obj.data);

    showOrUpdatePreview(content);
}

async function renderDataFile(uri: vscode.Uri) {
    const data = await parseJsonData(uri);
    if (!data) {
        return;
    }

    let destinationPath: string;
    if (data.obj.output) {
        destinationPath = data.obj.output;
    } else {
        const inferredName = inferredOutputName(data.dataPath, data.templatePath);
        destinationPath = fsPath.resolve(fsPath.dirname(data.dataPath), inferredName);
    }

    currentState = {
        ...data,
        uri: uri,
        templateString: await getDocContentByPath(data.templatePath),
        outputPath: destinationPath,
    };

    renderInternal();
}

async function toggleWatch(uri: vscode.Uri, lensProvider: LiquidDataCodeLensProvider) {
    lensProvider.refresh();
    renderDataFile(uri);
}

async function onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent) {
    const path = e.document.uri.fsPath;
    const isDataPath = path.endsWith(".liquid-data.json");

    if (isDataPath) validateLiquidDataDocument(e.document);

    if (!isDataPath && !path.includes(".liquid-template.")) return;

    if (!currentState) return;
    if (!isWatchMode) return;

    const { dataPath, templatePath, uri } = currentState;

    if (dataPath === path || templatePath === path) {
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            renderDataFile(uri);
        }, 500);
    }
}

export function init(context: vscode.ExtensionContext): vscode.Disposable {
    diagnostics = vscode.languages.createDiagnosticCollection('liquid-data');
    viewPanel = new RenderPreviewPanel(context);
    viewPanel.onPanelCreated = (panel) => {
        panel.webview.onDidReceiveMessage(async msg => {
            if (msg.command === 'open') {
                const uri = vscode.Uri.file(msg.path);
                if (msg.isOutput && !fs.existsSync(msg.path)) {
                    vscode.window.showWarningMessage("Output file doesn't exists, you need to save it first!");
                    return;
                }
                vscode.window.showTextDocument(uri, { preview: true });
            } else if (msg.command === 'save') {
                save();
            }
        });
    };

    const disposables: vscode.Disposable[] = [
        diagnostics,
        vscode.languages.registerCodeLensProvider({ language: 'json', pattern: '**/*.liquid-data.json' }, new LiquidDataCodeLensProvider()),
        vscode.workspace.onDidOpenTextDocument(validateLiquidDataDocument),
        vscode.workspace.onDidSaveTextDocument(validateLiquidDataDocument),
        vscode.commands.registerCommand('liquid.renderDataFile', renderDataFile),
        vscode.commands.registerCommand('liquid.toggleWatch', toggleWatch),
        vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument),
    ];

    return {
        dispose() {
            disposables.forEach(x => x.dispose());
        }
    };
}

function createError(message: string, line: number = 0): vscode.Diagnostic {
    return {
        message,
        range: new vscode.Range(line, 0, line, 100),
        severity: vscode.DiagnosticSeverity.Error,
        source: 'liquid-data'
    };
}

class LiquidDataCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    refresh() {
        this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
        const text = doc.getText();
        const json = parseJsonSafe(text);
        if (!json) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];

        const firstLine = new vscode.Range(0, 0, 0, 0);

        lenses.push(new vscode.CodeLens(firstLine, {
            title: '▶ Render',
            command: 'liquid.renderDataFile',
            arguments: [doc.uri]
        }));

        let label: string;
        let tooltip: string;

        if (currentState && currentState.uri.fsPath === doc.uri.fsPath) {
            label = '■ Stop';
            tooltip = 'Stop watching for changes';
            isWatchMode = true;
        }
        else {
            label = '▶ Watch';
            tooltip = 'Start watching for changes';
            isWatchMode = false;
        }

        const command: vscode.Command = {
            title: label,
            command: 'liquid.toggleWatch',
            arguments: [doc.uri, this],
            tooltip: tooltip
        };

        lenses.push(new vscode.CodeLens(firstLine, {
            title: label,
            command: 'liquid.toggleWatch',
            arguments: [doc.uri, this],
            tooltip: tooltip
        }));

        return lenses;
    }
}
