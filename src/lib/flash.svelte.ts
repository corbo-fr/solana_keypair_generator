let message = $state('');
let type = $state<'error' | 'success' | 'warning' | ''>('');
let timeout: ReturnType<typeof setTimeout> | null = null;

export function flash(msg: string, t: 'error' | 'success' | 'warning'): void {
	message = msg;
	type = t;
	if (timeout) clearTimeout(timeout);
	timeout = setTimeout(() => { message = ''; type = ''; }, 3000);
}

export function clearFlash(): void {
	message = '';
	type = '';
	if (timeout) clearTimeout(timeout);
}

export function getFlashMessage(): string {
	return message;
}

export function getFlashType(): typeof type {
	return type;
}
