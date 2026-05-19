// === 全域變數定義 ===
let video;
let hands;
let videoCamera;
let predictions = [];
const canvasW = 640;
const canvasH = 480;

// 遊戲狀態機控制
// "PLAYING": 猜拳進行中, "GAME_OVER": 出現繼續/結束選單, "ENDED": 遊戲完全結束
let gameState = "PLAYING"; 

// 猜拳本身邏輯變數
let playerGesture = "等待出拳";
let aiGesture = "✊";
let gameResultText = "請出拳！";
let playTimer = 0;

// === 【作業核心：新手勢控制變數】 ===
let gestureTimer = 0;       // 蓄力計時器 (影格數)
const TRIGGER_FRAME = 45;   // 需維持手勢 45 影格 (約 1.5 秒)
let currentChoice = "NONE"; // 目前偵測到的選擇 "CONTINUE", "END", "NONE"

function setup() {
  // 建立畫布並綁定到 HTML 中的 id="canvas-holder" 節點
  let canvas = createCanvas(canvasW, canvasH);
  canvas.parent('canvas-holder');

  // 初始化相機
  video = createCapture(VIDEO);
  video.size(canvasW, canvasH);
  video.hide(); // 隱藏原生的 HTML video 標籤，改用 p5 重新繪製

  // 初始化 Google MediaPipe Hands
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

  // 啟動相機連續串流傳輸給 AI 模型
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
  // 畫面鏡像翻轉，讓玩家操作像照鏡子一樣直覺
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);

  // 如果有抓到手部特徵點
  if (predictions.length > 0) {
    let landmarks = predictions[0];
    
    // 畫出 AI 手部藍點骨架
    drawSkeleton(landmarks);
    
    // 依據目前遊戲狀態執行不同邏輯
    if (gameState === "PLAYING") {
      updateUIStatus("猜拳對決中");
      handleRockPaperScissors(landmarks);
    } 
    else if (gameState === "GAME_OVER") {
      updateUIStatus("遊戲結束選單");
      handleMenuState(landmarks); // 執行作業要求的新手勢選擇邏輯
    }
  } else {
    // 沒抓到手時，如果在選單狀態，要立刻重設計時器防止中斷
    if (gameState === "GAME_OVER") {
      currentChoice = "NONE";
      gestureTimer = 0;
    }
  }

  // 繪製遊戲對戰文字與選單畫面 (轉回正常文字方向)
  drawUIOverlay();
}

// 接收 MediaPipe AI 辨識回傳的結果
function onHandsResults(results) {
  if (results.multiHandLandmarks) {
    predictions = results.multiHandLandmarks;
  } else {
    predictions = [];
  }
}

// 畫出手指關節點與骨架
function drawSkeleton(hl) {
  for (let i = 0; i < hl.length; i++) {
    fill(0, 255, 204);
    noStroke();
    ellipse(hl[i].x * width, hl[i].y * height, 8, 8);
  }
}

// 基礎核心：猜拳手勢判定 (石頭、布、剪刀)
function classifyRPS(hl) {
  let wrist = hl[0];
  let indexIsOpen = dist(hl[8].x, hl[8].y, wrist.x, wrist.y) > dist(hl[6].x, hl[6].y, wrist.x, wrist.y);
  let middleIsOpen = dist(hl[12].x, hl[12].y, wrist.x, wrist.y) > dist(hl[10].x, hl[10].y, wrist.x, wrist.y);
  let ringIsOpen = dist(hl[16].x, hl[16].y, wrist.x, wrist.y) > dist(hl[14].x, hl[14].y, wrist.x, wrist.y);
  let pinkyIsOpen = dist(hl[20].x, hl[20].y, wrist.x, wrist.y) > dist(hl[18].x, hl[18].y, wrist.x, wrist.y);

  if (!indexIsOpen && !middleIsOpen && !ringIsOpen && !pinkyIsOpen) return "✊ 石頭";
  if (indexIsOpen && middleIsOpen && ringIsOpen && pinkyIsOpen) return "🖐 布";
  if (indexIsOpen && middleIsOpen && !ringIsOpen && !pinkyIsOpen) return "✌️ 剪刀";
  return "未知";
}

// 猜拳階段邏輯
function handleRockPaperScissors(hl) {
  let currentHand = classifyRPS(hl);
  if (currentHand !== "未知") {
    playerGesture = currentHand;
    playTimer++;
    
    // 持續出拳滿 2 秒 (60幀) 判定為出拳定案，進入結算選單
    if (playTimer > 60) {
      const aiOptions = ["✊ 石頭", "✌️ 剪刀", "🖐 布"];
      aiGesture = random(aiOptions);
      
      // 簡單勝負對決字串判斷
      if (playerGesture === aiGesture) gameResultText = "平手！";
      else if (
        (playerGesture === "✊ 石頭" && aiGesture === "✌️ 剪刀") ||
        (playerGesture === "✌️ 剪刀" && aiGesture === "🖐 布") ||
        (playerGesture === "🖐 布" && aiGesture === "✊ 石頭")
      ) {
        gameResultText = "🎉 你贏了！";
      } else {
        gameResultText = "❌ 你輸了！";
      }
      
      playTimer = 0;
      gameState = "GAME_OVER"; // 轉換到繼續/結束的選單狀態
    }
  } else {
    playTimer = 0;
  }
}

