import FaceInventory from '../FaceInventory.js';
import { GeneratorState } from '../GeneratorState.js';
import Grid from '../Grid.js';
import SoftLinks from '../SoftLinks.js';

describe('SoftLinks', () => {
	function createSoftLinks() {
		let state = new GeneratorState(new Grid(), new FaceInventory());

		return state.softLinks;
	}

	it('creates open-tile soft links with generated ids', () => {
		let softLinks = createSoftLinks();

		expect(softLinks.createLink('open-tiles', {
			role: 'after-removal',
			sourceTiles: [0, 1],
			tiles: [2, 3],
		})).toEqual({
			id: 1,
			type: 'open-tiles',
			role: 'after-removal',
			sourceTiles: [0, 1],
			tiles: [2, 3],
		});
		expect(softLinks.state.softLinkRecords.length).toBe(1);
		expect(softLinks.state.nextSoftLinkId).toBe(2);
	});

	it('creates grouped soft links from explicitly related tiles', () => {
		let softLinks = createSoftLinks();

		expect(softLinks.createLink('grouped', {
			role: 'reservation',
			faceGroup: 7,
			requiredFaces: 4,
			tiles: [0, 1, 2],
		})).toEqual({
			id: 1,
			type: 'grouped',
			role: 'reservation',
			faceGroup: 7,
			requiredFaces: 4,
			tiles: [0, 1, 2],
		});
	});

	it('appends tiles to an existing link', () => {
		let softLinks = createSoftLinks();
		let link = softLinks.createLink('grouped', {
			role: 'reservation',
			tiles: [0, 1],
		});

		expect(softLinks.addTiles(link.id, [2, 3])).toBe(link);
		expect(link.tiles).toEqual([0, 1, 2, 3]);
	});

	it('finds links by simple fields', () => {
		let softLinks = createSoftLinks();
		let openLink = softLinks.createLink('open-tiles', {
			role: 'after-removal',
			sourceTiles: [0, 1],
			tiles: [2, 3],
		});
		let groupedLink = softLinks.createLink('grouped', {
			role: 'reservation',
			tiles: [0, 1, 2],
		});

		expect(softLinks.find({type: 'open-tiles'})).toEqual([openLink]);
		expect(softLinks.find({role: 'reservation'})).toEqual([groupedLink]);
		expect(softLinks.find({tiles: [2]})).toEqual([openLink, groupedLink]);
		expect(softLinks.find({sourceTiles: [0, 1]})).toEqual([openLink]);
		expect(softLinks.find({type: 'open-tiles', role: 'missing'})).toEqual([]);
	});

	it('throws for unsupported or malformed links', () => {
		let softLinks = createSoftLinks();

		expect(() => softLinks.create({
			type: 'blocked',
			role: 'after-removal',
			tiles: [],
		})).toThrowError('Unsupported soft link type: blocked');
		expect(() => softLinks.create({
			type: 'grouped',
			role: '',
			tiles: [],
		})).toThrowError('Soft link role is required');
		expect(() => softLinks.create({
			type: 'grouped',
			role: 'reservation',
			tiles: null,
		})).toThrowError('Soft link tiles must be an array');
		expect(() => softLinks.create({
			type: 'open-tiles',
			role: 'after-removal',
			tiles: [],
		})).toThrowError('Open-tiles soft links require sourceTiles');
	});

	it('throws when appending tiles to an unknown link', () => {
		let softLinks = createSoftLinks();

		expect(() => softLinks.addTiles(99, [1]))
			.toThrowError('Unknown soft link: 99');
	});

	it('can be constructed over explicit state records', () => {
		let state = {
			softLinkRecords: [],
			nextSoftLinkId: 1,
		};
		let softLinks = new SoftLinks(state);

		softLinks.createLink('grouped', {
			role: 'reservation',
			tiles: [0],
		});

		expect(state.softLinkRecords.length).toBe(1);
	});
});
