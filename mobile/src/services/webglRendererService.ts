// ✅ Service WebGL pour rendu GPU accéléré avec optimisations (texture caching, frame pooling)

// Note: expo-gl sera installé plus tard, types temporaires
// import { GLView } from 'expo-gl';
import { WebGLShader as WebGLShaderType } from '../utils/webglEffects';

interface TextureCacheEntry {
    texture: WebGLTexture;
    lastUsed: number;
    size: number;
}

interface FramePoolEntry {
    frameBuffer: WebGLFramebuffer;
    texture: WebGLTexture;
    width: number;
    height: number;
    inUse: boolean;
}

/**
 * Service optimisé pour rendu WebGL avec cache de textures et pool de frames
 */
export class WebGLRendererService {
    private textureCache: Map<string, TextureCacheEntry> = new Map();
    private framePool: FramePoolEntry[] = [];
    private maxCacheSize: number = 50 * 1024 * 1024; // 50 MB
    private currentCacheSize: number = 0;
    private maxFramePoolSize: number = 10;
    private gl: WebGLRenderingContext | null = null;
    private shaderCache: Map<string, WebGLProgram> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;

    /**
     * Initialise le contexte WebGL et les ressources
     */
    async init(gl: WebGLRenderingContext): Promise<WebGLTexture> {
        this.gl = gl;

        // Configuration WebGL optimisée
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

        // Démarrer le nettoyage périodique du cache
        this.startCacheCleanup();

        // Créer texture initiale
        return this.createTexture(gl);
    }

