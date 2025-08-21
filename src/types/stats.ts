export interface StatsResponse {
	usage: {
		/** The total number of objects in your account. */
		objects: number;
		/** The total size of all objects in your account, in bytes. */
		storage: number;
	};
	plan: {
		/** The total storage size included on the plan, in bytes. */
		included: number;
	};
	billing: {
		/** The extra space used, in bytes. */
		extraStorage: number;
		/** The total price of storage for all objects in your account, in BRL. */
		storagePrice: number;
		/** The total price of objects in your account, in BRL. */
		objectsPrice: number;
		/** The total estimate of all objects, storage and extra storage in your account, in BRL. */
		totalEstimate: number;
	};
}
