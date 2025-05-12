import * as fs from "fs";
import * as mssql from "mssql";
import * as fsPath from "path";
import * as vscode from "vscode";
import Ajv, { type ValidateFunction } from 'ajv';
import addErrors from "ajv-errors";
import liquidDataSchema from '../../schema/liquid-data-schema.json';
import { GLOB_PATTERN_NODE_MODULES, globToRegex, parseJsonSafe, resolveTarget } from "../utils";

let validate: ValidateFunction<ILiquidData>;
let currentState: IRenderState | undefined;

function createErr(doc: vscode.TextDocument, jsonPath: string, msg: string) {
    const text = doc.getText();
    const pathSegments = jsonPath
        .split("/")
        .slice(1)
        .filter(x => x);

    let offset = 0;

    for (const x of pathSegments) {
        const isArrayIndex = /^\d+$/.test(x);
        if (isArrayIndex) continue;

        const keyRegex = new RegExp(`"(${x})"\\s*:`, "g");
        const match = keyRegex.exec(text.slice(offset));

        if (match) {
            offset += match.index; // Tambah ke offset sekarang
        } else {
            // Jika key tidak ditemukan, fallback ke awal dokumen
            return new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0),
                msg,
                vscode.DiagnosticSeverity.Error
            );
        }
    }

    if (!pathSegments.length) {
        return new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 0),
            msg,
            vscode.DiagnosticSeverity.Error
        );
    }

    const startPos = doc.positionAt(offset);
    const endPos = doc.positionAt(offset + pathSegments[pathSegments.length - 1].length);

    const range = new vscode.Range(startPos, endPos);

    return new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error);
}

async function fetchData(uri: vscode.Uri) {
    const data = await parseJsonData(uri);

    if (!data) {
        vscode.window.showErrorMessage("Invalid liquid-data.json");
        return;
    }

    const src = data.dataGeneratorSrcFsPath!;

    if (!fs.existsSync(src)) {
        vscode.window.showErrorMessage(`Path ${src} doesn't exists!`);
        return;
    }

    const module = require(src);

    const { config, generate, sql } = module;

    if (typeof generate !== "function" || !config || typeof sql !== "string" || !sql) {
        vscode.window.showErrorMessage("Invalid 'liquid-data-src.js' file.");
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            cancellable: true
        },
        async (progress, cancellationToken) => {

            try {
                const pool = await mssql.connect(config);

                const req = pool.request();

                progress.report({ message: "Fetching data from database..." });
                const res = await req.query(sql);

                if (cancellationToken.isCancellationRequested) {
                    req.cancel();
                    return;
                }

                const oldData = data.obj;
                const newData = generate(oldData.data, res.recordsets);

                if (!newData) {
                    vscode.window.showErrorMessage("Invalid generate return");
                    return;
                }

                const editor = await vscode.window.showTextDocument(uri);
                const doc = editor.document;
                oldData.data = newData;

                const newJsonText = JSON.stringify(oldData, null, 4);

                await editor.edit(x => {
                    const start = new vscode.Position(0, 0);
                    const end = doc.lineAt(doc.lineCount - 1).range.end;

                    x.replace(new vscode.Range(start, end), newJsonText);
                });
            } catch (error: any) {
                if (!cancellationToken.isCancellationRequested) vscode.window.showErrorMessage(error.message || error);
            }
        }
    );

}

async function getDocContentByPath(path: string): Promise<string> {
    let doc = vscode.workspace.textDocuments.find(x => x.uri.fsPath === path);

    if (!doc) {
        doc = await vscode.workspace.openTextDocument(path);
    }

    return doc.getText();
}

function inferredOutputName(dataPath: string, templatePath: string): string {
    const dataBase = fsPath.basename(dataPath).replace('.liquid-data.json', '');
    const ext = fsPath.extname(templatePath);
    return `${dataBase}${ext}`;
}

