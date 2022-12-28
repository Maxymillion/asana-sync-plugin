import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import {DEFAULT_SETTINGS} from "../../Utils/types";
import AsanaSync, {pluginName} from "../../main";

export class SettingsTab extends PluginSettingTab {
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
							res.data.workspaces.length > 0 && res.data.workspaces.forEach((ws: { name: any; gid: any; }) => {
								if (typeof this.plugin.settings.asanaWorkplaces !== "string") {
									this.plugin.settings.asanaWorkplaces.push({name: ws.name, gid: ws.gid});
								}
							});

							this.plugin.settings.selectedWorkspace = res.data.workspaces.length > 0 ? res.data.workspaces[0] : '';

							this.plugin.getUserAssignedTasks().then((data) => {
								this.plugin.tasksAssigned = data;
							});

							this.plugin.getUserFollowedTasks().then((data) => {
								this.plugin.tasksFollowed = data;
							});

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
				if (typeof this.plugin.settings.asanaWorkplaces !== "string") {
					this.plugin.settings.asanaWorkplaces.length > 0 && this.plugin.settings.asanaWorkplaces.map((work) => {
						dd.addOption(work.gid, work.name);
					})
				}
					dd.onChange(async (val) => {
						// @ts-ignore
						this.plugin.settings.selectedWorkspace = val;
						await this.plugin.saveSettings();
					})
					return dd;
				}
			)

		new Setting(containerEl)
			.setDisabled(true)
			.setClass(this.plugin.settings.asanaWorkplaces.length < 1 ? "setting-invisible" : "setting-visible")
			.setName('Auto Convert Links')
			.setDesc('This will automatically convert all Asana links (in the active editor) into pages with imported data.')
			.addToggle((t) =>  {
				t.setValue(this.plugin.settings.autoImportAsanaLinks)
				t.onChange(async (val) => {
					this.plugin.settings.autoImportAsanaLinks = val;
					await this.plugin.saveSettings();
				})
			})

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
					dd.setValue(String(this.plugin.settings.syncInterval));
					dd.onChange(async (val) => {
						this.plugin.settings.syncInterval = Number(val);
						clearInterval(this.plugin.syncInterval(Number(val)));
						this.plugin.syncInterval(Number(val));
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
