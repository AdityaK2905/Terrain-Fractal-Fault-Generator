import { m4rotX, m4rotY, m4rotZ, m4mul, m4trans, m4scale, m4transpose } from './math.js'
import { m4perspNegZ, m4view, div, mul, normalize, cross, add, sub } from './math.js'

const IlliniBlue = new Float32Array([0.075, 0.16, 0.292, 1])
const IlliniOrange = new Float32Array([1, 0.373, 0.02, 1])
const IdentityMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])


/**
 * Given the source code of a vertex and fragment shader, compiles them,
 * and returns the linked program.
 */

async function setup() {
    window.gl = document.querySelector('canvas').getContext('webgl2', 
        {antialias: false, depth: true, preserveDrawingBuffer: true}
    )
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clearColor(1.0, 1.0, 1.0, 1.0);


    let vs = await fetch('vertex.glsl', {cache:"no-store"}).then(res => res.text())
    let fs = await fetch('fragment.glsl', {cache:"no-store"}).then(res => res.text())

    window.program = compileShader(vs,fs)

    gl.useProgram(program)

    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)


    fillScreen()
    window.addEventListener('resize', fillScreen)
    document.querySelector('#submit').addEventListener('click', generateTerrain)

    // tick(0) // <- ensure this function is called only once, at the end of setup
}


function generateTerrain() {
    const gridsize = Number(document.querySelector('#gridsize').value) || 2
    const faults = Number(document.querySelector('#faults').value) || 0

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(program)

    window.terrain = setupGeomery(makeTerrain(gridsize, faults))

    console.log('Generating terrain with gridsize', gridsize, 'and', faults, 'faults')

    tick(0)
}

function compileShader(vs_source, fs_source) {
    const vs = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vs, vs_source)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(vs))
        throw Error("Vertex shader compilation failed")
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fs, fs_source)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fs))
        throw Error("Fragment shader compilation failed")
    }

    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program))
        throw Error("Linking failed")
    }
    
    const uniforms = {}
    for(let i=0; i<gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i+=1) {
        let info = gl.getActiveUniform(program, i)
        uniforms[info.name] = gl.getUniformLocation(program, info.name)
    }
    program.uniforms = uniforms

    return program
}

/**
 * Sends per-vertex data to the GPU and connects it to a VS input
 * 
 * @param data    a 2D array of per-vertex data (e.g. [[x,y,z,w],[x,y,z,w],...])
 * @param loc     the layout location of the vertex shader's `in` attribute
 * @param mode    (optional) gl.STATIC_DRAW, gl.DYNAMIC_DRAW, etc
 * 
 * @returns the ID of the buffer in GPU memory; useful for changing data later
 */
