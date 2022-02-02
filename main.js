
// used tutorials: 
// Textures: https://www.youtube.com/watch?v=aJun0Q0CG_A
// Raycasting: https://www.youtube.com/watch?v=ZYi0xGp882I

// environment texture:
// https://polyhaven.com/a/empty_warehouse_01

import * as THREE from "./node_modules/three/build/three.module.js";
import { OrbitControls } from "./node_modules/three/examples/jsm/controls/OrbitControls.js";
import { FlakesTexture } from "./node_modules/three/examples/jsm/textures/FlakesTexture.js";
import { RGBELoader } from "./node_modules/three/examples/jsm/loaders/RGBELoader.js";
import GUI from './node_modules/lil-gui/dist/lil-gui.esm.js';

let scene, renderer, camera, ambLight, controls, raycaster, envMapTexture, texture, sphere;
let palette = []

function main(){


    /** SETUP */

    // scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x808080 );
    scene.fog = new THREE.Fog( 0x808080, 40, 90);

    // camera
    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        1,
        1000
    );
    camera.position.x = 0;
    camera.position.y = 5;
    camera.position.z = 40;
    camera.lookAt(new THREE.Vector3(0,0,0));
    
    // lights
    ambLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambLight);

    const numLights = 2;
    for (let i = 0; i < numLights; i++)
    {
        const light = new THREE.PointLight(0xffffff, 0.2); 
        light.position.set((Math.random() - 0.5) * 2 * 10, (Math.random() - 0.5) * 2 * 10, (Math.random() - 0.5) * 2 * 10);
        light.castShadow = true;
        scene.add(light);
    }

    // renderer
    renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    document.getElementById("webgl").appendChild(renderer.domElement);

    // user controls
    controls = new OrbitControls( camera, renderer.domElement );
    controls.enableDamping = true;
    controls.update();

    // raycaster
    raycaster = new THREE.Raycaster();
    const MAX_CLICK_DISTANCE = 3;
    const originalNormals = true;

    // GUI
    let sculpt_params = {
        strength: 1,
        radius: MAX_CLICK_DISTANCE, 
        use_original_normals: originalNormals
    };
    
    const gui = new GUI();
    const sculptFolder = gui.addFolder('Sculpt');
    sculptFolder.add(sculpt_params, 'strength', -2, 2);
    sculptFolder.add(sculpt_params, 'radius', 0.5, 10);
    sculptFolder.add(sculpt_params, 'use_original_normals');

    // colors
    palette[0] = 0x01295F;
    palette[1] = 0xFFB30F;
    palette[2] = 0xFD151B; 

    /** SETUP DONE */


    // need this definition as I have no idea how to properly handle callback functions and sphere might be undefined otherwise ¯\_(ツ)_/¯
    const sphereGeo = new THREE.SphereBufferGeometry(8, 300, 300);
    const newSphereMat = new THREE.MeshPhysicalMaterial();
    sphere = new THREE.Mesh(sphereGeo, newSphereMat);

    // load environment texture
    // texture from: https://polyhaven.com/a/empty_warehouse_01
    const envMapLoader = new THREE.PMREMGenerator(renderer);
    new RGBELoader().setPath("textures/").load("empty_warehouse_01_2k.hdr", function(hdrMap){

        envMapTexture = envMapLoader.fromCubemap(hdrMap);
        
        // get texture used on spheres
        texture = new THREE.CanvasTexture(new FlakesTexture());
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.x = 10;
        texture.repeat.y = 6;

        // create first sphere 
        sphere = generateSphere(8, pickColor(), new THREE.Vector3(0.0));
    } );
    
    const normalsX = [];
    const normalsY = [];
    const normalsZ = [];
    for (let i = 0; i < sphere.geometry.attributes.normal.count; i++){
        normalsX[i] = sphere.geometry.attributes.normal.getX(i)
        normalsY[i] = sphere.geometry.attributes.normal.getY(i)
        normalsZ[i] = sphere.geometry.attributes.normal.getZ(i)
    }

    // event for clicking --> Adding a permanent sphere
    window.addEventListener('pointerdown', event => {
        const clickMouse = new THREE.Vector2();
        let rect = renderer.domElement.getBoundingClientRect();
        clickMouse.x = ((event.clientX - rect.left)/ (rect.right - rect.left)) * 2 - 1;
        clickMouse.y = -((event.clientY - rect.top)/ (rect.bottom - rect.top)) * 2 + 1;
        raycaster.setFromCamera(clickMouse, camera);
        const isect = raycaster.intersectObjects(scene.children);
        if(isect.length > 0 && isect[0].object.geometry){
            const mesh = isect[0].object;
            const geometry = mesh.geometry;
            const point = isect[0].point;
            const face = isect[0].face;

            let normal = new THREE.Vector3(face.normal.x, face.normal.y, face.normal.z);
            
            for (let i = 0; i < geometry.attributes.position.count; i++){
                let vector3 = new THREE.Vector3(geometry.attributes.position.getX(i), geometry.attributes.position.getY(i), geometry.attributes.position.getZ(i));
                const toWorld = mesh.localToWorld(vector3);
                const distance = point.distanceTo(toWorld);
                if (distance < sculpt_params.radius){
                    const pushHeight = Math.sin((((sculpt_params.radius - distance) / sculpt_params.radius) * 2 - 1) * 0.5* Math.PI) + 1;
                    const push = sculpt_params.strength * pushHeight;
                    if(sculpt_params.use_original_normals){
                        geometry.attributes.position.setX(i, geometry.attributes.position.getX(i) + push * normalsX[i]);
                        geometry.attributes.position.setY(i, geometry.attributes.position.getY(i) + push * normalsY[i]);
                        geometry.attributes.position.setZ(i, geometry.attributes.position.getZ(i) + push * normalsZ[i]);                    
                    }
                    else{
                        geometry.attributes.position.setX(i, geometry.attributes.position.getX(i) + push * normal.x);
                        geometry.attributes.position.setY(i, geometry.attributes.position.getY(i) + push * normal.y);
                        geometry.attributes.position.setZ(i, geometry.attributes.position.getZ(i) + push * normal.z);  
                    }
                }
            }
            geometry.computeVertexNormals();
            geometry.attributes.position.needsUpdate = true;
            geometry.computeBoundingSphere();
        }
    })

    window.addEventListener('resize', event =>	{
        onResize();
	})

    render();
}

