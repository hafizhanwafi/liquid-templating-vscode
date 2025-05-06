const vsc = acquireVsCodeApi();

let viewData;

window.addEventListener('message', event => {
    viewData = event.data;
    const { templateName, templatePath, dataName, output, outputName, language } = event.data;

    code.innerHTML = "<!-- -->" + escapeHtml(output) + "<!-- -->";
    code.className = "language-" + (language || "plaintext");
    linkTemplate.innerHTML = templateName;
    linkTemplate.setAttribute("title", "Open file: " + templatePath);
    linkData.innerHTML = dataName;
    linkData.setAttribute("title", "Open file: " + templatePath);
    linkOutput.innerHTML = outputName;
    linkOutput.setAttribute("title", "Open file: " + templatePath);
    toolbarText.innerHTML = language;

    Prism.highlightAll();
});

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeContent(str) {
    return str.replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

const linkTemplate = document.querySelector("#link-template");
linkTemplate.addEventListener("click", () => {
    vsc.postMessage({
        command: "open",
        path: viewData.templatePath
    });
});

const linkData = document.querySelector("#link-data");
linkData.addEventListener("click", () => {
    vsc.postMessage({
        command: "open",
        path: viewData.dataPath
    });
});

const linkOutput = document.querySelector("#link-output");
linkOutput.addEventListener("click", () => {
    vsc.postMessage({
        command: "open",
        path: viewData.outputPath,
        isOutput: true
    });
});

document.querySelector(".copy-button").addEventListener("click", (e) => {
    navigator.clipboard.writeText(viewData.output);
});

document.querySelector("#link-save").addEventListener("click", () => {
    vsc.postMessage({
        command: "save"
    });
});

const toolbarText = document.querySelector(".toolbar-text");

const code = document.querySelector("code");