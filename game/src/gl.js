/**
 * gl.js — WebGL2 Renderer for Vice Point 3D
 *
 * Transform Form:
 *   drawMesh takes a transform object: { x, y, z, ry, sx, sy, sz }
 *   - x, y, z: world position (3D, y up)
 *   - ry: rotation around y axis (radians)
 *   - sx, sy, sz: scale factors (default 1 if omitted)
 *
 * Mesh Shape:
 *   A mesh object contains:
 *   - vao: WebGLVertexArrayObject
 *   - count: number of vertices
 *   - numIndices: number of indices (or vertex count if non-indexed)
 */

export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true });
  if (!gl) {
    throw new Error('WebGL2 is not supported in this browser/environment.');
  }

  // Shader source
  const vsSource = `#version 300 es
    in vec3 a_position;
    in vec3 a_normal;
    in vec4 a_color;

    uniform mat4 u_projection;
    uniform mat4 u_view;
    uniform mat4 u_model;

    out vec3 v_normal;
    out vec4 v_color;
    out float v_dist;

    void main() {
      vec4 worldPos = u_model * vec4(a_position, 1.0);
      vec4 viewPos = u_view * worldPos;
      gl_Position = u_projection * viewPos;

      v_normal = mat3(u_model) * a_normal;
      v_color = a_color;
      v_dist = length(viewPos.xyz);
    }
  `;

  const fsSource = `#version 300 es
    precision highp float;

    in vec3 v_normal;
    in vec4 v_color;
    in float v_dist;

    uniform vec3 u_sunDir;
    uniform vec3 u_fogColor;
    uniform float u_emissive;

    out vec4 fragColor;

    void main() {
      vec3 normal = normalize(v_normal);
      float diff = max(dot(normal, u_sunDir), 0.0);
      float lighting = clamp(0.35 + diff * 0.65 + u_emissive * 0.8, 0.0, 1.0);

      vec3 litColor = v_color.rgb * lighting;

      // Distance fog (start 600, full 2200)
      float fogFactor = clamp((v_dist - 600.0) / (2200.0 - 600.0), 0.0, 1.0);
      vec3 finalColor = mix(litColor, u_fogColor, fogFactor);

      fragColor = vec4(finalColor, v_color.a);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile error: ' + info);
    }
    return shader;
  }

  const vertShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
  }

  const uProjLoc = gl.getUniformLocation(program, 'u_projection');
  const uViewLoc = gl.getUniformLocation(program, 'u_view');
  const uModelLoc = gl.getUniformLocation(program, 'u_model');
  const uSunDirLoc = gl.getUniformLocation(program, 'u_sunDir');
  const uFogColorLoc = gl.getUniformLocation(program, 'u_fogColor');
  const uEmissiveLoc = gl.getUniformLocation(program, 'u_emissive');

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  // Matrix math helpers
  function mat4Identity() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  function mat4Perspective(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = (2 * far * near) * nf;
    return out;
  }

  function mat4LookAt(eye, target, up) {
    let zx = eye.x - target.x, zy = eye.y - target.y, zz = eye.z - target.z;
    let len = Math.hypot(zx, zy, zz);
    if (len > 0) { zx /= len; zy /= len; zz /= len; }

    let xx = up.y * zz - up.z * zy;
    let xy = up.z * zx - up.x * zz;
    let xz = up.x * zy - up.y * zx;
    len = Math.hypot(xx, xy, xz);
    if (len > 0) { xx /= len; xy /= len; xz /= len; }

    let yx = zy * xz - zz * xy;
    let yy = zz * xx - zx * xz;
    let yz = zx * xy - zy * xx;

    const out = new Float32Array(16);
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye.x + xy * eye.y + xz * eye.z);
    out[13] = -(yx * eye.x + yy * eye.y + yz * eye.z);
    out[14] = -(zx * eye.x + zy * eye.y + zz * eye.z);
    out[15] = 1;
    return out;
  }

  function mat4FromTransform(t) {
    const x = t.x || 0, y = t.y || 0, z = t.z || 0;
    const ry = t.ry || 0;
    const sx = t.sx !== undefined ? t.sx : 1;
    const sy = t.sy !== undefined ? t.sy : 1;
    const sz = t.sz !== undefined ? t.sz : 1;

    const c = Math.cos(ry);
    const s = Math.sin(ry);

    const out = new Float32Array(16);
    out[0] = c * sx;  out[1] = 0;   out[2] = -s * sx; out[3] = 0;
    out[4] = 0;       out[5] = sy;  out[6] = 0;       out[7] = 0;
    out[8] = s * sz;  out[9] = 0;   out[10] = c * sz; out[11] = 0;
    out[12] = x;      out[13] = y;  out[14] = z;      out[15] = 1;
    return out;
  }

  function hexToRgba(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c.split('').map(ch => ch + ch).join('');
    }
    const num = parseInt(c, 16);
    return [
      ((num >> 16) & 255) / 255,
      ((num >> 8) & 255) / 255,
      (num & 255) / 255,
      1.0
    ];
  }

  function parseColor(col) {
    if (Array.isArray(col)) return col;
    if (typeof col === 'string' && col.startsWith('#')) return hexToRgba(col);
    return [1, 1, 1, 1];
  }

  function makeMesh(positions, normals, colors) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Positions
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    // Normals
    const normBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    // Colors
    const colBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    return {
      vao,
      count: positions.length / 3
    };
  }

  // Primitive generators
  function box(w, h, d, colorInput) {
    const rgba = parseColor(colorInput);
    const hw = w / 2, hh = h / 2, hd = d / 2;

    const positions = [
      // Front
      -hw, -hh, hd,  hw, -hh, hd,  hw,  hh, hd,
      -hw, -hh, hd,  hw,  hh, hd, -hw,  hh, hd,
      // Back
       hw, -hh, -hd, -hw, -hh, -hd, -hw,  hh, -hd,
       hw, -hh, -hd, -hw,  hh, -hd,  hw,  hh, -hd,
      // Left
      -hw, -hh, -hd, -hw, -hh,  hd, -hw,  hh,  hd,
      -hw, -hh, -hd, -hw,  hh,  hd, -hw,  hh, -hd,
      // Right
       hw, -hh,  hd,  hw, -hh, -hd,  hw,  hh, -hd,
       hw, -hh,  hd,  hw,  hh, -hd,  hw,  hh,  hd,
      // Top
      -hw,  hh,  hd,  hw,  hh,  hd,  hw,  hh, -hd,
      -hw,  hh,  hd,  hw,  hh, -hd, -hw,  hh, -hd,
      // Bottom
      -hw, -hh, -hd,  hw, -hh, -hd,  hw, -hh,  hd,
      -hw, -hh, -hd,  hw, -hh,  hd, -hw, -hh,  hd
    ];

    const normals = [
      0,0,1, 0,0,1, 0,0,1,  0,0,1, 0,0,1, 0,0,1,
      0,0,-1, 0,0,-1, 0,0,-1,  0,0,-1, 0,0,-1, 0,0,-1,
      -1,0,0, -1,0,0, -1,0,0,  -1,0,0, -1,0,0, -1,0,0,
      1,0,0, 1,0,0, 1,0,0,  1,0,0, 1,0,0, 1,0,0,
      0,1,0, 0,1,0, 0,1,0,  0,1,0, 0,1,0, 0,1,0,
      0,-1,0, 0,-1,0, 0,-1,0,  0,-1,0, 0,-1,0, 0,-1,0
    ];

    const colors = [];
    for (let i = 0; i < 36; i++) {
      colors.push(...rgba);
    }

    return makeMesh(positions, normals, colors);
  }

  function quad(w, d, colorInput) {
    const rgba = parseColor(colorInput);
    const hw = w / 2, hd = d / 2;

    const positions = [
      -hw, 0, -hd,  -hw, 0,  hd,   hw, 0,  hd,
      -hw, 0, -hd,   hw, 0,  hd,   hw, 0, -hd
    ];
    const normals = [
      0, 1, 0,  0, 1, 0,  0, 1, 0,
      0, 1, 0,  0, 1, 0,  0, 1, 0
    ];
    const colors = [];
    for (let i = 0; i < 6; i++) colors.push(...rgba);

    return makeMesh(positions, normals, colors);
  }

  function cylinder(rTop, rBottom, h, segments, colorInput) {
    const rgba = parseColor(colorInput);
    const hh = h / 2;
    const positions = [];
    const normals = [];
    const colors = [];

    for (let i = 0; i < segments; i++) {
      const theta1 = (i / segments) * Math.PI * 2;
      const theta2 = ((i + 1) / segments) * Math.PI * 2;

      const c1 = Math.cos(theta1), s1 = Math.sin(theta1);
      const c2 = Math.cos(theta2), s2 = Math.sin(theta2);

      // Side quad
      const x1 = c1 * rBottom, z1 = s1 * rBottom;
      const x2 = c2 * rBottom, z2 = s2 * rBottom;
      const x3 = c2 * rTop,    z3 = s2 * rTop;
      const x4 = c1 * rTop,    z4 = s1 * rTop;

      const n1 = [c1, 0, s1], n2 = [c2, 0, s2];

      // Tri 1
      positions.push(x1, -hh, z1,  x2, -hh, z2,  x3, hh, z3);
      normals.push(...n1, ...n2, ...n2);
      // Tri 2
      positions.push(x1, -hh, z1,  x3, hh, z3,  x4, hh, z4);
      normals.push(...n1, ...n2, ...n1);

      for (let k = 0; k < 6; k++) colors.push(...rgba);
    }

    return makeMesh(positions, normals, colors);
  }

  function cone(r, h, segments, colorInput) {
    const rgba = parseColor(colorInput);
    const hh = h / 2;
    const positions = [];
    const normals = [];
    const colors = [];

    for (let i = 0; i < segments; i++) {
      const theta1 = (i / segments) * Math.PI * 2;
      const theta2 = ((i + 1) / segments) * Math.PI * 2;

      const c1 = Math.cos(theta1), s1 = Math.sin(theta1);
      const c2 = Math.cos(theta2), s2 = Math.sin(theta2);

      const x1 = c1 * r, z1 = s1 * r;
      const x2 = c2 * r, z2 = s2 * r;

      positions.push(x1, -hh, z1,  x2, -hh, z2,  0, hh, 0);
      normals.push(c1, 0.5, s1,  c2, 0.5, s2,  (c1+c2)*0.5, 0.5, (s1+s2)*0.5);

      for (let k = 0; k < 3; k++) colors.push(...rgba);
    }

    return makeMesh(positions, normals, colors);
  }

  // Camera state
  let projMat = mat4Identity();
  let viewMat = mat4Identity();
  let sunDir = [0.4, 0.8, 0.4];
  let fogColArr = [0.87, 0.47, 0.25];

  const sunLen = Math.hypot(sunDir[0], sunDir[1], sunDir[2]);
  sunDir[0] /= sunLen; sunDir[1] /= sunLen; sunDir[2] /= sunLen;

  return {
    setCamera(eye, target, up, fovY = Math.PI / 3) {
      const aspect = canvas.width / canvas.height || 16 / 9;
      projMat = mat4Perspective(fovY, aspect, 0.1, 4000);
      viewMat = mat4LookAt(eye, target, up);
    },

    begin(skyTop, skyBottom, fogColor) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      const fogRgba = parseColor(fogColor);
      fogColArr = [fogRgba[0], fogRgba[1], fogRgba[2]];

      gl.clearColor(fogRgba[0], fogRgba[1], fogRgba[2], 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(program);
      gl.uniformMatrix4fv(uProjLoc, false, projMat);
      gl.uniformMatrix4fv(uViewLoc, false, viewMat);
      gl.uniform3fv(uSunDirLoc, sunDir);
      gl.uniform3fv(uFogColorLoc, fogColArr);
    },

    box,
    quad,
    cylinder,
    cone,
    makeMesh,

    drawMesh(mesh, modelTransform, emissive = 0) {
      gl.bindVertexArray(mesh.vao);
      const modelMat = mat4FromTransform(modelTransform);
      gl.uniformMatrix4fv(uModelLoc, false, modelMat);
      gl.uniform1f(uEmissiveLoc, emissive);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      gl.bindVertexArray(null);
    },

    end() {
      // Flush / finish frame
    }
  };
}
