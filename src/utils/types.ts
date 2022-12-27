export interface AsanaSyncSettings {
	asanaAPIKey: string;
	asanaUserGID: string;
	asanaWorkplaces: AsanaWorkspace[] | string;
	selectedWorkspace: AsanaWorkspace;
	syncInterval: number;
	maxShown: number;
	searchShowDueDate: boolean;
	searchShowProjectName: boolean;
}

export interface AsanaWorkspace {
	gid: string;
	name: string;
}

// @ts-ignore
export const DEFAULT_SETTINGS: AsanaSyncSettings = {
	asanaAPIKey: '',
	asanaUserGID: '',
	asanaWorkplaces: '',
	syncInterval: 15,
	maxShown: 9,
	searchShowDueDate: true,
}
