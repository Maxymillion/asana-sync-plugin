import {App, Modal} from "obsidian";
import {SearchModal} from "./Modal";
import AsanaSync from "../../main";


export class AssignedModal extends SearchModal {
	constructor(app: App, plugin: AsanaSync) {
		super(app, plugin);
	}
	async onOpen() {
		const {modalEl} = this;

		let taskResults = await this.plugin.getUserAssignedTasks();

		this.settings.tasks = await this.plugin.getUserAssignedTasks();

		let taskInput = modalEl.createDiv('prompt-input-container')
			.createEl('input', 'prompt-input');

		taskInput.placeholder = "Find using task name";

		taskInput.oninput = (e: InputEvent) => {
			// @ts-ignore
			if (e.target && e.target.value !== "") {
				let resultEl = modalEl.querySelector(".prompt-results");
				if (resultEl !== null) {
					resultEl.remove();
				}
				// @ts-ignore
				this.generateList(modalEl, taskResults.data.filter((val) => val.name.toLowerCase().contains(e.target.value.toLowerCase())));
			}
		}

		taskInput.focus();

		this.generateList(modalEl, taskResults.data);
	}


}
