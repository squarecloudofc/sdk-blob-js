import { SquareCloudBlobError } from "../structures/error";

const objectUrlRegex =
	/^(?<url>https:\/\/public-blob\.squarecloud\.dev)?\/?(?<userId>[\w\d]+\/)(?<prefix>[\w\d\-_]+\/)?(?<name>[\w\d_]+)-(?<hash>[\w\d]+)(-ex\d+)?\.(?<extension>\w+)$/;

/**
 * Parses the object URL to extract id, userId, prefix, name, hash and extension.
 *
 * @param url - The object URL to parse.
 */
export function parseObjectUrl(url: string) {
	const match = url.match(objectUrlRegex);

	if (!match?.groups) {
		throw new SquareCloudBlobError("Invalid object URL");
	}

	const userId = match.groups.userId.replace("/", "");
	const prefix = match.groups.prefix?.replace("/", "");
	const name = match.groups.name;
	const hash = match.groups.hash;
	const extension = match.groups.extension;

	return {
		id: `${userId}/${prefix ? `${prefix}/` : ""}${name}-${hash}.${extension}`,
		userId,
		prefix,
		name,
		hash,
		extension,
	};
}
