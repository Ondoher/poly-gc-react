/** @module types */
/**
 * This is the position of where a tile can be placed on the board. The board
 * is made up of virtual positions in a three dimensional grid that is 30
 * horizontal (x), 20(y) verticle and stacked 7 high (z). Each tile occupies 2
 * horizontal, 2 veriticle and 1 high.
 *
 * @typedef {Object} TilePositon This is the position of a placeable tile
 * @property {Number} x the horizontal position of a tile
 * @property {Number} y the veriticle position of a tile
 * @property {Number} z the layer of the tile
 */

/**
 * This represents the exact positions of where tiles can be placed for a
 * specific layout. This game has only encoded the standard turtle layout, but
 * any layout with up to 144 tiles can be specified.
 *
 * @typedef {Array.<TilePositon>} PositionSet
 */

/**
 * This is the layout object
 *
 * @typedef {Object} Layout
 * @property {String} id a unique id for this layout
 * @property {Number} tiles how many tiles are needed for this layout
 * @property {PositionSet} positions the specific positions that make up this
 * 		layout
 */

/**
 * This is a representation of tiles that match. When tiles are drawn to be
 * placed on the board, two tiles from a single face set will be removed. There
 * are 144 tiles in a Mah Jongg set. Of those tiles each one can be matched in
 * sets of four. For instance, there will be four red dragon tiles that will
 * match with each other. A faceSet is the specfic tiles within the 144 that
 * will match. There are 36 groups of four matching tiles. These are sequential
 * numbers. There is a correlation between each number and the image that will
 * be rendered on the screen.
 *  *
 * @typedef {Object} FaceSet
 * @property {Array.<Number>} faces the indexes within the full set of tiles that
 *  	match in this one group of faces.
 */

/**
 * This is a reference to one set of matching faces
 *
 * @typedef {Number} FaceGroup
 */

/**
 * This represents the mah jongg tiles that have not yet been placed on the
 * board. When the board is generated, pairs of tiles will be removed from this
 * pile to be placed.
 *
 * @typedef {Object} DrawPile
 * @property {Number} count the number of pieces in the pile left to place
 * @property {Array.<FaceSet>}
 */

/**
 * The face repesents the specific tile being shown. MahJong tiles come in three
 * suites (dots, bamboo and character) numbered 1-9. Then there are the dragon
 * tiles, green white and red. There are four of each of these tiles. The winds
 * are north, south, east and west, also four of each. Tnd then there are  four
 * unique flower and four unique season tiles. The wind and seasons tiles will
 * match with each other. This is an index into the possible 144 tiles
 *
 * @typedef {Number} Face
 */

/**
 * @typedef {Object} FacePair
 * @property {Face} face1
 * @property {Face} face2
 */

/**
 * This represent a specfic tile that has been placed on the game board
 *
 * @typedef {Object} Piece
 * @property {TilePositon} pos the position of this tile on the grid
 * @property {Face} face this represents the specific face of the tile to be
 * 		displayed
 */

/**
 * This specifies which tiles have been drawn and where.
 *
 * @typedef {Object} Board
 * @property {Number} count the number of tiles on the board. comes directly
 * 	from the layout tile field
 * @property {Array.<Piece>} pieces this is where each tile has been
 * 		or can be placed.
 */

/**
 * Ths is an index into the pieces array of a board. The board represent the
 * current layout of the tiles and their faces
 *
 * @typedef  {Number} Tile
 */

/**
 * This is a pair of tiles, propbably used to describe a match
 *
 * @typedef {Object} TilePair
 * @property {Tile} tile1
 * @property {Tile} tile2
 */

/**
 * This type describes the current state of the game
 *
 * @typedef {Object} GameState
 * @property {Boolean} canUndo true if the player can undo a move
 * @property {Boolean} canRedo true if the player can redo a move
 * @property {Number} remaining the number of tiles still on the board
 * @property {Boolean} lost true if there are no more moves that can be made
 * @property {NumberSet} open the tiles that are open
 */


/**
 * This event is fired when the state of the game has changed
 *
 * @event updateState
 * @type {GameState}
 */

/**
 * This event is fired when the game should remove a tile from the board
 *
 * @event removeTile
 * @type {Tile}
 */

/**
 * This event is fired when the game should add a tile to the board
 *
 * @event addTile
 * @type {Tile}
 */

/**
 * This event is fired when there is a new game board
 *
 * @event newBoard
 * @type {Board}
 */
