// Service pour la recherche d'images
export interface ImageSearchRequest {
  similarity_threshold?: number;
  max_results?: number;
}

export interface ImageSearchResponse {
  results: ImageSearchResult[];
  total_found: number;
  search_time_ms: number;
}

export interface ImageSearchResult {
  media_id: number;
  service_id: number;
  path: string;
  similarity_score: number;
  image_metadata: ImageMetadata;
  service_data?: any;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  file_size: number;
  dominant_colors: number[][];
  color_histogram: number[];
  edge_density: number;
  brightness: number;
  contrast: number;
}

class ImageSearchService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/image-search';
  }

  /**
   * Upload une image et recherche des images similaires
   */
  async uploadAndSearch(
    imageFile: File,
    similarityThreshold: number = 0.3,
    maxResults: number = 10
  ): Promise<ImageSearchResponse> {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('similarity_threshold', similarityThreshold.toString());
    formData.append('max_results', maxResults.toString());

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Erreur recherche d'images: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Recherche par métadonnées d'image
   */
  async searchByMetadata(
    metadata: ImageMetadata,
    maxResults: number = 10
  ): Promise<ImageSearchResponse> {
    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      },
      body: JSON.stringify({
        metadata,
        max_results: maxResults,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur recherche par métadonnées: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Traite les images existantes pour générer leurs signatures
   */
  async processExistingImages(): Promise<{ success: boolean; processed_count: number }> {
    const response = await fetch(`${this.baseUrl}/process-existing`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur traitement images existantes: ${response.status}`);
    }

    return response.json();
  }
}

export const imageSearchService = new ImageSearchService(); 