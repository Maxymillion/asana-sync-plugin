import {App, ButtonComponent, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting} from 'obsidian';

// Remember to rename these classes and interfaces!
const pluginName = "Asana Sync";

function taskTemplate(title: string, link: string) {
	return `---
title: ${title}
---
# ${title}
_[Asana](${link})_

`;
}

interface AsanaSyncSettings {
	asanaAPIKey: string;
	asanaUserGID: string;
	asanaWorkplaces: AsanaWorkspace[];
	selectedWorkspace: string;
	syncInterval: number;
	maxShown: number;
	searchShowDueDate: boolean;
	searchShowProjectName: boolean;
}

interface AsanaWorkspace {
	gid: string;
	name: string;
}


const DEFAULT_SETTINGS: AsanaSyncSettings = {
	asanaAPIKey: '',
	asanaUserGID: '',
	asanaWorkplaces: '',
	syncInterval: 0,
	maxShown: 9,
	searchShowDueDate: true,
}

interface AsanaModalSettings {
	selected: string;
	tasks: { data: [] };
}

export default class AsanaSync extends Plugin {
	settings: AsanaSyncSettings;

	asanaTasks = [];

	async getTasks() {
		if (this.settings.syncInterval === 0) {
			new Notice(pluginName + ': retrieving from Asana...');
			return await this.getTasksToday();
		} else {
			let tasks = this.asanaTasks;
			return new Promise(function (resolve) {
				resolve({data: tasks.data});
			});
		}
	}

