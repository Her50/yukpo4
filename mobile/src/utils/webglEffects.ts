// ✅ NOUVEAU: Utilitaires WebGL pour effets vidéo temps réel
// Ces shaders peuvent être utilisés avec expo-gl pour effets GPU-accelerated

/**
 * Shaders WebGL pour effets vidéo
 * Peuvent être utilisés avec expo-gl dans le futur pour performance maximale
 */

export interface WebGLShader {
    vertexShader: string;
    fragmentShader: string;
    uniforms?: Record<string, { type: string; value: any }>;
}

/**
 * Shader de base pour rendu vidéo
 */
export const baseVideoShader: WebGLShader = {
    vertexShader: `
        attribute vec2 position;
        attribute vec2 texCoord;
        varying vec2 vTexCoord;
        
        void main() {
            gl_Position = vec4(position, 0.0, 1.0);
            vTexCoord = texCoord;
        }
    `,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        varying vec2 vTexCoord;
        
        void main() {
            gl_FragColor = texture2D(uTexture, vTexCoord);
        }
    `,
};

/**
 * Shader pour effet fade
 */
export const fadeShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uIntensity;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            gl_FragColor = vec4(color.rgb, color.a * uIntensity);
        }
    `,
    uniforms: {
        uIntensity: { type: 'float', value: 1.0 },
    },
};

/**
 * Shader pour effet blur
 */
export const blurShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform vec2 uResolution;
        uniform float uBlurAmount;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = vec4(0.0);
            vec2 texelSize = 1.0 / uResolution;
            float totalWeight = 0.0;
            
            for (int x = -2; x <= 2; x++) {
                for (int y = -2; y <= 2; y++) {
                    float weight = exp(-float(x*x + y*y) / (2.0 * uBlurAmount * uBlurAmount));
                    vec2 offset = vec2(float(x), float(y)) * texelSize;
                    color += texture2D(uTexture, vTexCoord + offset) * weight;
                    totalWeight += weight;
                }
            }
            
            gl_FragColor = color / totalWeight;
        }
    `,
    uniforms: {
        uResolution: { type: 'vec2', value: [1.0, 1.0] },
        uBlurAmount: { type: 'float', value: 2.0 },
    },
};

/**
 * Shader pour effet vintage
 */
export const vintageShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            
            // Séparation des canaux
            float r = color.r;
            float g = color.g;
            float b = color.b;
            
            // Teinte sépia
            float tr = 0.393 * r + 0.769 * g + 0.189 * b;
            float tg = 0.349 * r + 0.686 * g + 0.168 * b;
            float tb = 0.272 * r + 0.534 * g + 0.131 * b;
            
            // Désaturation légère
            vec3 sepia = vec3(tr, tg, tb);
            vec3 gray = vec3((r + g + b) / 3.0);
            vec3 final = mix(sepia, gray, 0.3);
            
            // Contraste augmenté
            final = (final - 0.5) * 1.2 + 0.5;
            
            gl_FragColor = vec4(final, color.a);
        }
    `,
};

/**
 * Shader pour effet noir et blanc
 */
export const blackWhiteShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            gl_FragColor = vec4(vec3(gray), color.a);
        }
    `,
};

/**
 * Shader pour effet zoom
 */
export const zoomShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uZoom;
        uniform vec2 uCenter;
        varying vec2 vTexCoord;
        
        void main() {
            vec2 centered = (vTexCoord - uCenter) / uZoom + uCenter;
            
            if (centered.x < 0.0 || centered.x > 1.0 || centered.y < 0.0 || centered.y > 1.0) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            } else {
                gl_FragColor = texture2D(uTexture, centered);
            }
        }
    `,
    uniforms: {
        uZoom: { type: 'float', value: 1.0 },
        uCenter: { type: 'vec2', value: [0.5, 0.5] },
    },
};

/**
 * Shader pour effet glow
 */
