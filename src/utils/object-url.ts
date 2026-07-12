import { SquareCloudBlobError } from "../structures/error";

const objectUrlRegex =
	/^(?<url>https:\/\/public-blob\.squarecloud\.dev)?\/?(?<userId>\w+\/)(?<prefix>[\w-]+\/)?(?<name>\w+)(?:-(?<hash>(?!ex\d+)\w+))?(?:-ex(?<expiration>\d+))?\.(?<extension>\w+)$/;

type ParsedObjectUrl = {
	id: string;
	userId: string;
	prefix?: string;
	name: string;
	hash?: string;
	extension: string;
	expiration?: number;
};

/**
 * Parses the object URL to extract id, userId, prefix, name, hash and extension.
 *
 * @param url - The object URL to parse.
 */
export function parseObjectUrl(url: string): ParsedObjectUrl {
	const match = url.match(objectUrlRegex);

	if (!match?.groups) {
		throw new SquareCloudBlobError(
			"INVALID_OBJECT_URL",
			`Could not parse object id or URL: ${url}`,
		);
	}

	const userId = match.groups.userId.replace("/", "");
	const prefix = match.groups.prefix?.replace("/", "");
	const name = match.groups.name;
	const hash = match.groups.hash;
	const extension = match.groups.extension;
	const expiration = match.groups.expiration
		? Number(match.groups.expiration)
		: undefined;

	return {
		id: `${userId}/${prefix ? `${prefix}/` : ""}${name}${hash ? `-${hash}` : ""}${expiration ? `-ex${expiration}` : ""}.${extension}`,
		userId,
		prefix,
		name,
		hash,
		extension,
		expiration,
	};
}
