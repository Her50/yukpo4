import { apiGet, apiPatch, apiPost, apiPut, apiDelete } from './api';

// ────────────────────────────────────────────────────────────
// Types partenaires
// ────────────────────────────────────────────────────────────
export interface RestaurantMenuItem {
  id: number;
  service_id?: number;
  nom: string;
  description?: string;
  prix: number;
  categorie?: string;
  is_disponible?: boolean;
  image_url?: string;
  video_url?: string;
  availability_days?: number[];
  sort_order?: number;
}

export interface RestaurantOrder {
  id: number;
  order_type: string;       // dine_in | takeaway | delivery
  status: string;           // pending | accepted | preparing | ready | completed | cancelled
  total_amount: number;
  client_name?: string;
  client_phone?: string;
  notes?: string;
  table_id?: number;
  estimated_ready_at?: string;
  created_at: string;
  items: RestaurantOrderItem[];
}

export interface RestaurantOrderItem {
  id: number;
  item_name: string;
  item_price: number;
  quantity: number;
  notes?: string;
}

export interface RestaurantReservation {
  id: number;
  status: string;
  reservation_type: string;
  requested_date?: string;
  confirmed_date?: string;
  details: Record<string, any>;
}

export interface RestaurantOpeningHour {
  id?: number;
  day_of_week: number;   // 0=Dim, 1=Lun … 6=Sam
  open_time?: string;    // 'HH:MM'
  close_time?: string;
  is_closed: boolean;
}

export interface RestaurantTable {
  id: number;
  service_id: number;
  label: string;
  capacity: number;
  position_x: number;
  position_y: number;
  zone?: string;
  sort_order: number;
  is_active: boolean;
}

export interface RestaurantOverview {
  service_id: number;
  tables_count: number;
  reservations_pending: number;
  accepts_delivery: boolean;
  accepts_dine_in: boolean;
  default_prep_minutes?: number;
}

// ────────────────────────────────────────────────────────────
// Types publics / client
// ────────────────────────────────────────────────────────────
export interface PublicRestaurant {
  service_id: number;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  accepts_delivery: boolean;
  accepts_dine_in: boolean;
  default_prep_minutes?: number;
  menu_count: number;
}

export interface PublicMenuResponse {
  service_id: number;
  menu: RestaurantMenuItem[];
  opening_hours: RestaurantOpeningHour[];
}

export interface RestaurantDashboardData {
  menuItems: RestaurantMenuItem[];
  pendingOrders: RestaurantOrder[];
  reservations: RestaurantReservation[];
}

const ensureArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────
export const restaurantManagementService = {
  // ─── Dashboard agrégé (partenaire) ───────────────────────
  async getDashboardData(): Promise<RestaurantDashboardData> {
    const [menuResp, ordersResp, reservationsResp] = await Promise.allSettled([
      apiGet('/api/restaurant/menu'),
      apiGet('/api/restaurant/orders'),
      apiGet('/api/specialized-services/reservations/prestataire'),
    ]);

    const menuItems =
      menuResp.status === 'fulfilled'
        ? ensureArray<RestaurantMenuItem>((menuResp.value as any)?.data?.items)
        : [];

    const pendingOrders =
      ordersResp.status === 'fulfilled'
        ? ensureArray<RestaurantOrder>((ordersResp.value as any)?.data?.orders)
        : [];

    const allReservations =
      reservationsResp.status === 'fulfilled'
        ? ensureArray<RestaurantReservation>((reservationsResp.value as any)?.data?.reservations)
        : [];

    const restaurantReservations = allReservations.filter(
      (r) =>
        r?.details?.service_type === 'restaurant' ||
        r?.details?.restaurant === true ||
        r?.reservation_type === 'table',
    );

    return { menuItems, pendingOrders, reservations: restaurantReservations };
  },

  // ─── Overview (partenaire) ────────────────────────────────
  async getOverview(): Promise<RestaurantOverview> {
    const resp = await apiGet('/api/restaurant/overview');
    return (resp as any)?.data as RestaurantOverview;
  },

  // ─── Settings (partenaire) ────────────────────────────────
  async patchSettings(data: {
    accepts_delivery?: boolean;
    accepts_dine_in?: boolean;
    default_prep_minutes?: number;
  }) {
    return apiPatch('/api/restaurant/settings', data);
  },

  // ─── Menu items (partenaire) ──────────────────────────────
  async getMenuItems(): Promise<RestaurantMenuItem[]> {
    const resp = await apiGet('/api/restaurant/menu');
    return ensureArray<RestaurantMenuItem>((resp as any)?.data?.items);
  },

  async createMenuItem(data: {
    nom: string;
    description?: string;
    prix: number;
    categorie?: string;
    is_disponible?: boolean;
    image_url?: string;
    video_url?: string;
    availability_days?: number[];
    sort_order?: number;
  }) {
    return apiPost('/api/restaurant/menu', data);
  },

  async updateMenuItem(
    id: number,
    data: Partial<{
      nom: string;
      description: string;
      prix: number;
      categorie: string;
      is_disponible: boolean;
      image_url: string;
      video_url: string;
      availability_days: number[];
      sort_order: number;
    }>,
  ) {
    return apiPatch(`/api/restaurant/menu/${id}`, data);
  },

  async deleteMenuItem(id: number) {
    return apiPatch(`/api/restaurant/menu/${id}`, { is_disponible: false });
  },

  // ─── Horaires d'ouverture (partenaire) ───────────────────
  async getOpeningHours(): Promise<RestaurantOpeningHour[]> {
    const resp = await apiGet('/api/restaurant/opening-hours');
    return ensureArray<RestaurantOpeningHour>((resp as any)?.data?.hours);
  },

  async updateOpeningHours(hours: RestaurantOpeningHour[]) {
    return apiPut('/api/restaurant/opening-hours', { hours });
  },

  // ─── Tables & plan de salle (partenaire) ─────────────────
  async getTables(): Promise<RestaurantTable[]> {
    const resp = await apiGet('/api/restaurant/tables');
    return ensureArray<RestaurantTable>((resp as any)?.data?.tables);
  },

  async createTable(data: {
    label: string;
    capacity?: number;
    position_x?: number;
    position_y?: number;
    zone?: string;
  }) {
    return apiPost('/api/restaurant/tables', data);
  },

  async updateTable(id: number, data: Partial<RestaurantTable>) {
    return apiPatch(`/api/restaurant/tables/${id}`, data);
  },

  async deleteTable(id: number) {
    return apiDelete(`/api/restaurant/tables/${id}`);
  },

  async getFloorPlan() {
    return apiGet('/api/restaurant/floor-plan');
  },

  // ─── Commandes (partenaire) ───────────────────────────────
  async getOrders(status?: string): Promise<RestaurantOrder[]> {
    const params = status ? { status } : {};
    const resp = await apiGet('/api/restaurant/orders', { params });
    return ensureArray<RestaurantOrder>((resp as any)?.data?.orders);
  },

  async updateOrderStatus(
    orderId: number,
    status: string,
    estimated_ready_at?: string,
  ) {
    return apiPatch(`/api/restaurant/orders/${orderId}/status`, {
      status,
      estimated_ready_at,
    });
  },

  // ─── Dashboard financier partenaire ──────────────────────
  async getFinancialSummary() {
    return apiGet('/api/restaurant/financial-summary');
  },

  // ─── Codes partenaires ────────────────────────────────────
  async createPartnerCode(label?: string) {
    return apiPost('/api/restaurant/partner-code', { label });
  },

  async verifyPartnerCode(code: string) {
    return apiGet('/api/restaurant/partner-code/verify', { params: { code } });
  },

  // ─── Endpoints publics — côté client/utilisateur ─────────
  async publicSearch(
    q: string,
    type: 'restaurant' | 'menu' = 'restaurant',
    limit?: number,
  ): Promise<{ type: string; results: any[] }> {
    const params: Record<string, any> = { q, type };
    if (limit !== undefined) params.limit = limit;
    const resp = await apiGet('/api/restaurant/public/search', { params });
    return {
      type: (resp as any)?.data?.type || type,
      results: ensureArray((resp as any)?.data?.results),
    };
  },

  async publicListRestaurants(
    lat?: number,
    lon?: number,
    limit?: number,
  ): Promise<PublicRestaurant[]> {
    const params: Record<string, any> = {};
    if (lat !== undefined) params.lat = lat;
    if (lon !== undefined) params.lon = lon;
    if (limit !== undefined) params.limit = limit;
    const resp = await apiGet('/api/restaurant/public/list', { params });
    return ensureArray<PublicRestaurant>((resp as any)?.data?.restaurants);
  },

  async publicGetMenu(serviceId: number): Promise<PublicMenuResponse> {
    const resp = await apiGet(`/api/restaurant/public/${serviceId}/menu`);
    return (resp as any)?.data as PublicMenuResponse;
  },

  async publicCreateOrder(
    serviceId: number,
    data: {
      order_type?: string;
      table_id?: number;
      notes?: string;
      client_name?: string;
      client_phone?: string;
      delivery_address?: string;
      items: Array<{
        menu_item_id?: number;
        item_name: string;
        item_price: number;
        quantity?: number;
        notes?: string;
      }>;
    },
  ): Promise<any> {
    return apiPost(`/api/restaurant/public/${serviceId}/order`, data);
  },

  // ─── Historique commandes client ──────────────────────────
  async clientOrderHistory(): Promise<any[]> {
    const resp = await apiGet('/api/restaurant/public/orders/history');
    return (resp as any)?.data?.orders ?? [];
  },

  // ─── Suivi commande en temps réel ────────────────────────
  async getOrderStatus(orderId: number): Promise<any> {
    const resp = await apiGet(`/api/restaurant/public/orders/${orderId}/status`);
    return (resp as any)?.data?.order;
  },

  // ─── Validation QR code livraison ────────────────────────
  async validateDeliveryQr(qrCode: string): Promise<any> {
    return apiPost('/api/restaurant/public/orders/validate-qr', { qr_code: qrCode });
  },

  // ─── Notation commande ────────────────────────────────────
  async rateOrder(orderId: number, rating: number, comment?: string): Promise<any> {
    return apiPost(`/api/restaurant/public/orders/${orderId}/rate`, { rating, comment });
  },

  // ─── Réservation de table (client → service spécialisé) ──
  async createTableReservation(payload: {
    service_id: number;
    requested_date: string;
    people_count: number;
    table_label?: string;
    notes?: string;
  }) {
    return apiPost('/api/specialized-services/reservations', {
      service_id: payload.service_id,
      service_type: 'restaurant',
      reservation_type: 'table',
      requested_date: payload.requested_date,
      details: {
        service_type: 'restaurant',
        people_count: payload.people_count,
        table_label: payload.table_label || null,
        notes: payload.notes || null,
      },
    });
  },

  // ─── Commandes (anciennes compat delivery) ────────────────
  async updateOrderPreparation(orderId: string, estimatedReadyAtIso: string) {
    return apiPost(`/api/delivery/orders/${orderId}/validate`, {
      estimated_ready_at: estimatedReadyAtIso,
    });
  },

  async markOrderReady(orderId: string) {
    return apiPost(`/api/delivery/orders/${orderId}/ready`, {});
  },
};
