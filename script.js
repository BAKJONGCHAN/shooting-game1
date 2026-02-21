// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const quizCountDisplay = document.getElementById('quiz-count-display'); // 퀴즈 카운터
const quizModal = document.getElementById('quiz-modal');
const quizQuestion = document.getElementById('quiz-question');
const quizImage = document.getElementById('quiz-image');
const quizOptionsContainer = document.getElementById('quiz-options');
const quizFeedback = document.getElementById('quiz-feedback');
const playerSprite = document.getElementById('player-sprite');
const startMessage = document.getElementById('start-message');
const gameOverOverlay = document.getElementById('game-over');
const finalResultsOverlay = document.getElementById('final-results'); // 최종 결과 오버레이
const finalResultsContent = document.getElementById('final-results-content'); // 결과 내용 컨테이너
const restartButton = document.getElementById('restart-button'); // 다시 시작 버튼

// --- Game Constants ---
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 40;
const ENEMY_WIDTH = 30;
const ENEMY_HEIGHT = 30;
const MISSILE_WIDTH = 5;
const MISSILE_HEIGHT = 10;
const JEWEL_RADIUS = 10;

const PLAYER_SPEED = 5;
const MISSILE_SPEED = 7;
const ENEMY_SPEED_Y = 0.8;
const ENEMY_SPEED_X_BASE = 1.5;
const ENEMY_MISSILE_SPEED = 4;
const ENEMY_SHOOT_PROBABILITY = 0.002;
const PLAYER_SHOOT_COOLDOWN = 200; // ms
const TOTAL_QUIZZES = 4; // 퀴즈 총 개수

// --- Game State Variables ---
let score = 0;
let gameState = 'START'; // START, PLAYING, QUIZ, GAMEOVER, FINAL_WIN
let player;
let enemies = [];
let playerMissiles = [];
let enemyMissiles = [];
let jewels = [];
let keys = {};
let lastPlayerShotTime = 0;
let currentWaveSize = 5;
let lastEnemyDestroyedPos = null;
let playerImageLoaded = false;
let animationFrameId = null;
let correctQuizCount = 0; // 맞춘 퀴즈 개수
let completedQuizzes = []; // 완료된 퀴즈 정보 저장 배열

