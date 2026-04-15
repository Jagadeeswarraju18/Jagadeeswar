import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const container = document.getElementById('webgl-container');
const loader = document.getElementById('loader');
const loaderProgress = document.getElementById('loader-progress');
const loaderPercent = document.getElementById('loader-percent');

// -- INITIALIZATION --
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 8);

// -- SCENE CONTENT: High-End Interactive Mesh --
const geometry = new THREE.SphereGeometry(1.4, 128, 128);

const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uScroll: { value: 0 },
    uColorA: { value: new THREE.Color("#080808") },   // Very dark
    uColorB: { value: new THREE.Color("#4a4a4a") },   // subtle grey/silver
    uColorC: { value: new THREE.Color("#ffffff") }    // bright accent
  },
  vertexShader: `
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uScroll;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying float vDisplacement;
    
    // Simplex Noise 3D
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v){ 
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 = v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
      i = mod289(i); 
      vec4 p = permute( permute( permute( 
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 1.0/7.0; // N=7
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
      vUv = uv;
      vNormal = normal;
      
      float noiseFreq = 1.2;
      float noiseAmp = 0.4 + (uScroll * 0.2);
      vec3 noisePos = vec3(position.x * noiseFreq + uTime * 0.2, position.y * noiseFreq + uTime * 0.3, position.z * noiseFreq);
      float noise = snoise(noisePos) * noiseAmp;
      
      float dist = distance(uv, uMouse * 0.5 + 0.5);
      float mouseInfluence = smoothstep(0.4, 0.0, dist) * 0.15;
      
      vDisplacement = noise + mouseInfluence;
      vec3 newPosition = position + normal * vDisplacement;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying float vDisplacement;
    
    void main() {
      float intensity = vDisplacement * 2.5;
      
      vec3 viewDirection = normalize(cameraPosition - vNormal);
      float fresnel = dot(viewDirection, vNormal);
      fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
      fresnel = pow(fresnel, 3.0);
      
      vec3 color = mix(uColorA, uColorB, intensity + 0.2);
      color = mix(color, uColorC, fresnel * 0.8 + intensity * 0.5);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  wireframe: true,
  transparent: true,
  opacity: 0.15
});

const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x050505 });
const coreMesh = new THREE.Mesh(geometry, coreMaterial);
coreMesh.scale.set(0.98, 0.98, 0.98);

const mesh = new THREE.Mesh(geometry, material);
const group = new THREE.Group();
group.add(mesh);
group.add(coreMesh);
scene.add(group);

// -- PARTICLES --
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 2000;
const posArray = new Float32Array(particlesCount * 3);

for(let i = 0; i < particlesCount * 3; i++) {
  posArray[i] = (Math.random() - 0.5) * 15;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMaterial = new THREE.PointsMaterial({
  size: 0.015,
  color: "#ffffff",
  transparent: true,
  opacity: 0.2,
  blending: THREE.AdditiveBlending
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// -- INTERACTIONS --
let mouse = new THREE.Vector2(0, 0);
let targetMouse = new THREE.Vector2(0, 0);
let scrollY = 0;

window.addEventListener('mousemove', (event) => {
  targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('scroll', () => {
  scrollY = window.scrollY;
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  material.uniforms.uScroll.value = Math.min(scrollY / maxScroll, 1.0);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -- ANIMATION LOOP --
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();
  
  // Update mouse easing
  mouse.x += (targetMouse.x - mouse.x) * 0.05;
  mouse.y += (targetMouse.y - mouse.y) * 0.05;

  // Render updates
  material.uniforms.uTime.value = elapsedTime;
  material.uniforms.uMouse.value = mouse;

  // Rotate group slightly globally
  group.rotation.x = elapsedTime * 0.1 + scrollY * 0.001;
  group.rotation.y = elapsedTime * 0.15 + mouse.x * 0.5;
  group.rotation.z = mouse.y * 0.2;
  
  camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.05;
  camera.position.y += (mouse.y * 0.5 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  particlesMesh.rotation.y = -elapsedTime * 0.02;
  particlesMesh.rotation.x = elapsedTime * 0.01;

  renderer.render(scene, camera);
}

// Start animation
animate();

// --- SCROLL ANIMATIONS (GSAP & THREE JS) ---

// 1. Initial State
group.position.x = 2.5; // Offset to the right
group.scale.set(1.2, 1.2, 1.2);

// 2. Animate 3D Object Based on Scroll
gsap.to(group.position, {
  x: -4.5,        // Move object far to the left for the spacer section
  y: -0.5,        // Move object down slightly
  scrollTrigger: {
    trigger: ".spacer-section",
    start: "top bottom",
    end: "bottom top",
    scrub: 1,     // Smooth scrubbing
  }
});

gsap.to(group.scale, {
  x: 2.2,         // Scale up (but keep it slightly controlled so text is visible)
  y: 2.2,
  z: 2.2,
  scrollTrigger: {
    trigger: ".spacer-section",
    start: "top center",
    end: "bottom top",
    scrub: 1,
  }
});

// Update Shader Uniforms Based on scroll (distortion effect)
gsap.to(material.uniforms.uScroll, {
  value: 3.0,     // Increase distortion intensity
  scrollTrigger: {
    trigger: ".spacer-section",
    start: "top bottom",
    end: "bottom top",
    scrub: 2,
  }
});

// -- FAKE LOADER --
let loadProgress = 0;
const loadInterval = setInterval(() => {
  loadProgress += Math.random() * 15;
  if (loadProgress >= 100) {
    loadProgress = 100;
    clearInterval(loadInterval);
    setTimeout(() => {
      if(loader) loader.classList.add('hidden');
    }, 400);
  }
  if(loaderProgress) loaderProgress.style.width = `${loadProgress}%`;
  if(loaderPercent) loaderPercent.innerText = Math.floor(loadProgress);
}, 100);
