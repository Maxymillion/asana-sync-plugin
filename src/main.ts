import {App, ButtonComponent, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting} from 'obsidian';

// Remember to rename these classes and interfaces!
const pluginName = "Asana Sync";

interface AsanaSyncSettings {
	asanaAPIKey: string;
	asanaUserGID: string;
	asanaWorkplaces: AsanaWorkspace[];
	selectedWorkspace: string;


}

interface AsanaWorkspace {
	gid: string;
	name: string;
}


const DEFAULT_SETTINGS: AsanaSyncSettings = {
	asanaAPIKey: '',
	asanaUserGID: '',
	asanaWorkplaces: '',
}


export default class AsanaSync extends Plugin {
	settings: AsanaSyncSettings;


	async getTasksToday(workplace, assignee, key) {
		const response = await fetch('https://app.asana.com/api/1.0/tasks?' + new URLSearchParams({
			opt_fields: 'due_on,name,projects',
			opt_pretty: true,
			workspace: workplace,
			assignee: assignee,
			completed_since: 'now'
		}), {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer ' + key,
			},
		});
		return response.json();
	}


	isToday(date) {
		const today = new Date();

		if (today.toDateString() === date.toDateString()) {
			return true;
		}

		return false;
	}

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('sync', pluginName, (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice(pluginName + ': Not implemented');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('asana-sync-ribbon');

		// // This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-sample-modal-simple',
		// 	name: 'Open sample modal (simple)',
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	}
		// });
		// // This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'sample-editor-command',
		// 	name: 'Sample editor command',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection('Sample Editor Command');
		// 	}
		// });

		this.addCommand({
			id: 'asana-get-due-tasks',
			name: 'Get Due Tasks',
			editorCallback: async (editor: Editor, view: MarkdownView) => {


				let taskList = "";
				await this.getTasksToday(this.settings.selectedWorkspace.gid, this.settings.asanaUserGID, this.settings.asanaAPIKey).then((res) => {
					res.data.map((task: any) => {
						if (task.due_on !== "" && this.isToday(new Date(task.due_on))) {
							taskList += "- [ ] [" + task.name + "](https://app.asana.com/0/" + (task.projects.length > 0 ? task.projects[0].gid : 0) + "/" + task.gid + "/f)  \n";
							this.app.vault.create(task.gid + ".md", "Creating file");
							// this.app.workspace.getLeavesOfType('graph')[0]
							//console.log(task.gid+".md");
						}
					});
				});

				editor.replaceSelection(taskList);
			}
		});

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: 'open-sample-modal-complex',
		// 	name: 'Open sample modal (complex)',
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}
		//
		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 	}
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AsanaSyncSettingTab(this.app, this));

		// // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'input', (evt) => {
		// 	// // if(evt.inputType === "insertText"){
		// 	// 	console.log('click', evt);
		// 	// // }
		//
		//
		// });
		//


		// this.app.vault.on("modify", (tel) => {
		//
		// 	// this.app.vault.read(tel).then((res) => {
		// 	// 	res.split("\n").forEach((line, i) => {
		// 	// 		if (line.replace(/\s/g, "").toLowerCase() === "%%asana%%"){
		// 	// 			console.log("Found at "+i);
		// 	// 		}
		// 	// 	})
		// 	// })
		// });

		// const getBullets = async () => {
		// 	let taskList = "";
		// 	await this.getTasksToday(this.settings.selectedWorkspace.gid, this.settings.asanaUserGID, this.settings.asanaAPIKey).then((res) => {
		// 		res.data.map((task: any) => {
		// 			if (task.due_on !== "" && this.isToday(new Date(task.due_on))) {
		// 				taskList += "- [ ] [" + task.name + "](https://app.asana.com/0/" + (task.projects.length > 0 ? task.projects[0].gid : 0) + "/" + task.gid + "/f)  \n";
		// 			}
		// 		});
		// 	});
		//
		// 	return taskList;
		// }
		//
		// const findTag = () => {
		// 	let startLine = 0;
		// 	let endLine = 0;
		//
		// 	this.app.workspace.activeEditor?.editor?.getValue().split("\n").forEach((line, i) => {
		// 		if (line.replace(/\s/g, "").toLowerCase() === "%%asana%%") {
		// 			startLine = i;
		// 		}
		// 		if (line.replace(/\s/g, "").toLowerCase() === "%%asana-end%%") {
		// 			endLine = i;
		// 		}
		// 	});
		//
		// 	getBullets().then((data) => {
		// 		if (startLine > 0 && endLine < 1) {
		// 			this.app.workspace.activeEditor?.editor?.setLine(startLine, "%% Asana %%\n\n"+data+"\n%% Asana-End %%");
		// 		}else if(startLine > 0 && endLine > 0){
		// 			this.app.workspace.activeEditor?.editor?.replaceRange("%% Asana %%\n\n"+data+"\n%% Asana-End %%\n", { line: startLine, ch: 0 }, {line:endLine+1, ch: 0} )
		// 		}
		// 	});
		// }
		//
		// // // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => findTag(), 2000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class AsanaSyncSettingTab extends PluginSettingTab {
	plugin: AsanaSync;

	constructor(app: App, plugin: AsanaSync) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async testConnection() {
		const response = await fetch('https://app.asana.com/api/1.0/users/me', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer ' + this.plugin.settings.asanaAPIKey,
			},
		});
		return response.json();
	}


	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h1', {text: pluginName});
		containerEl.createEl('small', {text: 'A little tool to keep track of data in Asana.'});
		containerEl.createEl('br');
		containerEl.createEl('hr');

		new Setting(containerEl)
			.setHeading()
			.setName('API key')
			.setDesc('Something about where to find this key...')
			.addText(text => text
				.setPlaceholder('1/123456789...')
				.setValue(this.plugin.settings.asanaAPIKey)
				.onChange(async (value) => {
					this.plugin.settings.asanaAPIKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Setup Connection')
			.setDesc('Get the workplaces and users from Asana using key')
			.addButton(cb => cb
				.setButtonText("Setup")
				.setIcon("sync")
				.onClick(async () => {
					if (this.plugin.settings.asanaAPIKey) {
						new Notice(pluginName + ': Setting up connection...');
					} else {
						new Notice(pluginName + ': Missing API key!');
					}

					this.plugin.settings.asanaAPIKey && this.testConnection().then(async (res) => {
						if (res.errors) {
							new Notice(pluginName + ': ' + res.errors[0].message);
						} else {
							new Notice(pluginName + ': Setup complete!');
							this.plugin.settings.asanaUserGID = res.data.gid;

							this.plugin.settings.asanaWorkplaces = [];
							res.data.workspaces.length > 0 && res.data.workspaces.forEach((ws) => {
								this.plugin.settings.asanaWorkplaces.push({name: ws.name, gid: ws.gid});
							});

							this.plugin.settings.selectedWorkspace = res.data.workspaces.length > 0 ? res.data.workspaces[0] : '';

							await this.plugin.saveSettings();
							this.display()
						}
					})
				})
			)

		new Setting(containerEl)
			.setDisabled(true)
			.setClass(this.plugin.settings.asanaWorkplaces.length < 1 ? "setting-invisible" : "setting-visible")
			.setName('Workplace')
			.setDesc('Select a workplace to sync data from')
			.addDropdown((dd) => {
					this.plugin.settings.asanaWorkplaces.length > 0 && this.plugin.settings.asanaWorkplaces.map((work) => {
						dd.addOption(work.gid, work.name);
					})
					dd.onChange(async (val) => {
						this.plugin.settings.selectedWorkspace = val;
						await this.plugin.saveSettings();
					})
					return dd;
				}
			)


		console.log(this.plugin.settings);

		new Setting(containerEl)
			.setName("Reset")
			.setDesc("This will reset the plugin\'s settings and preferences")
			.addButton(cb => cb
				.setIcon("cross")
				.onClick(async () => {
					new Notice(pluginName + ': Resetting');
					this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
					await this.plugin.saveSettings();
					this.display();
				})
			)
	}
}
