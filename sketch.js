// === 全域變數定義 ===
let video;
let hands;
let videoCamera;
let predictions = [];
const canvasW = 640;
const canvasH = 480;

// 遊戲狀態機控制
// "START_MENU": 遊戲說明畫面
// "WAITING_FOR_ROUND": 等待出拳 (出拳滿2秒鎖定)
// "COUNTDOWN": 3秒倒數對決
// "ROUND_RESULT": 單局勝負結算
// "MATCH_OVER": 五戰三勝最終結果畫面
let gameState = "START_MENU"; 

// 猜拳與計分變數
let playerGesture = "等待出拳";
let aiGesture = "✊";
let gameResultText = "";
let playTimer = 0;
let countdownTimer = 3; // 3秒倒數
let lastCountdownTime = 0;

// 五戰三勝計分表
let playerScore = 0;
let aiScore = 0;
const WINNING_SCORE = 3; // 先拿3分者獲勝
let roundFeedbackText = ""; // 局半獲得一分提示

// === 新手勢控制變數 ===
let gestureTimer = 0;       // 蓄力計時器 (影格數)
const TRIGGER_FRAME = 45;   // 需維持手勢 45 影格 (約 1.5 秒)
let currentChoice = "NONE"; // 目前偵測到的選擇 "CONTINUE", "END", "START"

function setup() {
  let canvas = createCanvas(canvasW, canvasH);
  canvas.parent('canvas-holder');

  video = createCapture(VIDEO);
  video.size(canvasW, canvasH);
  video.hide();

  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });

  hands.onResults(onHandsResults);

  videoCamera = new Camera(video.elt, {
    onFrame: async () => {
      await hands.send({ image: video.elt });
    },
    width: canvasW,
    height: canvasH
  });
  videoCamera.start();
}

function draw() {
  // 畫面鏡像翻轉
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);

  if (predictions.length > 0) {
    let landmarks = predictions[0];
    drawSkeleton(landmarks);
    
    // 依據不同遊戲狀態處理特殊手勢
    if (gameState === "START_MENU" || gameState === "ROUND_RESULT" || gameState === "MATCH_OVER") {
      handleSpecialMenuGestures(landmarks);
    } 
    else if (gameState === "WAITING_FOR_ROUND") {
      handleRockPaperScissors(landmarks);
    }
  } else {
    // 沒偵測到手時重設計時器
    currentChoice = "NONE";
    gestureTimer = 0;
  }

  // 處理 3 秒倒數計時邏輯 (不依賴手勢，依賴時間)
  if (gameState === "COUNTDOWN") {
    runCountdownLogic();
  }

  // 繪製所有的 UI 與文字反饋
  drawUIOverlay();
}

function onHandsResults(results) {
  if (results.multiHandLandmarks) {
    predictions = results.multiHandLandmarks;
  } else {
    predictions = [];
  }
}

function drawSkeleton(hl) {
  for (let i = 0; i < hl.length; i++) {
    fill(0, 255, 204);
    noStroke();
    ellipse(hl[i].x * width, hl[i].y * height, 6, 6);
  }
}

// 基礎剪刀石頭布判定
function classifyRPS(hl) {
  let wrist = hl[0];
  let indexIsOpen = dist(hl[8].x, hl[8].y, wrist.x, wrist.y) > dist(hl[6].x, hl[6].y, wrist.x, wrist.y);
  let middleIsOpen = dist(hl[12].x, hl[12].y, wrist.x, wrist.y) > dist(hl[10].x, hl[10].y, wrist.x, wrist.y);
  let ringIsOpen = dist(hl[16].x, hl[16].y, wrist.x, wrist.y) > dist(hl[14].x, hl[14].y, wrist.x, wrist.y);
  let pinkyIsOpen = dist(hl[20].x, hl[20].y, wrist.x, wrist.y) > dist(hl[18].x, hl[18].y, wrist.x, wrist.y);

  if (!indexIsOpen && !middleIsOpen && !ringIsOpen && !pinkyIsOpen) return "✊ 石頭";
  if (indexIsOpen && middleIsOpen && ringIsOpen && pinkyIsOpen) return "🖐 布";
  if (indexIsOpen && middleIsOpen && !ringIsOpen && !pinkyIsOpen) return "✌️ 剪刀";
  return "準備出拳中";
}

