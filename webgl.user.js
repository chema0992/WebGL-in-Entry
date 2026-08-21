// ==UserScript==
// @name         엔트리 WebGL 비공식 블록 확장
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  엔트리 작품 만들기 및 상세 페이지에서 Raw WebGL 블록을 사용할 수 있게 해줍니다.
// @author       Entry User
// @match        *://playentry.org/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function injectWebGLBlocks() {

        const initWebGL = setInterval(() => {
            let targetWindow = window;
            let isIframe = false;

            const iframe = document.querySelector('iframe.project_iframe') || document.querySelector('iframe');
            if (iframe && iframe.contentWindow && iframe.contentWindow.Entry) {
                targetWindow = iframe.contentWindow;
                isIframe = true;
            }

            const Entry = targetWindow.Entry;
            const EntryStatic = targetWindow.EntryStatic;

            if (!Entry || !Entry.block) return;

            if (!isIframe) {
                if (!Entry.playground || !Entry.playground.mainWorkspace || !Entry.playground.blockMenu) {
                    return;
                }
            }

            clearInterval(initWebGL);
            console.log('[WebGL Extension] 엔트리 엔진 감지됨! 안전하게 블록 주입 시작 (isIframe:', isIframe, ')');

            if (isIframe) {
                if (!Entry.playground) Entry.playground = {};
                if (!Entry.playground.mainWorkspace) {
                    Entry.playground.mainWorkspace = {
                        blockMenu: { _generateCategoryView: () => {} },
                        syncCode: () => {}
                    };
                }
                if (!Entry.playground.blockMenu) {
                    Entry.playground.blockMenu = {
                        _categoryData: [],
                        _generateCategoryCode: () => {}
                    };
                }
                if (!targetWindow.$) {
                    targetWindow.$ = () => { return { length: 0, append: () => {}, css: () => {}, attr: () => {} } };
                }
            }

            if (!targetWindow.__ENTRY_WEBGL__) {
                targetWindow.__ENTRY_WEBGL__ = {
                    gl: null,
                    canvas: null,
                    programs: {},
                    buffers: {},
                    shaders: {},
                    uniforms: {},
                    textures: {},
                    framebuffers: {} // [추가됨] 프레임버퍼 저장소
                };
            }

            const addBlock = (blockname, template, color, params, _class, func, skeleton = 'basic') => {
                Entry.block[blockname] = {
                    color: color.color,
                    outerLine: color.outerline,
                    fontColor: color.fontColor || '#ffffff',
                    skeleton: skeleton,
                    statement: [],
                    params: params.params,
                    events: {},
                    def: {
                        params: params.def,
                        type: blockname
                    },
                    paramsKeyMap: params.map,
                    class: _class ? _class : 'default',
                    func: func,
                    template: template
                };
            };

            addBlock(
                'webgl_destroy_context',
                'WebGL 캔버스 및 데이터 모두 지우기 %1',
                { color: '#E74C3C', outerLine: '#C0392B' },
                { params: [{ type: 'Indicator', img: '', size: 11 }], def: [null], map: {} },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (state) {
                        if (state.gl) {
                            const loseCtx = state.gl.getExtension('WEBGL_lose_context');
                            if (loseCtx) loseCtx.loseContext();
                        }
                        if (state.canvas && state.canvas.parentNode) {
                            state.canvas.parentNode.removeChild(state.canvas);
                        }
                        targetWindow.__ENTRY_WEBGL__ = {
                            gl: null,
                            canvas: null,
                            programs: {},
                            buffers: {},
                            shaders: {},
                            uniforms: {},
                            textures: {},
                            framebuffers: {} // [추가됨] 초기화 시 프레임버퍼도 비움
                        };
                        console.log('[WebGL] 캔버스 및 모든 초기화 데이터 삭제 완료');
                    }
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_init_context',
                'WebGL 캔버스 시작하기 %1',
                { color: '#8E44AD', outerLine: '#732D91' },
                { params: [{ type: 'Indicator', img: '', size: 11 }], def: [null], map: {} },
                'text',
                (sprite, script) => {
                    if (!targetWindow.__ENTRY_WEBGL__.canvas) {
                        const entryCanvas = targetWindow.document.querySelector('.entryCanvasWorkspace canvas') ||
                                            (Entry.stage && (Entry.stage.canvas.canvas || Entry.stage.canvas));

                        if (entryCanvas) {
                            const wrapper = entryCanvas.parentElement;
                            const glCanvas = targetWindow.document.createElement('canvas');

                            glCanvas.width = entryCanvas.width;
                            glCanvas.height = entryCanvas.height;

                            glCanvas.style.position = 'absolute';
                            glCanvas.style.top = entryCanvas.style.top || '0px';
                            glCanvas.style.left = entryCanvas.style.left || '0px';
                            glCanvas.style.width = '100%';
                            glCanvas.style.height = '100%';
                            glCanvas.style.pointerEvents = 'none';
                            glCanvas.style.zIndex = '100';

                            wrapper.appendChild(glCanvas);
                            const gl = glCanvas.getContext('webgl', { alpha: true });

                            targetWindow.__ENTRY_WEBGL__.canvas = glCanvas;
                            targetWindow.__ENTRY_WEBGL__.gl = gl;
                            console.log('[WebGL] 캔버스 초기화 완료');
                        }
                    }
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_clear_color',
                '화면 닦기 색상 R:%1 G:%2 B:%3 A:%4 %5',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['0.0'] }, { type: 'text', params: ['0.0'] },
                        { type: 'text', params: ['0.0'] }, { type: 'text', params: ['0.0'] }, null
                    ],
                    map: { R: 0, G: 1, B: 2, A: 3 }
                },
                'text',
                (sprite, script) => {
                    const gl = targetWindow.__ENTRY_WEBGL__.gl;
                    if (gl) {
                        const r = parseFloat(script.getNumberValue('R'));
                        const g = parseFloat(script.getNumberValue('G'));
                        const b = parseFloat(script.getNumberValue('B'));
                        const a = parseFloat(script.getNumberValue('A'));
                        gl.clearColor(r, g, b, a);
                    }
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_clear',
                '화면 닦기 %1',
                { color: '#8E44AD', outerLine: '#732D91' },
                { params: [{ type: 'Indicator', img: '', size: 11 }], def: [null], map: {} },
                'text',
                (sprite, script) => {
                    const gl = targetWindow.__ENTRY_WEBGL__.gl;
                    if (gl) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_create_program_glsl',
                'WebGL 프로그램 %1 생성 (버텍스 GLSL: %2 , 프래그먼트 GLSL: %3)',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Block', accept: 'string' }, { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['my_program'] },
                        { type: 'text', params: ['attribute vec2 a_position;\nvoid main() {\n  gl_Position = vec4(a_position, 0.0, 1.0);\n}'] },
                        { type: 'text', params: ['precision mediump float;\nvoid main() {\n  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n}'] },
                        null
                    ],
                    map: { PROG_NAME: 0, VS_SOURCE: 1, FS_SOURCE: 2 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const progName = script.getStringValue('PROG_NAME');
                    const vsSource = script.getStringValue('VS_SOURCE');
                    const fsSource = script.getStringValue('FS_SOURCE');

                    const compileShader = (type, source) => {
                        const shader = gl.createShader(type);
                        gl.shaderSource(shader, source);
                        gl.compileShader(shader);
                        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                            console.error('[WebGL Shader Error]:', gl.getShaderInfoLog(shader));
                            return null;
                        }
                        return shader;
                    };

                    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
                    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
                    if (!vs || !fs) return script.callReturn();

                    const program = gl.createProgram();
                    gl.attachShader(program, vs);
                    gl.attachShader(program, fs);
                    gl.linkProgram(program);

                    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
                        state.programs[progName] = program;
                        console.log(`[WebGL] 프로그램 '${progName}' 링킹 성공`);
                    }
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_create_buffer_data',
                '버퍼 %1 에 정점 데이터 [%2] 설정 %3',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['pos_buffer'] },
                        { type: 'text', params: ['-0.5, -0.5,  0.5, -0.5,  0.0, 0.5'] }, null
                    ],
                    map: { BUF_NAME: 0, DATA_STR: 1 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const bufName = script.getStringValue('BUF_NAME');
                    const rawArray = script.getStringValue('DATA_STR').split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));

                    let buffer = state.buffers[bufName] || gl.createBuffer();
                    state.buffers[bufName] = buffer;

                    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rawArray), gl.STATIC_DRAW);
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_bind_attribute',
                '프로그램 %1 의 %2 특성에 버퍼 %3 연결 (차원: %4) %5',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['my_program'] }, { type: 'text', params: ['a_position'] },
                        { type: 'text', params: ['pos_buffer'] }, { type: 'text', params: ['2'] }, null
                    ],
                    map: { PROG_NAME: 0, ATTR_NAME: 1, BUF_NAME: 2, SIZE: 3 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const program = state.programs[script.getStringValue('PROG_NAME')];
                    const buffer = state.buffers[script.getStringValue('BUF_NAME')];

                    if (program && buffer) {
                        gl.useProgram(program);
                        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                        const loc = gl.getAttribLocation(program, script.getStringValue('ATTR_NAME'));
                        if (loc !== -1) {
                            gl.vertexAttribPointer(loc, script.getNumberValue('SIZE') || 2, gl.FLOAT, false, 0, 0);
                            gl.enableVertexAttribArray(loc);
                        }
                    }
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_draw_arrays',
                '프로그램 %1 로 그리기 (모드: %2, 시작: %3, 정점 수: %4) %5',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['my_program'] }, { type: 'text', params: ['TRIANGLES'] },
                        { type: 'text', params: ['0'] }, { type: 'text', params: ['3'] }, null
                    ],
                    map: { PROG_NAME: 0, MODE: 1, FIRST: 2, COUNT: 3 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const program = state.programs[script.getStringValue('PROG_NAME')];
                    const modeStr = script.getStringValue('MODE').toUpperCase().trim();

                    if (program) {
                        gl.useProgram(program);
                        let mode = gl.TRIANGLES;
                        if (modeStr === 'POINTS') mode = gl.POINTS;
                        else if (modeStr === 'LINES') mode = gl.LINES;
                        else if (modeStr === 'LINE_STRIP') mode = gl.LINE_STRIP;
                        else if (modeStr === 'LINE_LOOP') mode = gl.LINE_LOOP;
                        else if (modeStr === 'TRIANGLE_STRIP') mode = gl.TRIANGLE_STRIP;
                        else if (modeStr === 'TRIANGLE_FAN') mode = gl.TRIANGLE_FAN;

                        gl.drawArrays(mode, script.getNumberValue('FIRST') || 0, script.getNumberValue('COUNT') || 3);
                    }
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_create_index_buffer_data',
                '인덱스 버퍼 %1 에 데이터 [%2] 설정 %3',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['index_buffer'] },
                        { type: 'text', params: ['0, 1, 2'] }, null
                    ],
                    map: { BUF_NAME: 0, DATA_STR: 1 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const bufName = script.getStringValue('BUF_NAME');
                    const rawArray = script.getStringValue('DATA_STR').split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));

                    let buffer = state.buffers[bufName] || gl.createBuffer();
                    state.buffers[bufName] = buffer;

                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(rawArray), gl.STATIC_DRAW);
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_bind_index_buffer',
                '인덱스 버퍼 %1 연결 %2',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['index_buffer'] }, null
                    ],
                    map: { BUF_NAME: 0 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const buffer = state.buffers[script.getStringValue('BUF_NAME')];

                    if (buffer) {
                        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
                    }
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_draw_elements',
                '프로그램 %1 로 인덱스 그리기 (모드: %2, 정점 수: %3, 시작: %4) %5',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['my_program'] }, { type: 'text', params: ['TRIANGLES'] },
                        { type: 'text', params: ['3'] }, { type: 'text', params: ['0'] }, null
                    ],
                    map: { PROG_NAME: 0, MODE: 1, COUNT: 2, OFFSET: 3 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const program = state.programs[script.getStringValue('PROG_NAME')];
                    const modeStr = script.getStringValue('MODE').toUpperCase().trim();

                    if (program) {
                        gl.useProgram(program);
                        let mode = gl.TRIANGLES;
                        if (modeStr === 'POINTS') mode = gl.POINTS;
                        else if (modeStr === 'LINES') mode = gl.LINES;
                        else if (modeStr === 'LINE_STRIP') mode = gl.LINE_STRIP;
                        else if (modeStr === 'LINE_LOOP') mode = gl.LINE_LOOP;
                        else if (modeStr === 'TRIANGLE_STRIP') mode = gl.TRIANGLE_STRIP;
                        else if (modeStr === 'TRIANGLE_FAN') mode = gl.TRIANGLE_FAN;

                        const count = script.getNumberValue('COUNT') || 3;
                        const offset = script.getNumberValue('OFFSET') || 0;

                        gl.drawElements(mode, count, gl.UNSIGNED_SHORT, offset);
                    }
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_set_uniform',
                '프로그램 %1 의 유니폼 %2 에 값 [%3] 설정 (타입: %4) %5',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['my_program'] }, { type: 'text', params: ['u_color'] },
                        { type: 'text', params: ['1.0, 0.0, 0.0, 1.0'] }, { type: 'text', params: ['4f'] }, null
                    ],
                    map: { PROG_NAME: 0, UNIFORM_NAME: 1, VALUE_STR: 2, TYPE: 3 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const progName = script.getStringValue('PROG_NAME');
                    const uniformName = script.getStringValue('UNIFORM_NAME');
                    const valueStr = script.getStringValue('VALUE_STR');
                    const type = script.getStringValue('TYPE').toLowerCase().trim();

                    const program = state.programs[progName];
                    if (program) {
                        gl.useProgram(program);

                        const cacheKey = `${progName}_${uniformName}`;
                        let loc = state.uniforms[cacheKey];
                        if (loc === undefined) {
                            loc = gl.getUniformLocation(program, uniformName);
                            state.uniforms[cacheKey] = loc;
                        }

                        if (loc !== null) {
                            const rawArray = valueStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
                            if (type === '1f') gl.uniform1f(loc, rawArray[0] || 0);
                            else if (type === '2f') gl.uniform2f(loc, rawArray[0] || 0, rawArray[1] || 0);
                            else if (type === '3f') gl.uniform3f(loc, rawArray[0] || 0, rawArray[1] || 0, rawArray[2] || 0);
                            else if (type === '4f') gl.uniform4f(loc, rawArray[0] || 0, rawArray[1] || 0, rawArray[2] || 0, rawArray[3] || 0);
                            else if (type === '1i') gl.uniform1i(loc, Math.floor(rawArray[0] || 0));
                            else if (type === 'mat4') gl.uniformMatrix4fv(loc, false, new Float32Array(rawArray));
                        }
                    }
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_toggle_depth_test',
                '깊이 테스트 %1 %2',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        {
                            type: 'Dropdown',
                            options: [['켜기 (ON)', 'ON'], ['끄기 (OFF)', 'OFF']],
                            value: 'ON',
                            fontSize: 11,
                            bgColor: '#732D91',
                            arrowColor: '#FFFFFF'
                        },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [null, null],
                    map: { STATE: 0 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const toggle = script.getField('STATE', script);

                    if (toggle === 'ON') {
                        gl.enable(gl.DEPTH_TEST);
                    } else {
                        gl.disable(gl.DEPTH_TEST);
                    }
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_load_texture',
                '텍스처 %1 생성 (URL: %2) %3',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['tex_0'] },
                        { type: 'text', params: ['https://playentry.org/img/assets/entry_logo.png'] }, null
                    ],
                    map: { TEX_NAME: 0, URL: 1 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const texName = script.getStringValue('TEX_NAME');
                    const url = script.getStringValue('URL');

                    if (!state.textures) state.textures = {};

                    let texture = state.textures[texName];
                    if (!texture) {
                        texture = gl.createTexture();
                        state.textures[texName] = texture;
                    }

                    gl.bindTexture(gl.TEXTURE_2D, texture);

                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

                    const image = new Image();
                    image.crossOrigin = 'anonymous';
                    image.onload = () => {
                        gl.bindTexture(gl.TEXTURE_2D, texture);
                        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

                        const isPowerOf2 = (val) => (val & (val - 1)) === 0;
                        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                            gl.generateMipmap(gl.TEXTURE_2D);
                        } else {
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                        }
                    };
                    image.src = url;

                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_bind_texture',
                '프로그램 %1 의 샘플러 %2 에 텍스처 %3 연결 (유닛: %4) %5',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['my_program'] }, { type: 'text', params: ['u_sampler'] },
                        { type: 'text', params: ['tex_0'] }, { type: 'text', params: ['0'] }, null
                    ],
                    map: { PROG_NAME: 0, UNIFORM_NAME: 1, TEX_NAME: 2, UNIT: 3 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const progName = script.getStringValue('PROG_NAME');
                    const uniformName = script.getStringValue('UNIFORM_NAME');
                    const texName = script.getStringValue('TEX_NAME');
                    const unit = Math.max(0, parseInt(script.getNumberValue('UNIT') || 0, 10));

                    const program = state.programs[progName];
                    const texture = state.textures ? state.textures[texName] : null;

                    if (program && texture) {
                        gl.useProgram(program);
                        gl.activeTexture(gl.TEXTURE0 + unit);
                        gl.bindTexture(gl.TEXTURE_2D, texture);

                        const cacheKey = `${progName}_${uniformName}`;
                        let loc = state.uniforms[cacheKey];
                        if (loc === undefined) {
                            loc = gl.getUniformLocation(program, uniformName);
                            state.uniforms[cacheKey] = loc;
                        }

                        if (loc !== null) {
                            gl.uniform1i(loc, unit);
                        }
                    }
                    return script.callReturn();
                }
            );

            // [추가 기능] 프레임버퍼(Framebuffer) 생성 블록
            addBlock(
                'webgl_create_framebuffer',
                '프레임버퍼 %1 생성 (가로: %2 세로: %3 연결할 텍스처: %4) %5',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['fb_0'] }, { type: 'text', params: ['512'] },
                        { type: 'text', params: ['512'] }, { type: 'text', params: ['tex_fb_0'] }, null
                    ],
                    map: { FB_NAME: 0, WIDTH: 1, HEIGHT: 2, TEX_NAME: 3 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const fbName = script.getStringValue('FB_NAME');
                    const width = Math.max(1, parseInt(script.getNumberValue('WIDTH') || 512, 10));
                    const height = Math.max(1, parseInt(script.getNumberValue('HEIGHT') || 512, 10));
                    const texName = script.getStringValue('TEX_NAME');

                    if (!state.framebuffers) state.framebuffers = {};
                    if (!state.textures) state.textures = {};

                    // 프레임버퍼 객체 생성 및 바인딩
                    const fb = gl.createFramebuffer();
                    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

                    // 컬러 어태치먼트로 사용할 빈 텍스처 생성
                    const tex = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

                    // 프레임버퍼에 텍스처 연결
                    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

                    // 3D 렌더링을 위한 깊이(Depth) 렌더버퍼 생성 및 연결
                    const depthBuffer = gl.createRenderbuffer();
                    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
                    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
                    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

                    // 상태 저장
                    state.framebuffers[fbName] = { fb: fb, width: width, height: height, depth: depthBuffer };
                    state.textures[texName] = tex;

                    // 바인딩 해제 (원래 캔버스로 원상복구)
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

                    return script.callReturn();
                }
            );

            // [추가 기능] 프레임버퍼 바인딩(사용) 블록
            addBlock(
                'webgl_bind_framebuffer',
                '그리기 화면을 프레임버퍼 %1 (으)로 변경 (기본 캔버스는 "기본" 입력) %2',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['fb_0'] }, null
                    ],
                    map: { FB_NAME: 0 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const fbName = script.getStringValue('FB_NAME');

                    // "기본", "", "null" 입력 시 캔버스 화면으로 돌아감
                    if (fbName === '기본' || fbName === 'null' || fbName === '') {
                        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                        if (state.canvas) {
                            // 원래 캔버스 크기로 뷰포트 복원
                            gl.viewport(0, 0, state.canvas.width, state.canvas.height);
                        }
                    } else {
                        const fbObj = state.framebuffers ? state.framebuffers[fbName] : null;
                        if (fbObj) {
                            gl.bindFramebuffer(gl.FRAMEBUFFER, fbObj.fb);
                            // 프레임버퍼 텍스처 크기에 맞게 뷰포트 조절
                            gl.viewport(0, 0, fbObj.width, fbObj.height);
                        }
                    }

                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_set_time_uniform',
                '프로그램 %1 의 유니폼 %2 에 현재 시간(u_time) 설정 %3',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Indicator', img: '', size: 11 }
                    ],
                    def: [
                        { type: 'text', params: ['my_program'] }, { type: 'text', params: ['u_time'] }, null
                    ],
                    map: { PROG_NAME: 0, UNIFORM_NAME: 1 }
                },
                'text',
                (sprite, script) => {
                    const state = targetWindow.__ENTRY_WEBGL__;
                    if (!state || !state.gl) return script.callReturn();

                    const gl = state.gl;
                    const progName = script.getStringValue('PROG_NAME');
                    const uniformName = script.getStringValue('UNIFORM_NAME');

                    const program = state.programs[progName];
                    if (program) {
                        gl.useProgram(program);

                        const cacheKey = `${progName}_${uniformName}`;
                        let loc = state.uniforms[cacheKey];
                        if (loc === undefined) {
                            loc = gl.getUniformLocation(program, uniformName);
                            state.uniforms[cacheKey] = loc;
                        }

                        if (loc !== null) {
                            // 현재 시간을 초 단위(seconds)로 변환하여 유니폼에 전달
                            const timeInSeconds = performance.now() / 1000.0;
                            gl.uniform1f(loc, timeInSeconds);
                        }
                    }
                    return script.callReturn();
                }
            );

            addBlock(
                'webgl_make_transform_matrix',
                '이동 X:%1 Y:%2 Z:%3 회전 X:%4 Y:%5 Z:%6 크기 X:%7 Y:%8 Z:%9 변환 행렬',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' }
                    ],
                    def: [
                        { type: 'text', params: ['0'] }, { type: 'text', params: ['0'] }, { type: 'text', params: ['0'] }, // 이동
                        { type: 'text', params: ['0'] }, { type: 'text', params: ['0'] }, { type: 'text', params: ['0'] }, // 회전
                        { type: 'text', params: ['1'] }, { type: 'text', params: ['1'] }, { type: 'text', params: ['1'] }  // 크기
                    ],
                    map: { TX: 0, TY: 1, TZ: 2, RX: 3, RY: 4, RZ: 5, SX: 6, SY: 7, SZ: 8 }
                },
                'text',
                (sprite, script) => {
                    const tx = parseFloat(script.getNumberValue('TX') || 0);
                    const ty = parseFloat(script.getNumberValue('TY') || 0);
                    const tz = parseFloat(script.getNumberValue('TZ') || 0);

                    // 각도를 라디안으로 변환
                    const rx = parseFloat(script.getNumberValue('RX') || 0) * Math.PI / 180;
                    const ry = parseFloat(script.getNumberValue('RY') || 0) * Math.PI / 180;
                    const rz = parseFloat(script.getNumberValue('RZ') || 0) * Math.PI / 180;

                    const sx = parseFloat(script.getNumberValue('SX') || 1);
                    const sy = parseFloat(script.getNumberValue('SY') || 1);
                    const sz = parseFloat(script.getNumberValue('SZ') || 1);

                    // 4x4 행렬 곱셈 (Column-major)
                    const multiply = (a, b) => {
                        let c = new Array(16);
                        for(let i=0; i<4; i++) {
                            for(let j=0; j<4; j++) {
                                c[i*4 + j] = a[0*4 + j]*b[i*4 + 0] + a[1*4 + j]*b[i*4 + 1] +
                                             a[2*4 + j]*b[i*4 + 2] + a[3*4 + j]*b[i*4 + 3];
                            }
                        }
                        return c;
                    };

                    const identity = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

                    let matT = identity();
                    matT[12] = tx; matT[13] = ty; matT[14] = tz;

                    let matS = identity();
                    matS[0] = sx; matS[5] = sy; matS[10] = sz;

                    let matRx = identity();
                    matRx[5] = Math.cos(rx); matRx[6] = Math.sin(rx);
                    matRx[9] = -Math.sin(rx); matRx[10] = Math.cos(rx);

                    let matRy = identity();
                    matRy[0] = Math.cos(ry); matRy[2] = -Math.sin(ry);
                    matRy[8] = Math.sin(ry); matRy[10] = Math.cos(ry);

                    let matRz = identity();
                    matRz[0] = Math.cos(rz); matRz[1] = Math.sin(rz);
                    matRz[4] = -Math.sin(rz); matRz[5] = Math.cos(rz);

                    // 이동 * Z회전 * Y회전 * X회전 * 크기 순으로 결합 (TRS)
                    let out = multiply(matT, matRz);
                    out = multiply(out, matRy);
                    out = multiply(out, matRx);
                    out = multiply(out, matS);

                    // 0에 가까운 부동소수점 오차 제거 및 쉼표로 연결하여 반환
                    return out.map(v => (Math.abs(v) < 1e-6 ? 0 : v).toFixed(4)).join(', ');
                },
                'basic_string_field' // 값을 반환하는 둥근 블록으로 설정
            );

            // [추가 기능] 원근(Perspective) 투영 행렬 생성 블록 (값 블록)
            addBlock(
                'webgl_make_perspective_matrix',
                '원근 투영 시야각(FOV):%1 비율(W/H):%2 최소거리:%3 최대거리:%4',
                { color: '#8E44AD', outerLine: '#732D91' },
                {
                    params: [
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' },
                        { type: 'Block', accept: 'string' }, { type: 'Block', accept: 'string' }
                    ],
                    def: [
                        { type: 'text', params: ['60'] }, // FOV (도 단위)
                        { type: 'text', params: ['1.0'] }, // 화면 비율 (보통 캔버스 가로/세로)
                        { type: 'text', params: ['0.1'] }, // Near (가장 가까이 보이는 거리)
                        { type: 'text', params: ['100.0'] } // Far (가장 멀리 보이는 거리)
                    ],
                    map: { FOV: 0, ASPECT: 1, NEAR: 2, FAR: 3 }
                },
                'text',
                (sprite, script) => {
                    const fov = parseFloat(script.getNumberValue('FOV') || 60);
                    const aspect = parseFloat(script.getNumberValue('ASPECT') || 1.0);
                    const near = parseFloat(script.getNumberValue('NEAR') || 0.1);
                    const far = parseFloat(script.getNumberValue('FAR') || 100.0);

                    // 각도를 라디안으로 변환
                    const fovInRad = fov * Math.PI / 180.0;

                    // 원근 투영 행렬 계산 공식 적용
                    const f = 1.0 / Math.tan(fovInRad / 2.0);
                    const rangeInv = 1.0 / (near - far);

                    let out = new Array(16).fill(0);
                    out[0] = f / aspect;
                    out[5] = f;
                    out[10] = (near + far) * rangeInv;
                    out[11] = -1.0;
                    out[14] = near * far * rangeInv * 2.0;

                    // 0에 가까운 부동소수점 오차 제거 및 쉼표로 연결하여 텍스트로 반환
                    return out.map(v => (Math.abs(v) < 1e-6 ? 0 : v).toFixed(4)).join(', ');
                },
                'basic_string_field' // 값을 반환하는 둥근 블록
            );

            const webglBlocks = [
                'webgl_destroy_context',
                'webgl_init_context', 'webgl_clear_color', 'webgl_clear',
                'webgl_create_program_glsl', 'webgl_create_buffer_data',
                'webgl_bind_attribute', 'webgl_draw_arrays',
                'webgl_create_index_buffer_data', 'webgl_bind_index_buffer', 'webgl_draw_elements',
                'webgl_set_uniform', 'webgl_set_time_uniform', 'webgl_toggle_depth_test',
                'webgl_load_texture', 'webgl_bind_texture',
                'webgl_create_framebuffer', 'webgl_bind_framebuffer',
                'webgl_make_transform_matrix',
                'webgl_make_perspective_matrix' // <-- 추가된 원근 투영 행렬 블록
            ];

            if (EntryStatic && typeof EntryStatic.getAllBlocks === 'function') {
                const originalGetAllBlocks = EntryStatic.getAllBlocks;
                EntryStatic.getAllBlocks = () => {
                    const blocks = originalGetAllBlocks();
                    const hasCustom = blocks.find(c => c.category === 'WebGL');
                    if (!hasCustom) {
                        blocks.push({ category: 'WebGL', blocks: webglBlocks });
                    }
                    return blocks;
                };
            }

            if (!isIframe && targetWindow.$) {
                try {
                    const $ = targetWindow.$;
                    Entry.playground.mainWorkspace.blockMenu._generateCategoryView([
                        { category: 'start', visible: true }, { category: 'flow', visible: true },
                        { category: 'moving', visible: true }, { category: 'looks', visible: true },
                        { category: 'brush', visible: true }, { category: 'text', visible: true },
                        { category: 'sound', visible: true }, { category: 'judgement', visible: true },
                        { category: 'calc', visible: true }, { category: 'variable', visible: true },
                        { category: 'func', visible: true }, { category: 'analysis', visible: true },
                        { category: 'ai_utilize', visible: true }, { category: 'expansion', visible: true },
                        { category: 'arduino', visible: false },
                        { category: 'WebGL', visible: true }
                    ]);

                    $('.entryCategoryElementWorkspace').not('#entryCategorytext').attr('class', 'entryCategoryElementWorkspace');

                    Entry.playground.blockMenu._categoryData = EntryStatic.getAllBlocks();
                    Entry.playground.blockMenu._generateCategoryCode('WebGL');

                    $('#entryCategoryWebGL')[0].innerText = 'WebGL 3D';
                    $('#entryCategoryWebGL').css({ 'background-color': '#8E44AD', 'color': '#ffffff' });
                } catch (e) {
                    console.warn('[WebGL Extension] 카테고리 UI 렌더링 중 경고 (무시해도 됨):', e);
                }
            }

            console.log('[WebGL Extension] 프레임버퍼 기능이 포함된 모든 WebGL 블록 주입 완료!');
        }, 500);
    }

    const script = document.createElement('script');
    script.appendChild(document.createTextNode('(' + injectWebGLBlocks.toString() + ')();'));
    (document.body || document.head || document.documentElement).appendChild(script);

})();
