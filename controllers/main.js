class GameController {
    #canvas;
    #context;

    #snakeX;
    #snakeY;

    #foodX;
    #foodY;
    
    //Field size is responsive
    #fieldXMin;
    #fieldXMax;
    #fieldYMax;

    #vector = { x: 0, y: 0 };
    #previousVector = this.#vector;
    #vectorDelta = 1;

    #trail = [];                                        //Snake X,Y positions will be maintained here (upto tailLength)
    #trailLength = GameController.minTrailLength;       //Snake tail will have a length of 5 initially
    
    //Score variables
    #finalScore = 0;
    #highScore = 0;

    //For notifying view about state changes
    #viewListener = null;

    //Constants
    static tileSize = 0;
    static minTrailLength = 3;

    static fieldColor = '#000000';
    static snakeColor = '#00ff00';
    static foodColor = '#ff0000';
    static marginColor = '#333333';
    static fontColorWhite = '#FFFFFF';
    static fontColorBlack = '#000000';
    static alertModalColor = '#FFFFFF';
    
    static hintFont = '14px Verdana';
    static scoreFont = '16px Verdana';
    static alertFont = '30px Verdana';

    //Field takes 80% of the available width
    static fieldWidthFactor = 0.8;
    static marginThickness = 5;

    //Icon padding and dimenstions
    static iconOffsetX = 5;
    static iconOffsetY = 5;
    static iconSize = 40;

    //Corner radius props - yet to implement
    static snakeRadius = 10;
    static foodRadius = 30;
    static alertRadius = 20;

    //Margin width in px
    static marginWidth = 0;

    //Smooth mode speed reduction factor
    static smoothFactor = 8;
    
    //Tolerance in position diff while in smooth mode
    static foodIntersectionTolerance = 1;

    #SMOOTH = false;
    #currentState = GameController.States.INIT;

    playIcon = new Image();
    pauseIcon = new Image();
    smoothFPSIcon = new Image();

    static States = {
        INIT        :   'INIT',
        RUNNING     :   'RUNNING',
        PAUSED      :   'PAUSED',
        GAME_OVER   :   'GAME_OVER'
    }

    //For preventing action on trying to move in opposite direction
    static oppositeKeyMapping = {
        37: 39,
        38: 40,
        39: 37,
        40: 38
    }

    resetSnake = () => {
        this.#snakeX = Math.floor(this.#fieldXMax / 2);
        this.#snakeY = Math.floor(this.#fieldYMax / 2);
    }

    placeFood = () => {
        this.#foodX = Math.max(Math.floor(Math.random() * this.#fieldXMax), this.#fieldXMin);
        this.#foodY = Math.floor(Math.random() * this.#fieldYMax);

        //Avoiding placing at snake's current position
        while (this.isFoodInterSecting()) {
            this.placeFood();
        }
    }

    //Will update the canvas to set width and height and also update instance variables
    setupCanvas = (innerWidth, innerHeight) => {
        this.#canvas.width = innerWidth;
        this.#canvas.height = innerHeight;

        GameController.tileSize = innerWidth * innerHeight / Math.pow(15, 4);   //for 15px x 15px snake trail size
        
        //Dividing the remaining 20% of area after drawing field
        GameController.marginWidth = Math.round((this.#canvas.width - (this.#canvas.width * GameController.fieldWidthFactor)) / 2);

        this.#fieldXMax = Math.floor(innerWidth / GameController.tileSize);
        this.#fieldYMax = Math.floor(innerHeight / GameController.tileSize);

        let leftMarginX = this.getLeftMargin();
        this.#fieldXMin = Math.round(leftMarginX / GameController.tileSize);

        let rightMarginX = this.getRightMargin();
        this.#fieldXMax = Math.round(rightMarginX / GameController.tileSize);
    }

    getLeftMargin = () => {
        let leftMarginX = GameController.marginWidth;
        leftMarginX = Math.floor(leftMarginX - (leftMarginX % GameController.tileSize));

        return leftMarginX;
    }

    getRightMargin = () => {
        let rightMarginX = this.#canvas.width - GameController.marginWidth;
        rightMarginX = Math.ceil(rightMarginX - (rightMarginX % GameController.tileSize));

        return rightMarginX;
    }

    //For moving snake slower to allow 60FPS animation
    enableSmoothMode = () => {
        this.#SMOOTH = true;
        this.#vectorDelta /= GameController.smoothFactor;
        this.#vector.x /= GameController.smoothFactor;
        this.#vector.y /= GameController.smoothFactor;
    }

    //Reverting to 15FPS mode
    disableSmoothMode = () => {
        this.#SMOOTH = false;
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
        const isNewVector = this.#vector.is_new;
        if (this.isRunning()) {
            let vectorX = this.#vector.x;
            let vectorY = this.#vector.y;

            if (isNewVector) {
                delete this.#vector.is_new;

                if (this.#SMOOTH) {
                    vectorX *= GameController.smoothFactor;
                    vectorY *= GameController.smoothFactor;
                }
            }

            this.#snakeX += vectorX;
            this.#snakeY += vectorY;

            //Ensuring grid when changing direction in 60FPS mode
            if (isNewVector && this.#SMOOTH) {
                this.#snakeX = Math.round(this.#snakeX);
                this.#snakeY = Math.round(this.#snakeY);
            }
        }
        
        //Order of drawing in canvas decides the layers
        this.renderField();

        this.handleWrap();
        
        //For rendering intial position
        if (this.#trail.length == 0) {
            this.#trail.push({ x: this.#snakeX, y: this.#snakeY });
        }

        let isGameOver = this.renderSnake();
        if (isGameOver) {
            this.renderGameOver();
        }

        if (this.isInit()) {
            let gameStartText = 'Hello! Press any ARROW key to start';
            this.showAlert(gameStartText);
        }

        //Adding current position to trail
        if (this.isRunning()) {
            this.#trail.unshift({ x: this.#snakeX, y: this.#snakeY });

            //Updating previous trail by regular vector delta for ensuring smoothness
            // if (this.#SMOOTH) {
            //     if (!isNewVector) {
            //         for (let i = 0; i < this.#trail.length; i++) {
            //             const prevTrail = this.#trail[i];
            //             const shiftDelta = this.#vectorDelta * GameController.smoothFactor - this.#vectorDelta;
            //             let xDiff = prevTrail.x - this.#snakeX;
            //             let yDiff = prevTrail.y - this.#snakeY;

            //             //Ignoring non-adjacent trail
            //             if (Math.abs(xDiff) > 0 && Math.abs(yDiff) > 0) {
            //                 console.log(shiftDelta, xDiff, yDiff);
            //                 continue;
            //             }
    
            //             if (xDiff > 0) {
            //                 prevTrail.x += shiftDelta;
            //             } else if (xDiff < 0) {
            //                 prevTrail.x -= shiftDelta;
            //             }
    
            //             if (yDiff > 0) {
            //                 prevTrail.y += shiftDelta;
            //             } else if (yDiff < 0) {
            //                 prevTrail.y -= shiftDelta;   
            //             }
            //         }
            //     } else {

            //     }
            // }

            this.popExcessTrail();
        }

        //Snake has ate the food
        if (this.isFoodPosition(this.#snakeX, this.#snakeY, this.#SMOOTH)) {
            this.#trailLength++;
            this.placeFood();
        }

        this.renderFood();
    }

    renderField = () => {
        this.#context.lineJoin = 'miter';
        this.#context.lineWidth = 1.0;

        //Draw field for entire canvas
        this.#context.fillStyle = GameController.fieldColor;
        this.#context.fillRect(0, 0, this.#canvas.width, this.#canvas.height);

        //Drawing margins
        this.#context.fillStyle = GameController.marginColor;

        this.#context.fillRect(this.getLeftMargin(), 0, GameController.marginThickness, this.#canvas.height);
        this.#context.fillRect(this.getRightMargin(), 0, GameController.marginThickness, this.#canvas.height);

        this.renderUI();
    }

    loadAssets = async () => {
        let images = [];
        images.push(this.playIcon);
        images.push(this.pauseIcon);
        images.push(this.smoothFPSIcon);

        let loaded = false;
        let promiseChain = Promise.all(Array.from(images).filter(img => !img.complete).map(img => new Promise(resolve => { img.onload = img.onerror = resolve; })));
        promiseChain.then(() => { loaded = true; });

        this.playIcon.src = 'assets/play-100.png';
        this.pauseIcon.src = 'assets/pause-100.png';
        this.smoothFPSIcon.src = 'assets/60-100.png';

        await promiseChain;
        return loaded;
    }

    renderUI = () => {
        let stateIcon = this.isRunning() ? this.pauseIcon : this.playIcon;
        this.#context.drawImage(stateIcon, GameController.iconOffsetX, GameController.iconOffsetY, GameController.iconSize, GameController.iconSize);

        this.#context.filter = 'opacity(' + (this.#SMOOTH ? 1 : 0.2) + ')';
        this.#context.drawImage(this.smoothFPSIcon, GameController.iconSize + GameController.iconOffsetX, GameController.iconOffsetY, GameController.iconSize, GameController.iconSize);
        this.#context.filter = 'none';

        let smoothHint = 'Press (s) for 60FPS';
        this.#context.font = GameController.hintFont;
        this.#context.fillStyle = GameController.fontColorWhite;
        this.#context.fillText(smoothHint, GameController.iconOffsetX, GameController.iconSize * 2 + GameController.iconOffsetX * 2);

        let scoreText = 'Score: ' + (this.isGameOver() ? this.#finalScore : this.#trailLength);
        this.#context.font = GameController.scoreFont;
        this.#context.fillStyle = GameController.fontColorWhite;
        let textMetrics = this.#context.measureText(scoreText);
        this.#context.fillText(scoreText, this.#canvas.width - textMetrics.width - 10, 25);
        
        let highScoreText = 'High score: ' + this.#highScore;
        this.#context.font = GameController.scoreFont;
        this.#context.fillStyle = GameController.fontColorWhite;
        textMetrics = this.#context.measureText(highScoreText);
        this.#context.fillText(highScoreText, this.#canvas.width - textMetrics.width - 10, 50);
    }
    
    renderSnake = () => {
        this.#context.lineJoin = 'round';
        this.#context.lineWidth = GameController.snakeRadius;

        let isGameOver = this.isGameOver();
        this.#context.fillStyle = GameController.snakeColor;
        for (let i = 0; i < this.#trail.length; i++) {
            let trailPos = this.#trail[i];

            //Drawing snake and its tail. Params are for coordinates X, Y and rect size
            //-2 is added to show separation between tail element in the grid
            this.#context.fillRect(trailPos.x * GameController.tileSize, trailPos.y * GameController.tileSize, GameController.tileSize - 2, GameController.tileSize - 2);

            //Oops, the snake bit itself :(
            if (trailPos.x == this.#snakeX && trailPos.y == this.#snakeY && this.isRunning() && this.#trail.length > GameController.minTrailLength) {
                this.#finalScore = this.#trailLength;
                let isNewHighScore = ScoreManager.checkAndUpdateHighScore(this.#finalScore);
                isGameOver = true;
            }
        }

        return isGameOver;
    }

    renderFood = () => {
        this.#context.lineJoin = 'round';
        this.#context.lineWidth = GameController.foodRadius;

        this.#context.fillStyle = GameController.foodColor;
        //-2 on food rect as well for uniform size
        this.#context.fillRect(this.#foodX * GameController.tileSize, this.#foodY * GameController.tileSize, GameController.tileSize - 2, GameController.tileSize - 2);
    }

    renderGameOver = () => {
        //Redraw once before showing game over
        this.renderField();
        this.renderUI();
        this.renderSnake();
        this.renderFood();

        let gameOverText = 'Game over!\nYour score: ' + this.#finalScore + '\n Press SPACE to continue';
        this.showAlert(gameOverText);

        this.#trailLength = GameController.minTrailLength;
        this.#currentState = GameController.States.GAME_OVER;

        if (typeof this.#viewListener === 'function') {
            this.#viewListener({ state: this.#currentState });
        }

        this.popExcessTrail();
    }

    showAlert = (text) => {
        //for alert BG
        let textMetrics = this.#context.measureText(text);
        let alertTextX = this.#canvas.width / 2 - textMetrics.width;
        let alertTextY = this.#canvas.height / 2;
        
        let cornerRadius = GameController.alertRadius;
        this.#context.lineJoin = 'round';
        this.#context.lineWidth = cornerRadius;
        
        // let alertModalPadding = 10;
        // this.#context.fillStyle = GameController.alertModalColor;
        // //Change origin and dimensions to match true size (a stroke makes the shape a bit larger)
        // this.#context.strokeRect(alertTextX - (cornerRadius / 2) - alertModalPadding, alertTextY - (cornerRadius / 2) - alertModalPadding, textMetrics.width + alertModalPadding, parseInt(GameController.alertFont) + alertModalPadding);
        // this.#context.fillRect(alertTextX + (cornerRadius / 2), alertTextY + (cornerRadius / 2), textMetrics.width - cornerRadius, parseInt(GameController.alertFont) - cornerRadius);

        //Alert content
        this.#context.font = GameController.alertFont;
        this.#context.fillStyle = GameController.fontColorWhite;
        this.#context.fillText(text, alertTextX, alertTextY);
    }

    popExcessTrail = () => {
        //Remove excess trail to be avoided for next render
        while (this.#trail.length > this.#trailLength) {
            this.#trail.pop();
        }
    }

    //Will find if snake position is intersecting with food in grid
    isFoodPosition = (x, y, inaccurateCheck) => {
        return !inaccurateCheck ? 
                    x == this.#foodX && y == this.#foodY :
                    Math.abs(x - this.#foodX) < GameController.foodIntersectionTolerance && Math.abs(y - this.#foodY) < GameController.foodIntersectionTolerance;     //Allowing inaccurate match for when smooth mode is chosen
    }

    isFoodInterSecting = () => {
        for (let i = 0; i < this.#trail.length; i++) {
            let trailPos = this.#trail[i];
            if (this.isFoodPosition(trailPos.x, trailPos.y, this.#SMOOTH)) {
                return true;
            }
        }

        return false;
    }

    //Cheat :))
    _growTail = (delta) => {
        this.#trailLength += delta;
    }

    //Wrap snake if moving out of bounds
    handleWrap = () => {
        let xBound = this.#fieldXMax - 1;
        let yBound = this.#fieldYMax - 1;

        if (this.#snakeX > xBound) {
            this.#snakeX = this.#fieldXMin;
        } else if (this.#snakeX < this.#fieldXMin) {
            this.#snakeX = xBound;
        }

        if (this.#snakeY > yBound) {
            this.#snakeY = 0;
        } else if (this.#snakeY < 0) {
            this.#snakeY = yBound;
        }
    }

    handleResize = (innerWidth, innerHeight) => {
        this.setupCanvas(innerWidth, innerHeight);
        this.placeFood();
        this.looper();
    }

    updateVector = (vector) => {
        vector.is_new = true;
        this.#previousVector = this.#vector;
        this.#vector = vector;
    }

    getVectorDelta = () => {
        return this.#vectorDelta;
    }

    constructor (canvasElem, innerWidth, innerHeight) {
        this.#canvas = canvasElem;
        this.setupCanvas(innerWidth, innerHeight);
        this.#context = this.#canvas.getContext('2d');
        this.#highScore = ScoreManager.getHighScore();

        this.reInit();
        let loaded = this.loadAssets();
        console.log('Loaded: ' + loaded);
    }

    subscribeToEvents= (listener) => {
        this.#viewListener = listener;
    }

    reInit = () => {
        this.resetSnake();
        this.placeFood();
    }

    pause = () => {
        this.#currentState = GameController.States.PAUSED;
        this.looper();
    }

    resume = () => {
        this.#currentState = GameController.States.RUNNING;
        this.looper();
    }

    isInit = () => {
        return this.#currentState == GameController.States.INIT;
    }

    isPaused = () => {
        return this.#currentState == GameController.States.PAUSED;
    }

    isRunning = () => {
        return this.#currentState == GameController.States.RUNNING;
    }

    isGameOver = () => {
        return this.#currentState == GameController.States.GAME_OVER;
    }
}


