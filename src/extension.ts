/**
 * @author Ali Gençay
 * https://github.com/gencay/vscode-autonimate
 *
 * @license
 * Copyright (c) 2022 - Present, Ali Gençay
 *
 * All rights reserved. Code licensed under the ISC license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

import * as vscode from "vscode";
import ChatGptViewProvider from './chatgpt-view-provider';

const menuCommands = ["refactorCode", "findProblems", "optimize", "explain", "addComments", "completeCode", "generateCode", "customPrompt1", "customPrompt2", "adhoc"];

export async function activate(context: vscode.ExtensionContext) {
	let adhocCommandPrefix: string = context.globalState.get("autonimate-adhoc-prompt") || '';

	const provider = new ChatGptViewProvider(context);
	provider.setMessageId = "3452346362362346";
	const view = vscode.window.registerWebviewViewProvider(
		"autonimate.view",
		provider,
		{
			webviewOptions: {
				retainContextWhenHidden: true,
			},
		}
	);


	const freeText = vscode.commands.registerCommand("autonimate.freeText", async () => {
		const value = await vscode.window.showInputBox({
			prompt: "Ask anything...",
		});

		if (value) {
			provider?.sendApiRequest(value, { command: "freeText" });
		}
	});

	const resetThread = vscode.commands.registerCommand("autonimate.clearConversation", async () => {
		provider?.sendMessage({ type: 'clearConversation' }, true);
	});

	const exportConversation = vscode.commands.registerCommand("autonimate.exportConversation", async () => {
		provider?.sendMessage({ type: 'exportConversation' }, true);
	});

	const clearSession = vscode.commands.registerCommand("autonimate.clearSession", () => {
		context.globalState.update("autonimate-session-token", null);
		context.globalState.update("autonimate-clearance-token", null);
		context.globalState.update("autonimate-user-agent", null);
		context.globalState.update("autonimate-gpt3-apiKey", null);

		provider?.clearSession();
	});

	const configChanged = vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('autonimate.response.showNotification')) {
			provider.subscribeToResponse = vscode.workspace.getConfiguration("autonimate").get("response.showNotification") || false;
		}

		if (e.affectsConfiguration('autonimate.response.autoScroll')) {
			provider.autoScroll = !!vscode.workspace.getConfiguration("autonimate").get("response.autoScroll");
		}

		if (e.affectsConfiguration('autonimate.useAutoLogin')) {
			provider.useAutoLogin = vscode.workspace.getConfiguration("autonimate").get("useAutoLogin") || false;

			context.globalState.update("autonimate-session-token", null);
			context.globalState.update("autonimate-clearance-token", null);
			context.globalState.update("autonimate-user-agent", null);
		}

		if (e.affectsConfiguration('autonimate.chromiumPath')) {
			provider.setChromeExecutablePath();
		}

		if (e.affectsConfiguration('autonimate.profilePath')) {
			provider.setProfilePath();
		}

		if (e.affectsConfiguration('autonimate.proxyServer')) {
			provider.setProxyServer();
		}

		if (e.affectsConfiguration('autonimate.method')) {
			provider.setMethod();
		}
		if (e.affectsConfiguration('autonimate.systemPrompt')) {
			provider.systemPrompt = vscode.workspace.getConfiguration("autonimate").get("systemPrompt") || '';
		}

		if (e.affectsConfiguration('autonimate.systemAppendPrompt')) {
			provider.systemAppendPrompt = vscode.workspace.getConfiguration("autonimate").get("systemAppendPrompt") || '';
		}



		if (e.affectsConfiguration('autonimate.gpt3.model')) {
			provider.model = vscode.workspace.getConfiguration("autonimate").get("gpt3.model");
		}

		if (
			e.affectsConfiguration("autonimate.gpt3.apiBaseUrl") ||
			e.affectsConfiguration("autonimate.gpt3.azureBaseURL") ||
			e.affectsConfiguration("autonimate.gpt3.model") ||
			e.affectsConfiguration("autonimate.gpt3.organization") ||
			e.affectsConfiguration("autonimate.gpt3.maxTokens") ||
			e.affectsConfiguration("autonimate.gpt3.temperature") ||
			e.affectsConfiguration("autonimate.gpt3.top_p") ||
			e.affectsConfiguration("autonimate.systemPrompt") ||
			e.affectsConfiguration("autonimate.systemAppendPrompt")
		) {
			provider.prepareConversation(true);
		}

		if (e.affectsConfiguration('autonimate.promptPrefix') || e.affectsConfiguration('autonimate.gpt3.generateCode-enabled') || e.affectsConfiguration('autonimate.gpt3.model') || e.affectsConfiguration('autonimate.method')) {
			setContext();
		}



	});

	const adhocCommand = vscode.commands.registerCommand("autonimate.adhoc", async () => {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		const selection = editor.document.getText(editor.selection);
		let dismissed = false;
		if (selection) {
			await vscode.window
				.showInputBox({
					title: "Add prefix to your ad-hoc command",
					prompt: "Prefix your code with your custom prompt. i.e. Explain this",
					ignoreFocusOut: true,
					placeHolder: "Ask anything...",
					value: adhocCommandPrefix
				})
				.then((value) => {
					if (!value) {
						dismissed = true;
						return;
					}

					adhocCommandPrefix = value.trim() || '';
					context.globalState.update("autonimate-adhoc-prompt", adhocCommandPrefix);
				});

			if (!dismissed && adhocCommandPrefix?.length > 0) {
				provider?.sendApiRequest(adhocCommandPrefix, { command: "adhoc", code: selection });
			}
		}
	});

	const generateCodeCommand = vscode.commands.registerCommand(`autonimate.generateCode`, () => {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		const selection = editor.document.getText(editor.selection);
		if (selection) {
			provider?.sendApiRequest(selection, { command: "generateCode", language: editor.document.languageId });
		}
	});

	// Skip AdHoc - as it was registered earlier
	const registeredCommands = menuCommands.filter(command => command !== "adhoc" && command !== "generateCode").map((command) => vscode.commands.registerCommand(`autonimate.${command}`, () => {
		const prompt = vscode.workspace.getConfiguration("autonimate").get<string>(`promptPrefix.${command}`);
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		const selection = editor.document.getText(editor.selection);
		if (selection && prompt) {
			provider?.sendApiRequest(prompt, { command, code: selection, language: editor.document.languageId });
		}
	}));

	context.subscriptions.push(view, freeText, resetThread, exportConversation, clearSession, configChanged, adhocCommand, generateCodeCommand, ...registeredCommands);

	const setContext = () => {
		menuCommands.forEach(command => {
			if (command === "generateCode") {
				let generateCodeEnabled = !!vscode.workspace.getConfiguration("autonimate").get<boolean>("gpt3.generateCode-enabled");
				const modelName = vscode.workspace.getConfiguration("autonimate").get("gpt3.model") as string;
				const method = vscode.workspace.getConfiguration("autonimate").get("method") as string;
				generateCodeEnabled = generateCodeEnabled && method === "GPT3 OpenAI API Key" && modelName.startsWith("code-");
				vscode.commands.executeCommand('setContext', "generateCode-enabled", generateCodeEnabled);
			} else {
				const enabled = !!vscode.workspace.getConfiguration("autonimate.promptPrefix").get<boolean>(`${command}-enabled`);
				vscode.commands.executeCommand('setContext', `${command}-enabled`, enabled);
			}
		});
	};

	setContext();
}

export function deactivate() { }
