const canvas = document.getElementById('webgl');
const gl = canvas.getContext('webgl');

canvas.addEventListener('click', () => {
    canvas.requestPointerLock();
  });

// Vertex Shader: transforms vertex positions and passes UV to fragment shader
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  varying vec2 v_UV;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
  }
`;

// Fragment Shader: blends texture color with base color
const FSHADER_SOURCE = `
  precision mediump float;
  uniform sampler2D u_Sampler;
  uniform float u_texColorWeight;
  uniform vec4 u_baseColor;
  varying vec2 v_UV;
  void main() {
    vec4 texColor = texture2D(u_Sampler, v_UV);
    gl_FragColor = mix(u_baseColor, texColor, u_texColorWeight);
  }
`;

// Compile and link shaders into a program
function initShader(gl, vsSource, fsSource) {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vsSource);
  gl.compileShader(vertexShader);

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fsSource);
  gl.compileShader(fragmentShader);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  gl.program = program;
}
initShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);

// Cube class
class Cube {
  constructor(gl, program, modelMatrix, texWeight = 1.0, baseColor = [1, 1, 1, 1]) {
    this.modelMatrix = new Matrix4(modelMatrix);
    this.texWeight = texWeight;
    this.baseColor = baseColor;
    // Vertices with positions (x, y, z) and texture coords (u, v)
    this.vertices = new Float32Array([
      -0.5, -0.5, 0.5, 0, 0,
       0.5, -0.5, 0.5, 1, 0,
      -0.5,  0.5, 0.5, 0, 1,
       0.5,  0.5, 0.5, 1, 1,
    ]);

    // Create and bind vertex buffer
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);

    const FSIZE = this.vertices.BYTES_PER_ELEMENT;
    // Set up attribute pointers
    const a_Position = gl.getAttribLocation(program, 'a_Position');
    const a_UV = gl.getAttribLocation(program, 'a_UV');
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, FSIZE * 5, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, FSIZE * 5, FSIZE * 3);
    gl.enableVertexAttribArray(a_UV);
  }

  draw(gl, program) {
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.modelMatrix.elements);
    gl.uniform1f(u_texColorWeight, this.texWeight);
    gl.uniform4fv(u_baseColor, this.baseColor);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// Get uniform locations
const u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');
const u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
const u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
const u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
const u_texColorWeight = gl.getUniformLocation(gl.program, 'u_texColorWeight');
const u_baseColor = gl.getUniformLocation(gl.program, 'u_baseColor');

// Load and bind texture
const texture = gl.createTexture();
function initTextures(gl, texture, u_Sampler, imagePath) {
  let image = new Image();
  image.onload = function () {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.uniform1i(u_Sampler, 0);
    drawScene();
  };
  image.src = imagePath;
}
initTextures(gl, texture, u_Sampler, 'textures/dirt.png');

// Camera setup
let eye = new Vector3([0, 2, -5]);
let forward = new Vector3([0, 0, 1]).normalize();
let up = new Vector3([0, 1, 0]);
let at = new Vector3([0, 2, 0]);

console.log('initial eye:', eye.elements);
console.log('initial at:', at.elements);
console.log('initial forward:', forward.elements);


let viewMatrix = new Matrix4();
let projectionMatrix = new Matrix4();

// Update view matrix using eye, up, and at
function updateViewMatrix() {
  viewMatrix.setLookAt(eye.elements[0], eye.elements[1], eye.elements[2], at.elements[0], at.elements[1], at.elements[2], up.elements[0], up.elements[1], up.elements[2]);
}

// Update projection matrix for perspective view
function updateProjectionMatrix() {
  projectionMatrix.setPerspective(60, canvas.width / canvas.height, 0.1, 100);
}

function move(dirVec) {
    const moveVec = new Vector3(dirVec.elements).normalize().mul(0.3);
    eye.add(moveVec);
    at.add(moveVec);
    console.log('eye:', eye.elements);
    console.log('at:', at.elements);
    updateViewMatrix();
    drawScene();
  }

document.addEventListener('keydown', (e) => {
    console.log('Key pressed:', e.code);
    switch (e.code) {
      case 'KeyW': move(forward); break;
      case 'KeyS': move(new Vector3(forward.elements).mul(-2)); break;
      case 'KeyA': {
        const viewDir = new Vector3(at.elements).sub(eye).normalize();
        const right = new Vector3();
        Vector3.cross(right, viewDir, up);
        right.normalize();
        move(new Vector3(right.elements).mul(-1));
        break;
      }
      case 'KeyD': {
        const viewDir = new Vector3(at.elements).sub(eye).normalize();
        const right = new Vector3();
        Vector3.cross(right, viewDir, up);
        right.normalize();
        move(right);
        break;
      }      
      case 'KeyQ':
        forward = new Matrix4().setRotate(-5, ...up.elements).multiplyVector3(forward).normalize();
        at = new Vector3(eye).add(forward);
        break;
      case 'KeyE':
        forward = new Matrix4().setRotate(5, ...up.elements).multiplyVector3(forward).normalize();
        at = new Vector3(eye).add(forward);
        break;
      case 'Space': move(new Vector3(up.elements)); break;
      case 'ShiftLeft': move(new Vector3(up.elements).mul(-1)); break;        
    }
  
    updateViewMatrix();
    drawScene();
  });

  
// Enable pointer lock on click
canvas.addEventListener('click', () => {
  canvas.requestPointerLock();
});

// Mouse movement to rotate view
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    const sensitivity = 0.002;
    let yaw = -e.movementX * sensitivity;
    let rot = new Matrix4().setRotate(yaw * 180 / Math.PI, ...up.elements);
    forward = rot.multiplyVector3(forward).normalize();
    updateViewMatrix();
    drawScene();
  }
});

//2D map where each cell holds cube height
const map = [
  [1, 0, 2, 0],
  [3, 0, 0, 1],
  [1, 0, 1, 1],
  [4, 0, 0, 2]
];

// Draw all objects in the scene
function drawScene() {
  gl.clearColor(0.5, 0.7, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, projectionMatrix.elements);

  // Sky background (large blue cube)
  const skyMatrix = new Matrix4().setTranslate(2, 2, 2).scale(50, 50, 50);
  const sky = new Cube(gl, gl.program, skyMatrix, 0.0, [0.3, 0.5, 1.0, 1.0]);
  sky.draw(gl, gl.program);

  // Ground plane (flat green box)
  const groundMatrix = new Matrix4().setTranslate(2, -0.1, 2).scale(8, 0.1, 8);
  const ground = new Cube(gl, gl.program, groundMatrix, 0.0, [0.3, 0.8, 0.3, 1.0]);
  ground.draw(gl, gl.program);

  // Draw textured cubes according to the map
  for (let i = 0; i < map.length; i++) {
    for (let j = 0; j < map[0].length; j++) {
      let height = map[i][j];
      for (let h = 0; h < height; h++) {
        const modelMatrix = new Matrix4().setTranslate(i, h, j);
        const cube = new Cube(gl, gl.program, modelMatrix);
        cube.draw(gl, gl.program);
      }
    }
  }
}

// Enable depth testing
gl.enable(gl.DEPTH_TEST);

// Initial setup
updateViewMatrix();
updateProjectionMatrix();
drawScene();
