# Postprocess GPU Shader vs Integrated Shader Subjective Scenes

Status: accepted

These visual inspection images compare the existing packet/postprocess GPU shader with the integrated Three-native `Algorithm32AtmospherePass` shader for the same browser scene, camera, source, light, and geometry setup.

## Gallery

- `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-gallery.png`

## Cases

- distant-midday: side-by-side `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/distant-midday/postprocess-vs-integrated-side-by-side.png`, postprocess `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/distant-midday/postprocess-gpu-shader.png`, integrated `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/distant-midday/integrated-three-native-shader.png`, maxAbsRgbDelta=66, p99=1.
- distant-sunset-behind-camera: side-by-side `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/distant-sunset-behind-camera/postprocess-vs-integrated-side-by-side.png`, postprocess `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/distant-sunset-behind-camera/postprocess-gpu-shader.png`, integrated `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/distant-sunset-behind-camera/integrated-three-native-shader.png`, maxAbsRgbDelta=9, p99=1.
- local-closest: side-by-side `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/local-closest/postprocess-vs-integrated-side-by-side.png`, postprocess `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/local-closest/postprocess-gpu-shader.png`, integrated `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/local-closest/integrated-three-native-shader.png`, maxAbsRgbDelta=104, p99=1.
- local-090deg: side-by-side `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/local-090deg/postprocess-vs-integrated-side-by-side.png`, postprocess `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/local-090deg/postprocess-gpu-shader.png`, integrated `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/postprocess-vs-integrated-cases/local-090deg/integrated-three-native-shader.png`, maxAbsRgbDelta=116, p99=1.

This is subjective comparison material. The deltas are recorded for inspection, not as a new parity gate.
