import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// ── Model3D ──────────────────────────────────────────────────────────────
// Renders a real .glb/.gltf model (via expo-gl + three.js) instead of an
// emoji, for "win" moments across the games (trophies, medals, etc).
//
// `source` must be a `require('../assets/models/whatever.glb')` reference —
// metro.config.js registers glb/gltf as binary asset extensions so that
// resolves to a loadable asset the same way an image require() would.
//
// Loading is done by hand (Asset.downloadAsync -> fetch -> GLTFLoader.parse)
// instead of expo-three's loadAsync() helper, so a failure at any stage
// reports exactly *which* stage failed (resolve/fetch/parse) rather than
// one opaque "failed to load".
//
// The model is auto-centered and auto-scaled to a consistent size
// regardless of the source file's own units/origin, since exported models
// vary wildly on both — without this every new .glb would need its own
// hand-tuned camera distance and position.
export default function Model3D({
  source, size = 120, autoRotate = true, rotationSpeed = 0.6, style,
}) {
  const [loading, setLoading]   = useState(true);
  const [failed, setFailed]     = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const rafId       = useRef(null);
  const modelRef    = useRef(null);
  const rendererRef = useRef(null);

  const onContextCreate = useCallback(async (gl) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0); // transparent, so it sits over any card/background
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      35,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0.15, 4);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xfff3c4, 0.45);
    fillLight.position.set(-3, -1.5, -2);
    scene.add(fillLight);

    let stage = 'resolve';
    try {
      const asset = Asset.fromModule(source);
      if (!asset.localUri) await asset.downloadAsync();
      const uri = asset.localUri || asset.uri;
      if (!uri) throw new Error('asset has no localUri/uri after downloadAsync');

      stage = 'fetch';
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`fetch responded ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();

      stage = 'parse';
      const gltf = await new Promise((resolve, reject) => {
        new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
      });

      const model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
      if (!model) throw new Error('.glb parsed but has no scene');

      // Center at the origin and scale to fit a consistent ~2-unit span,
      // regardless of the model's original export scale/pivot.
      const box = new THREE.Box3().setFromObject(model);
      const dims = new THREE.Vector3();
      box.getSize(dims);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const maxDim = Math.max(dims.x, dims.y, dims.z) || 1;
      const scale = 2 / maxDim;
      model.scale.setScalar(scale);
      model.position.sub(center.multiplyScalar(scale));

      scene.add(model);
      modelRef.current = model;
      setLoading(false);
    } catch (e) {
      const msg = `[${stage}] ${e?.message || String(e)}`;
      if (__DEV__) console.warn('Model3D failed to load:', msg);
      setErrorMsg(msg);
      setFailed(true);
      setLoading(false);
      return;
    }

    if (!autoRotate) {
      // Static usage (e.g. a small always-mounted header icon) — render
      // one frame and stop. Running a perpetual requestAnimationFrame loop
      // for a picture that never changes would burn GPU/battery for the
      // entire time the screen is open, for no visual benefit.
      renderer.render(scene, camera);
      gl.endFrameEXP();
      return;
    }

    let lastTime = Date.now();
    const tick = () => {
      rafId.current = requestAnimationFrame(tick);
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      if (modelRef.current) {
        modelRef.current.rotation.y += dt * rotationSpeed;
      }
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    tick();
  }, [source, autoRotate, rotationSpeed]);

  useEffect(() => () => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rendererRef.current?.dispose?.();
  }, []);

  // On failure: in dev, show the actual error text so it can be read/
  // screenshotted straight off the screen instead of hunting terminal
  // logs. In production, degrade to blank rather than a broken layout.
  if (failed) {
    return (
      <View style={[{ width: size, height: size }, style, __DEV__ && styles.errorBox]}>
        {__DEV__ && (
          <Text style={styles.errorText} numberOfLines={6}>{errorMsg}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      {loading && (
        <ActivityIndicator style={StyleSheet.absoluteFill} color="#FFD700" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    borderWidth: 1, borderColor: '#B00020', borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', padding: 2,
    backgroundColor: 'rgba(176,0,32,0.08)',
  },
  errorText: { fontSize: 7, color: '#B00020', textAlign: 'center' },
});
