export type ListObjectsOptions = {
	prefix?: string;
	/** Token returned by a previous `objects.list` call to fetch the next page. */
	continuationToken?: string;
};

export type ListedObject = {
	id: string;
	size: number;
	created_at: string;
	/** Only present when the object has an expiration. */
	expires_at?: string;
};

export type ListObjectsResponse = {
	objects: ListedObject[];
	/** Present when there are more objects to list. */
	continuationToken?: string;
};
