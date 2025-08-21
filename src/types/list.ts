export type ListObjectsOptions = {
	prefix?: string;
	continuationToken?: string;
};

export type ListedObject = {
	id: string;
	size: number;
	created_at: Date;
	expires_at?: Date;
};

export type ListObjectsResponse = {
	objects: ListedObject[];
};
