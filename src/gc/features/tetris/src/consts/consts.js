
export const NO_BUTTON = 0;
export const LEFT_BUTTON = 1;
export const RIGHT_BUTTON = 2;
export const ROTATELEFT_BUTTON = 1;
export const ROTATERIGHT_BUTTON = 2;
export const SOFTDOWN_BUTTON = 1;
export const HARDDOWN_BUTTON = 2;

export const DOWN_BTN = 1
export const MOVE_BTN = 2;
export const ROTATE_BTN = 3;

export const BOUCE_DELAY = 200;
export const REPEAT_DELAY = 75;
export const SPAWN_DELAY = 500;
export const LOCK_DELAY = 1000;

export const ROW_CLEAR_VALUES = [100, 300, 500, 800];
export const TSPIN_VALUES = [400, 800, 1200, 1600]
export const CLEAR_MATRIX = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

export const ROWS = 20;
export const COLS = 10;

export const LEFT = -1;
export const DOWN = 0;
export const RIGHT = 1;
export const UP = 2;

export const EMPTY   = 0;
export const CYAN    = 1;
export const BLUE    = 2;
export const ORANGE  = 3;
export const YELLOW  = 4;
export const GREEN   = 5;
export const PURPLE  = 6;
export const RED     = 7;

export const TILE_WIDTH = 25;
export const TILE_HEIGHT = 30;
export const LEFT_LAYER_OFFSET = 4;
export const TOP_LAYER_OFFSET = 4;

export const CONFIGURATION = {
    tilePath: "tetris/images/normal/",
    tileImages: ["empty.png", "cyan.png", "blue.png", "orange.png", "yellow.png", "green.png", "purple.png", "red.png"],
    tileWidth: 16,
    tileHeight: 16,
    smallTilePath: "tetris/images/small/",
    smallTileImages: ["empty.png", "cyan.png", "blue.png", "orange.png", "yellow.png", "green.png", "purple.png", "red.png"],
    smallTileWidth: 12,
    smallTileHeight: 12,
    whoopPath: "tertis/images/whoop.png"
};