function supplyDataBuffer(data, loc, mode) {
    if (mode === undefined) mode = gl.STATIC_DRAW
    
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    const f32 = new Float32Array(data.flat())
    gl.bufferData(gl.ARRAY_BUFFER, f32, mode)
    
    gl.vertexAttribPointer(loc, data[0].length, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(loc)
    
    return buf;
}

/**
 * Creates a Vertex Array Object and puts into it all of the data in the given
 * JSON structure, which should have the following form:
 * 
 * ````
 * {"triangles": a list of of indices of vertices
 * ,"attributes":
 *  [ a list of 1-, 2-, 3-, or 4-vectors, one per vertex to go in location 0
 *  , a list of 1-, 2-, 3-, or 4-vectors, one per vertex to go in location 1
 *  , ...
 *  ]
 * }
 * ````
 * 
 * @returns an object with four keys:
 *  - mode = the 1st argument for gl.drawElements
 *  - count = the 2nd argument for gl.drawElements
 *  - type = the 3rd argument for gl.drawElements
 *  - vao = the vertex array object for use with gl.bindVertexArray
 */
function setupGeomery(geom) {
    var triangleArray = gl.createVertexArray()
    gl.bindVertexArray(triangleArray)

    for(let i=0; i<geom.attributes.length; i+=1) {
        let data = geom.attributes[i]
        supplyDataBuffer(data, i)
    }

    var indices = new Uint16Array(geom.triangles.flat())
    var indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

    return {
        mode: gl.TRIANGLES,
        count: indices.length,
        type: gl.UNSIGNED_SHORT,
        vao: triangleArray
    }
}

function makeTerrain(gridsize, faults) {
    let g = {"triangles":
            [
            
            ]
        ,"attributes":
            [ // position
                [

                ]
            , // normals
                [

                ]
            ] 
    }

    let step = 2 / (gridsize - 1);  // Ensure we fit between -1 and 1

    for (let i = 0; i < gridsize; i++) {
        for (let j = 0; j < gridsize; j++) {
            let x = -1 + j * step
            let z = -1 + i * step

            g.attributes[0].push([x, 0, z, 1])  // position: [x, y, z, w]
            // g.attributes[1].push([0.5, 0.5, 0.5, 1])  // color: [r, g, b, a]
            // g.attributes[1].push([i / (gridsize - 1),  j / (gridsize - 1),  1.0 - i / (gridsize - 1),  1])  // color: [r, g, b, a]
        }
    }

    for (let fault = 0; fault < faults; fault++) {
        // Generate random point p on the grid and random direction vector n⃗
        let px = Math.random() * 2 - 1  
        let pz = Math.random() * 2 - 1  
        let theta = Math.random() * 2 * Math.PI  
        let nx = Math.cos(theta)  
        let nz = Math.sin(theta)

        
        let delta = 0.01; 
        let R = 0.5

        for (let i = 0; i < gridsize; i++) {
            for (let j = 0; j < gridsize; j++) {
                let idx = i * gridsize + j;
                let x = g.attributes[0][idx][0]
                let z = g.attributes[0][idx][2]

                let dotProduct = (x - px) * nx + (z - pz) * nz

                let r = Math.abs(dotProduct) 

                let weight = (r < R) ? Math.pow(1 - (r / R) ** 2, 2) : 0

                if (dotProduct >= 0) {
                    g.attributes[0][idx][1] += delta * weight
                } else {
                    g.attributes[0][idx][1] -= delta * weight
                }
            }
        }
    }

    // Normalize the heights
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < g.attributes[0].length; i++) {
        let y = g.attributes[0][i][1];
        if (y < minY) minY = y
        if (y > maxY) maxY = y
    }

    // Apply normalization: height' = c * (height - 1/2(max + min)) / (max - min)
    let c = 1.0; 
    if (maxY != minY) {  // Avoid division by zero
        for (let i = 0; i < g.attributes[0].length; i++) {
            let y = g.attributes[0][i][1]
            g.attributes[0][i][1] = c * (y - 0.5 * (maxY + minY)) / (maxY - minY)
        }
    }

    for (let i = 0; i < gridsize - 1; i++) {
        for (let j = 0; j < gridsize - 1; j++) {
            let topLeft = i * gridsize + j
            let topRight = topLeft + 1
            let bottomLeft = (i + 1) * gridsize + j
            let bottomRight = bottomLeft + 1

            // First triangle (top-left, top-right, bottom-left)
            g.triangles.push([topLeft, topRight, bottomLeft])

            // Second triangle (top-right, bottom-right, bottom-left)
            g.triangles.push([topRight, bottomRight, bottomLeft])
        }
    }
    addNormals(g)

    console.log(g)

    return g;
}