// 核心手勢邏輯：🤙 (繼續/開始) 與 🖖 (結束)
function handleSpecialMenuGestures(hl) {
  let wrist = hl[0];
  let thumbIsOpen = dist(hl[4].x, hl[4].y, hl[17].x, hl[17].y) > dist(hl[3].x, hl[3].y, hl[17].x, hl[17].y);
  let indexIsOpen = dist(hl[8].x, hl[8].y, wrist.x, wrist.y) > dist(hl[6].x, hl[6].y, wrist.x, wrist.y);
  let middleIsOpen = dist(hl[12].x, hl[12].y, wrist.x, wrist.y) > dist(hl[10].x, hl[10].y, wrist.x, wrist.y);
  let ringIsOpen = dist(hl[16].x, hl[16].y, wrist.x, wrist.y) > dist(hl[14].x, hl[14].y, wrist.x, wrist.y);
  let pinkyIsOpen = dist(hl[20].x, hl[20].y, wrist.x, wrist.y) > dist(hl[18].x, hl[18].y, wrist.x, wrist.y);

  // 🤙 傲嬌/極客手勢：只有大拇指和小指張開，其餘三指緊握
  let isShaka = (thumbIsOpen && indexIsOpen === false && middleIsOpen === false && ringIsOpen === false && pinkyIsOpen === true);
  
  // 🖖 瓦肯手禮：四指伸直，但中指和無名指指尖距離要大 (X軸分開)
  let isVulcan = (indexIsOpen && middleIsOpen && ringIsOpen && pinkyIsOpen && abs(hl[12].x - hl[16].x) > 0.08);

  if (isShaka) {
    currentChoice = (gameState === "START_MENU") ? "START" : "CONTINUE";
    gestureTimer++;
  } else if (isVulcan) {
    currentChoice = "END";
    gestureTimer++;
  } else {
    currentChoice = "NONE";
    gestureTimer = 0;
  }

  // 蓄力全滿觸發
  if (gestureTimer >= TRIGGER_FRAME) {
    if (currentChoice === "START" || currentChoice === "CONTINUE") {
      if (gameState === "MATCH_OVER") restartGame();
      startCountdown(); // 進入3秒倒數
    } else if (currentChoice === "END") {
      gameState = "FINISHED";
    }
    gestureTimer = 0;
    currentChoice = "NONE";
  }
}

// 觸發 3 秒倒數對決
function startCountdown() {
  gameState = "COUNTDOWN";
  countdownTimer = 3;
  lastCountdownTime = millis();
}

// 倒數計時核心邏輯
function runCountdownLogic() {
  updateUIStatus("對決倒數中...");
  if (millis() - lastCountdownTime >= 1000) {
    countdownTimer--;
    lastCountdownTime = millis();
    
    // 倒數結束，立刻抓取此時玩家的手勢進行判定
    if (countdownTimer <= 0) {
      gameState = "WAITING_FOR_ROUND";
      playTimer = 0;
    }
  }
}

// 猜拳判定與計分
function handleRockPaperScissors(hl) {
  let currentHand = classifyRPS(hl);
  playerGesture = currentHand;
  playTimer++;
  
  // 鎖定手勢 1 秒 (30幀) 進行出拳決議
  if (playTimer > 30) {
    if (playerGesture === "準備出拳中") {
      playerGesture = "✊ 石頭"; // 沒出預設出石頭
    }
    
    const aiOptions = ["✊ 石頭", "✌️ 剪刀", "🖐 布"];
    aiGesture = random(aiOptions);
    
    // 勝負判定
    if (playerGesture === aiGesture) {
      gameResultText = "🤝 這一局平手！";
      roundFeedbackText = "";
    } else if (
      (playerGesture === "✊ 石頭" && aiGesture === "✌️ 剪刀") ||
      (playerGesture === "✌️ 剪刀" && aiGesture === "🖐 布") ||
      (playerGesture === "🖐 布" && aiGesture === "✊ 石頭")
    ) {
      gameResultText = "🔥 你贏了這一局！";
      playerScore++;
      roundFeedbackText = "✨ 恭喜獲得一分！ ✨";
    } else {
      gameResultText = "💀 電腦贏了這一局！";
      aiScore++;
      roundFeedbackText = "再接再厲！電腦拿到一分。";
    }
    
    playTimer = 0;
    
    // 檢查五戰三勝總結果
    if (playerScore >= WINNING_SCORE || aiScore >= WINNING_SCORE) {
      gameState = "MATCH_OVER";
    } else {
      gameState = "ROUND_RESULT"; // 還有局數，進入單局結算選單
    }
  }
}

