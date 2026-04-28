interface AssetReviewController {
	getState(): object;
	setTilesetId(tilesetId: string): void;
	assetUrl(path: string, cacheKey?: string): string;
	load(options?: object): Promise<void>;
	dismissMessageDialog(): void;
}
