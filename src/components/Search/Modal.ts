import {App, Editor, MarkdownView, Modal} from "obsidian";
import {AsanaModalSettings} from "./types";
import AsanaSync from "../../main";
import {isToday, isTomorrow} from "../../Utils";
import {taskTemplate} from "../Task";

export class SearchModal extends Modal {

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
			console.log("File already exists, skipped creating file");
		});

		return "- [ ] [[" + task.gid + ".asana|" + task.name + "]] \n";
	}

	private getTaskFromSelection() {
		if (this.settings.selected !== "") {

			console.log()
			// @ts-ignore
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

	protected generateList(modalEl: any, tasks: any) {
		let results = modalEl.createDiv('prompt-results');
		tasks.map((task: any) => {
			let item = results.createDiv('suggestion-item mod-complex')
			item.setAttribute("data-gid", task.gid);
			let el = item.createDiv('suggestion-content');
			el.createEl('div', { text: task.name, cls: "suggestion-title" });
			let sub = el.createDiv('suggestion-subtitle');
			if (task.projects.length > 0 && this.plugin.settings.searchShowProjectName) {
				let projectsString = "";
				task.projects.map((project: any, index: number) => {
					projectsString += project.name;
					if (index + 1 !== task.projects.length) {
						projectsString += ", ";
					}
				})
				sub.createEl('div', {text: projectsString, cls: 'suggestion-projects'});
			}
			if (task.due_on && this.plugin.settings.searchShowDueDate) {
				let due = new Date(task.due_on);
				sub.createEl('div', {text: "Due " + (!isToday(due) ? !isTomorrow(due) ? "on " + due.toLocaleDateString() : "Tomorrow" : "today"), cls: 'suggestion-due-date'});
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



	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
