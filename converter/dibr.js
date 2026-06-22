// Depth-Image-Based Rendering parallax warp (§4.2).
//
// Synthesizes a left/right stereo pair from a single image + depth map by
// horizontal displacement Δx = parallax·(d − c), split as ±Δx/2 around the
// convergence plane `c` so it sits at screen depth.
//
// Implementation: a full-screen-quad fragment shader (WebGL2 by default). For
// each destination pixel we solve the backward mapping iteratively — this
// naturally stretches background across disocclusions (crack-fill) instead of
// leaving holes, as called for in §4.2. Depth is pre-smoothed with a short
// asymmetric horizontal blur to soften edge cracking.

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_color;

uniform sampler2D u_image;
uniform sampler2D u_depth;
uniform float u_parallax;   // max displacement as a fraction of width
uniform float u_converge;   // convergence plane c in [0,1]
uniform float u_eyeSign;    // +1 left eye, -1 right eye
uniform float u_invert;     // 1.0 to invert depth (near=black -> near=white)
uniform vec2  u_texel;      // 1/size for depth blur taps

// Asymmetric horizontal smoothing of depth to reduce edge cracking (§4.2).
float sampleDepth(vec2 uv) {
  float d =
      texture(u_depth, uv).r * 0.40
    + texture(u_depth, uv + vec2( u_texel.x, 0.0)).r * 0.16
    + texture(u_depth, uv + vec2(-u_texel.x, 0.0)).r * 0.16
    + texture(u_depth, uv + vec2( u_texel.x * 2.0, 0.0)).r * 0.12
    + texture(u_depth, uv + vec2(-u_texel.x * 2.0, 0.0)).r * 0.08
    + texture(u_depth, uv + vec2( u_texel.x * 3.0, 0.0)).r * 0.08;
  return mix(d, 1.0 - d, u_invert);
}

void main() {
  // Solve x_src so that warp(x_src) == v_uv.x.
  // shift(d) = u_eyeSign * u_parallax * (d - u_converge) * 0.5
  // x_dst = x_src - shift(d(x_src))  ->  x_src = x_dst + shift(d(x_src))
  float xs = v_uv.x;
  for (int i = 0; i < 8; i++) {
    float d = sampleDepth(vec2(xs, v_uv.y));
    float shift = u_eyeSign * u_parallax * (d - u_converge) * 0.5;
    xs = clamp(v_uv.x + shift, 0.0, 1.0);
  }
  o_color = texture(u_image, vec2(xs, v_uv.y));
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`DIBR shader compile failed: ${log}`);
  }
  return sh;
}

export class DibrWarper {
  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl2', {
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL2 unavailable; DIBR cannot run.');
    this.gl = gl;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`DIBR link failed: ${gl.getProgramInfoLog(prog)}`);
    }
    this.prog = prog;

    this.u = {
      image: gl.getUniformLocation(prog, 'u_image'),
      depth: gl.getUniformLocation(prog, 'u_depth'),
      parallax: gl.getUniformLocation(prog, 'u_parallax'),
      converge: gl.getUniformLocation(prog, 'u_converge'),
      eyeSign: gl.getUniformLocation(prog, 'u_eyeSign'),
      invert: gl.getUniformLocation(prog, 'u_invert'),
      texel: gl.getUniformLocation(prog, 'u_texel'),
    };

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;

    this.imgTex = this._makeTex();
    this.depthTex = this._makeTex();
  }

  _makeTex() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  _upload(tex, source) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // WebGL texture origin is bottom-left while image data is top-left; flip on
    // upload so the rendered output is not vertically mirrored.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source
    );
  }

  /**
   * Render one eye.
   * @param {ImageBitmap|HTMLCanvasElement|ImageData} image source colour
   * @param {ImageBitmap|HTMLCanvasElement|ImageData} depth grayscale depth
   * @param {object} opts { width, height, parallax, converge, eyeSign, invert }
   * @returns {ImageBitmap}
   */
  async render(image, depth, opts) {
    const {
      width, height,
      parallax = 0.04,
      converge = 0.5,
      eyeSign = 1,
      invert = false,
    } = opts;
    const gl = this.gl;

    this.canvas.width = width;
    this.canvas.height = height;
    gl.viewport(0, 0, width, height);

    this._upload(this.imgTex, image);
    this._upload(this.depthTex, depth);

    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.uniform1i(this.u.image, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex);
    gl.uniform1i(this.u.depth, 1);

    gl.uniform1f(this.u.parallax, parallax);
    gl.uniform1f(this.u.converge, converge);
    gl.uniform1f(this.u.eyeSign, eyeSign);
    gl.uniform1f(this.u.invert, invert ? 1.0 : 0.0);
    gl.uniform2f(this.u.texel, 1 / width, 1 / height);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    return createImageBitmap(this.canvas);
  }

  destroy() {
    const gl = this.gl;
    gl.deleteTexture(this.imgTex);
    gl.deleteTexture(this.depthTex);
    gl.deleteProgram(this.prog);
    const ext = gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }
}
