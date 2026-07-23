async function loadSidePanel() {
    const response = await fetch(chrome.runtime.getURL("popup/popup.html"));
    if (!response.ok) {
        throw new Error(`Unable to load the extension UI (HTTP ${response.status}).`);
    }

    const source = await response.text();
    const parsed = new DOMParser().parseFromString(source, "text/html");
    parsed.querySelectorAll("script").forEach(script => script.remove());

    document.title = parsed.title || document.title;
    document.body.replaceChildren(...[...parsed.body.childNodes].map(node => document.importNode(node, true)));
    document.documentElement.classList.add("side-panel-mode");
    document.body.classList.add("side-panel-mode");

    await import("./popup.js");
}

loadSidePanel().catch(error => {
    const message = document.createElement("div");
    message.className = "empty-state";
    message.textContent = `ACP Validator could not start: ${error.message}`;
    document.body.replaceChildren(message);
});