export const glowShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uGlowIntensity;
        uniform vec2 uResolution;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            
            // Échantillonnage pour glow
            vec4 glow = vec4(0.0);
            vec2 texelSize = 1.0 / uResolution;
            
            for (int x = -1; x <= 1; x++) {
                for (int y = -1; y <= 1; y++) {
                    if (x == 0 && y == 0) continue;
                    vec2 offset = vec2(float(x), float(y)) * texelSize * 2.0;
                    glow += texture2D(uTexture, vTexCoord + offset);
                }
            }
            
            glow /= 8.0;
            
            // Mélange avec couleur originale
            vec3 final = color.rgb + glow.rgb * uGlowIntensity;
            final = clamp(final, 0.0, 1.0);
            
            gl_FragColor = vec4(final, color.a);
        }
    `,
    uniforms: {
        uGlowIntensity: { type: 'float', value: 0.5 },
        uResolution: { type: 'vec2', value: [1.0, 1.0] },
    },
};

/**
 * Shader pour effet sharpen
 */
export const sharpenShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform vec2 uResolution;
        uniform float uSharpness;
        varying vec2 vTexCoord;
        
        void main() {
            vec2 texelSize = 1.0 / uResolution;
            
            vec4 center = texture2D(uTexture, vTexCoord);
            vec4 left = texture2D(uTexture, vTexCoord + vec2(-texelSize.x, 0.0));
            vec4 right = texture2D(uTexture, vTexCoord + vec2(texelSize.x, 0.0));
            vec4 top = texture2D(uTexture, vTexCoord + vec2(0.0, -texelSize.y));
            vec4 bottom = texture2D(uTexture, vTexCoord + vec2(0.0, texelSize.y));
            
            vec4 sharpened = center * (1.0 + 4.0 * uSharpness) - (left + right + top + bottom) * uSharpness;
            
            gl_FragColor = clamp(sharpened, 0.0, 1.0);
        }
    `,
    uniforms: {
        uResolution: { type: 'vec2', value: [1.0, 1.0] },
        uSharpness: { type: 'float', value: 0.3 },
    },
};

/**
 * Shader pour effet neon
 */
export const neonShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uBrightness;
        uniform float uContrast;
        uniform float uSaturation;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            vec3 rgb = color.rgb;
            
            // Ajustement luminosité
            rgb += uBrightness;
            
            // Ajustement contraste
            rgb = (rgb - 0.5) * uContrast + 0.5;
            
            // Ajustement saturation
            float gray = dot(rgb, vec3(0.299, 0.587, 0.114));
            rgb = mix(vec3(gray), rgb, uSaturation);
            
            gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        uBrightness: { type: 'float', value: 0.2 },
        uContrast: { type: 'float', value: 1.5 },
        uSaturation: { type: 'float', value: 2.0 },
    },
};

/**
 * Shader pour effet warm (tons chauds)
 */
export const warmShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uRedShift;
        uniform float uBlueShift;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            vec3 rgb = color.rgb;
            
            // Décalage vers tons chauds
            rgb.r += uRedShift;
            rgb.b += uBlueShift;
            
            gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        uRedShift: { type: 'float', value: 0.3 },
        uBlueShift: { type: 'float', value: -0.3 },
    },
};

/**
 * Shader pour effet cool (tons froids)
 */
export const coolShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uRedShift;
        uniform float uBlueShift;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            vec3 rgb = color.rgb;
            
            // Décalage vers tons froids
            rgb.r += uRedShift;
            rgb.b += uBlueShift;
            
            gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        uRedShift: { type: 'float', value: -0.2 },
        uBlueShift: { type: 'float', value: 0.2 },
    },
};

/**
 * Shader pour effet sepia
 */
