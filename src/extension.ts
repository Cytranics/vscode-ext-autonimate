import * as vscode from "vscode";
import ChatGptViewProvider from './autonimate-view';



export async function activate(context: vscode.ExtensionContext) {
	let adhocCommandPrefix: string = context.globalState.get("autonimate-adhoc-prompt") || '';
	const editor = vscode.window.activeTextEditor;
	const document = editor?.document;

	const provider = new ChatGptViewProvider(context);

	provider.menuCommands = ["refactorCode", "refactorCodeAuto", "findProblems", "optimize", "explain", "addComments", "completeCode", "generateCode", "customPrompt1", "customPrompt2", "adhoc"];

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
		context.globalState.update("autonimate-apiKey", null);

		provider?.clearSession();
	});
	
	function loadAllConfigurations() {
		const config = vscode.workspace.getConfiguration("autonimate");
		provider.subscribeToResponse = config.get("response.showNotification") || false;
		provider.autoScroll = !!config.get("response.autoScroll");
		provider.systemPrompt = config.get("systemPrompt") || '';
		provider.systemAppendPrompt = config.get("systemAppendPrompt") || '';
		provider.model = config.get("model");
		provider.apiKey = config.get("apiKey") as string || '';
		provider.apiBaseUrl = config.get("apiBaseUrl");
		provider.azureBaseUrl = config.get("azureBaseURL");
		provider.azureDeployment = config.get("azureDeployment");
		provider.max_tokens = config.get("maxTokens");
		provider.temperature = config.get("temperature");
		provider.top_p = config.get("top_p");
		provider.method = config.get("method");
		provider.conversationHistoryAmount = config.get("conversationHistoryAmount") as number;
	}
	
	const configChanged = vscode.workspace.onDidChangeConfiguration(e => {
		loadAllConfigurations();
		
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

	const registeredCommands = provider.menuCommands.filter(command => {
		// Exclude commands that end with "Auto"
		if (command.endsWith("Auto")) {
			return false;
		}
	
		// Exclude "adhoc" and "generateCode" commands
		return command !== "adhoc" && command !== "generateCode";
	}).map((command) => vscode.commands.registerCommand(`autonimate.${command}`, () => {
		const prompt = vscode.workspace.getConfiguration("autonimate").get<string>(`promptPrefix.${command}`);
		const editor = vscode.window.activeTextEditor;
	
		if (!editor) {
			return;
		}
	
		const document = editor.document;
		if (document) {
			const text = document.getText();
			const importRegex = /import\s+.*\s+from\s+['"].*['"]/g;
			const imports = text.match(importRegex);
	
			const selection = editor.document.getText(editor.selection);
			if (selection && prompt) {
				console.log({ command, code: selection, language: editor.document.languageId, imports });
				provider?.sendApiRequest(prompt, { command, code: selection, language: editor.document.languageId, imports: imports ? imports.join('\n') : '' });
			}
		}
	}));
	

	const registeredAutoCommands = provider.menuCommands.filter(command => command !== "adhoc" && command !== "generateCode").map((command) => vscode.commands.registerCommand(`autonimate.auto.${command}`, () => {
	
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		const document = editor.document;
		if (document) {
			const text = document.getText();
			const importRegex = /import\s+.*\s+from\s+['"].*['"]/g;
			const imports = text.match(importRegex);

			const selection = editor.document.getText(editor.selection);
			if (selection) {
				console.log({ command, code: selection, language: editor.document.languageId, imports });
				provider?.sendApiRequest("", { command, code: selection, language: editor.document.languageId, imports: imports ? imports.join('\n') : '' });
			}
		}
	}
	));

	



	context.subscriptions.push(view, freeText, resetThread, exportConversation, clearSession, configChanged, adhocCommand, generateCodeCommand, ...registeredCommands);

	const setContext = () => {
		provider.menuCommands.forEach(command => {
				const enabled = !!vscode.workspace.getConfiguration("autonimate.promptPrefix").get<boolean>(`${command}-enabled`);
				vscode.commands.executeCommand('setContext', `${command}-enabled`, enabled);
			
		});
	};

	setContext();
}
