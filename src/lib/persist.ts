const PREFIX = 'solbox_inputs_';

export function loadInputs<T extends Record<string, unknown>>(page: string, defaults: T): T {
	if (typeof localStorage === 'undefined') return { ...defaults };
	try {
		const raw = localStorage.getItem(PREFIX + page);
		if (!raw) return { ...defaults };
		const parsed = JSON.parse(raw);
		const result = { ...defaults };
		for (const key in defaults) {
			if (key in parsed && typeof parsed[key] === typeof defaults[key]) {
				result[key] = parsed[key];
			}
		}
		return result;
	} catch {
		return { ...defaults };
	}
}

export function saveInputs<T extends Record<string, unknown>>(page: string, values: T): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(PREFIX + page, JSON.stringify(values));
}
