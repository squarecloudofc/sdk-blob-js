import { SquareCloudBlobError } from "../structures/error";

const objectUrlRegex =
	/^(?<url>https:\/\/public-blob\.squarecloud\.dev)?\/?(?<userId>\d+\/)(?<prefix>[\w\d-_]+\/)?(?<name>[\w\d_]+)-(?<hash>[\w\d]+)\.(?<extension>\w+)$/;

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

	const payload = {
		userId: match.groups.userId.replace("/", ""),
		prefix: match.groups.prefix?.replace("/", ""),
		name: match.groups.name,
		hash: match.groups.hash,
		extension: match.groups.extension,
	};

	return {
		id: `${payload.userId}/${payload.prefix ? `${payload.prefix}/` : ""}${
			payload.name
		}-${payload.hash}.${payload.extension}`,
		...payload,
	};
}
