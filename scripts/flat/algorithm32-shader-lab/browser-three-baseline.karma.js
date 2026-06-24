describe('Algorithm32 shader lab browser baseline', () => {
	it('renders a browser Three baseline scene and returns diagnostics', async () => {
		document.body.innerHTML = '<canvas id="lab-canvas" width="640" height="320"></canvas>';

		await import('/base/scripts/flat/algorithm32-shader-lab/page/shader-lab.js');

		const command = window.__karma__.config.algorithm32ShaderLabCommand;
		const result = await window.runShaderLabSmoke(command);

		window.__karma__.info({
			algorithm32ShaderLab: {
				type: 'browser-three-baseline-result',
				result,
			},
		});

		expect(result.status).toBe('accepted');
		expect(result.selectedPixels.some((sample) => sample.classification === 'sky')).toBeTrue();
		expect(result.selectedPixels.some((sample) => sample.classification !== 'sky')).toBeTrue();
		expect(result.diagnostics.webgl.version).toContain('WebGL');
	}, 30000);
});
