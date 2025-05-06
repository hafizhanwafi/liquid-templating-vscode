import * as vscode from 'vscode';
import { init } from './core';


export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        init(context)
    );
}