	async getTasksToday() {
		const response = await fetch('https://app.asana.com/api/1.0/tasks?' + new URLSearchParams({
			opt_fields: 'due_on,name,projects',
			opt_pretty: true,
			workspace: this.settings.selectedWorkspace.gid,
			assignee: this.settings.asanaUserGID,
			completed_since: 'now'
		}), {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer ' + this.settings.asanaAPIKey,
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


	isTomorrow(date) {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);

		if (tomorrow.toDateString() === date.toDateString()) {
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

		ribbonIconEl.addClass('asana-sync-ribbon');

		let syncInterval = window.setInterval(() => {
			if (this.settings.syncInterval !== 0) {
				// this.asanaTasks = this

				this.getTasksToday().then((data) => {
					this.asanaTasks = data;
				})
			}
		}, 1000 * this.settings.syncInterval);

		this.registerInterval(syncInterval);


		this.addCommand({
			id: 'asana-get-due-tasks',
			name: 'Get Due Tasks',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				let taskList = "";
				await this.getTasks().then((res) => {
					res.data.map((task: any) => {
						if (task.due_on !== "" && this.isToday(new Date(task.due_on))) {
							let taskLink = "https://app.asana.com/0/" + (task.projects.length > 0 ? task.projects[0].gid : 0) + "/" + task.gid + "/f";

							this.app.vault.create(task.gid + ".asana.md", taskTemplate(task.name, taskLink));

							taskList += "- [ ] [[" + task.gid + ".asana|" + task.name + "]] \n";
						}
					});
				});
				editor.replaceSelection(taskList);
			}
		});

		this.addCommand({
			id: 'asana-get-task',
			name: 'Get Assigned Task',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new AsanaSearchModal(this.app, this).open();
					}


					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		this.addSettingTab(new AsanaSyncSettingTab(this.app, this));
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

class AsanaSearchModal extends Modal {

	settings: AsanaModalSettings;
	plugin: AsanaSync;

	editor: Editor | undefined;

	constructor(app: App, plugin: AsanaSync) {
		super(app);
		this.plugin = plugin;
		this.editor = app.workspace.getActiveViewOfType(MarkdownView)?.editor;
		this.settings = {selected: '', tasks: {data: []}};

		this.modalEl.replaceChildren();
		this.modalEl.addClass('asana-modal', 'prompt');
		this.modalEl.removeClass('modal');
		this.modalEl.tabIndex = -1;

		this.scope.register([], 'ArrowDown', e => {
			e.preventDefault()
			this.arrowMoveSelected(this.modalEl, "down");
		})
		this.scope.register([], 'ArrowUp', e => {
			e.preventDefault()
			this.arrowMoveSelected(this.modalEl, "up");
		})

		this.scope.register([], 'Enter', e => {
			e.preventDefault();
			this.getTaskFromSelection();
		})
	}

	private setSelected(target: any) {
		let selectedClass = "is-selected";
		this.settings.selected = target.getAttribute('data-gid');

		let elements = target.parentElement.getElementsByClassName(selectedClass);

		for (let element of elements) {
			element.removeClass(selectedClass)
		}

		target.addClass(selectedClass);
	}

	private getParsedTask(task: any) {
		let taskLink = "https://app.asana.com/0/" + (task.projects.length > 0 ? task.projects[0].gid : 0) + "/" + task.gid + "/f";

		this.app.vault.create(task.gid + ".asana.md", taskTemplate(task.name, taskLink)).catch(() => {
			console.log("File already exists, skipped creating file")
		});

		return "- [ ] [[" + task.gid + ".asana|" + task.name + "]] \n";
	}

	private getTaskFromSelection() {
		if (this.settings.selected !== "") {

			this.editor?.replaceSelection(this.getParsedTask(this.settings.tasks.data.filter((val) => val.gid === this.settings.selected)[0]));

			this.close();
		}
	}

	private arrowMoveSelected(modal: any, direction: string) {
		let selectedEl = modal.querySelector('[data-gid="' + this.settings.selected + '"]');
		let parentChildren = selectedEl.parentElement?.children;

		if (direction === "down" && selectedEl.nextSibling !== null) {
			this.setSelected(selectedEl.nextSibling);
			selectedEl.nextSibling.scrollIntoView({block: "end", inline: "nearest"});
		} else if (direction === "down") {
			this.setSelected(parentChildren[0]);
			parentChildren[0].scrollIntoView({block: "end", inline: "nearest"});
		}

		if (direction === "up" && selectedEl.previousSibling !== null) {
			this.setSelected(selectedEl.previousSibling);
			selectedEl.previousSibling.scrollIntoView({block: "end", inline: "nearest"});
		} else if (direction === "up") {
			this.setSelected(parentChildren[parentChildren.length - 1]);
			parentChildren[parentChildren.length - 1].scrollIntoView({block: "end", inline: "nearest"});
		}
	}

	private generateList(modalEl: any, tasks: any) {
		let results = modalEl.createDiv('prompt-results');
		tasks.map((task: any) => {
			let item = results.createDiv('suggestion-item mod-complex')
			item.setAttribute("data-gid", task.gid);
			let el = item.createDiv('suggestion-content');
			el.createDiv('suggestion-title').innerHTML = task.name;
			if (task.due_on && this.plugin.settings.searchShowDueDate) {
				let due = new Date(task.due_on);

				el.createDiv('suggestion-due-date').innerHTML = "Due " + (!this.plugin.isToday(due) ? !this.plugin.isTomorrow(due) ? "on " + due.toLocaleDateString() : "Tomorrow" : "today");
			}
			item.onclick = () => this.getTaskFromSelection();
			item.onmouseenter = (e: MouseEvent) => this.setSelected(e.target);
		});

		if (results.children.length > 0) {
			this.settings.selected = results.children[0].getAttribute('data-gid');
			results.children[0].addClass("is-selected");
			results.style.maxHeight = (results.children[0].offsetHeight * this.plugin.settings.maxShown) + "px";
		} else {
			this.settings.selected = '';
		}
	}

	async onOpen() {
		const {modalEl} = this;

		if(this.plugin.settings.syncInterval === 0) new Notice(pluginName + ': retrieving from Asana...');
		this.settings.tasks = await this.plugin.getTasks();
		if(this.plugin.settings.syncInterval === 0) new Notice(pluginName + ': retrieved ' + (this.settings.tasks.data.length) + ' task(s)');

		let taskResults = this.settings.tasks;

		let taskInput = modalEl.createDiv('prompt-input-container')
			.createEl('input', 'prompt-input');

		taskInput.placeholder = "Find using task name";

		taskInput.oninput = (e: InputEvent) => {
			if (e.target && e.target.value !== "") {
				let resultEl = modalEl.querySelector(".prompt-results");
				if (resultEl !== null) {
					resultEl.remove();
				}
				this.generateList(modalEl, taskResults.data.filter((val) => val.name.toLowerCase().contains(e.target.value.toLowerCase())));
			}
		}

		taskInput.focus();

		this.generateList(modalEl, taskResults.data);
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

		new Setting(containerEl)
			.setDisabled(true)
			.setClass(this.plugin.settings.asanaWorkplaces.length < 1 ? "setting-invisible" : "setting-visible")
			.setName('Sync Interval')
			.setDesc('Select an interval in which the cache will update, immediate will cause the plugin to directly access the API on every call instead of the cached version')
			.addDropdown((dd) => {
					dd.addOption(String(0), "Immediate");
					dd.addOption(String(1), "Every minute");
					dd.addOption(String(5), "Every 5 minutes");
					dd.addOption(String(15), "Every 15 minutes");
					dd.addOption(String(30), "Every 30 minutes");
					dd.addOption(String(60), "Every hour");
					dd.onChange(async (val) => {
						this.plugin.settings.syncInterval = Number(val);
						await this.plugin.saveSettings();
					})
					return dd;
				}
			)

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

		containerEl.createEl('h3', {text: "Search settings"})

		new Setting(containerEl)
			.setName('Max shown')
			.setDesc('The maximum shown tasks before scrolling')
			.addText(text => text
				.setValue(String(this.plugin.settings.maxShown))
				.onChange(async (value) => {
					if (Number(value) > 0 && Number(value) < 100) {
						this.plugin.settings.maxShown = Number(value);
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Show due date')
			.setDesc('Show due date while using the search function')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.searchShowDueDate)
				.onChange(async (value) => {
					this.plugin.settings.searchShowDueDate = value;
					await this.plugin.saveSettings();
				})
			)

		new Setting(containerEl)
			.setName('Show project name')
			.setDesc('Show project name while using the search function')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.searchShowProjectName)
				.onChange(async (value) => {
					this.plugin.settings.searchShowProjectName = value;
					await this.plugin.saveSettings();
				})
			)
	}
}
