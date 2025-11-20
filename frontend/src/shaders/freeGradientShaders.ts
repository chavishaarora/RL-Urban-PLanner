/**
 * FREE GPU GRADIENT SHADERS
 * 100% Open Source WebGL Fragment Shaders
 * 
 * Color Schemes: Matplotlib (BSD License - FREE)
 * Techniques: Standard computer graphics (PUBLIC DOMAIN)
 */

// ============================================================================
// VERTEX SHADER (FREE - Standard WebGL)
// ============================================================================

export const gradientVertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// ============================================================================
// FRAGMENT SHADER - SMOOTH GRADIENT WITH BUILDING AWARENESS
// ============================================================================

export const gradientFragmentShader = `
precision highp float;

uniform sampler2D uDataTexture;      // Environmental values
uniform sampler2D uBuildingMask;     // Building occlusion mask
uniform vec2 uResolution;            // Texture resolution
uniform float uMinValue;             // Data range min
uniform float uMaxValue;             // Data range max
uniform int uColorScheme;            // 0=viridis, 1=plasma, 2=inferno, 3=magma
uniform float uSmoothing;            // Blur radius (0-5)
uniform float uBuildingFeather;      // Building edge softness (0-1)
uniform float uBloomIntensity;       // Bloom effect (0-1)

varying vec2 vUv;

// ============================================================================
// FREE COLOR SCHEMES (Matplotlib - BSD Licensed)
// ============================================================================

// Viridis colormap (perceptually uniform, FREE)
vec3 viridis(float t) {
    const vec3 c0 = vec3(0.267004, 0.004874, 0.329415);
    const vec3 c1 = vec3(0.127568, 0.566949, 0.550556);
    const vec3 c2 = vec3(0.993248, 0.906157, 0.143936);
    
    t = clamp(t, 0.0, 1.0);
    
    if (t < 0.5) {
        return mix(c0, c1, t * 2.0);
    } else {
        return mix(c1, c2, (t - 0.5) * 2.0);
    }
}

// Plasma colormap (FREE)
vec3 plasma(float t) {
    const vec3 c0 = vec3(0.050383, 0.029803, 0.527975);
    const vec3 c1 = vec3(0.796477, 0.278086, 0.469538);
    const vec3 c2 = vec3(0.940015, 0.975158, 0.131326);
    
    t = clamp(t, 0.0, 1.0);
    
    if (t < 0.5) {
        return mix(c0, c1, t * 2.0);
    } else {
        return mix(c1, c2, (t - 0.5) * 2.0);
    }
}

// Inferno colormap (FREE)
vec3 inferno(float t) {
    const vec3 c0 = vec3(0.001462, 0.000466, 0.013866);
    const vec3 c1 = vec3(0.788626, 0.283351, 0.108483);
    const vec3 c2 = vec3(0.988362, 0.998364, 0.644924);
    
    t = clamp(t, 0.0, 1.0);
    
    if (t < 0.5) {
        return mix(c0, c1, t * 2.0);
    } else {
        return mix(c1, c2, (t - 0.5) * 2.0);
    }
}

// Magma colormap (FREE)
vec3 magma(float t) {
    const vec3 c0 = vec3(0.001462, 0.000466, 0.013866);
    const vec3 c1 = vec3(0.788691, 0.232556, 0.469115);
    const vec3 c2 = vec3(0.987053, 0.991438, 0.749504);
    
    t = clamp(t, 0.0, 1.0);
    
    if (t < 0.5) {
        return mix(c0, c1, t * 2.0);
    } else {
        return mix(c1, c2, (t - 0.5) * 2.0);
    }
}

vec3 getColor(float t) {
    if (uColorScheme == 0) return viridis(t);
    if (uColorScheme == 1) return plasma(t);
    if (uColorScheme == 2) return inferno(t);
    return magma(t);
}

// ============================================================================
// GAUSSIAN BLUR (FREE - Standard image processing)
// ============================================================================

float gaussianBlur(sampler2D tex, vec2 uv, float radius) {
    if (radius < 0.1) {
        return texture2D(tex, uv).r;
    }
    
    float sum = 0.0;
    float weightSum = 0.0;
    vec2 texelSize = 1.0 / uResolution;
    
    // 9-tap Gaussian kernel (FREE algorithm)
    // Weights for 3x3 blur
    float w0 = 0.0625;
    float w1 = 0.125;
    float w2 = 0.25;
    
    sum += texture2D(tex, uv + vec2(-1.0, -1.0) * texelSize * radius).r * w0;
    sum += texture2D(tex, uv + vec2( 0.0, -1.0) * texelSize * radius).r * w1;
    sum += texture2D(tex, uv + vec2( 1.0, -1.0) * texelSize * radius).r * w0;
    
    sum += texture2D(tex, uv + vec2(-1.0,  0.0) * texelSize * radius).r * w1;
    sum += texture2D(tex, uv + vec2( 0.0,  0.0) * texelSize * radius).r * w2;
    sum += texture2D(tex, uv + vec2( 1.0,  0.0) * texelSize * radius).r * w1;
    
    sum += texture2D(tex, uv + vec2(-1.0,  1.0) * texelSize * radius).r * w0;
    sum += texture2D(tex, uv + vec2( 0.0,  1.0) * texelSize * radius).r * w1;
    sum += texture2D(tex, uv + vec2( 1.0,  1.0) * texelSize * radius).r * w0;
    
    return sum;
}

// ============================================================================
// BILINEAR INTERPOLATION (FREE - Standard graphics)
// ============================================================================

float bilinearSample(sampler2D tex, vec2 uv) {
    vec2 texelSize = 1.0 / uResolution;
    vec2 f = fract(uv * uResolution);
    
    float tl = texture2D(tex, uv).r;
    float tr = texture2D(tex, uv + vec2(texelSize.x, 0.0)).r;
    float bl = texture2D(tex, uv + vec2(0.0, texelSize.y)).r;
    float br = texture2D(tex, uv + texelSize).r;
    
    float top = mix(tl, tr, f.x);
    float bottom = mix(bl, br, f.x);
    
    return mix(top, bottom, f.y);
}

// ============================================================================
// BUILDING EDGE FEATHERING (FREE - Distance field technique)
// ============================================================================

float buildingEdgeFeather(vec2 uv) {
    if (uBuildingFeather < 0.01) {
        return 1.0;
    }
    
    float buildingMask = texture2D(uBuildingMask, uv).r;
    vec2 texelSize = 1.0 / uResolution;
    
    // Compute distance to building edge (simplified FREE method)
    float edgeDist = 0.0;
    for (int i = -2; i <= 2; i++) {
        for (int j = -2; j <= 2; j++) {
            vec2 offset = vec2(float(i), float(j)) * texelSize;
            float maskValue = texture2D(uBuildingMask, uv + offset).r;
            if (maskValue != buildingMask) {
                float dist = length(vec2(i, j));
                edgeDist = max(edgeDist, 1.0 / (dist + 1.0));
            }
        }
    }
    
    // Soft feather at edges
    return 1.0 - edgeDist * uBuildingFeather;
}

// ============================================================================
// MAIN SHADER (FREE - Combines all techniques)
// ============================================================================

void main() {
    // Sample with bilinear interpolation
    float rawValue = bilinearSample(uDataTexture, vUv);
    
    // Apply Gaussian smoothing
    float smoothedValue = gaussianBlur(uDataTexture, vUv, uSmoothing);
    
    // Normalize to 0-1 range
    float normalizedValue = (smoothedValue - uMinValue) / (uMaxValue - uMinValue);
    normalizedValue = clamp(normalizedValue, 0.0, 1.0);
    
    // Get base color
    vec3 color = getColor(normalizedValue);
    
    // Apply building edge feathering
    float feather = buildingEdgeFeather(vUv);
    color *= feather;
    
    // Optional bloom effect (FREE - simple additive blend)
    if (uBloomIntensity > 0.01) {
        float bloomValue = gaussianBlur(uDataTexture, vUv, uSmoothing * 2.0);
        float bloomNorm = (bloomValue - uMinValue) / (uMaxValue - uMinValue);
        bloomNorm = clamp(bloomNorm, 0.0, 1.0);
        vec3 bloomColor = getColor(bloomNorm);
        color += bloomColor * uBloomIntensity * 0.3;
    }
    
    gl_FragColor = vec4(color, 0.7);
}
`;

