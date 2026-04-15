import Grid from '../Grid.js';

describe('Grid', () => {
    it('constructs an empty grid', () => {
        let grid = new Grid();

        expect(grid).toBeDefined();
        expect(grid.has({x: 0, y: 0, z: 0})).toBe(false);
        expect(grid.intersects({x: 0, y: 0, z: 0})).toBe(false);
    });

    it('adds a single occupied point', () => {
        let grid = new Grid();

        grid.add({x: 2, y: 3, z: 4});

        expect(grid.has({x: 2, y: 3, z: 4})).toBe(true);
        expect(grid.has({x: 1, y: 3, z: 4})).toBe(false);
        expect(grid.has({x: 2, y: 2, z: 4})).toBe(false);
        expect(grid.has({x: 2, y: 3, z: 3})).toBe(false);
    });

    it('defaults box dimensions to 1', () => {
        let grid = new Grid();

        grid.add({x: 4, y: 5, z: 6});

        expect(grid.has({x: 4, y: 5, z: 6})).toBe(true);
        expect(grid.intersects({x: 4, y: 5, z: 6})).toBe(true);

        grid.subtract({x: 4, y: 5, z: 6});

        expect(grid.has({x: 4, y: 5, z: 6})).toBe(false);
        expect(grid.intersects({x: 4, y: 5, z: 6})).toBe(false);
    });

    it('adds every point in a 3d box', () => {
        let grid = new Grid();

        grid.add({x: 5, y: 6, z: 2, width: 3, height: 2, depth: 2});

        expect(grid.has({x: 5, y: 6, z: 2})).toBe(true);
        expect(grid.has({x: 6, y: 6, z: 2})).toBe(true);
        expect(grid.has({x: 7, y: 6, z: 2})).toBe(true);
        expect(grid.has({x: 5, y: 7, z: 2})).toBe(true);
        expect(grid.has({x: 7, y: 7, z: 3})).toBe(true);

        expect(grid.has({x: 4, y: 6, z: 2})).toBe(false);
        expect(grid.has({x: 8, y: 6, z: 2})).toBe(false);
        expect(grid.has({x: 5, y: 8, z: 2})).toBe(false);
        expect(grid.has({x: 5, y: 6, z: 4})).toBe(false);
    });

    it('reports intersections for overlapping boxes', () => {
        let grid = new Grid();

        grid.add({x: 10, y: 10, z: 1, width: 2, height: 2});

        expect(grid.intersects({x: 9, y: 9, z: 1, width: 2, height: 2})).toBe(true);
        expect(grid.intersects({x: 11, y: 11, z: 1})).toBe(true);
        expect(grid.intersects({x: 12, y: 12, z: 1})).toBe(false);
        expect(grid.intersects({x: 10, y: 10, z: 2, width: 2, height: 2})).toBe(false);
    });

    it('does not report intersections for exactly adjacent boxes', () => {
        let grid = new Grid();

        grid.add({x: 10, y: 10, z: 1, width: 2, height: 2, depth: 2});

        expect(grid.intersects({x: 12, y: 10, z: 1, width: 1, height: 2, depth: 2})).toBe(false);
        expect(grid.intersects({x: 10, y: 12, z: 1, width: 2, height: 1, depth: 2})).toBe(false);
        expect(grid.intersects({x: 10, y: 10, z: 3, width: 2, height: 2, depth: 1})).toBe(false);
    });

    it('subtracts previously occupied space', () => {
        let grid = new Grid();

        grid.add({x: 1, y: 1, z: 1, width: 3, height: 2});
        grid.subtract({x: 2, y: 1, z: 1, height: 2});

        expect(grid.has({x: 1, y: 1, z: 1})).toBe(true);
        expect(grid.has({x: 3, y: 2, z: 1})).toBe(true);
        expect(grid.has({x: 2, y: 1, z: 1})).toBe(false);
        expect(grid.has({x: 2, y: 2, z: 1})).toBe(false);
    });

    it('subtracts only the overlapping portion of a box', () => {
        let grid = new Grid();

        grid.add({x: 1, y: 1, z: 1, width: 4, height: 3, depth: 2});
        grid.subtract({x: 3, y: 2, z: 2, width: 3, height: 2, depth: 2});

        expect(grid.has({x: 1, y: 1, z: 1})).toBe(true);
        expect(grid.has({x: 2, y: 3, z: 2})).toBe(true);
        expect(grid.has({x: 3, y: 2, z: 2})).toBe(false);
        expect(grid.has({x: 4, y: 3, z: 2})).toBe(false);
        expect(grid.has({x: 4, y: 3, z: 1})).toBe(true);
    });

    it('does not affect disconnected occupied regions when subtracting', () => {
        let grid = new Grid();

        grid.add({x: 0, y: 0, z: 0, width: 2, height: 2, depth: 1});
        grid.add({x: 10, y: 10, z: 0, width: 2, height: 2, depth: 1});
        grid.subtract({x: 0, y: 0, z: 0, width: 2, height: 2, depth: 1});

        expect(grid.has({x: 0, y: 0, z: 0})).toBe(false);
        expect(grid.has({x: 1, y: 1, z: 0})).toBe(false);
        expect(grid.has({x: 10, y: 10, z: 0})).toBe(true);
        expect(grid.has({x: 11, y: 11, z: 0})).toBe(true);
    });

    it('is idempotent when adding the same box twice', () => {
        let grid = new Grid();
        let box = {x: 3, y: 4, z: 2, width: 2, height: 2, depth: 2};

        grid.add(box);
        grid.add(box);

        expect(grid.has({x: 3, y: 4, z: 2})).toBe(true);
        expect(grid.has({x: 4, y: 5, z: 3})).toBe(true);
        expect(grid.intersects(box)).toBe(true);
    });

    it('is safe to subtract the same box twice', () => {
        let grid = new Grid();
        let box = {x: 7, y: 8, z: 1, width: 2, height: 2, depth: 1};

        grid.add(box);
        grid.subtract(box);
        grid.subtract(box);

        expect(grid.has({x: 7, y: 8, z: 1})).toBe(false);
        expect(grid.has({x: 8, y: 9, z: 1})).toBe(false);
        expect(grid.intersects(box)).toBe(false);
    });

    it('ignores subtracting empty space', () => {
        let grid = new Grid();

        grid.subtract({x: 20, y: 20, z: 20, width: 2, height: 2, depth: 2});

        expect(grid.has({x: 20, y: 20, z: 20})).toBe(false);
        expect(grid.intersects({x: 20, y: 20, z: 20, width: 2, height: 2, depth: 2})).toBe(false);
    });

    it('clears all occupied space', () => {
        let grid = new Grid();

        grid.add({x: 0, y: 0, z: 0, width: 2, height: 2, depth: 2});
        grid.clear();

        expect(grid.has({x: 0, y: 0, z: 0})).toBe(false);
        expect(grid.has({x: 1, y: 1, z: 1})).toBe(false);
        expect(grid.intersects({x: 0, y: 0, z: 0, width: 2, height: 2, depth: 2})).toBe(false);
    });

    it('clears sparse occupancy across multiple rows and depths', () => {
        let grid = new Grid();

        grid.add({x: 0, y: 0, z: 0});
        grid.add({x: 5, y: 7, z: 2, width: 2, height: 2});
        grid.add({x: 9, y: 1, z: 4});
        grid.clear();

        expect(grid.has({x: 0, y: 0, z: 0})).toBe(false);
        expect(grid.has({x: 5, y: 7, z: 2})).toBe(false);
        expect(grid.has({x: 6, y: 8, z: 2})).toBe(false);
        expect(grid.has({x: 9, y: 1, z: 4})).toBe(false);
    });
});
