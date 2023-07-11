/**
 * @author Ali Gençay
 * https://github.com/gencay/vscode-chatgpt
 *
 * @license
 * Copyright (c) 2022 - Present, Ali Gençay
 *
 * All rights reserved. Code licensed under the ISC license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

// @ts-nocheck

(function () {
    const vscode = acquireVsCodeApi();
    let language = "";
    marked.setOptions({
        renderer: new marked.Renderer(),
        highlight: function (code, _lang) {
            return hljs.highlightAuto(code).value;
        },
        langPrefix: 'hljs language-',
        pedantic: false,
        gfm: true,
        breaks: false,
        sanitize: false,
        smartypants: false,
        xhtml: false
    });

    const aiSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24px" height="24px" viewBox="0 0 24 24" stroke-width="1.2" version="1.1">
<g id="surface1">
<path style=" stroke:none;fill-rule:nonzero;fill:rgb(123,123,123);fill-opacity:1;" d="M 8.15625 6.992188 C 6 10.726562 4.070312 14.0625 3.882812 14.398438 L 3.523438 15.019531 L 5.738281 14.960938 L 7.96875 14.90625 L 9.976562 11.476562 C 11.0625 9.582031 12.039062 8.0625 12.132812 8.082031 C 12.207031 8.117188 13.894531 10.929688 15.863281 14.324219 L 19.425781 20.53125 L 21.617188 20.585938 C 22.820312 20.605469 23.8125 20.605469 23.8125 20.570312 C 23.8125 20.53125 21.84375 17.082031 19.445312 12.917969 C 17.042969 8.757812 14.417969 4.199219 13.613281 2.8125 C 12.804688 1.425781 12.132812 0.261719 12.113281 0.242188 C 12.09375 0.226562 10.3125 3.261719 8.15625 6.992188 Z M 8.15625 6.992188 "/>
<path style=" stroke:none;fill-rule:nonzero;fill:rgb(123,123,123);fill-opacity:1;" d="M 10.480469 14.664062 C 9.636719 16.144531 8.53125 18.039062 8.042969 18.898438 C 7.539062 19.742188 7.125 20.492188 7.125 20.53125 C 7.125 20.585938 9.375 20.625 12.113281 20.625 C 14.851562 20.625 17.0625 20.550781 17.023438 20.476562 C 16.894531 20.117188 12.148438 12 12.09375 12 C 12.054688 12 11.34375 13.199219 10.480469 14.664062 Z M 10.480469 14.664062 "/>
<path style=" stroke:none;fill-rule:nonzero;fill:rgb(123,123,123);fill-opacity:1;" d="M 1.667969 18.226562 C 1.238281 18.976562 0.769531 19.78125 0.636719 20.007812 C 0.488281 20.230469 0.375 20.476562 0.375 20.53125 C 0.375 20.585938 1.351562 20.605469 2.550781 20.585938 L 4.726562 20.53125 L 5.738281 18.789062 C 6.300781 17.8125 6.75 17.007812 6.75 16.949219 C 6.75 16.914062 5.773438 16.875 4.59375 16.875 L 2.457031 16.875 Z M 1.667969 18.226562 "/>
</g>
</svg>
`;
    

    const userSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-license="isc-gnc" stroke-width="1.5" stroke="currentColor" class="w-5 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`;

    const clipboardSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-license="isc-gnc" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>`;

    const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-license="isc-gnc" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>`;

    const cancelSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-license="isc-gnc" stroke-width="1.5" stroke="currentColor" class="w-3 h-3 mr-1"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;

    const sendSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-license="isc-gnc" stroke-width="1.5" stroke="currentColor" class="w-3 h-3 mr-1"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>`;

    const pencilSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-license="isc-gnc" stroke-width="2" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>`;

    const plusSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-license="isc-gnc" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`;

    const insertSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-license="isc-gnc" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" /></svg>`;

    const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" data-license="isc-gnc" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" ><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

    const closeSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-license="isc-gnc" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;

    const refreshSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-license="isc-gnc" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`;
    
    const diffSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M12 20V4m-7 9h14"></path></svg>`;



    function insertAfter(newNode, referenceNode) {
        referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
    }



    function createCodeBlockButtons(preCode) {
        preCode.classList.add("input-background", "p-4", "pb-2", "block", "whitespace-pre", "overflow-x-scroll");
        preCode.parentElement.classList.add("pre-code-element", "relative");

        const buttonWrapper = document.createElement("no-export");
        buttonWrapper.classList.add("code-actions-wrapper", "flex", "gap-3", "pr-2", "pt-1", "pb-1", "flex-wrap", "items-center", "justify-end", "rounded-t-lg", "input-background");

        // Create copy to clipboard button
        const copyButton = document.createElement("button");
        copyButton.title = "Copy to clipboard";
        copyButton.innerHTML = `${clipboardSvg} Copy`;
        copyButton.classList.add("code-element-ext", "p-1", "pr-2", "flex", "items-center", "rounded-lg");

        // Create insert button
        const insertButton = document.createElement("button");
        insertButton.title = "Insert the below code to the current file";
        insertButton.innerHTML = `${insertSvg} Insert`;
        insertButton.classList.add("edit-element-ext", "p-1", "pr-2", "flex", "items-center", "rounded-lg");

        // Create diff button
        const diffButton = document.createElement("button");
        diffButton.title = "Show diff with the current file";
        diffButton.innerHTML = `${diffSvg} Diff`;
        diffButton.classList.add("diff-element-ext", "p-1", "pr-2", "flex", "items-center", "rounded-lg");

        // Create new tab button
        const newTabButton = document.createElement("button");
        newTabButton.title = "Create a new file with the below code";
        newTabButton.innerHTML = `${plusSvg} New`;
        newTabButton.classList.add("new-code-element-ext", "p-1", "pr-2", "flex", "items-center", "rounded-lg");

        buttonWrapper.append(copyButton, insertButton, newTabButton, diffButton);

        if (preCode.parentNode.previousSibling) {
            insertAfter(buttonWrapper, preCode.parentNode.previousSibling);
        } else {
            preCode.parentNode.parentElement.append(buttonWrapper);
        }
    }

    


    window.addEventListener("message", (event) => {
        const message = event.data;
      
        const list = document.getElementById("qa-list");
        if (message.value === "done")  {
            return;
        }
  


        switch (message.type) {
            case "showInProgress":
                if (message.inProgress === true) {
                    document.getElementById("stop-button").classList.remove("hidden");
                } else {
                    document.getElementById("stop-button").classList.add("hidden");
                }

                if (message.inProgress) {
                    document.getElementById("in-progress").classList.remove("hidden");
                    document.getElementById("question-input").setAttribute("disabled", true);
                    document.getElementById("question-input-buttons").classList.add("hidden");
                } else {
                    document.getElementById("in-progress").classList.add("hidden");
                    document.getElementById("question-input").removeAttribute("disabled");
                    document.getElementById("question-input-buttons").classList.remove("hidden");
                }
                break;
            case "addQuestion":
                list.classList.remove("hidden");
                document.getElementById("introduction")?.classList?.add("hidden");
                document.getElementById("conversation-list").classList.add("hidden");

                const escapeHtml = (unsafe) => {
                    return unsafe.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#039;', "'");
                };

                list.innerHTML +=
                    `<div class="p-4 self-end mt-4 question-element-ext relative input-background">
                        <h2 class="mb-5 flex" data-license="isc-gnc">${userSvg}You</h2>
                        <no-export class="mb-2 flex items-center" data-license="isc-gnc">
                            <button title="Edit and resend this prompt" class="resend-element-ext p-1.5 flex items-center rounded-lg absolute right-6 top-6">${pencilSvg}</button>
                            <div class="hidden send-cancel-elements-ext flex gap-2">
                                <button title="Send this prompt" class="send-element-ext p-1 pr-2 flex items-center">${sendSvg}&nbsp;Send</button>
                                <button title="Cancel" class="cancel-element-ext p-1 pr-2 flex items-center">${cancelSvg}&nbsp;Cancel</button>
                            </div>
                        </no-export>
                        <div class="overflow-y-auto">${escapeHtml(message.value)}</div>
                    </div>`;

                if (event.data.autoScroll) {
                    list.lastChild?.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
                }
                break;
            case "addResponse":
                let existingMessage = document.getElementById(message.id);
                let updatedValue = "";
                let rawValue = "";
                
                updatedValue = message.value.split("```").length % 2 === 1 ? message.value : message.value + "\n\n```\n\n";
                updatedValue = message.value.replace(/`([^`]{1})`/g, '<code>$1</code>');                 
                
                
                const wrappedCodeBlocks = [];
                let inCodeBlock = false;
                 // variable to store the language
                const lines = updatedValue.split("\n");
                
                lines.forEach((line, index) => {
                    const match = /^```(.*)$/.exec(line);
                    if (match) {
                        inCodeBlock = !inCodeBlock;
                        if (inCodeBlock) {
                            language = match[1]; // save the language
                        } else if (!inCodeBlock && index !== lines.length - 1) {
                            wrappedCodeBlocks.push("</p>\n\n<p>");
                        }
                    } else {
                        if (inCodeBlock) {
                            line = "    " + line;
                        }
                        wrappedCodeBlocks.push(line);
                    }
                });
                
            
                
                if (inCodeBlock) {
                    wrappedCodeBlocks.push("</p>");
                }
                
                updatedValue = "<p>" + wrappedCodeBlocks.join('\n') + "</p>";
                let markedResponse = marked.parse(updatedValue);
                
                
                //const markedResponse = marked.parse(updatedValue);
                const parser = new DOMParser();
                const htmlDoc = parser.parseFromString(markedResponse, 'text/html');
                htmlDoc.querySelectorAll('pre').forEach(preElement => {
                    preElement.classList.add('pre-code-element', 'relative');
                });
                htmlDoc.querySelectorAll('code').forEach(codeElement => {
                    //codeElement.classList.add('input-background', 'p-4', 'pb-2', 'block', 'whitespace-pre', 'overflow-x-scroll');
                });
                
                htmlDoc.querySelectorAll("pre > code").forEach(createCodeBlockButtons);
              
                const updatedMarkedResponse = htmlDoc.documentElement.innerHTML;
               
                

                if (existingMessage) {
                    
          
                    existingMessage.innerHTML = updatedMarkedResponse;
                    
                   
                } else {
                    list.innerHTML +=
                        `<div data-license="isc-gnc" class="p-4 self-end mt-4 pb-8 answer-element-ext">
                            <h2 class="mb-5 flex">${aiSvg} Autonimate</h2>
                            <div class="result-streaming" id="${message.id}">${updatedMarkedResponse}</div>
                        </div>`;
                }
                
           

                if (message.autoScroll) {
                    list.lastChild?.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" });
                }
                
                break;
            case "addError":
                const messageValue = message.value || "An error occurred. If this issue persists please clear your session token with `ChatGPT: Reset session` command and/or restart your Visual Studio Code. If you still experience issues, it may be due to outage on https://openai.com services.";

                list.innerHTML +=
                    `<div class="p-4 self-end mt-4 pb-8 error-element-ext" data-license="isc-gnc">
                        <h2 class="mb-5 flex">${aiSvg}Autonimate</h2>
                        <div class="text-red-400">${marked.parse(messageValue)}</div>
                    </div>`;

                if (message.autoScroll) {
                    list.lastChild?.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
                }
                break;
            case "clearConversation":
                clearConversation();
                break;
            case "exportConversation":
                exportConversation();
                break;
            case "loginSuccessful":
                document.getElementById("login-button")?.classList?.add("hidden");
                if (message.showConversations) {
                    document.getElementById("list-conversations-link")?.classList?.remove("hidden");
                }
                break;
            default:
                break;
        }
    });

    const addFreeTextQuestion = () => {
        const input = document.getElementById("question-input");
        if (input.value?.length > 0) {
            vscode.postMessage({
                type: "addFreeTextQuestion",
                value: input.value,
            });

            input.value = "";
        }
    };

    const clearConversation = () => {
        document.getElementById("qa-list").innerHTML = "";

        document.getElementById("introduction")?.classList?.remove("hidden");

        vscode.postMessage({
            type: "clearConversation"
        });

    };

    const exportConversation = () => {
        const turndownService = new TurndownService({ codeBlockStyle: "fenced" });
        turndownService.remove('no-export');
        let markdown = turndownService.turndown(document.getElementById("qa-list"));

        vscode.postMessage({
            type: "openNew",
            value: markdown,
            language: "markdown"
        });
    };

    document.getElementById('question-input').addEventListener("keydown", function (event) {
        if (event.key == "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            addFreeTextQuestion();
        }
    });

    document.addEventListener("click", (e) => {
        const targetButton = e.target.closest('button');

        if (targetButton?.id === "more-button") {
            e.preventDefault();
            document.getElementById('chat-button-wrapper')?.classList.toggle("hidden");

            return;
        } else {
            document.getElementById('chat-button-wrapper')?.classList.add("hidden");
        }

        if (e.target?.id === "settings-button") {
            e.preventDefault();
            vscode.postMessage({
                type: "openSettings",
            });
            return;
        }

        if (e.target?.id === "settings-prompt-button") {
            e.preventDefault();
            vscode.postMessage({
                type: "openSettingsPrompt",
            });
            return;
        }

        if (targetButton?.id === "login-button") {
            e.preventDefault();
            vscode.postMessage({
                type: "login",
            });
            return;
        }

        if (targetButton?.id === "ask-button") {
            e.preventDefault();
            addFreeTextQuestion();
            return;
        }

        if (targetButton?.id === "clear-button") {
            e.preventDefault();
            clearConversation();
            return;
        }

        if (targetButton?.id === "export-button") {
            e.preventDefault();
            exportConversation();
            return;
        }

        if (targetButton?.id === "stop-button") {
            e.preventDefault();
            vscode.postMessage({
                type: "stopGenerating",
            });

            return;
        }

        if (targetButton?.classList?.contains("resend-element-ext")) {
            e.preventDefault();
            const question = targetButton.closest(".question-element-ext");
            const elements = targetButton.nextElementSibling;
            elements.classList.remove("hidden");
            question.lastElementChild?.setAttribute("contenteditable", true);

            targetButton.classList.add("hidden");

            return;
        }

        if (targetButton?.classList?.contains("send-element-ext")) {
            e.preventDefault();

            const question = targetButton.closest(".question-element-ext");
            const elements = targetButton.closest(".send-cancel-elements-ext");
            const resendElement = targetButton.parentElement.parentElement.firstElementChild;
            elements.classList.add("hidden");
            resendElement.classList.remove("hidden");
            question.lastElementChild?.setAttribute("contenteditable", false);

            if (question.lastElementChild.textContent?.length > 0) {
                vscode.postMessage({
                    type: "addFreeTextQuestion",
                    value: question.lastElementChild.textContent,
                    language: language,
                });
            }
            return;
        }

        if (targetButton?.classList?.contains("cancel-element-ext")) {
            e.preventDefault();
            const question = targetButton.closest(".question-element-ext");
            const elements = targetButton.closest(".send-cancel-elements-ext");
            const resendElement = targetButton.parentElement.parentElement.firstElementChild;
            elements.classList.add("hidden");
            resendElement.classList.remove("hidden");
            question.lastElementChild?.setAttribute("contenteditable", false);
            return;
        }

        if (targetButton?.classList?.contains("code-element-ext")) {
            e.preventDefault();
            navigator.clipboard.writeText(targetButton.parentElement?.nextElementSibling?.lastChild?.textContent).then(() => {
                targetButton.innerHTML = `${checkSvg} Copied`;

                setTimeout(() => {
                    targetButton.innerHTML = `${clipboardSvg} Copy`;
                }, 1500);
            });

            return;
        }

        if (targetButton?.classList?.contains("edit-element-ext")) {
            e.preventDefault();
            vscode.postMessage({
                type: "editCode",
                value: targetButton.parentElement?.nextElementSibling?.lastChild?.textContent,
            });

            return;
        }

        if (targetButton?.classList?.contains("new-code-element-ext")) {
            e.preventDefault();
            vscode.postMessage({
                type: "openNew",
                value: targetButton.parentElement?.nextElementSibling?.lastChild?.textContent,
                language: language,
            });

            return;
        }
    
        if (targetButton?.classList?.contains("diff-element-ext")) {
            e.preventDefault();
            vscode.postMessage({
                type: "showDiff",
                value: targetButton.parentElement?.nextElementSibling?.lastChild?.textContent,
                language: language,
            });

            return;
        }

    
    
    });

})();