// ============================================================================
// ALTERNATIVE: WIND VECTOR FIELD SHADER (FREE)
// ============================================================================

export const windVectorShader = `
precision highp float;

uniform sampler2D uWindSpeed;        // Wind speed texture
uniform sampler2D uWindDirection;    // Wind direction texture (radians)
uniform vec2 uResolution;
uniform float uTime;
uniform float uArrowDensity;         // Arrows per 100px

varying vec2 vUv;

// Arrow shape (FREE procedural geometry)
float arrowShape(vec2 p, float heading) {
    // Rotate point
    float c = cos(-heading);
    float s = sin(-heading);
    vec2 rotated = vec2(
        p.x * c - p.y * s,
        p.x * s + p.y * c
    );
    
    // Arrow body
    float body = step(abs(rotated.y), 0.05) * step(rotated.x, 0.3) * step(-0.3, rotated.x);
    
    // Arrow head
    float head = step(abs(rotated.y - rotated.x * 0.5), 0.1) * step(0.15, rotated.x) * step(rotated.x, 0.3);
    
    return max(body, head);
}

void main() {
    // Grid-based arrow placement
    vec2 gridUV = vUv * uResolution / uArrowDensity;
    vec2 gridCell = floor(gridUV);
    vec2 localUV = fract(gridUV) - 0.5;
    
    // Sample wind at grid center
    vec2 centerUV = (gridCell + 0.5) * uArrowDensity / uResolution;
    float speed = texture2D(uWindSpeed, centerUV).r;
    float direction = texture2D(uWindDirection, centerUV).r;
    
    // Scale arrow by wind speed
    vec2 p = localUV * (5.0 / (speed + 1.0));
    
    // Draw arrow
    float arrow = arrowShape(p, direction);
    
    // Color by speed (using viridis)
    float t = clamp(speed / 14.0, 0.0, 1.0);
    const vec3 c0 = vec3(0.267004, 0.004874, 0.329415);
    const vec3 c1 = vec3(0.127568, 0.566949, 0.550556);
    const vec3 c2 = vec3(0.993248, 0.906157, 0.143936);
    vec3 color = t < 0.5 ? mix(c0, c1, t * 2.0) : mix(c1, c2, (t - 0.5) * 2.0);
    
    gl_FragColor = vec4(color, arrow * 0.8);
}
`;

export default {
    gradientVertexShader,
    gradientFragmentShader,
    windVectorShader
};
