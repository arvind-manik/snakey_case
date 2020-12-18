window.gameController = undefined;

window.onload = function() {
    let canvasElem = document.createElement('canvas');
    canvasElem.style.display = 'block';
    window.gameController = new GameController(canvasElem, window.innerWidth, window.innerHeight);
    document.body.appendChild(canvasElem);
    document.addEventListener('keydown', gameController.keyPushListener);

    const normalModeFPS = 15;
    runNormalMode = () => {
        window.gameInterval = window.setInterval(gameController.looper, 1000 / normalModeFPS);
    }

    runNormalMode();

    var SMOOTH = false;
    enableSmoothMode = () => {
        window.gameController.enableSmoothMode();
        SMOOTH = true;
        
        clearInterval(window.gameInterval);

        var frameLoop = () => {
            if (SMOOTH) {
                gameController.looper();
                requestAnimationFrame(frameLoop);
            }
        }

        requestAnimationFrame(frameLoop);
    }

    disableSmoothMode = () => {
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

    #snakeTrail = [];   //Snake X,Y positions will be maintained here (upto tailLength)
    #tailLength = GameController.minTailLength;    //Snake tail will have a length of 5 initially

    //Constants
    static tileSize = 50;  //50px
    static minTailLength = 5;

    static fieldColor = '#000000';
    static snakeColor = '#00ff00';
    static foodColor = '#ff0000';

    #lastKeyIn = -1;

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
        if (this.didEatFood()) {
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

    //For moving snake slower to allow 60FPS animation
    enableSmoothMode = () => {
        this.#vectorDelta = 0.1;
    }

    //Reverting to 15FPS mode
    disableSmoothMode = () => {
        this.#vectorDelta = 1;
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
        for (let i = 0; i < this.#snakeTrail.length; i++) {
            let trailPos = this.#snakeTrail[i];

            //Drawing snake and its tail. Params are for coordinates X, Y and rect size
            //-2 is added to show separation between tail element in the grid
            this.#context.fillRect(trailPos.x * GameController.tileSize, trailPos.y * GameController.tileSize, GameController.tileSize - 2, GameController.tileSize - 2);

            //Oops, the snake bit itself :(
            if (trailPos.x == this.#snakeX && trailPos.y == this.#snakeY) {
                this.#tailLength = GameController.minTailLength;
            }
        }

        this.#snakeTrail.push({ x: this.#snakeX, y: this.#snakeY });

        //Remove excess trail to be avoided for next render
        while (this.#snakeTrail.length > this.#tailLength) {
            this.#snakeTrail.shift();
        }

        //Snake has eaten food
        if (this.didEatFood()) {
            this.#tailLength++;
            this.placeFood();
        }

        this.#context.fillStyle = GameController.foodColor;
        //-2 on food rect as well for uniform size
        this.#context.fillRect(this.#foodX * GameController.tileSize, this.#foodY * GameController.tileSize, GameController.tileSize - 2, GameController.tileSize - 2);
    }

    //Will find if snake position is intersecting with food in grid
    didEatFood = () => {
        return this.#snakeX == this.#foodX && this.#snakeY == this.#foodY;
    }

    //Wrap snake if moving out of bounds
    handleWrap = () => {
        if (this.#snakeX > this.#boardXMax - 1) {
            this.#snakeX = 0;
        } else if (this.#snakeX < 0) {
            this.#snakeX = this.#boardXMax - 1;
        }

        if (this.#snakeY > this.#boardYMax - 1) {
            this.#snakeY = 0;
        } else if (this.#snakeY < 0) {
            this.#snakeY = this.#boardYMax - 1;
        }
    }

    handleResize = (innerWidth, innerHeight) => {
        this.setUpCanvas(innerWidth, innerHeight);
    }

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

    constructor (canvasElem, innerWidth, innerHeight) {
        this.#canvas = canvasElem;
        this.setUpCanvas(innerWidth, innerHeight);
        this.#context = this.#canvas.getContext('2d');

        this.resetSnake();
        this.placeFood();
    }
}

