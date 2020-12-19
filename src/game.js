window.gameController = undefined;

window.onload = function() {
    let canvasElem = document.createElement('canvas');
    Util.setStyle(canvasElem, { display: 'block', overflow: 'hidden', position: 'absolute', top: 0, left: 0 });
    
    window.gameController = new GameController(canvasElem, window.innerWidth, window.innerHeight);
    document.body.appendChild(canvasElem);
    document.addEventListener('keydown', gameController.keyPushListener);

    window.gameInterval = null;
    const normalModeFPS = 15;
    runNormalMode = () => {
        window.gameInterval = window.setInterval(gameController.looper, 1000 / normalModeFPS);
    }

    //By default game starts in normal mode
    runNormalMode();

    window.gameAnimationFrame = null;
    runSmoothMode = () => {
        let frameLoop = () => {
            if (SMOOTH) {
                gameController.looper();
                window.gameAnimationFrame = requestAnimationFrame(frameLoop);
            }
        }
    
        window.gameAnimationFrame = requestAnimationFrame(frameLoop);
    }

    pauseGame = () => {
        if (!SMOOTH) {
            clearInterval(window.gameInterval);
        } else {
            cancelAnimationFrame(window.gameAnimationFrame);
        }
    }
    
    resumeGame = () => {
        if (!SMOOTH) {
            runNormalMode();
        } else {
            runSmoothMode();
        }
    }

    var SMOOTH = false;
    enableSmoothMode = () => {
        clearInterval(window.gameInterval);
        window.gameController.enableSmoothMode();
        SMOOTH = true;
        
        runSmoothMode();
    }

    disableSmoothMode = () => {
        cancelAnimationFrame(window.gameAnimationFrame);
        window.gameController.disableSmoothMode();
        SMOOTH = false;

        runNormalMode();
    }

    //Debounced resize event
    var resizeTimer = null;
    window.onresize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            gameController.handleResize(window.innerWidth, window.innerHeight);
        }, 250);    //will trigger 250ms after resize completes
    }
}

class GameView {

}

window.Util = {
    setStyle: (element, styles) => {
        for (let styleName in styles) {
            element.style[styleName] = styles[styleName];
        }
    }
}

class GameController {
    #canvas;
    #context;

    #snakeX;
    #snakeY;

    #foodX;
    #foodY;
    
    //Board size is responsive
    #boardXMax;
    #boardYMax;

    #vector = { x: 0, y: 0 };
    #vectorDelta = 1;

    #trail = [];                                        //Snake X,Y positions will be maintained here (upto tailLength)
    #trailLength = GameController.minTrailLength;       //Snake tail will have a length of 5 initially

    //Constants
    static tileSize = 50;  //50px
    static minTrailLength = 5;

    static fieldColor = '#000000';
    static snakeColor = '#00ff00';
    static foodColor = '#ff0000';

    #lastKeyIn = -1;
    #SMOOTH = false;

    //For preventing action on trying to move in opposite direction
    static oppositeKeyMapping = {
        37: 39,
        38: 40,
        39: 37,
        40: 38
    }

    resetSnake = () => {
        this.#snakeX = Math.floor(this.#boardXMax / 2);
        this.#snakeY = Math.floor(this.#boardYMax / 2);
    }

    placeFood = () => {
        this.#foodX = Math.floor(Math.random() * this.#boardXMax);
        this.#foodY = Math.floor(Math.random() * this.#boardYMax);

        //Avoiding placing at snake's current position
        if (this.isFoodInterSecting()) {
            this.placeFood();
        }
    }

    //Will update the canvas to set width and height and also update instance variables
    setUpCanvas = (innerWidth, innerHeight) => {
        this.#canvas.width = innerWidth;
        this.#canvas.height = innerHeight;

        this.#boardXMax = Math.floor(innerWidth / GameController.tileSize);
        this.#boardYMax = Math.floor(innerHeight / GameController.tileSize);
    }

    static smoothFactor = 5;
    //For moving snake slower to allow 60FPS animation
    enableSmoothMode = () => {
        this.#SMOOTH = true;
        this.#vectorDelta /= GameController.smoothFactor;
        this.#vector.x /= GameController.smoothFactor;
        this.#vector.y /= GameController.smoothFactor;
    }

    //Reverting to 15FPS mode
    disableSmoothMode = () => {
        this.#SMOOTH = true;
        this.#vectorDelta *= GameController.smoothFactor;
        this.#vector.x *= GameController.smoothFactor;
        this.#vector.y *= GameController.smoothFactor;

        this.#snakeX = Math.round(this.#snakeX);
        this.#snakeY = Math.round(this.#snakeY);

        for (let i = 0; i < this.#trail.length; i++) {
            let trailPos = this.#trail[i];
            trailPos.x = Math.round(trailPos.x);
            trailPos.y = Math.round(trailPos.y);
        }
    }

