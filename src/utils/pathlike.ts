import { readFile } from "fs/promises";
import { SquareCloudBlobError } from "../structures/error";

export async function parsePathLike(
	pathLike: string | Buffer,
): Promise<Buffer> {
	if (typeof pathLike === "string") {
		const fileBuffer = await readFile(pathLike).catch(() => undefined);

		if (!fileBuffer) {
			throw new SquareCloudBlobError("INVALID_FILE", "File not found");
		}

		return fileBuffer;
	}

	return pathLike;
}