function onDidSaveTextDocument(doc: vscode.TextDocument) {
    if (doc.uri.fsPath.endsWith(".js")) {
        delete require.cache[doc.uri.fsPath];
    }

    if (REGEX_PATTERN_LIQUID_DATA.test(doc.uri.fsPath)) {
        validateLiquidDataDocument(doc);
    }
}

function provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    const text = doc.getText();
    const json = parseJsonSafe(text);
    if (!json) {
        return [];
    }

    const lenses = new Array<vscode.CodeLens>();

    const match = text.match(/"dataGenerator"\s*:/);

    if (match && match.index) {
        const line = doc.positionAt(match.index).line;
        lenses.push(new vscode.CodeLens(
            new vscode.Range(line, 0, line, 0),
            {
                title: "▶ Fetch",
                command: COMMANDS_DATA_GENERATOR_FETCH,
                arguments: [doc.uri]
            }
        ));
    }

    const firstLine = new vscode.Range(0, 0, 0, 0);

    lenses.push(new vscode.CodeLens(firstLine, {
        title: '▶ Render',
        command: COMMANDS_DATA_RENDER,
        arguments: [doc.uri]
    }));

    let label: string;
    let tooltip: string;

    if (currentState?.watchMode && currentState.dataUri.fsPath === doc.uri.fsPath) {
        label = '■ Stop';
        tooltip = 'Stop watching for changes';
    }
    else {
        label = '▶ Watch';
        tooltip = 'Start watching for changes';
    }

    lenses.push(new vscode.CodeLens(firstLine, {
        title: label,
        command: COMMANDS_TOGGLE_WATCH,
        arguments: [doc.uri],
        tooltip: tooltip
    }));

    return lenses;
}

async function provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.CompletionItem[]> {
    const textBefore = doc.getText(new vscode.Range(new vscode.Position(0, 0), pos));

    let currentKey = '';
    try {
        const match = textBefore.match(/"(\w+)"\s*:\s*("[^"]*$)?$/m);
        if (match) currentKey = match[1];
    } catch (error) {
        return [];
    }

    let pattern;

    switch (currentKey) {
        case "template":
            pattern = "**/*.liquid-template.*";
            break;
        case "src":
            pattern = "**/*.liquid-data-src.js";
            break;
        default:
            return [];
    }

    const files = await vscode.workspace.findFiles(pattern, GLOB_PATTERN_NODE_MODULES);

    return files.map(x => {
        const item = new vscode.CompletionItem(
            vscode.workspace.asRelativePath(x),
            vscode.CompletionItemKind.File
        );

        return item;
    });
}

async function render(uri: vscode.Uri) {
    const data = await parseJsonData(uri);

    if (!data) {
        return;
    }

    const templateString = await getDocContentByPath(data.templateFsPath);

    const outputFsPath = data.outputFsPath || data.outputFsPathSuggestion;

    if (currentState) {
        currentState.dataFsPath = data.dataFsPath;
        currentState.obj = data.obj;
        currentState.templateFsPath = data.templateFsPath;
        currentState.dataUri = uri;
        currentState.templateString = templateString;
        currentState.outputFsPath = outputFsPath!;
    } else {
        currentState = {
            ...data,
            dataUri: uri,
            outputFsPath: outputFsPath!,
            watchMode: false,
            templateString: templateString,
        };
    }

    onRenderComplete?.(currentState);
}

async function toggleWatch(uri: vscode.Uri) {
    if (!currentState?.watchMode) {
        await render(uri);
    }

    currentState!.watchMode = !currentState!.watchMode;
    onDidChangeCodeLenses.fire();
}