    /**
     * Crée une texture WebGL
     */
    private createTexture(gl: WebGLRenderingContext): WebGLTexture {
        const texture = gl.createTexture();
        if (!texture) {
            throw new Error('Failed to create WebGL texture');
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        return texture;
    }

    /**
     * ✅ OPTIMISATION: Cache de textures avec LRU (Least Recently Used)
     */
    getCachedTexture(key: string, gl: WebGLRenderingContext): WebGLTexture | null {
        const entry = this.textureCache.get(key);
        if (entry) {
            entry.lastUsed = Date.now();
            return entry.texture;
        }
        return null;
    }

    /**
     * ✅ OPTIMISATION: Ajoute une texture au cache avec gestion de la taille
     */
    cacheTexture(key: string, texture: WebGLTexture, size: number, gl: WebGLRenderingContext): void {
        // Vérifier si la texture existe déjà
        if (this.textureCache.has(key)) {
            const existing = this.textureCache.get(key)!;
            this.currentCacheSize -= existing.size;
            this.textureCache.delete(key);
        }

        // Nettoyer le cache si nécessaire (LRU)
        while (this.currentCacheSize + size > this.maxCacheSize && this.textureCache.size > 0) {
            this.evictLRUTexture(gl);
        }

        this.textureCache.set(key, {
            texture,
            lastUsed: Date.now(),
            size,
        });
        this.currentCacheSize += size;
    }

    /**
     * ✅ OPTIMISATION: Supprime la texture la moins récemment utilisée (LRU)
     */
    private evictLRUTexture(gl: WebGLRenderingContext): void {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.textureCache.entries()) {
            if (entry.lastUsed < oldestTime) {
                oldestTime = entry.lastUsed;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            const entry = this.textureCache.get(oldestKey)!;
            gl.deleteTexture(entry.texture);
            this.currentCacheSize -= entry.size;
            this.textureCache.delete(oldestKey);
        }
    }

    /**
     * ✅ OPTIMISATION: Pool de frames pour réutiliser les framebuffers
     */
    getFrameBuffer(width: number, height: number, gl: WebGLRenderingContext): FramePoolEntry {
        // Chercher un framebuffer disponible dans le pool
        for (const entry of this.framePool) {
            if (!entry.inUse && entry.width === width && entry.height === height) {
                entry.inUse = true;
                return entry;
            }
        }

        // Créer un nouveau framebuffer si aucun disponible
        if (this.framePool.length < this.maxFramePoolSize) {
            const frameBuffer = gl.createFramebuffer();
            const texture = this.createTexture(gl);

            if (!frameBuffer || !texture) {
                throw new Error('Failed to create framebuffer or texture');
            }

            gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

            const entry: FramePoolEntry = {
                frameBuffer,
                texture,
                width,
                height,
                inUse: true,
            };

            this.framePool.push(entry);
            return entry;
        }

        // Réutiliser le plus ancien framebuffer si le pool est plein
        const oldest = this.framePool[0];
        oldest.inUse = true;
        return oldest;
    }

    /**
     * ✅ OPTIMISATION: Libère un framebuffer du pool
     */
    releaseFrameBuffer(entry: FramePoolEntry): void {
        entry.inUse = false;
    }

    /**
     * Compile et cache un shader
     */
    private compileShader(
        gl: WebGLRenderingContext,
        source: string,
        type: number
    ): WebGLShader | null {
        const shader = gl.createShader(type);
        if (!shader) return null;

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            console.error('[WebGLRenderer] Shader compilation error:', error);
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * ✅ OPTIMISATION: Cache de programmes shader compilés
     */
    getCachedProgram(shaderKey: string, shader: WebGLShaderType, gl: WebGLRenderingContext): WebGLProgram | null {
        if (this.shaderCache.has(shaderKey)) {
            return this.shaderCache.get(shaderKey)!;
        }

        const vertexShader = this.compileShader(gl, shader.vertexShader, gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(gl, shader.fragmentShader, gl.FRAGMENT_SHADER);

        if (!vertexShader || !fragmentShader) {
            return null;
        }

        const program = gl.createProgram();
        if (!program) return null;

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            console.error('[WebGLRenderer] Program linking error:', error);
            gl.deleteProgram(program);
            return null;
        }

        this.shaderCache.set(shaderKey, program);
        return program;
    }

    /**
     * Met à jour la texture vidéo depuis une source vidéo
     */
    updateVideoTexture(
        gl: WebGLRenderingContext,
        texture: WebGLTexture | null,
        videoElement: HTMLVideoElement | any
    ): WebGLTexture {
        if (!texture) {
            texture = this.createTexture(gl);
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Utiliser la texture vidéo directement si disponible
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);
        } catch (error) {
            console.warn('[WebGLRenderer] Failed to update video texture:', error);
        }

        return texture;
    }

    /**
     * Applique les effets et rend la scène
     */
    render(
        gl: WebGLRenderingContext,
        videoTexture: WebGLTexture | null,
        shaders: WebGLShaderType[],
        uniforms: Record<string, any> = {}
    ): void {
        if (!videoTexture || shaders.length === 0) {
            return;
        }

        // Utiliser le premier shader (peut être étendu pour chaînage)
        const shader = shaders[0];
        const shaderKey = JSON.stringify(shader);
        const program = this.getCachedProgram(shaderKey, shader, gl);

        if (!program) {
            return;
        }

        gl.useProgram(program);

        // Configuration des attributs
        const positionLocation = gl.getAttribLocation(program, 'position');
        const texCoordLocation = gl.getAttribLocation(program, 'texCoord');

        // Quad de rendu
        const positions = new Float32Array([
            -1, -1, 1, -1, -1, 1,
            1, -1, 1, 1, -1, 1,
        ]);

        const texCoords = new Float32Array([
            0, 1, 1, 1, 0, 0,
            1, 1, 1, 0, 0, 0,
        ]);

        // Buffers
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // Uniformes
        const textureLocation = gl.getUniformLocation(program, 'uTexture');
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.uniform1i(textureLocation, 0);

        // Appliquer les uniforms personnalisés
        for (const [key, value] of Object.entries(uniforms)) {
            const location = gl.getUniformLocation(program, key);
            if (!location) continue;

            if (typeof value === 'number') {
                gl.uniform1f(location, value);
            } else if (Array.isArray(value)) {
                if (value.length === 2) {
                    gl.uniform2fv(location, new Float32Array(value));
                } else if (value.length === 3) {
                    gl.uniform3fv(location, new Float32Array(value));
                } else if (value.length === 4) {
                    gl.uniform4fv(location, new Float32Array(value));
                }
            }
        }

        // Rendu
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /**
     * ✅ OPTIMISATION: Nettoie périodiquement le cache
     */
    private startCacheCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // Nettoyage toutes les 30 secondes
        this.cleanupInterval = setInterval(() => {
            this.cleanupCache();
        }, 30000);
    }

    /**
     * ✅ OPTIMISATION: Nettoie les textures non utilisées depuis plus de 60 secondes
     */
    private cleanupCache(): void {
        if (!this.gl) return;

        const now = Date.now();
        const maxAge = 60000; // 60 secondes

        for (const [key, entry] of this.textureCache.entries()) {
            if (now - entry.lastUsed > maxAge) {
                this.gl.deleteTexture(entry.texture);
                this.currentCacheSize -= entry.size;
                this.textureCache.delete(key);
            }
        }
    }

    /**
     * Nettoie toutes les ressources
     */
    cleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.gl) {
            // Nettoyer le cache de textures
            for (const entry of this.textureCache.values()) {
                this.gl.deleteTexture(entry.texture);
            }
            this.textureCache.clear();

            // Nettoyer le pool de frames
            for (const entry of this.framePool) {
                this.gl.deleteFramebuffer(entry.frameBuffer);
                this.gl.deleteTexture(entry.texture);
            }
            this.framePool = [];

            // Nettoyer le cache de shaders
            for (const program of this.shaderCache.values()) {
                this.gl.deleteProgram(program);
            }
            this.shaderCache.clear();

            this.currentCacheSize = 0;
        }

        this.gl = null;
    }
}

// Instance singleton
export const webglRendererService = new WebGLRendererService();
