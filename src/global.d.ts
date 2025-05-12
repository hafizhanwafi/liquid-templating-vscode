import type { Uri } from "vscode";

declare global {
    interface ILiquidData {
        data: any;
        template: string;
        output?: string;
        dataGenerator?: ILiquidDataGenerator;
    }

    interface ILiquidDataParseResult {
        obj: ILiquidData;
        dataFsPath: string;
        templateFsPath: string;
        outputFsPath?: string;
        dataGeneratorSrcFsPath?: string;
        outputFsPathSuggestion?: string;
        outputPathSuggestion?: string;
    }

    interface ILiquidDataGenerator {
        type: "js";
        src: string;
    }

    interface IRenderState extends ILiquidDataParseResult {
        outputFsPath: string;
        templateString?: string;
        dataUri: Uri;
        renderedContent?: string;
        watchMode: boolean;
    }
}