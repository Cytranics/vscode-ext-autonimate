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

import delay from 'delay';
import OpenAI from 'openai';
import * as vscode from 'vscode';



export default class ChatGptViewProvider implements vscode.WebviewViewProvider {
	private webView?: vscode.WebviewView;

	public subscribeToResponse: boolean;
	public autoScroll: boolean;
	public useAutoLogin?: boolean;
	public chromiumPath?: string;
	public profilePath?: string;
	public model?: string = 'gpt-3.5-turbo-16k';
	public selectedBaseUrl: string;
	public apiKey: string;
	public azureDeployment: string;
	public max_tokens: number;
	public temperature: number;
	public top_p: number;
	public apiBaseUrl: string;
	public azureBaseUrl: string;
	public systemPrompt: string;
	public systemAppendPrompt: string;
	public method: string;
	public conversationHistoryAmount: number;
	private conversationId?: string;
	public conversationHistory?: any[];
	private messageState: vscode.Memento;
	private questionCounter: number = 0;
	private inProgress: boolean = false;
	private currentMessageId: string = "";
	private response: string = "";
	private stream: AsyncIterableIterator<any>;
	private prompt: string = "";
	private options: any = {};

	/**
	 * Message to be rendered lazily if they haven't been rendered
	 * in time before resolveWebviewView is called.
	 */
	private leftOverMessage?: any;
	constructor(private context: vscode.ExtensionContext) {
		this.subscribeToResponse = vscode.workspace.getConfiguration("autonimate").get("response.showNotification") || false;
		this.autoScroll = vscode.workspace.getConfiguration("autonimate").get("response.autoScroll");
		this.model = vscode.workspace.getConfiguration("autonimate").get("model") as string || 'gpt-3.5-turbo-16k';
		this.systemPrompt = vscode.workspace.getConfiguration("autonimate").get("systemPrompt") || '';
		this.systemAppendPrompt = vscode.workspace.getConfiguration("autonimate").get("systemAppendPrompt") || '';
		this.apiKey = vscode.workspace.getConfiguration("autonimate").get("apiKey") as string;
		this.azureDeployment = vscode.workspace.getConfiguration("autonimate").get("azureDeployment") as string;
		this.max_tokens = vscode.workspace.getConfiguration("autonimate").get("maxTokens") as number;
		this.temperature = vscode.workspace.getConfiguration("autonimate").get("temperature") as number;
		this.top_p = vscode.workspace.getConfiguration("autonimate").get("top_p") as number;
		this.apiBaseUrl = vscode.workspace.getConfiguration("autonimate").get("apiBaseUrl") as string;
		this.azureBaseUrl = vscode.workspace.getConfiguration("autonimate").get("azureBaseUrl") as string;
		this.selectedBaseUrl = this.azureBaseUrl && this.azureBaseUrl.trim() !== '' ? this.azureBaseUrl : this.apiBaseUrl;
		this.method = vscode.workspace.getConfiguration("autonimate").get("method") as string || 'OpenAI';
		this.conversationHistoryAmount = vscode.workspace.getConfiguration("autonimate").get("conversationHistoryAmount") as number;
		this.messageState = context.globalState;



	}


	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this.webView = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this.context.extensionUri
			]
		};

		webviewView.webview.html = this.getWebviewHtml(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async data => {
			switch (data.type) {
				case 'addFreeTextQuestion':
					this.sendApiRequest(data.value, { command: "freeText" });
					break;
				case 'editCode':
					const escapedString = (data.value as string).replace(/\$/g, '\\$');;
					vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(escapedString));

					this.logEvent("code-inserted");
					break;
				case 'openNew':
					const document = await vscode.workspace.openTextDocument({
						content: data.value,
						language: data.language
					});
					vscode.window.showTextDocument(document);

					this.logEvent(data.language === "markdown" ? "code-exported" : "code-opened");
					break;
				case 'clearConversation':
					this.messageState.update("conversationHistory", []);
					this.questionCounter = 0;

					this.logEvent("conversation-cleared");
					break;

				case 'openSettings':
					vscode.commands.executeCommand('workbench.action.openSettings', "@ext:autonimate.autonimate autonimate.");

					this.logEvent("settings-opened");
					break;
				case 'openSettingsPrompt':
					vscode.commands.executeCommand('workbench.action.openSettings', "@ext:autonimate.autonimate promptPrefix");

					this.logEvent("settings-prompt-opened");
					break;
				case 'showConversation':
					/// ...
					break;


				case 'showDiff':
					const editor = vscode.window.activeTextEditor;
					const selection = editor.document.getText(editor.selection);
					const activeEditor = vscode.window.activeTextEditor;
					if (activeEditor) {
						const document1Uri = activeEditor.document.uri;

						// Create a new untitled document with the content of data.value
						const document2 = await vscode.workspace.openTextDocument({
							content: data.value,
							language: activeEditor.document.languageId // Use the same language as the original document
						});

						// Get the URI for the new document
						const document2Uri = document2.uri;

						// Open the diff editor with the original document and the new document
						vscode.commands.executeCommand('vscode.diff',
							document1Uri,
							document2Uri,
							'Original <<>> Generated'
						);
					}
					this.logEvent("code-diffed");
					break;

				case "stopGenerating":
					this.stopGenerating();
					
					break;
				default:
					break;
			}
		});

		if (this.leftOverMessage != null) {
			// If there were any messages that wasn't delivered, render after resolveWebView is called.
			this.sendMessage(this.leftOverMessage);
			this.leftOverMessage = null;
		}
	}

	private stopGenerating(): void {
		(this.stream as any).controller.abort();
		this.stream = undefined;
		this.inProgress = false;
		this.sendMessage({ type: 'showInProgress', inProgress: this.inProgress });
		this.sendMessage({ type: 'addResponse', value: this.response, done: true, id: this.currentMessageId, autoScroll: this.autoScroll });
		this.logEvent("stopped-generating");
	}

	public clearSession(): void {
		this.stopGenerating();
		this.messageState.update("conversationHistory", []);
		this.conversationId = undefined;
		this.logEvent("cleared-session");
	}





	public async prepareConversation(modelChanged = false): Promise<boolean> {


		const state = this.context.globalState;
		const configuration = vscode.workspace.getConfiguration("autonimate");

		// Prioritize azureBaseUrl if not blank, otherwise use apiBaseUrl	
		this.azureDeployment = vscode.workspace.getConfiguration("autonimate").get("azureDeployment") as string;
		this.max_tokens = vscode.workspace.getConfiguration("autonimate").get("maxTokens") as number;
		this.temperature = vscode.workspace.getConfiguration("autonimate").get("temperature") as number;
		this.top_p = vscode.workspace.getConfiguration("autonimate").get("top_p") as number;
		this.apiKey = vscode.workspace.getConfiguration("autonimate").get("apiKey") as string;
		this.systemPrompt = vscode.workspace.getConfiguration("autonimate").get("systemPrompt") as string;
		this.systemAppendPrompt = vscode.workspace.getConfiguration("autonimate").get("systemAppendPrompt") as string;
		this.apiBaseUrl = vscode.workspace.getConfiguration("autonimate").get("apiBaseUrl") as string || '';
		this.azureBaseUrl = vscode.workspace.getConfiguration("autonimate").get("azureBaseURL") as string || '';
		this.model = vscode.workspace.getConfiguration("autonimate").get("model") as string;
		this.method = vscode.workspace.getConfiguration("autonimate").get("method") as string || 'OpenAI';
		this.autoScroll = vscode.workspace.getConfiguration("autonimate").get("response.autoScroll") as boolean;


		if (!this.apiKey) {
			vscode.window.showErrorMessage("Please add your API Key to use OpenAI official APIs. Storing the API Key in Settings is discouraged due to security reasons, though you can still opt-in to use it to persist it in settings. Instead you can also temporarily set the API Key one-time: You will need to re-enter after restarting the vs-code.", "Store in session (Recommended)", "Open settings").then(async choice => {
				if (choice === "Open settings") {
					vscode.commands.executeCommand('workbench.action.openSettings', "autonimate.apiKey");
					return false;
				} else if (choice === "Store in session (Recommended)") {
					await vscode.window
						.showInputBox({
							title: "Store Azure/OpenAI API Key in session",
							prompt: "Please enter your API Key to store in your session only.",
							ignoreFocusOut: true,
							placeHolder: "API Key",
							value: this.apiKey || ""
						})
						.then((value) => {
							if (value) {
								this.apiKey = value;
								state.update("autonimate-apiKey", this.apiKey);
								this.sendMessage({ type: 'loginSuccessful', showConversations: this.useAutoLogin }, true);
							}
						});
				}
			});

			return false;
		}

		return true;
	}

	public buildMessages(role: string, content: string, systemPrompt?: string, endingPrompt?: string): Array<{ role: string, content: string; }> {
	
		this.conversationHistory = this.messageState.get("conversationHistory") || [];
	
		if (systemPrompt) {
			this.conversationHistory.push({ role: "system", content: systemPrompt });
		}
	
		this.conversationHistory.push({ role: role, content: content });
	
		if (endingPrompt) {
			this.conversationHistory.push({ role: "assistant", content: endingPrompt });
		}
	
		// Check if conversation history has reached the limit
		if (this.conversationHistory.length > this.conversationHistoryAmount) {
			// Remove the second message, preserving the system message
			this.conversationHistory.splice(1, 1);
		}
	
		this.messageState.update("conversationHistory", this.conversationHistory);
	
		console.log(this.conversationHistory);
		return this.messageState.get("conversationHistory");
	}
	
	private processQuestion(question: string, code?: string, language?: string) {
		if (code != null) {
			// Add prompt prefix to the code if there was a code block selected
			question = `${question}${language ? ` (The following code is in ${language} programming language.)` : ''}: ${code}`;
		}
		return question + '\r\n';
	}
	
	public async sendApiRequest(prompt: string, options: { command: string, code?: string, previousAnswer?: string, language?: string; }) {
		this.prompt = prompt;
		this.options = options;
		if (this.inProgress) {
			return;
		}
	
		this.logEvent("api-request-sent", this.getAutonimateLogOptions(this.prompt, this.options));
	
		if (!await this.prepareConversation()) {
			return;
		}
	
		let question = this.processQuestion(this.prompt, options.code, options.language);
	
		this.updateConversationHistory(question, this.prompt, options);
	
		this.focusOnChatGPTView();
	
		this.response = "";
		this.inProgress = true;
		this.sendMessage({ type: 'showInProgress', inProgress: this.inProgress });
		this.currentMessageId = this.getRandomId();
	
		this.sendMessage({ type: 'addQuestion', value: this.prompt, code: this.options.code, autoScroll: this.autoScroll });
	
		let openai = this.initializeOpenAI();
	
		try {
			this.stream = await openai.chat.completions.create(this.getChatCompletionOptions());
	
			for await (const part of (this.stream as any)) {
				this.processStreamPart(part);
			}
			
	
			//if (this.subscribeToResponse) {
			//	this.notifyUser();
			//}
	
		} catch (error: any) {
			this.handleError(error, this.prompt, this.options);
		} finally {
			this.inProgress = false;
			this.sendMessage({ type: 'showInProgress', inProgress: this.inProgress });
		}
		this.buildMessages("assistant", this.response);
		this.handleContinuation(this.prompt, this.options);
	}
	
	private getAutonimateLogOptions(prompt: string, options: { command: string, code?: string, previousAnswer?: string, language?: string; }) {
		return {
			"autonimate-prompt": prompt,
			"autonimate.command": options.command,
			"autonimate.hasCode": String(!!options.code),
			"autonimate.hasPreviousAnswer": String(!!options.previousAnswer)
		};
	}
	
	private updateConversationHistory(question: string, prompt: string, options: { command: string, code?: string, previousAnswer?: string, language?: string; }) {
		if (this.questionCounter === 0) {
			this.questionCounter++;
			this.messageState.update("conversationHistory", []);
			this.conversationHistory = this.buildMessages("user", question, this.systemPrompt, this.systemAppendPrompt);
			this.logEvent("api-request-sent", this.getAutonimateLogOptions(prompt, options));
		} else {
			this.conversationHistory = this.buildMessages("user", question);
			this.questionCounter++;
		}
	}
	
	private focusOnChatGPTView() {
		if (this.webView == null) {
			vscode.commands.executeCommand('autonimate.view.focus');
		} else {
			this.webView?.show?.(true);
		}
	}
	
	private initializeOpenAI() {
		let openai = {} as any;
	
		if (this.method == "Azure") {
			openai = new OpenAI({
				apiKey: this.apiKey,
				baseURL: this.azureBaseUrl,
				defaultQuery: { 'api-version': '2023-03-15-preview' },
				defaultHeaders: { 'api-key': this.apiKey }
			});
		} else {
			openai = new OpenAI({
				apiKey: this.apiKey,
				baseURL: this.apiBaseUrl
			});
		}
	
		return openai;
	}
	
	private getChatCompletionOptions() {
		let options: {
			model: string;
			messages: any[];
			temperature: number;
			top_p: number;
			stream: boolean;
			max_tokens?: number; // add max_tokens as an optional property
		} = {
			model: this.model || 'gpt-3.5-turbo-16k',
			messages: this.conversationHistory,
			temperature: this.temperature,
			top_p: this.top_p,
			stream: true,
		};
	
		if (this.max_tokens !== 0) {
			options.max_tokens = this.max_tokens; //ignore max_tokens if 0
		}
	
		return options;
	}
	
	
	private processStreamPart(part: any) {
		if (part.error) {
			this.sendMessage({ type: 'addError', value: part.error, autoScroll: this.autoScroll });
			this.inProgress = false;
			this.sendMessage({ type: 'showInProgress', inProgress: this.inProgress });
		}
	
		if (part.id) {
			this.conversationId = part.id;
	
			if (part.choices[0].delta?.content && this.inProgress) {
				this.response += part.choices[0].delta.content;
	
				this.sendMessage({ type: 'addResponse', value: this.response, id: this.conversationId, autoScroll: this.autoScroll });
	
			}
			
		} else {
			console.log('Error: No delta.content found' + part);
		}
		
	}
	
	private handleContinuation(prompt: string, options: { command: string, code?: string, previousAnswer?: string, language?: string; }) {
		const hasContinuation = ((this.response.split("```").length) % 2) === 0;
		if (!hasContinuation) {
			this.buildMessages("assistant", this.response);
			this.sendMessage({ type: 'stopGenerating', value: this.response, done: true, id: this.currentMessageId, autoScroll: this.autoScroll });
		} else {
			if (hasContinuation) {
				this.response += " \r\n ```\r\n";
				vscode.window.showInformationMessage("It looks like autonimate didn't complete their answer for your coding question. You can ask it to continue and combine the answers.", "Continue and combine answers")
					.then(async (choice) => {
						if (choice === "Continue and combine answers") {
							this.sendApiRequest("Continue", { command: options.command, code: undefined, previousAnswer: this.response });
						}
					});
			}
		}
	}
	
	private notifyUser() {
		vscode.window.showInformationMessage("Autonimate responded to your question.", "Open conversation").then(async () => {
			await vscode.commands.executeCommand('autonimate.view.focus');
		});
	}
	
	private handleError(error: any, prompt: string, options: { command: string, code?: string, previousAnswer?: string, language?: string; }) {
		let message;
		let apiMessage = error?.response?.data?.error?.message || error?.tostring?.() || error?.message || error?.name;
	
		this.logError("api-request-failed");
	
		message = this.getErrorMessage(error, apiMessage);
	
		this.sendMessage({ type: 'addError', value: message, autoScroll: this.autoScroll });
	
		return;
	}
	
	private getErrorMessage(error: any, apiMessage: string) {
		let message;
	
		if (error?.response?.status || error?.response?.statusText) {
			message = `${error?.response?.status || ""} ${error?.response?.statusText || ""}`;
	
			vscode.window.showErrorMessage("An error occured. If this is due to max_token you could try `ChatGPT: Clear Conversation` command and retry sending your prompt.", "Clear conversation and retry").then(async choice => {
				if (choice === "Clear conversation and retry") {
					await vscode.commands.executeCommand("autonimate.clearConversation");
					await delay(250);
					this.sendApiRequest(this.prompt, { command: this.options.command, code: this.options.code });
				}
			});
		} else if (error.statusCode === 400) {
			message = `Your model: '${this.model}' may be incompatible or one of your parameters is unknown. Reset your settings to default. (HTTP 400 Bad Request)`;
	
		} else if (error.statusCode === 401) {
			message = 'Make sure you are properly signed in. If you are using Browser Auto-login method, make sure the browser is open (You could refresh the browser tab manually if you face any issues, too). If you stored your API key in settings.json, make sure it is accurate. If you stored API key in session, you can reset it with `ChatGPT: Reset session` command. (HTTP 401 Unauthorized) Potential reasons: \r\n- 1.Invalid Authentication\r\n- 2.Incorrect API key provided.\r\n- 3.Incorrect Organization provided. \r\n See https://platform.openai.com/docs/guides/error-codes for more details.';
		} else if (error.statusCode === 403) {
			message = 'Your token has expired. Please try authenticating again. (HTTP 403 Forbidden)';
		} else if (error.statusCode === 404) {
			message = `Your model: '${this.model}' may be incompatible or you may have exhausted your ChatGPT subscription allowance. (HTTP 404 Not Found)`;
		} else if (error.statusCode === 429) {
			message = "Too many requests try again later. (HTTP 429 Too Many Requests) Potential reasons: \r\n 1. You exceeded your current quota, please check your plan and billing details\r\n 2. You are sending requests too quickly \r\n 3. The engine is currently overloaded, please try again later. \r\n See https://platform.openai.com/docs/guides/error-codes for more details.";
		} else if (error.statusCode === 500) {
			message = "The server had an error while processing your request, please try again. (HTTP 500 Internal Server Error)\r\n See https://platform.openai.com/docs/guides/error-codes for more details.";
		}
	
		if (apiMessage) {
			message = `${message ? message + " " : ""}${apiMessage}`;
		}
	
		return message;
	}
	

	/**
	 * Message sender, stores if a message cannot be delivered
	 * @param message Message to be sent to WebView
	 * @param ignoreMessageIfNullWebView We will ignore the command if webView is null/not-focused
	 */
	public sendMessage(message: any, ignoreMessageIfNullWebView?: boolean) {
		if (this.webView) {
			this.webView?.webview.postMessage(message);
		} else if (!ignoreMessageIfNullWebView) {
			this.leftOverMessage = message;
		}
	}

	private logEvent(eventName: string, properties?: {}): void {
		// You can initialize your telemetry reporter and consume it here - *replaced with console.debug to prevent unwanted telemetry logs
		// this.reporter?.sendTelemetryEvent(eventName, { "autonimate.loginMethod": this.loginMethod!, "autonimate.authType": this.authType!, "autonimate.model": this.model || "unknown", ...properties }, { "autonimate.questionCounter": this.questionCounter });
		console.debug(eventName, { "autonimate.model": this.model || "unknown", ...properties }, { "autonimate.questionCounter": this.questionCounter });
	}

	private logError(eventName: string): void {
		// You can initialize your telemetry reporter and consume it here - *replaced with console.error to prevent unwanted telemetry logs
		// this.reporter?.sendTelemetryErrorEvent(eventName, { "autonimate.loginMethod": this.loginMethod!, "autonimate.authType": this.authType!, "autonimate.model": this.model || "unknown" }, { "autonimate.questionCounter": this.questionCounter });
		console.error(eventName, { "autonimate.model": this.model || "unknown" }, { "autonimate.questionCounter": this.questionCounter });
	}

	private getWebviewHtml(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
		const stylesMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css'));

		const vendorHighlightCss = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'highlight.min.css'));
		const vendorHighlightJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'highlight.min.js'));
		const vendorMarkedJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'marked.min.js'));
		const vendorTailwindJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'tailwindcss.3.2.4.min.js'));
		const vendorTurndownJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'turndown.js'));


		const nonce = this.getRandomId();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0" data-license="isc-gnc">

				<link href="${stylesMainUri}" rel="stylesheet">
				<link href="${vendorHighlightCss}" rel="stylesheet">
				<script src="${vendorHighlightJs}"></script>
				<script src="${vendorMarkedJs}"></script>
				<script src="${vendorTailwindJs}"></script>
				<script src="${vendorTurndownJs}"></script>
		
			</head>
			<body class="overflow-hidden">
				<div class="flex flex-col h-screen">
					<div id="introduction" class="flex flex-col justify-between h-full justify-center px-6 w-full relative login-screen overflow-auto">
						<div data-license="isc-gnc-hi-there" class="flex items-start text-center features-block my-5">
							<div class="flex flex-col gap-3.5 items-center text-center flex-1">
								<img src="https://autonimatevector.blob.core.windows.net/vscode/autonimate_logo.png" style="height: 8vh; width: 70vw;">
								
								
								<h2>Features</h2>
								<ul class="flex flex-col gap-3.5 text-xs">
									<li class="p-3 border-2 border-zinc-700 rounded-md">Advanced Prompting Support</li>
  <li class="p-3 border-2 border-zinc-700 rounded-md">OpenAI and Azure Compatibility</li>
  <li class="p-3 border-2 border-zinc-700 rounded-md">Copy, Create, and Diff Functionality</li>
  <li class="p-3 border-2 border-zinc-700 rounded-md">Auto-Detect Syntax Highlighting</li>
  <li class="p-3 border-2 border-zinc-700 rounded-md">Conversation History</li>
								</ul>
							</div>
						</div>
						<div class="flex flex-col gap-4 h-full items-center justify-end text-center">
							
				
							<p class="max-w-sm text-center text-xs text-slate-500">
								<a title="" id="settings-button" href="#">Update settings</a>&nbsp; | &nbsp;<a title="" id="settings-prompt-button" href="#">Update prompts</a>
							</p>
						</div>
					</div>

					<div class="flex-1 overflow-y-auto" id="qa-list" data-license="isc-gnc"></div>

					<div class="flex-1 overflow-y-auto hidden" id="conversation-list" data-license="isc-gnc"></div>

					<div id="in-progress" class="pl-4 pt-2 flex items-center hidden" data-license="isc-gnc">
						<div class="typing">Thinking</div>
						<div class="spinner">
							<div class="bounce1"></div>
							<div class="bounce2"></div>
							<div class="bounce3"></div>
						</div>

						<button id="stop-button" class="btn btn-primary flex items-end p-1 pr-2 rounded-md ml-5">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Stop responding</button>
					</div>

					<div class="p-4 flex items-center pt-2" data-license="isc-gnc">
						<div class="flex-1 textarea-wrapper">
							<textarea
								type="text"
								rows="1" data-license="isc-gnc"
								id="question-input"
								placeholder="Ask a question..."
								onInput="this.parentNode.dataset.replicatedValue = this.value"></textarea>
						</div>
						<div id="chat-button-wrapper" class="absolute bottom-14 items-center more-menu right-8 border border-gray-200 shadow-xl hidden text-xs" data-license="isc-gnc">
							<button class="flex gap-2 items-center justify-start p-2 w-full" id="clear-button"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>&nbsp;New Chat Session</button>	
							<button class="flex gap-2 items-center justify-start p-2 w-full" id="settings-button"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>&nbsp;Update settings</button>
							<button class="flex gap-2 items-center justify-start p-2 w-full" id="export-button"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>&nbsp;Export to markdown</button>
						</div>
						<div id="question-input-buttons" class="right-6 absolute p-0.5 ml-5 flex items-center gap-2">
							<button id="more-button" title="More actions" class="rounded-lg p-0.5" data-license="isc-gnc">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" /></svg>
							</button>

							<button id="ask-button" title="Submit prompt" class="ask-button rounded-lg p-0.5">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
							</button>
						</div>
					</div>
				</div>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	private getRandomId() {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}
}
