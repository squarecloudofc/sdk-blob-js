import { SquareCloudBlob } from "../src";

export const blob = new SquareCloudBlob(
	process.env.SQUARECLOUD_API_KEY as string,
);
