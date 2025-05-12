import GlobToRegExp from "glob-to-regexp";
import path from "path";

export const GLOB_PATTERN_NODE_MODULES = "**/node_modules/**";

export function resolveTarget(base: string, target: string): string {
    const baseDir = path.extname(base) ? path.dirname(base) : base;
    return path.resolve(baseDir, target);
}

export function parseJsonSafe<T extends {}>(text: string): T {
    try {
        return JSON.parse(text);
    } catch (e) {
        return {} as T;
    }
}

export function globToRegex(glob: string): RegExp {
    const regex = GlobToRegExp(glob, {
        flags: 'i',
        globstar: true
    });

    return regex;
}

export function debounce<T extends (...args: any[]) => void>(callback: T, delay: number = 500): T {
    let timer: NodeJS.Timeout | null = null;

    return ((...args: any[]) => {
        timer && clearTimeout(timer);

        timer = setTimeout(() => {
            callback(...args);
        }, delay);
    }) as T;
}

export function getPrismLanguageFromExtension(filePath: string): string {
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