// --- Quiz Data ---
const QUIZ_DATA = [
    { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Meisje_met_de_parel.jpg/500px-Meisje_met_de_parel.jpg", title: "진주 귀걸이를 한 소녀", artist: "요하네스 베르메르", other_titles: ["모나리자", "별이 빛나는 밤", "인상, 해돋이"], other_artists: ["레오나르도 다 빈치", "빈센트 반 고흐", "클로드 모네"] },
    { url: "https://img1.yna.co.kr/etc/inner/KR/2024/11/16/AKR20241116041600005_04_i_P4.jpg", title: "자화상", artist: "빈센트 반 고흐", other_titles: ["게르니카", "기억의 지속", "수련"], other_artists: ["파블로 피카소", "살바도르 달리", "클로드 모네"] },
    { url: "https://cdn.kidshankook.kr/news/photo/202406/10628_28020_2640.jpg", title: "절규", artist: "에드바르 뭉크", other_titles: ["아메리칸 고딕", "밤샘하는 사람들", "키스"], other_artists: ["그랜트 우드", "에드워드 호퍼", "구스타프 클림트"] },
    { url: "https://cdn.labortoday.co.kr/news/photo/201906/159030_72361_0628.jpg", title: "씨뿌리는 사람", artist: "밀레", other_titles: ["풀밭 위의 점심 식사", "만종", "이삭 줍는 사람들"], other_artists: ["에두아르 마네", "장 오귀스트 도미니크 앵그르", "구스타브 쿠르베"] }
];
let currentQuiz = null;
let currentQuizQuestionType = '';
let quizInteractionDisabled = false;
let activeQuizTimeouts = []; // 현재 활성화된 퀴즈 관련 setTimeout ID 저장

// --- Classes (using functions/objects for simplicity here) ---

function createPlayer(x, y) {
    return {
        x: x, y: y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, speed: PLAYER_SPEED,
        draw() {
            if (playerImageLoaded) {
                ctx.drawImage(playerSprite, this.x, this.y, this.width, this.height);
            } else {
                ctx.fillStyle = 'blue';
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        },
        update() {
            let moveX = 0;
            let moveY = 0;
            if (keys['ArrowLeft']) moveX -= this.speed;
            if (keys['ArrowRight']) moveX += this.speed;
            if (keys['ArrowUp']) moveY -= this.speed;
            if (keys['ArrowDown']) moveY += this.speed;

            this.x += moveX;
            this.y += moveY;

            if (this.x < 0) this.x = 0;
            if (this.x + this.width > SCREEN_WIDTH) this.x = SCREEN_WIDTH - this.width;
            if (this.y < 0) this.y = 0;
            if (this.y + this.height > SCREEN_HEIGHT) this.y = SCREEN_HEIGHT - this.height;
        },
        shoot() {
            const now = Date.now();
            if (now - lastPlayerShotTime > PLAYER_SHOOT_COOLDOWN) {
                lastPlayerShotTime = now;
                playerMissiles.push(createMissile(this.x + this.width / 2 - MISSILE_WIDTH / 2, this.y, -MISSILE_SPEED, 'lightblue'));
            }
        }
    };
}

function createEnemy(x, y) {
    return {
        x: x, y: y, width: ENEMY_WIDTH, height: ENEMY_HEIGHT,
        speedY: ENEMY_SPEED_Y,
        speedX: Math.random() < 0.5 ? ENEMY_SPEED_X_BASE : -ENEMY_SPEED_X_BASE,
        amplitude: Math.random() * 2 + 1,
        initialY: y,
        draw() {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        },
        update() {
            this.y += this.speedY;
            const zigzagOffset = this.amplitude * Math.sin(this.y * 0.05);
            this.x += this.speedX + zigzagOffset;

            if (this.x <= 0 || this.x + this.width >= SCREEN_WIDTH) {
                this.speedX *= -1;
                 this.x = Math.max(0, Math.min(this.x, SCREEN_WIDTH - this.width));
            }

            if (gameState === 'PLAYING' && Math.random() < ENEMY_SHOOT_PROBABILITY) { // Only shoot when playing
                this.shoot();
            }
        },
         shoot() {
              enemyMissiles.push(createMissile(this.x + this.width / 2 - MISSILE_WIDTH / 2, this.y + this.height, ENEMY_MISSILE_SPEED, 'pink'));
         }
    };
}

function createMissile(x, y, speedY, color) {
    return {
        x: x, y: y, width: MISSILE_WIDTH, height: MISSILE_HEIGHT, speedY: speedY, color: color,
        draw() {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        },
        update() {
            this.y += this.speedY;
        }
    };
}

function createJewel(x, y) {
    return {
        x: x, y: y, radius: JEWEL_RADIUS,
        draw() {
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        },
        update() {}
    };
}

// --- Helper Functions ---

function spawnEnemies(count) {
    enemies = [];
    for (let i = 0; i < count; i++) {
        const x = Math.random() * (SCREEN_WIDTH - ENEMY_WIDTH * 2) + ENEMY_WIDTH;
        const y = Math.random() * -100 - ENEMY_HEIGHT;
        enemies.push(createEnemy(x, y));
    }
    lastEnemyDestroyedPos = null;
}


function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function isCollidingCircleRect(circle, rect) {
    let closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    let closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
    let distanceX = circle.x - closestX;
    let distanceY = circle.y - closestY;
    let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    return distanceSquared < (circle.radius * circle.radius);
}


function updateScore(newScore) {
    score = newScore;
    scoreDisplay.textContent = `Score: ${score}`;
}

function updateQuizCount(count) {
    correctQuizCount = count;
    quizCountDisplay.textContent = `맞춘 퀴즈: ${correctQuizCount} / ${TOTAL_QUIZZES}`;
}


function clearCanvas() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

function clearActiveQuizTimeouts() {
    activeQuizTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    activeQuizTimeouts = [];
}


function initGame() {
    updateScore(0);
    updateQuizCount(0);
    completedQuizzes = [];
    gameState = 'PLAYING';
    player = createPlayer(SCREEN_WIDTH / 2 - PLAYER_WIDTH / 2, SCREEN_HEIGHT - PLAYER_HEIGHT - 10);
    enemies = [];
    playerMissiles = [];
    enemyMissiles = [];
    jewels = [];
    keys = {};
    lastPlayerShotTime = 0;
    gameOverOverlay.style.display = 'none';
    startMessage.style.display = 'none';
    quizModal.style.display = 'none';
    finalResultsOverlay.style.display = 'none';
    spawnEnemies(currentWaveSize);

    clearActiveQuizTimeouts();

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    gameLoop();
}

// --- Quiz Functions ---

function startQuiz() {
    clearActiveQuizTimeouts();
    gameState = 'QUIZ';
    quizInteractionDisabled = false;

    const availableQuizzes = QUIZ_DATA.filter(q => !completedQuizzes.some(cq => cq.url === q.url));
    if (availableQuizzes.length === 0) {
         console.error("No available quizzes left, but startQuiz was called.");
         endQuiz();
         return;
    }
    currentQuiz = availableQuizzes[Math.floor(Math.random() * availableQuizzes.length)];

    quizImage.src = currentQuiz.url;
    quizImage.onerror = () => {
        console.error("Failed to load quiz image:", currentQuiz.url);
        quizFeedback.textContent = "이미지 로딩 실패!";
        quizFeedback.className = 'incorrect';
        quizInteractionDisabled = true;
        const timeoutId = setTimeout(() => {
             activeQuizTimeouts = activeQuizTimeouts.filter(id => id !== timeoutId);
             endQuiz();
        }, 2000);
         activeQuizTimeouts.push(timeoutId);
    };
    quizImage.onload = () => {
         displayQuizQuestion('title');
         quizModal.style.display = 'flex';
    }
}

function displayQuizQuestion(type) {
    clearActiveQuizTimeouts();
    currentQuizQuestionType = type;
    quizInteractionDisabled = false;
    quizFeedback.textContent = '';
    quizOptionsContainer.innerHTML = '';

    let questionText = '';
    let correctAnswer = '';
    let incorrectOptions = [];

    if (type === 'title') {
        questionText = "이 그림의 제목은 무엇일까요?";
        correctAnswer = currentQuiz.title;
        incorrectOptions = currentQuiz.other_titles;
    } else {
        questionText = "이 그림을 그린 화가는 누구일까요?";
        correctAnswer = currentQuiz.artist;
        incorrectOptions = currentQuiz.other_artists;
    }

    quizQuestion.textContent = questionText;

    let options = [...incorrectOptions.slice(0, 3), correctAnswer];
    options.sort(() => Math.random() - 0.5);

    options.forEach(option => {
        const button = document.createElement('button');
        button.textContent = option;
        button.classList.add('quiz-option-button');
        button.onclick = () => {
             if (!quizInteractionDisabled) {
                checkAnswer(option);
             }
        };
        quizOptionsContainer.appendChild(button);
    });
}

function checkAnswer(selectedOption) {
    clearActiveQuizTimeouts();
    quizInteractionDisabled = true;

    let correctAnswer = (currentQuizQuestionType === 'title') ? currentQuiz.title : currentQuiz.artist;
    let timeoutId;

    if (selectedOption === correctAnswer) {
        quizFeedback.textContent = "잘했어요. 정답입니다!";
        quizFeedback.className = 'correct';

        if (currentQuizQuestionType === 'title') {
            timeoutId = setTimeout(() => {
                 activeQuizTimeouts = activeQuizTimeouts.filter(id => id !== timeoutId);
                 displayQuizQuestion('artist');
            }, 1000);
             activeQuizTimeouts.push(timeoutId);
        } else {
            if (!completedQuizzes.some(cq => cq.url === currentQuiz.url)) {
                 completedQuizzes.push(currentQuiz);
                 updateQuizCount(correctQuizCount + 1);
            }
             updateScore(score + 100); // 점수는 아티스트 맞출 때만 추가

            if (correctQuizCount >= TOTAL_QUIZZES) {
                 timeoutId = setTimeout(() => {
                      activeQuizTimeouts = activeQuizTimeouts.filter(id => id !== timeoutId);
                      handleFinalWin();
                 }, 1500);
                  activeQuizTimeouts.push(timeoutId);
            } else {
                 timeoutId = setTimeout(() => {
                     activeQuizTimeouts = activeQuizTimeouts.filter(id => id !== timeoutId);
                     endQuiz();
                 }, 1500);
                  activeQuizTimeouts.push(timeoutId);
            }
        }
    } else {
        quizFeedback.textContent = "오답입니다. 다시 한 번 더 생각해 보세요";
        quizFeedback.className = 'incorrect';
         timeoutId = setTimeout(() => {
             activeQuizTimeouts = activeQuizTimeouts.filter(id => id !== timeoutId);
             endQuiz();
         }, 2000);
          activeQuizTimeouts.push(timeoutId);
    }
}

function endQuiz() {
    clearActiveQuizTimeouts();
    quizModal.style.display = 'none';
    quizImage.src = "";
    if (gameState === 'QUIZ') {
        gameState = 'PLAYING';
    }
    quizInteractionDisabled = false;

    if (gameState === 'PLAYING' && enemies.length === 0 && jewels.length === 0) {
        spawnEnemies(currentWaveSize);
    }

    if (!animationFrameId && gameState === 'PLAYING') {
        gameLoop();
    }
}

// --- Game Over & Win Functions ---
function handleGameOver() {
    clearActiveQuizTimeouts();
    gameState = 'GAMEOVER';
    gameOverOverlay.style.display = 'flex';
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// *** MODIFIED handleFinalWin function ***
function handleFinalWin() {
    clearActiveQuizTimeouts(); // 진행 중이던 퀴즈 타임아웃 제거
    quizModal.style.display = 'none'; // <<< 퀴즈 모달 숨기는 코드 추가!
    gameState = 'FINAL_WIN';
    populateFinalResults();
    finalResultsOverlay.style.display = 'flex';
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}
// *** END of MODIFIED handleFinalWin function ***

function populateFinalResults() {
    finalResultsContent.innerHTML = '';
    QUIZ_DATA.forEach(quiz => {
        if (completedQuizzes.some(cq => cq.url === quiz.url)) {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('result-item');

            const img = document.createElement('img');
            img.src = quiz.url;
            img.alt = quiz.title;

            const infoDiv = document.createElement('div');
            infoDiv.classList.add('result-item-info');

            const title = document.createElement('h3');
            title.textContent = quiz.title;

            const artist = document.createElement('p');
            artist.textContent = quiz.artist;

            infoDiv.appendChild(title);
            infoDiv.appendChild(artist);
            itemDiv.appendChild(img);
            itemDiv.appendChild(infoDiv);
            finalResultsContent.appendChild(itemDiv);
        }
    });
}


// --- Input Handling ---
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (gameState === 'PLAYING' && e.key === ' ') {
        e.preventDefault();
        player.shoot();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

startMessage.addEventListener('click', initGame);
gameOverOverlay.addEventListener('click', initGame);
restartButton.addEventListener('click', initGame);


// --- Main Game Loop ---
function gameLoop() {
    if (gameState === 'START' || gameState === 'GAMEOVER' || gameState === 'FINAL_WIN') {
        animationFrameId = null;
        return;
    }

    if (gameState === 'PLAYING') {
        clearCanvas();

        // Updates
        player.update();

        playerMissiles = playerMissiles.filter(m => m.y + m.height > 0);
        playerMissiles.forEach(m => m.update());
        enemyMissiles = enemyMissiles.filter(m => m.y < SCREEN_HEIGHT);
        enemyMissiles.forEach(m => m.update());

        lastEnemyDestroyedPos = null;
        enemies = enemies.filter(e => e.y < SCREEN_HEIGHT + e.height);
        enemies.forEach(e => e.update());

        jewels.forEach(j => j.update());


        // Collision Detection
        for (let i = playerMissiles.length - 1; i >= 0; i--) {
             if (!playerMissiles[i]) continue;
            for (let j = enemies.length - 1; j >= 0; j--) {
                 if (!enemies[j]) continue;
                if (isColliding(playerMissiles[i], enemies[j])) {
                    updateScore(score + 10);
                    lastEnemyDestroyedPos = { x: enemies[j].x + enemies[j].width / 2, y: enemies[j].y + enemies[j].height / 2 };
                    enemies.splice(j, 1);
                    playerMissiles.splice(i, 1);
                    break;
                }
            }
        }

         for (let i = enemyMissiles.length - 1; i >= 0; i--) {
              if (!enemyMissiles[i]) continue;
            if (isColliding(enemyMissiles[i], player)) {
                enemyMissiles.splice(i, 1);
                handleGameOver();
                return;
            }
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
             if (!enemies[i]) continue;
            if (isColliding(player, enemies[i])) {
                 handleGameOver();
                 return;
            }
        }

        for (let i = jewels.length - 1; i >= 0; i--) {
            if (isCollidingCircleRect(jewels[i], player)) {
                jewels.splice(i, 1);
                startQuiz();
                break;
            }
        }

        // Wave Clear & Jewel Spawn
        if (enemies.length === 0 && jewels.length === 0 && gameState === 'PLAYING') {
            if (lastEnemyDestroyedPos) {
                jewels.push(createJewel(lastEnemyDestroyedPos.x, lastEnemyDestroyedPos.y));
                lastEnemyDestroyedPos = null;
            } else {
                // 적을 모두 격추시키지 못했더라도 화면 밖으로 사라지면 다음 웨이브를 생성
                spawnEnemies(currentWaveSize);
            }
        }

        // Drawing
        player.draw();
        enemies.forEach(e => e.draw());
        playerMissiles.forEach(m => m.draw());
        enemyMissiles.forEach(m => m.draw());
        jewels.forEach(j => j.draw());

    } // End of PLAYING state logic

    // Request Next Frame (only if game should continue)
    if (gameState === 'PLAYING' || gameState === 'QUIZ') {
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
         animationFrameId = null; // Explicitly clear if not playing or quiz
    }
}

// --- Initial Setup ---
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

playerSprite.onload = () => {
    playerImageLoaded = true;
    startMessage.style.display = 'flex';
};
playerSprite.onerror = () => {
     console.error("Player image failed to load!");
     playerImageLoaded = false;
     startMessage.style.display = 'flex';
if (playerSprite.complete && playerSprite.naturalHeight !== 0) {
     playerSprite.onload();

}
