import * as THREE from "three";

const lanes = [-3, 0, 3];
const playerZ = 4;
const scene = new THREE.Scene();
const clock = new THREE.Clock();
const objects = [];
const roadSegments = [];
const environmentSegments = [];
let camera, renderer, player, mixer;
let lane = 1, verticalVelocity = 0, running = false, elapsed = 0, spawnTimer = 0;
let score = 0, coins = 0, highScore = Number(localStorage.getItem("pesatRunnerHighScore")) || 0;
let audioContext;

const ui = {
  score: document.querySelector("#score"), coins: document.querySelector("#coins"),
  speed: document.querySelector("#speed"), menu: document.querySelector("#menu"),
  over: document.querySelector("#game-over"), menuHigh: document.querySelector("#menu-high-score"),
  finalScore: document.querySelector("#final-score"), finalCoins: document.querySelector("#final-coins"),
  finalHigh: document.querySelector("#final-high-score"), bonus: document.querySelector("#bonus"),
};

function initScene() {
  scene.background = new THREE.Color(0x70c9ed);
  scene.fog = new THREE.Fog(0x70c9ed, 35, 110);
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 180);
  camera.position.set(0, 6.3, 11);
  camera.lookAt(0, 1.4, -25);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  document.querySelector("#game").prepend(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xe4f7ff, 0x4e6b3a, 2));
  const sunlight = new THREE.DirectionalLight(0xfff1d5, 2);
  sunlight.position.set(-12, 20, 8); sunlight.castShadow = true; scene.add(sunlight);
  createWorld();
  player = createPlayer();
  scene.add(player);
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  });
}

function createWorld() {
  createRoad();
  createEnvironment();
}

function createRoad() {
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x30343b, roughness: 1 });
  const curbMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e5e5 });
  for (let z = -80; z <= 24; z += 12) {
    const segment = new THREE.Group();
    const road = new THREE.Mesh(new THREE.BoxGeometry(10, 0.18, 12.2), roadMaterial);
    road.position.set(0, -0.1, 0); road.receiveShadow = true; segment.add(road);
    for (const x of [-5.35, 5.35]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(.7, .3, 12.2), curbMaterial);
      curb.position.set(x, 0, 0); segment.add(curb);
    }
    for (const x of [-1.5, 1.5]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(.12, .02, 4.8), curbMaterial);
      line.position.set(x, .01, 0); segment.add(line);
    }
    segment.position.z = z; scene.add(segment); roadSegments.push(segment);
  }
}

function createEnvironment() {
  const trunk = new THREE.MeshStandardMaterial({ color: 0x754426 });
  const leaves = new THREE.MeshStandardMaterial({ color: 0x3e9a5c, flatShading: true });
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0x555b62, emissive: 0x222211 });
  for (let z = -75; z < 20; z += 9) {
    const segment = new THREE.Group();
    for (const side of [-1, 1]) {
      const x = side * (7 + (Math.abs(z / 9) % 2) * 2);
      const height = 5 + (Math.abs(z * 7) % 7);
      const building = new THREE.Mesh(new THREE.BoxGeometry(5, height, 5), new THREE.MeshStandardMaterial({ color: side < 0 ? 0x4d88be : 0xdf7e58, flatShading: true }));
      building.position.set(side * 12, height / 2, 0); building.castShadow = true; segment.add(building);
      const tree = new THREE.Group();
      const treeTrunk = new THREE.Mesh(new THREE.CylinderGeometry(.18, .25, 1.5, 6), trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.8, 7), leaves);
      treeTrunk.position.y = .75; crown.position.y = 2.4; tree.add(treeTrunk, crown); tree.position.set(x, 0, 3); segment.add(tree);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(.12, 3.2, .12), lampMaterial);
      lamp.position.set(side * 5.9, 1.6, 0); segment.add(lamp);
      const lampTop = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffe58a, emissive: 0xffc400 }));
      lampTop.position.set(side * 5.9, 3.25, 0); segment.add(lampTop);
    }
    segment.position.z = z; scene.add(segment); environmentSegments.push(segment);
  }
}

