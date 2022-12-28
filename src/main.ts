import {Editor, MarkdownView, Notice, Plugin, TFile} from 'obsidian';
import {SearchModal} from "./components/Search/Modal";
import {AsanaSyncSettings, DEFAULT_SETTINGS} from "./utils/types";
import {SettingsTab} from "./components/Settings";
import {taskTemplate} from "./components/Task";
import {isToday} from "./utils";
import {AssignedModal} from "./components/Search/AssignedModal";
import {FollowedModal} from "./components/Search/FollowedModal";

export const pluginName = "Asana Sync";

export default class AsanaSync extends Plugin {
	settings: AsanaSyncSettings;

	tasksAssigned = [];

	tasksFollowed = [];

	currentlyProcessing: string[] = [];

	async getUserAssignedTasks() {
		if (this.settings.syncInterval === 0) {
			new Notice(pluginName + ': retrieving from Asana...');
			return await this.getTasksAssigned();
		} else {
			let tasks = this.tasksAssigned;
			return new Promise(function (resolve) {
				// @ts-ignore
				resolve({data: tasks.data});
			});
		}
	}

	async getUserFollowedTasks() {
		if (this.settings.syncInterval === 0) {
			new Notice(pluginName + ': retrieving from Asana...');
			return await this.getTasksFollowed();
		} else {
			let tasks = this.tasksFollowed;
			return new Promise(function (resolve) {
				// @ts-ignore
				resolve({data: tasks.data});
			});
		}
	}

	async getTasksFollowed() {
		//https://app.asana.com/api/1.0/workspaces/4217227315264/tasks/search?followers.any=1202094292843882&completed_on=null&opt_fields=due_on,name,projects,projects.name&opt_pretty=true
		if (this.settings.selectedWorkspace && this.settings.selectedWorkspace.gid && this.settings.asanaAPIKey) {
			const response = await fetch('https://app.asana.com/api/1.0/workspaces/' + this.settings.selectedWorkspace.gid + '/tasks/search?' + new URLSearchParams({
				opt_fields: "due_on,name,projects,projects.name",
				opt_pretty: 'true',
				completed_on: 'null',
				"followers.any": this.settings.asanaUserGID
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

	async getTasksAssigned() {
		if (this.settings.selectedWorkspace && this.settings.selectedWorkspace.gid && this.settings.asanaAPIKey) {
			const response = await fetch('https://app.asana.com/api/1.0/tasks?' + new URLSearchParams({
				opt_fields: "due_on,name,projects,projects.name",
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

	async getTasksFromID(taskID: string) {
		if (this.settings.selectedWorkspace && this.settings.selectedWorkspace.gid && this.settings.asanaAPIKey) {
			const response = await fetch('https://app.asana.com/api/1.0/tasks/' + taskID, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + this.settings.asanaAPIKey,
				},
			});
			return response.json();
		}
	}

	private syncLocalTasks() {
		this.getTasksAssigned().then((data) => {
			this.tasksAssigned = data;
		})
		this.getTasksFollowed().then((data) => {
			this.tasksFollowed = data;
		})
	}

	syncInterval = (interval: number) => window.setInterval(() => {
		if (this.settings.syncInterval !== 0) {
			this.syncLocalTasks();
		}
	}, 1000 * interval);


	replaceInterval = window.setInterval(() => {
		this.replaceAsanaLinks();
	}, 200);


	private getParsedLink(task: any) {
		let taskLink = "https://app.asana.com/0/" + (task.projects.length > 0 ? task.projects[0].gid : 0) + "/" + task.gid + "/f";

		this.app.vault.create(task.gid + ".asana.md", taskTemplate(task.name, taskLink)).catch(() => {
			console.log("File already exists, skipped creating file");
		});
		return "[[" + task.gid + ".asana|" + task.name + "]] \n";
	}


	replaceAsanaLinks() {

		if (this.settings.autoImportAsanaLinks) {
			let activeEditor = this.app.workspace.activeEditor;
			if (activeEditor && activeEditor.editor) {
				activeEditor.editor.processLines((index, text) => {
					let urlRegex = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
					let urlMatches = text.match(urlRegex);

					if (urlMatches) {
						urlMatches.map((url) => {

							if (url.contains('app.asana.com')) {
								let from = text.indexOf(url);
								let urlArr = url.split("/");
								let taskID = urlArr[urlArr.length - 1];
								if (taskID === "f") {
									taskID = urlArr[urlArr.length - 2];
								}

								let checkLocal = this.app.vault.getAbstractFileByPath(taskID + ".asana.md");

								if (!this.currentlyProcessing.contains(taskID) && checkLocal === null) {
									this.currentlyProcessing.push(taskID);
									this.getTasksFromID(taskID).then(data => {
										activeEditor?.editor?.replaceRange(this.getParsedLink(data.data), {
											line: index,
											ch: from
										}, {line: index, ch: from + url.length});
										this.currentlyProcessing.remove(taskID);
									})
								} else if (checkLocal !== null) {
									if (checkLocal instanceof TFile) {
										this.app.fileManager.processFrontMatter(checkLocal, (fn) => {
											// @ts-ignore
											activeEditor?.editor?.replaceRange('[[' + checkLocal.path + '|' + fn.title + ']]', {
												line: index,
												ch: from
											}, {line: index, ch: from + url.length});
											;
										})
									}
								}

							}
						})
					}
					;

				}, (index, text, val) => {

				});
			}
		}

	}

	async onload() {
		await this.loadSettings();

		this.registerInterval(this.syncInterval(this.settings.syncInterval ?? 60));

		this.registerInterval(this.replaceInterval);

		if (this.settings.selectedWorkspace && this.settings.selectedWorkspace.gid != "" && this.settings.asanaUserGID != "") {

			this.getTasksAssigned().then((data) => {
				this.tasksAssigned = data;
			});

			this.getTasksFollowed().then((data) => {
				this.tasksFollowed = data;
			});
		}

		this.addCommand({
			id: 'asana-get-due-tasks',
			name: 'Get due tasks',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				if (this.settings.asanaUserGID !== "") {
					let taskList = "";
					await this.getUserAssignedTasks().then((res) => {
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
			name: 'Find assigned task',
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						if (this.settings.asanaUserGID !== "") {
							new AssignedModal(this.app, this).open();
						} else {
							new Notice(pluginName + ": Invalid plugin settings!");
						}

					}
					return true;
				}
			}
		});

		this.addCommand({
			id: 'asana-get-followed-task',
			name: 'Find followed task',
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						if (this.settings.asanaUserGID !== "") {
							new FollowedModal(this.app, this).open();
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



