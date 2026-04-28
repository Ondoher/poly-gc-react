interface AssetReviewView {
	getState(): object;
	assetUrl(path: string, cacheKey?: string): string;
	load(options?: object): Promise<void>;
	dismissMessageDialog(): void;
}