function createPlayer() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98162 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x800020 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x252637 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f5f5 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x3c2415 });
  const part = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; group.add(mesh); return mesh;
  };
  part(new THREE.SphereGeometry(.55, 14, 12), skin, 0, 2.65, 0);
  part(new THREE.SphereGeometry(.57, 8, 6), hair, 0, 3.05, -.04).scale.y = .35;
  part(new THREE.BoxGeometry(.85, 1.15, .45), shirt, 0, 1.75, 0);
  const limbs = [];
  [-1, 1].forEach((side) => {
    const arm = part(new THREE.CapsuleGeometry(.14, .65, 5, 8), shirt, side * .62, 1.9, 0);
    const leg = part(new THREE.CapsuleGeometry(.18, .7, 5, 8), pants, side * .25, .65, 0);
    const shoe = part(new THREE.BoxGeometry(.32, .2, .55), white, side * .25, .18, .13);
    limbs.push({ arm, leg, shoe, phase: side });
  });
  group.userData.limbs = limbs;
  group.position.set(0, 0, playerZ);
  return group;
}

function createObstacle(type, targetLane) {
  const group = new THREE.Group();
  let height, width, depth;
  if (type === "cone") {
    height = 1; width = .7; depth = .7;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.38, .9, 16), new THREE.MeshStandardMaterial({ color: 0xf58220 }));
    cone.position.y = .45; group.add(cone);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .12, 4), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    base.position.y = .06; group.add(base);
  } else if (type === "barrier") {
    height = 1.15; width = 2.1; depth = .45;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(width, .48, depth), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    bar.position.y = .85; group.add(bar);
    [[-.75, .32], [.75, .32]].forEach(([x, y]) => {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(.16, .7, .16), new THREE.MeshStandardMaterial({ color: 0x800020 }));
      stand.position.set(x, y, 0); group.add(stand);
    });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(.45, .5, .47), new THREE.MeshStandardMaterial({ color: 0xd73333 }));
    stripe.position.set(0, .85, .01); group.add(stripe);
  } else {
    height = 2.25; width = 2.15; depth = 1.7;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color: 0xa75b2a, roughness: .8 }));
    crate.position.y = height / 2; crate.castShadow = true; group.add(crate);
  }
  group.position.set(lanes[targetLane], 0, -80);
  group.userData = { kind: "obstacle", type, height, width, depth };
  scene.add(group); objects.push(group);
}

function createCoin(targetLane, offset = 0) {
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .1, 16), new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x795f00, metalness: .6 }));
  coin.rotation.z = Math.PI / 2;
  coin.position.set(lanes[targetLane], 1 + offset, -80);
  coin.userData = { kind: "coin" };
  scene.add(coin); objects.push(coin);
}

function spawnObjects() {
  const safeLane = Math.floor(Math.random() * 3);
  const dangerCount = Math.random() < .35 ? 2 : 1;
  const available = lanes.map((_, i) => i).filter((i) => i !== safeLane).sort(() => Math.random() - .5);
  for (let i = 0; i < dangerCount; i++) {
    const type = Math.random() < .38 ? "crate" : Math.random() < .5 ? "cone" : "barrier";
    createObstacle(type, available[i]);
  }
  const coinLane = Math.random() < .65 ? safeLane : Math.floor(Math.random() * 3);
  for (let i = 0; i < 4; i++) createCoin(coinLane, i === 3 ? .25 : 0);
}

function handleInput(action) {
  if (!running) return;
  if (action === "left") lane = Math.max(0, lane - 1);
  if (action === "right") lane = Math.min(2, lane + 1);
  if (action === "jump" && player.position.y <= .01) {
    verticalVelocity = 8.1; playTone(380, .1, "sine");
  }
}

function updatePlayer(delta) {
  player.position.x = THREE.MathUtils.damp(player.position.x, lanes[lane], 11, delta);
  verticalVelocity -= 21 * delta;
  player.position.y = Math.max(0, player.position.y + verticalVelocity * delta);
  if (player.position.y === 0) verticalVelocity = 0;
  player.rotation.z = THREE.MathUtils.damp(player.rotation.z, -(lanes[lane] - player.position.x) * .11, 8, delta);
  const cycle = elapsed * (9 + speedMultiplier() * 2);
  player.userData.limbs.forEach(({ arm, leg, shoe, phase }) => {
    const swing = Math.sin(cycle * phase) * .65;
    arm.rotation.x = swing; leg.rotation.x = -swing; shoe.rotation.x = -swing * .2;
  });
}

