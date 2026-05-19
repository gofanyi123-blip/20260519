// sketch.js
let video;
let hands;
let camera;
let predictions = [];
const width = 640;
const height = 480;

function setup() {
  // 建立畫布，並對齊 HTML 中 id 為 canvas-holder 的標籤
  let canvas = createCanvas(width, height);
  canvas.parent('canvas-holder');

  // 初始化攝影機擷取
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide(); // 隱藏 HTML 的預設 video 元件，由 p5 負責繪製

  // 初始化 Google MediaPipe Hands 模型
  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  // 設定 AI 辨識參數
  hands.setOptions({
    maxNumHands: 1,             // 同時最多偵測一隻手
    modelComplexity: 1,         // 模型複雜度 (0 輕量, 1 精準)
    minDetectionConfidence: 0.7, // 當信心值高於 70% 才判定為手掌
    minTrackingConfidence: 0.7   // 當追蹤信心值高於 70% 才進行連續追蹤
  });

  // 設定當辨識出結果時的回呼函式 (Callback)
  hands.onResults(onHandsResults);

  // 建立攝影機連續串流，將畫面丟給 AI 模型處理
  camera = new Camera(video.elt, {
    onFrame: async () => {
      await hands.send({ image: video.elt });
    },
    width: width,
    height: height
  });
  camera.start();
}

function draw() {
  // 將畫布水平翻轉（鏡像處理），這樣使用者在照鏡子時操作會比較直覺
  translate(width, 0);
  scale(-1, 1);
  
  // 將攝影機目前的影格畫在畫布上
  image(video, 0, 0, width, height);

  // 如果 AI 有成功抓到手部特徵點
  if (predictions.length > 0) {
    let landmarks = predictions[0];
    
    // 呼叫自訂函式：畫出綠色的手指關節與骨架
    drawHandSkeleton(landmarks);
    
    // 呼叫自訂函式：判斷目前的猜拳狀態
    let gesture = classifyGesture(landmarks);
    
    // 將結果更新到網頁 HTML 的指定區塊中
    updateUIResult(gesture);
  } else {
    updateUIResult("未偵測到手部");
  }
}

// 當 MediaPipe 回傳辨識資料時觸發
function onHandsResults(results) {
  if (results.multiHandLandmarks) {
    predictions = results.multiHandLandmarks; // 儲存 21 個手部特徵點座標
  } else {
    predictions = [];
  }
}

// 繪製手部關節點與骨架連線
function drawHandSkeleton(hl) {
  // 1. 畫出手指的關節點
  for (let i = 0; i < hl.length; i++) {
    let x = hl[i].x * width;
    let y = hl[i].y * height;
    fill(255, 50, 50);
    noStroke();
    ellipse(x, y, 10, 10);
  }

  // 2. 畫出重點骨架連線（以食指為例：5->6->7->8）
  stroke(0, 255, 0);
  strokeWeight(3);
  noFill();
  
  // 這裡可以根據需要利用 beginShape() 畫出完整五指連線
  // 簡化示範核心節點連線：
  for(let j = 0; j < 5; j++) {
    let base = 1 + j * 4;
    line(hl[0].x * width, hl[0].y * height, hl[base].x * width, hl[base].y * height);
    for(let k = 0; k < 3; k++) {
      line(hl[base+k].x * width, hl[base+k].y * height, hl[base+k+1].x * width, hl[base+k+1].y * height);
    }
  }
}

// 演算法：透過比對手指尖端與關節的 Y 軸相對位置，判斷手指是張開或收起
function classifyGesture(hl) {
  // MediaPipe 關節代號：
  // 食指尖: 8, 食指第二關節: 6
  // 中指尖: 12, 中指第二關節: 10
  // 無名指尖: 16, 無名指第二關節: 14
  // 小指尖: 20, 小指第二關節: 18
  
  let indexIsOpen = hl[8].y < hl[6].y;
  let middleIsOpen = hl[12].y < hl[10].y;
  let ringIsOpen = hl[16].y < hl[14].y;
  let pinkyIsOpen = hl[20].y < hl[18].y;

  // 判斷邏輯：
  // ✊ 石頭：四根手指全部握起來（尖端位置低於關節）
  if (!indexIsOpen && !middleIsOpen && !ringIsOpen && !pinkyIsOpen) {
    return "✊ 石頭";
  }
  
  // 🖐 布：四根手指全部伸直
  if (indexIsOpen && middleIsOpen && ringIsOpen && pinkyIsOpen) {
    return "🖐 布";
  }
  
  // ✌️ 剪刀：只有食指、中指伸直，其餘握起
  if (indexIsOpen && middleIsOpen && !ringIsOpen && !pinkyIsOpen) {
    return "✌️ 剪刀";
  }

  return "正在思考手勢...";
}

// 安全更新 HTML 文字
function updateUIResult(text) {
  let resultElement = document.getElementById('result');
  if (resultElement) {
    resultElement.innerText = text;
  }
}