// 渲染所有畫面 UI
function drawUIOverlay() {
  push();
  translate(width, 0);
  scale(-1, 1);
  textAlign(CENTER, CENTER);
  
  // 頂部永久計分板 (五戰三勝)
  drawScoreBoard();

  if (gameState === "START_MENU") {
    // 遊戲說明畫面
    drawOverlayBackground();
    fill(255, 204, 0); textSize(26); text("🤖 AI 猜拳五戰三勝大賽", width / 2, 80);
    
    textSize(16); fill(230);
    text("【遊戲規則說明】\n1. 比出特定手勢觸發開局，畫面會進入 3 秒對決倒數。\n2. 倒數歸零時，請對準相機擺出 ✊、✌️ 或 🖐。\n3. 本遊戲採用五戰三勝制，先獲得 3 分者成為大贏家！", width / 2, height / 2 - 20);
    
    drawGesturePrompt("🤙 比出此手勢「開始遊戲」", "🖖 比出此手勢「離開」");
    updateUIStatus("等待開始...");
  } 
  
  else if (gameState === "COUNTDOWN") {
    // 3秒倒數畫面
    drawOverlayBackground();
    textSize(100);
    fill(255, 51, 102);
    text(countdownTimer, width / 2, height / 2);
    textSize(22);
    fill(255);
    text("準備... 倒數結束時請出拳！", width / 2, height / 2 + 100);
  } 
  
  else if (gameState === "WAITING_FOR_ROUND") {
    // 拍照鎖定中
    textSize(20); fill(0, 255, 204);
    text("📸 正在鎖定手勢：" + playerGesture, width / 2, height - 40);
  } 
  
  else if (gameState === "ROUND_RESULT") {
    // 單局結果選單
    drawOverlayBackground();
    textSize(28); fill(255, 230, 100); text(gameResultText, width / 2, height / 2 - 100);
    textSize(20); fill(255); text("你出: " + playerGesture + "  vs  電腦出: " + aiGesture, width / 2, height / 2 - 50);
    
    // 小局反饋
    textSize(24); fill(0, 255, 153); text(roundFeedbackText, width / 2, height / 2 + 10);
    
    drawGesturePrompt("🤙 蓄力「進入下一局」", "🖖 蓄力「認輸離開」");
    updateUIStatus("單局結算");
  } 
  
  else if (gameState === "MATCH_OVER") {
    // 終極大勝選單
    drawOverlayBackground();
    if (playerScore >= WINNING_SCORE) {
      textSize(36); fill(0, 255, 204); text("🏆 恭喜大獲全勝！！！ 🏆", width / 2, height / 2 - 60);
      textSize(20); fill(255); text("你成功以 " + playerScore + " : " + aiScore + " 擊敗了強大的 AI！", width / 2, height / 2);
    } else {
      textSize(36); fill(255, 51, 51); text("❌ 殘念！最終敗北 ❌", width / 2, height / 2 - 60);
      textSize(20); fill(255); text("AI 以 " + aiScore + " : " + playerScore + " 贏得了最終勝利。", width / 2, height / 2);
    }
    
    drawGesturePrompt("🤙 蓄力「重開新賽局」", "🖖 蓄力「結束離開」");
    updateUIStatus("比賽總終結");
  } 
  
  else if (gameState === "FINISHED") {
    fill(10, 10, 15); rect(0, 0, width, height);
    textSize(32); fill(150); text("遊戲已安全結束", width / 2, height / 2);
    updateUIStatus("遊戲已退出");
  }

  // 渲染蓄力進度條
  if (currentChoice !== "NONE" && gestureTimer > 0) {
    drawProgressBar();
  }
  
  pop();
}

// 畫頂部精緻計分板
function drawScoreBoard() {
  fill(0, 0, 0, 120);
  rect(width / 2 - 140, 15, 280, 40, 20);
  textSize(16); textAlign(CENTER, CENTER);
  fill(255); text("玩家", width / 2 - 80, 35);
  text("AI", width / 2 + 80, 35);
  
  textSize(22); fill(0, 255, 204);
  text(playerScore, width / 2 - 35, 35);
  fill(255, 102, 102);
  text(aiScore, width / 2 + 35, 35);
  fill(200); textSize(14); text("vs", width / 2, 33);
}

function drawOverlayBackground() {
  fill(0, 0, 0, 200);
  rect(0, 0, width, height);
}

// 下方控制手勢提示
function drawGesturePrompt(leftTxt, rightTxt) {
  stroke(255, 50); line(40, height - 120, width - 40, height - 120); noStroke();
  textSize(16); 
  fill(102, 255, 153); text(leftTxt, width / 4 + 20, height - 90);
  fill(255, 102, 102); text(rightTxt, (width / 4) * 3 - 20, height - 90);
}

// 畫科技感進度條
function drawProgressBar() {
  stroke(255, 150); noFill();
  rect(width / 2 - 100, height - 50, 200, 12, 6);
  noStroke(); fill(0, 255, 204);
  let w = map(gestureTimer, 0, TRIGGER_FRAME, 0, 200);
  rect(width / 2 - 100, height - 50, w, 12, 6);
}

function updateUIStatus(msg) {
  let statusBar = document.getElementById('current-stage');
  if (statusBar) statusBar.innerText = msg;
}

// 重設為全新比賽
function restartGame() {
  playerScore = 0;
  aiScore = 0;
}