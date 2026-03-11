const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// 성능 최적화: 캔버스 크기를 윈도우 크기에 맞추되 해상도가 너무 높으면 조절 가능
canvasElement.width = window.innerWidth;
canvasElement.height = window.innerHeight;

let handX = null;
let handY = null;
let isPinching = false;
let explosionTriggered = false;

const particles = [];
const NUM_PARTICLES = 300; // Iris Xe에 최적화된 개수

class Particle {
    constructor() {
        this.init();
    }

    init() {
        this.x = Math.random() * canvasElement.width;
        this.y = Math.random() * canvasElement.height;
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = (Math.random() - 0.5) * 1;
        this.size = Math.random() * 2 + 0.5;

        // 우주 느낌의 색상 (흰색, 연청색, 보라색)
        const colors = ['#ffffff', '#a2e9ff', '#d4a2ff'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.alpha = Math.random(); // 반짝이는 느낌을 위한 투명도
    }

    update() {
        if (handX !== null && handY !== null) {
            let dx = handX - this.x;
            let dy = handY - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (isPinching) {
                if (distance < 400) {
                    let force = (400 - distance) / 400;
                    // 회전력을 가미해 소용돌이 느낌 추가
                    this.vx += (dx / distance) * force * 1.2 + (dy / distance) * 0.5;
                    this.vy += (dy / distance) * force * 1.2 - (dx / distance) * 0.5;
                }
            } else if (explosionTriggered) {
                if (distance < 300) {
                    let force = (300 - distance) / 300;
                    this.vx -= (dx / distance) * force * 40;
                    this.vy -= (dy / distance) * force * 40;
                }
            }
        }

        this.vx *= 0.95;
        this.vy *= 0.95;
        this.x += this.vx;
        this.y += this.vy;

        // 화면 밖으로 나가면 반대편 이동
        if (this.x < 0) this.x = canvasElement.width;
        if (this.x > canvasElement.width) this.x = 0;
        if (this.y < 0) this.y = canvasElement.height;
        if (this.y > canvasElement.height) this.y = 0;
    }

    draw(ctx) {
        // shadowBlur 대신 2중 원으로 글로우 효과 구현 (성능 비결)
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.3; // 바깥쪽 흐린 빛
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1.0; // 안쪽 밝은 핵
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push(new Particle());
}

function animate() {
    // 배경 그리기 (완전 검은색 유지)
    canvasCtx.globalCompositeOperation = 'source-over';
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.35)'; // 잔상 효과
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    // 파티클 그리기 (빛 합성 모드)
    canvasCtx.globalCompositeOperation = 'lighter';
    particles.forEach(p => {
        p.update();
        p.draw(canvasCtx);
    });

    if (explosionTriggered) explosionTriggered = false;

    // 손 중심점 표시
    if (handX !== null && handY !== null) {
        canvasCtx.globalAlpha = 0.5;
        canvasCtx.fillStyle = isPinching ? '#000000' : '#000000';
        canvasCtx.beginPath();
        canvasCtx.arc(handX, handY, 10, 0, Math.PI * 2);
        canvasCtx.fill();
        canvasCtx.globalAlpha = 1.0;
    }

    requestAnimationFrame(animate);
}
animate();

// --- MediaPipe 로직 (최적화 + 높은 정확도의 상태 머신 + 디버그 UI) ---
function onResults(results) {
    // 1. 디버그 텍스트 UI 요소 가져오기
    const handStateText = document.getElementById('hand-state-text');

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        const wrist = landmarks[0];
        const center = landmarks[9];

        handX = center.x * canvasElement.width;
        handY = center.y * canvasElement.height;

        // 💡 핵심 로직: 오타 수정 완료!
        const isFingerFolded = (tipIdx, pipIdx) => {
            const tip = landmarks[tipIdx];
            const pip = landmarks[pipIdx];

            const distTipToWrist = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
            // ✅ 아래 줄의 오타(괄호와 + 기호)를 수정했습니다.
            const distPipToWrist = Math.sqrt(Math.pow(pip.x - wrist.x, 2) + Math.pow(pip.y - wrist.y, 2));

            return distTipToWrist < distPipToWrist;
        };

        const fingersFolded = [
            isFingerFolded(8, 6),
            isFingerFolded(12, 10),
            isFingerFolded(16, 14),
            isFingerFolded(20, 18)
        ];

        const foldedCount = fingersFolded.filter(folded => folded === true).length;

        // 💡 상태 판정 및 디버그 UI 업데이트 로직 추가
        if (foldedCount >= 3) {
            isPinching = true;
            if (handStateText) {
                handStateText.innerText = "주먹 쥔 상태";
                handStateText.style.color = "#ff3366";
            }
        } else if (foldedCount <= 1) {
            if (isPinching === true) {
                explosionTriggered = true; 
            }
            isPinching = false;
            if (handStateText) {
                handStateText.innerText = "손 펴짐 상태";
                handStateText.style.color = "#00ffff";
            }
        } else {
            isPinching = false;
            if (handStateText) {
                handStateText.innerText = "생각중...";
                handStateText.style.color = "#cccccc";
            }
        }

    } else {
        handX = null;
        handY = null;
        isPinching = false;
        
        // 화면에서 손이 사라졌을 때
        if (handStateText) {
            handStateText.innerText = "손이 인식이 안됨";
            handStateText.style.color = "#ff0000";
        }
    }
}

const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0, // ⚡ 중요: Iris Xe를 위해 모델 경량화
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 480, // 입력 영상 해상도를 낮추면 성능이 더 좋아집니다.
    height: 360
});

const startBtn = document.getElementById('start-btn');
const homeBanner = document.getElementById('home-banner');
const debugUi = document.getElementById('debug-ui');

startBtn.addEventListener('click', () => {
    homeBanner.classList.add('hidden');
    debugUi.classList.remove('hidden');
    camera.start();
})