function speedMultiplier() { return Math.min(2.4, 1 + Math.floor(elapsed / 20) * .16); }

function updateObstacles(delta) {
  const movement = 18 * speedMultiplier() * delta;
  for (let i = objects.length - 1; i >= 0; i--) {
    const object = objects[i];
    object.position.z += movement;
    if (object.userData.kind === "coin") object.rotation.y += delta * 8;
    if (object.position.z > 12) {
      scene.remove(object); objects.splice(i, 1); continue;
    }
    checkCollisions(object, i);
  }
}

function updateWorld(delta) {
  const movement = 18 * speedMultiplier() * delta;
  roadSegments.forEach((segment) => {
    segment.position.z += movement;
    if (segment.position.z > 30) segment.position.z -= 108;
  });
  environmentSegments.forEach((segment) => {
    segment.position.z += movement;
    if (segment.position.z > 25) segment.position.z -= 99;
  });
}

function checkCollisions(object, index) {
  if (Math.abs(object.position.z - playerZ) > (object.userData.depth || .35) + .45) return;
  if (Math.abs(object.position.x - player.position.x) > (object.userData.width || .45) / 2 + .38) return;
  if (object.userData.kind === "coin") {
    if (Math.abs(object.position.y - (player.position.y + 1.4)) < 1.35) {
      coins++; score += 10; scene.remove(object); objects.splice(index, 1); showBonus(); playTone(850, .08, "square"); updateScore();
    }
  } else if (object.userData.type === "crate" || player.position.y + .35 < object.userData.height) {
    endGame();
  }
}

function updateScore() {
  score = Math.floor(elapsed * 8 * speedMultiplier()) + coins * 10;
  ui.score.textContent = String(score).padStart(4, "0");
  ui.coins.textContent = String(coins).padStart(2, "0");
  ui.speed.textContent = `${speedMultiplier().toFixed(1)}x`;
}

function showBonus() {
  ui.bonus.classList.remove("show");
  requestAnimationFrame(() => ui.bonus.classList.add("show"));
}

function playTone(frequency, duration, wave) {
  if (!audioContext) audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
  oscillator.type = wave; oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.06, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}

function startGame() {
  resetGame(); running = true; ui.menu.hidden = true; ui.over.hidden = true; clock.getDelta();
}

function endGame() {
  if (!running) return;
  running = false; playTone(110, .45, "sawtooth");
  highScore = Math.max(highScore, score); localStorage.setItem("pesatRunnerHighScore", highScore);
  ui.finalScore.textContent = String(score).padStart(4, "0");
  ui.finalCoins.textContent = String(coins).padStart(2, "0");
  ui.finalHigh.textContent = String(highScore).padStart(4, "0");
  ui.menuHigh.textContent = String(highScore).padStart(4, "0");
  ui.over.hidden = false;
}

function resetGame() {
  objects.forEach((object) => scene.remove(object)); objects.length = 0;
  lane = 1; elapsed = 0; spawnTimer = .8; score = 0; coins = 0; verticalVelocity = 0;
  player.position.set(0, 0, playerZ); player.rotation.z = 0; updateScore();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .05);
  if (running) {
    elapsed += delta; spawnTimer -= delta;
    if (spawnTimer <= 0) { spawnObjects(); spawnTimer = Math.max(1.25, 2.65 - elapsed / 75); }
    updatePlayer(delta); updateObstacles(delta); updateWorld(delta); updateScore();
  }
  renderer.render(scene, camera);
}

document.querySelector("#play-button").addEventListener("click", startGame);
document.querySelector("#again-button").addEventListener("click", startGame);
document.querySelector("#menu-button").addEventListener("click", () => { ui.over.hidden = true; ui.menu.hidden = false; });
document.querySelector("#how-button").addEventListener("click", () => {
  const instructions = document.querySelector("#instructions"); instructions.hidden = !instructions.hidden;
});
addEventListener("keydown", (event) => {
  const action = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "jump", w: "jump", W: "jump", " ": "jump" }[event.key];
  if (action) { event.preventDefault(); handleInput(action); }
});
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("pointerdown", () => handleInput(button.dataset.action)));
ui.menuHigh.textContent = String(highScore).padStart(4, "0");
initScene();
animate();