export const sepiaShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            float r = color.r;
            float g = color.g;
            float b = color.b;
            
            // Matrice sépia
            float tr = 0.393 * r + 0.769 * g + 0.189 * b;
            float tg = 0.349 * r + 0.686 * g + 0.168 * b;
            float tb = 0.272 * r + 0.534 * g + 0.131 * b;
            
            gl_FragColor = vec4(tr, tg, tb, color.a);
        }
    `,
};

/**
 * Shader pour ajustement contraste
 */
export const contrastShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uContrast;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            vec3 rgb = (color.rgb - 0.5) * uContrast + 0.5;
            gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        uContrast: { type: 'float', value: 1.5 },
    },
};

/**
 * Shader pour ajustement saturation
 */
export const saturationShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uSaturation;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            vec3 rgb = mix(vec3(gray), color.rgb, uSaturation);
            gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        uSaturation: { type: 'float', value: 1.5 },
    },
};

/**
 * Shader pour ajustement luminosité
 */
export const brightnessShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uBrightness;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            vec3 rgb = color.rgb + uBrightness;
            gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        uBrightness: { type: 'float', value: 0.2 },
    },
};

/**
 * Shader pour ajustement teinte (hue)
 */
export const hueShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uHueShift;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            vec3 rgb = color.rgb;
            
            // Conversion RGB vers HSV
            float maxVal = max(max(rgb.r, rgb.g), rgb.b);
            float minVal = min(min(rgb.r, rgb.g), rgb.b);
            float delta = maxVal - minVal;
            
            float hue = 0.0;
            if (delta != 0.0) {
                if (maxVal == rgb.r) {
                    hue = mod((rgb.g - rgb.b) / delta + (rgb.g < rgb.b ? 6.0 : 0.0), 6.0);
                } else if (maxVal == rgb.g) {
                    hue = (rgb.b - rgb.r) / delta + 2.0;
                } else {
                    hue = (rgb.r - rgb.g) / delta + 4.0;
                }
                hue /= 6.0;
            }
            
            // Décalage de teinte
            hue += uHueShift;
            hue = mod(hue, 1.0);
            
            // Conversion HSV vers RGB (simplifiée)
            float c = delta;
            float x = c * (1.0 - abs(mod(hue * 6.0, 2.0) - 1.0));
            float m = minVal;
            
            vec3 rgbOut;
            if (hue < 1.0/6.0) rgbOut = vec3(c, x, 0.0);
            else if (hue < 2.0/6.0) rgbOut = vec3(x, c, 0.0);
            else if (hue < 3.0/6.0) rgbOut = vec3(0.0, c, x);
            else if (hue < 4.0/6.0) rgbOut = vec3(0.0, x, c);
            else if (hue < 5.0/6.0) rgbOut = vec3(x, 0.0, c);
            else rgbOut = vec3(c, 0.0, x);
            
            rgbOut += m;
            
            gl_FragColor = vec4(clamp(rgbOut, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        uHueShift: { type: 'float', value: 0.0 },
    },
};

/**
 * Shader pour inversion des couleurs
 */
export const invertShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            gl_FragColor = vec4(1.0 - color.rgb, color.a);
        }
    `,
};

/**
 * Shader pour effet vignette
 */
export const vignetteShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uIntensity;
        uniform vec2 uResolution;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            vec2 center = vec2(0.5, 0.5);
            vec2 coord = vTexCoord;
            float dist = distance(coord, center);
            float vignette = 1.0 - smoothstep(0.3, 0.8, dist) * uIntensity;
            gl_FragColor = vec4(color.rgb * vignette, color.a);
        }
    `,
    uniforms: {
        uIntensity: { type: 'float', value: 0.5 },
        uResolution: { type: 'vec2', value: [1.0, 1.0] },
    },
};

/**
 * Shader pour effet pixelate
 */
export const pixelateShader: WebGLShader = {
    vertexShader: baseVideoShader.vertexShader,
    fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uPixelSize;
        uniform vec2 uResolution;
        varying vec2 vTexCoord;
        
        void main() {
            vec2 texelSize = 1.0 / uResolution;
            vec2 pixelated = floor(vTexCoord / (texelSize * uPixelSize)) * (texelSize * uPixelSize);
            gl_FragColor = texture2D(uTexture, pixelated);
        }
    `,
    uniforms: {
        uPixelSize: { type: 'float', value: 10.0 },
        uResolution: { type: 'vec2', value: [1.0, 1.0] },
    },
};

/**
 * Mappe un nom d'effet à son shader WebGL
 */
export const getShaderForEffect = (effectName: string): WebGLShader | null => {
    const shaderMap: Record<string, WebGLShader> = {
        // Transitions
        fade: fadeShader,
        zoom: zoomShader,

        // Effets visuels
        blur: blurShader,
        sharpen: sharpenShader,
        glow: glowShader,
        neon: neonShader,
        vintage: vintageShader,
        blackwhite: blackWhiteShader,
        warm: warmShader,
        cool: coolShader,
        sepia: sepiaShader,
        contrast: contrastShader,
        saturation: saturationShader,
        brightness: brightnessShader,
        hue: hueShader,
        invert: invertShader,
        pixelate: pixelateShader,

        // Spéciaux
        vignette: vignetteShader,
    };

    return shaderMap[effectName.toLowerCase()] || null;
};

/**
 * Liste tous les shaders disponibles
 */
export const getAvailableShaders = (): string[] => {
    return [
        'fade',
        'blur',
        'vintage',
        'blackwhite',
        'zoom',
        'glow',
        'sharpen',
        'neon',
        'warm',
        'cool',
        'sepia',
        'contrast',
        'saturation',
        'brightness',
        'hue',
        'invert',
        'pixelate',
        'vignette',
    ];
};