// === 【作業核心修改：大拇指選擇邏輯與防誤判計時】 ===
function handleMenuState(landmarks) {
  let thumbTip = landmarks[4];
  let thumbBase = landmarks[2];
  
  let wrist = landmarks[0];
  let indexIsOpen = dist(landmarks[8].x, landmarks[8].y, wrist.x, wrist.y) > dist(landmarks[6].x, landmarks[6].y, wrist.x, wrist.y);
  let middleIsOpen = dist(landmarks[12].x, landmarks[12].y, wrist.x, wrist.y) > dist(landmarks[10].x, landmarks[10].y, wrist.x, wrist.y);
  let ringIsOpen = dist(landmarks[16].x, landmarks[16].y, wrist.x, wrist.y) > dist(landmarks[14].x, landmarks[14].y, wrist.x, wrist.y);
  let pinkyIsOpen = dist(landmarks[20].x, landmarks[20].y, wrist.x, wrist.y) > dist(landmarks[18].x, landmarks[18].y, wrist.x, wrist.y);
  
  // 確保其他四指是握拳收起的 (進階防誤判)
  let otherFingersClosed = (!indexIsOpen && !middleIsOpen && !ringIsOpen && !pinkyIsOpen);

  if (otherFingersClosed && thumbTip.y < thumbBase.y) {
    // 👍 大拇指朝上 (網頁座標 Y 軸向上為小)
    currentChoice = "CONTINUE";
    gestureTimer++;
  } else if (otherFingersClosed && thumbTip.y > thumbBase.y) {
    // 👎 大拇指朝下
    currentChoice = "END";
    gestureTimer++;
  } else {
    // 手勢放開或不符，計時器歸零重置
    currentChoice = "NONE";
    gestureTimer = 0;
  }

  // 觸發條件達成 (滿 1.5 秒)
  if (gestureTimer >= TRIGGER_FRAME) {
    if (currentChoice === "CONTINUE") {
      restartGame();
    } else if (currentChoice === "END") {
      exitGame();
    }
    gestureTimer = 0;
    currentChoice = "NONE";
  }
}

// 繪製遊戲文字與選單視覺效果
function drawUIOverlay() {
  push();
  // 將翻轉的畫布轉回正常方向繪製文字，避免文字顛倒
  translate(width, 0);
  scale(-1, 1);
  
  textAlign(CENTER, CENTER);
  
  if (gameState === "PLAYING") {
    // 進行中畫面
    textSize(22);
    fill(255);
    text("請對著相機擺出出拳手勢...", width / 2, 40);
    
    textSize(20);
    fill(0, 255, 204);
    text("你目前準備出：" + playerGesture, width / 2, height - 50);
    
    // 出拳蓄力條
    if (playTimer > 0) {
      stroke(0, 255, 204);
      noFill();
      rect(width/2 - 100, height - 25, 200, 10, 5);
      noStroke();
      fill(0, 255, 204);
      rect(width/2 - 100, height - 25, map(playTimer, 0, 60, 0, 200), 10, 5);
    }
  } 
  else if (gameState === "GAME_OVER") {
    // 遊戲結束，顯示輸贏與「繼續/結束」新手勢選單
    fill(0, 0, 0, 180);
    rect(0, 0, width, height); // 半透明背景遮罩
    
    textSize(32);
    fill(255, 204, 0);
    text(gameResultText, width / 2, height / 2 - 100);
    
    textSize(20);
    fill(255);
    text("電腦出: " + aiGesture + "  |  你出: " + playerGesture, width / 2, height / 2 - 50);
    
    // 選單分隔線
    stroke(255, 100);
    line(50, height/2, width-50, height/2);
    
    noStroke();
    textSize(22);
    fill(102, 255, 102);
    text("👍 繼續玩一局", width / 4 + 30, height / 2 + 50);
    fill(255, 102, 102);
    text("👎 結束離開", (width / 4) * 3 - 30, height / 2 + 50);
    
    // 【加分項目：繪製手勢蓄力視覺回饋】
    if (currentChoice !== "NONE") {
      fill(255);
      textSize(18);
      if (currentChoice === "CONTINUE") text("偵測到【👍 繼續】，請維持...", width / 2, height - 80);
      if (currentChoice === "END") text("偵測到【👎 結束】，請維持...", width / 2, height - 80);
      
      // 進度條外框
      stroke(255);
      noFill();
      rect(width / 2 - 100, height - 55, 200, 15, 5);
      // 綠色蓄力進度
      noStroke();
      fill(0, 255, 204);
      let pWidth = map(gestureTimer, 0, TRIGGER_FRAME, 0, 200);
      rect(width / 2 - 100, height - 55, pWidth, 15, 5);
    } else {
      fill(200);
      textSize(16);
      text("(請對鏡頭比出 👍 或 👎 來選擇選單項目)", width / 2, height - 60);
    }
  } 
  else if (gameState === "ENDED") {
    // 完全結束畫面
    fill(15, 15, 26);
    rect(0, 0, width, height);
    
    textAlign(CENTER, CENTER);
    textSize(36);
    fill(255, 51, 51);
    text("遊戲已結束", width / 2, height / 2 - 20);
    textSize(18);
    fill(150);
    text("感謝您的遊玩！請關閉網頁分頁。", width / 2, height / 2 + 30);
    updateUIStatus("已離開遊戲");
  }
  
  pop();
}

// 重新開始遊戲
function restartGame() {
  gameState = "PLAYING";
  playerGesture = "等待出拳";
  gameResultText = "請出拳！";
  playTimer = 0;
}

// 結束並退出遊戲
function exitGame() {
  gameState = "ENDED";
}

// 更新網頁 HTML 的文字狀態列
function updateUIStatus(msg) {
  let statusBar = document.getElementById('current-stage');
  if (statusBar) {
    statusBar.innerText = msg;
  }
}