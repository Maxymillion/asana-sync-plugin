export function taskTemplate(title: string, link: string) {
	return `---
title: ${title}
---
# ${title}
_[Asana](${link})_

`;
}
