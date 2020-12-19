class GameView {
    window = null;
    #gameInterval = null;
    #gameAnimationFrame = null;

    #controller = null;

    #lastKeyIn = null;

    static normalModeFPS = 15;
    runNormalMode = () => {
        this.#gameInterval = window.setInterval(this.#controller.looper, 1000 / GameView.normalModeFPS);
    }

    runSmoothMode = () => {
        let frameLoop = () => {
            if (this.#SMOOTH) {
                this.#controller.looper();
                this.#gameAnimationFrame = window.requestAnimationFrame(frameLoop);
            }
        }
    
        this.#gameAnimationFrame = window.requestAnimationFrame(frameLoop);
    }

    pauseRender = () => {
        if (!this.#SMOOTH) {
            window.clearInterval(this.#gameInterval);
        } else {
            window.cancelAnimationFrame(this.#gameAnimationFrame);
        }
    }

    pauseGame = () => {
        this.pauseRender();
        this.#controller.pause();
    }
    
    resumeGame = () => {
        this.#controller.resume();
        
        if (!this.#SMOOTH) {
            this.runNormalMode();
        } else {
            this.runSmoothMode();
        }
    }

    #SMOOTH = false;
    enableSmoothMode = () => {
        window.clearInterval(this.#gameInterval);
        this.#controller.enableSmoothMode();
        this.#SMOOTH = true;
        
        this.runSmoothMode();
    }

    disableSmoothMode = () => {
        cancelAnimationFrame(this.#gameAnimationFrame);
        this.#controller.disableSmoothMode();
        this.#SMOOTH = false;

        this.runNormalMode();
    }

    constructor(window, gameController) {
        this.window = window;
        this.#controller = gameController;

        gameController.subscribeToEvents(this.gameListener);
    }

    gameListener = (event) => {
        let state = event.state;

        if (event.state == GameController.States.GAME_OVER) {
            this.pauseRender();
        }
    }

    #keyDebounce = (event) => {
        const keyCode = event.keyCode;
        let vector = { x: 0, y: 0 };
        let vectorDelta = this.#controller.getVectorDelta();

        //Update movement vectors
        switch (keyCode) {
            case 37:    //Arrow LEFT
                vector.x = -vectorDelta;
                break;

            case 38:    //Arrow UP
                vector.y = -vectorDelta;
                break;

            case 39:    //Arrow RIGHT
                vector.x = vectorDelta;
                break;

            case 40:    //Arrow DOWN
                vector.y = vectorDelta;
                break;

            case 83:    //Character S - for enabling smooth mode
                if (!this.#SMOOTH) {
                    this.enableSmoothMode();
                } else {
                    this.disableSmoothMode();
                } 

                break;

            case 32:    //Space key - for pausing or restarting game
                if (this.#controller.isPaused()) {
                    this.resumeGame();
                } else if (this.#controller.isRunning()) {
                    this.pauseGame();
                } else if (this.#controller.isGameOver()) {
                    this.#controller.reInit();
                    this.resumeGame();
                }
        }

        //Update vector if arrow keys were pressed
        if (keyCode >= 37 && keyCode <= 40) {
            this.#controller.updateVector(vector);

            if(this.#controller.isPaused() || this.#controller.isInit()) {
                this.resumeGame();
            }

            this.#lastKeyIn = keyCode;
        }
    }

    #keyTimeout = null;
    keyPushListener = (event) => {
        const keyCode = event.keyCode;

        //Allow only arrow key, space key and S key
        if ((keyCode < 37 || keyCode > 40) && keyCode != 32 && keyCode != 83) {
            return;
        }

        //Prevent attempting to move in opposite direction
        if (this.#controller.isRunning() && (keyCode == GameController.oppositeKeyMapping[this.#lastKeyIn] || keyCode == this.#lastKeyIn)) {
            return;
        }

        event.preventDefault();

        clearTimeout(this.#keyTimeout);
        this.#keyTimeout = setTimeout(() => { this.#keyDebounce(event); }, 10);     //Debouncing key events by 10ms to avoid duplicate input in-between frames
    }

    //For drawing initial frame
    initialize = () => {
        this.#controller.looper();
    }
}
