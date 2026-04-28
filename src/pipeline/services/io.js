import { Service } from '@polylith/core';

export default class IoService extends Service {
	constructor(registry) {
		super('io', registry);
		this.implement(['start', 'send', 'getSourceStateUpdatedOn']);
	}

	start() {
		this.sourceStateUpdatedOn = '';
	}

	getSourceStateUpdatedOn() {
		return this.sourceStateUpdatedOn;
	}

	async send(options = {}) {
		let result;

		try {
			const requestOptions = this.requestOptions(options);
			const response = await fetch(options.url, requestOptions);
			const responseText = await response.text();
			const payload = responseText ? parseJsonResponse(responseText) : {};
			result = this.resultFromResponse(response, payload);
		} catch (error) {
			result = {
				success: false,
				status: 0,
				data: null,
				failureMode: 'exception',
				message: error.message,
				error,
			};
		}

		this.rememberServerStateToken(options.url, result);

		if (result.success) {
			this.fire('io-result', options, result.data);
			return result;
		}

		this.fire('io-error', result);
		return result;
	}

	requestOptions(options) {
		const method = options.method || 'GET';
		const body = this.requestBody(options);

		return {
			...options,
			method,
			headers: {
				Accept: 'application/json',
				...(body ? { 'Content-Type': 'application/json' } : {}),
				...(options.headers || {}),
			},
			...(body ? { body } : {}),
		};
	}

	requestBody(options) {
		if (options.body === undefined || options.body === null) {
			return null;
		}

		const body = typeof options.body === 'string'
			? parseJsonResponse(options.body)
			: options.body;

		const nextBody = this.withSourceStateToken(options.url, body);

		return JSON.stringify(nextBody);
	}

	withSourceStateToken(url, body) {
		if (!this.isSourceAssignmentWrite(url)) {
			return body;
		}

		return {
			...(body || {}),
			sourceStateUpdatedOn: this.sourceStateUpdatedOn,
		};
	}

	resultFromResponse(response, payload) {
		const success = response.ok && payload?.ok !== false;

		return {
			success,
			status: response.status,
			data: payload,
			...(success ? {} : {
				failureMode: response.ok ? 'application' : 'http',
				message: payload?.message || `Request failed: ${response.status}`,
			}),
		};
	}

	rememberServerStateToken(url, result) {
		if (!this.isSourceStateResponse(url) || !result?.data?.sourceStateUpdatedOn) {
			return;
		}

		this.sourceStateUpdatedOn = result.data.sourceStateUpdatedOn;
	}

	isSourceAssignmentWrite(url) {
		return /(?:^|\/)api\/pipeline\/source-assignment\/(?:save-draft|regenerate|accept)(?:\?|$)/.test(url);
	}

	isSourceStateResponse(url) {
		return /(?:^|\/)api\/pipeline\/(?:source-normalization|source-assignment\/(?:save-draft|regenerate|accept))(?:\?|$)/.test(url);
	}
}

function parseJsonResponse(responseText) {
	try {
		return JSON.parse(responseText);
	} catch (error) {
		return {
			ok: false,
			message: String(responseText || '')
				.replace(/<[^>]+>/g, ' ')
				.replace(/\s+/g, ' ')
				.trim() || error.message,
		};
	}
}

new IoService();
