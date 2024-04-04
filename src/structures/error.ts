export class SquareCloudBlobError extends Error {
	constructor(code: string, message?: string, cause?: unknown) {
		super(message, { cause });

		this.name = SquareCloudBlobError.name;
		this.message = this.getMessage(code);

		Error.captureStackTrace(this, SquareCloudBlobError);
	}

	private getMessage(rawCode: string) {
		const code = rawCode
			.replaceAll("_", " ")
			.toLowerCase()
			.replace(/(^|\s)\S/g, (L) => L.toUpperCase());
		const message = this.message ? `: ${this.message}` : "";

		return `${code}${message}`;
	}
}
