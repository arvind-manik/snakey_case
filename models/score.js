ScoreManager = {
    HIGH_SCORE_KEY: 'hs',

    checkAndUpdateHighScore: (score) => {
        let existingHighScore = ScoreManager.getHighScore();

        const isNewHighScore = existingHighScore < score;
        if (isNewHighScore) {
            localStorage.setItem(ScoreManager.HIGH_SCORE_KEY, score);
        }

        return isNewHighScore;
    },

    getHighScore: () => {
        const highScore = localStorage.getItem(ScoreManager.HIGH_SCORE_KEY);
        return highScore != null ? highScore : 0;
    }
}