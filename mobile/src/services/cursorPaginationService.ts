/**
 * CursorPaginationService - Service pour pagination cursor-based
 * Prêt pour migration backend vers cursor
 */

interface CursorPaginationParams {
    cursor?: string;
    limit?: number;
    direction?: 'forward' | 'backward';
}

interface CursorPaginationResponse<T> {
    data: T[];
    nextCursor?: string;
    prevCursor?: string;
    hasMore: boolean;
}

class CursorPaginationService {
    // ✅ Préparer les paramètres pour pagination cursor
    prepareCursorParams(params: CursorPaginationParams): Record<string, any> {
        const queryParams: Record<string, any> = {
            limit: params.limit || 20,
        };

        if (params.cursor) {
            queryParams.cursor = params.cursor;
        }

        if (params.direction) {
            queryParams.direction = params.direction;
        }

        return queryParams;
    }

    // ✅ Parser la réponse cursor
    parseCursorResponse<T>(response: any): CursorPaginationResponse<T> {
        if (response.success && response.data) {
            return {
                data: Array.isArray(response.data)
                    ? response.data
                    : (response.data.items || response.data.data || []),
                nextCursor: response.data.next_cursor || response.data.nextCursor,
                prevCursor: response.data.prev_cursor || response.data.prevCursor,
                hasMore: response.data.has_more ?? response.data.hasMore ?? false,
            };
        }

        return {
            data: [],
            hasMore: false,
        };
    }

    // ✅ Helper pour construire l'URL avec cursor
    buildCursorUrl(baseUrl: string, params: CursorPaginationParams): string {
        const queryParams = this.prepareCursorParams(params);
        const queryString = new URLSearchParams(
            Object.entries(queryParams).reduce((acc, [key, value]) => {
                if (value !== undefined && value !== null) {
                    acc[key] = String(value);
                }
                return acc;
            }, {} as Record<string, string>)
        ).toString();

        return `${baseUrl}?${queryString}`;
    }
}

export const cursorPaginationService = new CursorPaginationService();
export default cursorPaginationService;