export function init(onRenderCompleted: (state: IRenderState) => void): vscode.Disposable {
    onRenderComplete = onRenderCompleted;
    diagnostics = vscode.languages.createDiagnosticCollection('liquid-data');

    const ajv = new Ajv({ allErrors: true });
    addErrors(ajv);

    validate = ajv.compile(liquidDataSchema);

    const selector: vscode.DocumentSelector = { pattern: GLOB_PATTERN_LIQUID_DATA, language: "json", scheme: "file" };
    const disposables: vscode.Disposable[] = [
        vscode.languages.registerCompletionItemProvider(
            selector,
            { provideCompletionItems }
        ),
        vscode.languages.registerCodeLensProvider(
            selector,
            {
                provideCodeLenses, onDidChangeCodeLenses: onDidChangeCodeLenses.event
            }
        ),

        vscode.workspace.onDidOpenTextDocument(validateLiquidDataDocument),
        vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument),

        vscode.commands.registerCommand(COMMANDS_TOGGLE_WATCH, toggleWatch),
        vscode.commands.registerCommand(COMMANDS_DATA_GENERATOR_FETCH, fetchData),
        vscode.commands.registerCommand(COMMANDS_DATA_RENDER, render),
    ];

    return {
        dispose() {
            disposables.forEach(x => x.dispose());
        }
    };
}

export function isPathLiquidData(path: string) {
    const res = REGEX_PATTERN_LIQUID_DATA.test(path);
    return res;
}

export function isUriLiquidData(uri: vscode.Uri) {
    return isPathLiquidData(uri.fsPath);
}

export async function parseJsonData(uri: vscode.Uri): Promise<ILiquidDataParseResult | undefined> {
    if (!isUriLiquidData(uri)) return;

    let doc: vscode.TextDocument;

    const dataFsPath = uri.fsPath;
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor && activeEditor.document.uri.fsPath === dataFsPath) {
        doc = activeEditor.document;
    } else {
        doc = await vscode.workspace.openTextDocument(uri);
    }

    const dataContent = doc.getText();
    const errors: vscode.Diagnostic[] = [];

    const json = parseJsonSafe<ILiquidData>(dataContent);

    validate(json);

    for (const err of validate.errors || []) {
        const path = err.instancePath || "/";
        const msg = err.message || "Validation error";

        errors.push(createErr(doc, path, msg));
    }

    if (errors.length) {
        diagnostics.set(doc.uri, errors);
        return;
    }
    else {
        diagnostics.delete(doc.uri);
    }

    let templateFsPath = resolveTarget(dataFsPath, json.template);
    let outputFsPath: string | undefined;
    let dataGeneratorSrcFsPath: string | undefined;
    let outputFsPathSuggestion: string | undefined;
    let outputPathSuggestion: string | undefined;

    if (json.output) {
        outputFsPath = resolveTarget(dataFsPath, json.output);
    } else {
        const inferredName = inferredOutputName(dataFsPath, templateFsPath);
        outputFsPathSuggestion = resolveTarget(dataFsPath, inferredName);
        outputPathSuggestion = "./" + inferredName;
    }

    if (json.dataGenerator?.src) {
        dataGeneratorSrcFsPath = resolveTarget(dataFsPath, json.dataGenerator.src);
    }

    return {
        dataFsPath,
        templateFsPath,
        outputFsPath,
        dataGeneratorSrcFsPath,
        outputFsPathSuggestion,
        outputPathSuggestion,
        obj: json as ILiquidData,
    };
}

export function validateLiquidDataDocument(doc: vscode.TextDocument): boolean {
    const uri = doc.uri;
    return !!parseJsonData(uri);
}

const COMMANDS_DATA_GENERATOR_FETCH = "liquid-templating.data.dataGenerator.fetch";
const onDidChangeCodeLenses = new vscode.EventEmitter<void>();

let diagnostics: vscode.DiagnosticCollection;
let onRenderComplete: (state: IRenderState) => void | undefined;

export const COMMANDS_DATA_RENDER = 'liquid-templating.data.render';
export const COMMANDS_TOGGLE_WATCH = 'liquid-templating.data.toggleWatch';
export const GLOB_PATTERN_LIQUID_DATA = "**/*.liquid-data.json";
export const REGEX_PATTERN_LIQUID_DATA = globToRegex(GLOB_PATTERN_LIQUID_DATA);
