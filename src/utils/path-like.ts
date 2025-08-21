import { readFile } from "fs/promises";
import { SquareCloudBlobError } from "../structures/error";

/**
 * Parses a path-like input into a Buffer
 * @param pathLike - File path string or Buffer
 * @returns Promise resolving to Buffer
 */
export async function parsePathLike(
	pathLike: string | Buffer,
): Promise<Buffer> {
	if (typeof pathLike === "string") {
		try {
			const fileBuffer = await readFile(pathLike);
			return fileBuffer;
		} catch {
			throw new SquareCloudBlobError("INVALID_FILE_PATH", "File not found");
		}
	}

	return pathLike;
}