/** Draw one frame */
function draw(seconds) {
    // gl.clearColor(...IlliniBlue) // f(...[1,2,3]) means f(1,2,3)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(program)
    // fillScreen()

    
    
    gl.bindVertexArray(terrain.vao)

    

    let ld = normalize([1, 1, 0])
    let h = normalize(add(ld, [0, 0, 1]))
    // console.log("light direction", ld)

    gl.uniform4fv(program.uniforms.color, [0.9, 0.8, 0.7, 1])

    gl.uniform3fv(program.uniforms.lightdir, ld)
    gl.uniform3fv(program.uniforms.lightcolor, [1, 1, 1])
    gl.uniform3fv(program.uniforms.halfway, h)

    let v = m4view([2, 2, 1], [0,0,0], [0,1,0])
    // gl.uniformMatrix4fv(program.uniforms.mv, false, v)
    gl.uniformMatrix4fv(program.uniforms.mv, false, m4mul(v, m4rotY(seconds * Math.PI / 4)))
    gl.uniformMatrix4fv(program.uniforms.p, false, p)
    gl.drawElements(terrain.mode, terrain.count, terrain.type, 0)

    // gl.bindVertexArray(tetra.vao)

    // let m = m4rotX(seconds)
    // let v = m4view([0, 10, 10], [0,0,0], [0,1,0]) // eye center up
    // // let v = IdentityMatrix

    // gl.uniform4fv(program.uniforms.color, IlliniOrange)
    // gl.uniformMatrix4fv(program.uniforms.mv, false, m4mul(v, m))
    // gl.uniformMatrix4fv(program.uniforms.p, false, p)
    // gl.drawElements(tetra.mode, tetra.count, tetra.type, 0)

    // gl.bindVertexArray(octa.vao)

    // let m2 = m4mul(m, m4rotX(seconds * 2), m4trans(0, 2, 0))

    // gl.uniformMatrix4fv(program.uniforms.mv, false, m4mul(v, m2))
    // gl.drawElements(octa.mode, octa.count, octa.type, 0)

}

/** Compute any time-varying or animated aspects of the scene */
function tick(milliseconds) {
    let seconds = milliseconds / 1000;

    draw(seconds)
    requestAnimationFrame(tick)
}

/** Resizes the canvas to completely fill the screen */
function fillScreen() {
    let canvas = document.querySelector('canvas')
    document.body.style.margin = '0'
    canvas.style.width = '100vw'
    canvas.style.height = '100vh'
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    canvas.style.width = ''
    canvas.style.height = ''
    if (window.gl) {
        gl.viewport(0,0, canvas.width, canvas.height)
        window.p = m4perspNegZ(0.1, 100, 1, canvas.width, canvas.height)
        // draw()
    }
}

function addNormals(geom) {
    console.log("Adding normals")
    // let ni = geom.attributes.length
    let ni = 1
    // geom.attributes.push([])
    for(let i = 0; i < geom.attributes[0].length; i+=1) {
        geom.attributes[ni].push([0,0,0])
    }
    for(let i = 0; i < geom.triangles.length; i+=1) {
        let p0 = geom.attributes[0][geom.triangles[i][0]]
        let p1 = geom.attributes[0][geom.triangles[i][1]]
        let p2 = geom.attributes[0][geom.triangles[i][2]]
        let e1 = sub(p1,p0)
        let e2 = sub(p2,p0)
        let n = cross(e1,e2)
        n = mul(n, -1) // flip normals
        geom.attributes[ni][geom.triangles[i][0]] = add(geom.attributes[ni][geom.triangles[i][0]], n)
        geom.attributes[ni][geom.triangles[i][1]] = add(geom.attributes[ni][geom.triangles[i][1]], n)
        geom.attributes[ni][geom.triangles[i][2]] = add(geom.attributes[ni][geom.triangles[i][2]], n)
    }
    for(let i = 0; i < geom.attributes[0].length; i+=1) {
        geom.attributes[ni][i] = normalize(geom.attributes[ni][i])
    }

    console.log("Normals added")
}

window.addEventListener('load', setup)
// document.querySelector('#submit').addEventListener('click', generateTerrain)
/** Compile, link, set up geometry */
// window.addEventListener('load', async (event) => {
//     window.gl = document.querySelector('canvas').getContext('webgl2',
//         // optional configuration object: see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
//         {antialias: false, depth:true, preserveDrawingBuffer:true}
//     )
//     let vs = await fetch('vertex.glsl', {cache:"no-store"}).then(res => res.text())
//     let fs = await fetch('fragment.glsl', {cache:"no-store"}).then(res => res.text())
//     window.program = compileShader(vs,fs)
//     gl.enable(gl.DEPTH_TEST)
//     window.geom = setupGeomery(tetrahedron)
//     fillScreen()
//     window.addEventListener('resize', fillScreen)
//     requestAnimationFrame(tick)
// })