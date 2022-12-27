import {Editor, MarkdownView, Notice, Plugin} from 'obsidian';
import {SearchModal} from "./components/Search/Modal";
import {AsanaSyncSettings, DEFAULT_SETTINGS} from "./Utils/types";
import {SettingsTab} from "./components/Settings";
import {taskTemplate} from "./components/Task";
import {isToday} from "./utils";

export const pluginName = "Asana Sync";


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
				// @ts-ignore
				resolve({data: tasks.data});
			});
		}
	}

	async getTasksToday() {
		if (this.settings.selectedWorkspace && this.settings.selectedWorkspace.gid && this.settings.asanaAPIKey) {
			const response = await fetch('https://app.asana.com/api/1.0/tasks?' + new URLSearchParams({
				opt_fields: "due_on,name,projects",
				opt_pretty: 'true',
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
	}

	syncInterval = (interval: number) => window.setInterval(() => {
		if (this.settings.syncInterval !== 0) {
			this.getTasksToday().then((data) => {
				this.asanaTasks = data;
			})
		}
	}, 1000 * interval);

	async onload() {
		await this.loadSettings();

		this.registerInterval(this.syncInterval(this.settings.syncInterval ?? 60));


		if (this.settings.selectedWorkspace && this.settings.selectedWorkspace.gid != "" && this.settings.asanaUserGID != "") {

			this.getTasksToday().then((data) => {
				this.asanaTasks = data;
			});
		}

		this.addCommand({
			id: 'asana-get-due-tasks',
			name: 'Get Due Tasks',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				if (this.settings.asanaUserGID !== "") {
					let taskList = "";
					await this.getTasks().then((res) => {
						res.data.map((task: any) => {
							if (task.due_on !== "" && isToday(new Date(task.due_on))) {
								let taskLink = "https://app.asana.com/0/" + (task.projects.length > 0 ? task.projects[0].gid : 0) + "/" + task.gid + "/f";

								this.app.vault.create(task.gid + ".asana.md", taskTemplate(task.name, taskLink));

								taskList += "- [ ] [[" + task.gid + ".asana|" + task.name + "]] \n";
							}
						});
					});
					editor.replaceSelection(taskList);
				} else {
					new Notice(pluginName + ": Invalid plugin settings!");
				}

			}
		});

		this.addCommand({
			id: 'asana-get-task',
			name: 'Get Assigned Task',
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						if (this.settings.asanaUserGID !== "") {
							new SearchModal(this.app, this).open();
						} else {
							new Notice(pluginName + ": Invalid plugin settings!");
						}

					}
					return true;
				}
			}
		});


		this.addSettingTab(new SettingsTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}