function render() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

// pick random color from palette 
function pickColor(){
    const colorPicker = Math.random();
    const index = Math.floor(palette.length * colorPicker);
    return(palette[index])
}

// generate permanent sphere
function generateSphere(size, color, position){
    const sphereGeo = new THREE.SphereBufferGeometry(size, 300, 300);

    const newSphereMaterial = {
        clearcoat: 1.0,
        clearcoatRoughness: 0.2,
        clearcoatRoughnessMap: texture,
        metalness: 0.9,
        roughness: 0.5,
        color: color,
        normalMap: texture,
        normalScale: new THREE.Vector2(0.15, 0.15),
        envMap: envMapTexture.texture,
        envMapIntensity: 0.7,
        sheen: 0.2,
        sheenColor: 0x0000ff
    };
    const newSphereMat = new THREE.MeshPhysicalMaterial(newSphereMaterial);
    const sphereMesh = new THREE.Mesh(sphereGeo, newSphereMat);
    sphereMesh.position.set(position.x, position.y, position.z);
    sphereMesh.castShadow = true;
    sphereMesh.receiveShadow = true;
    
    scene.add(sphereMesh);
    return sphereMesh;
}

function onResize(){
    let width = window.innerWidth;
    let height = window.innerHeight;
    renderer.setSize( width, height );
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

main();