    //Main renderer
    looper = () => {
        this.#snakeX += this.#vector.x;
        this.#snakeY += this.#vector.y;

        this.handleWrap();

        //Draw field for entire canvas
        this.#context.fillStyle = GameController.fieldColor;
        this.#context.fillRect(0, 0, this.#canvas.width, this.#canvas.height);

        this.#context.fillStyle = GameController.snakeColor;
        for (let i = 0; i < this.#trail.length; i++) {
            let trailPos = this.#trail[i];

            //Drawing snake and its tail. Params are for coordinates X, Y and rect size
            //-2 is added to show separation between tail element in the grid
            this.#context.fillRect(trailPos.x * GameController.tileSize, trailPos.y * GameController.tileSize, GameController.tileSize - 2, GameController.tileSize - 2);

            //Oops, the snake bit itself :(
            if (trailPos.x == this.#snakeX && trailPos.y == this.#snakeY) {
                this.#trailLength = GameController.minTrailLength;
            }
        }

        //Adding current position to trail
        this.#trail.push({ x: this.#snakeX, y: this.#snakeY });

        //Remove excess trail to be avoided for next render
        while (this.#trail.length > this.#trailLength) {
            this.#trail.shift();
        }

        //Snake has eaten food
        if (this.isFoodPosition(this.#snakeX, this.#snakeY, this.#SMOOTH)) {
            this.#trailLength++;
            this.placeFood();
        }

        this.#context.fillStyle = GameController.foodColor;
        //-2 on food rect as well for uniform size
        this.#context.fillRect(this.#foodX * GameController.tileSize, this.#foodY * GameController.tileSize, GameController.tileSize - 2, GameController.tileSize - 2);
    }

    static accuracy = 1;
    //Will find if snake position is intersecting with food in grid
    isFoodPosition = (x, y, inaccurateCheck) => {
        return !inaccurateCheck ? 
                    x == this.#foodX && y == this.#foodY :
                    Math.abs(x - this.#foodX) < GameController.accuracy && Math.abs(y - this.#foodY) < GameController.accuracy;     //Allowing inaccurate match for when smooth mode is chosen
    }

    isFoodInterSecting = () => {
        for (let i = 0; i < this.#trail.length; i++) {
            let trailPos = this.#trail[i];
            if (this.isFoodPosition(trailPos.x, trailPos.y)) {
                return true;
            }
        }

        return false;
    }

    //Wrap snake if moving out of bounds
    handleWrap = () => {
        let xBound = this.#boardXMax - 1;
        let yBound = this.#boardYMax - 1;

        if (this.#snakeX > xBound) {
            this.#snakeX = 0;
        } else if (this.#snakeX < 0) {
            this.#snakeX = xBound;
        }

        if (this.#snakeY > yBound) {
            this.#snakeY = 0;
        } else if (this.#snakeY < 0) {
            this.#snakeY = yBound;
        }
    }

    handleResize = (innerWidth, innerHeight) => {
        this.setUpCanvas(innerWidth, innerHeight);
        this.placeFood();
    }

    #keyDebounce = (event) => {
        const keyCode = event.keyCode;

        //Update movement vectors
        switch (keyCode) {
            case 37:
                this.#vector.x = -this.#vectorDelta;
                this.#vector.y = 0;
                break;
            case 38:
                this.#vector.y = -this.#vectorDelta;
                this.#vector.x = 0;
                break;
            case 39:
                this.#vector.x = this.#vectorDelta;
                this.#vector.y = 0;
                break;
            case 40:
                this.#vector.y = this.#vectorDelta;
                this.#vector.x = 0;
        }

        this.#lastKeyIn = keyCode;
    }

    #keyTimeout = null;
    keyPushListener = (event) => {
        const keyCode = event.keyCode;

        //Ignore non-arrow key input
        if (keyCode < 37 || keyCode > 40) {
            return;
        }

        //Prevent attempting to move in opposite direction
        if (keyCode == GameController.oppositeKeyMapping[this.#lastKeyIn]) {
            return;
        }

        event.preventDefault();

        clearTimeout(this.#keyTimeout);
        this.#keyTimeout = setTimeout(() => { this.#keyDebounce(event); }, 20);     //Debouncing key events by 20ms to avoid duplicate input in-between frames
    }

    constructor (canvasElem, innerWidth, innerHeight) {
        this.#canvas = canvasElem;
        this.setUpCanvas(innerWidth, innerHeight);
        this.#context = this.#canvas.getContext('2d');

        this.resetSnake();
        this.placeFood();
    }
}

