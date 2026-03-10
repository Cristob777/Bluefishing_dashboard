// ============================================================================
// MI SPA BI SYSTEM - Cliente API Bsale
// ============================================================================

import { ETLLogger } from './logger.ts';
import { fetchWithRetry, rateLimiter, RATE_LIMIT_CONFIG } from './retry.ts';
import { BsaleApiResponse } from './types.ts';

export class BsaleClient {
  constructor(
    private accessToken: string,
    private baseUrl = 'https://api.bsale.cl/v1',
    private logger?: ETLLogger
  ) {}

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    
    await rateLimiter.wait();
    
    const response = await fetchWithRetry(url.toString(), {
      headers: { 'access_token': this.accessToken, 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Bsale API error ${response.status}`);
    }
    return response.json();
  }

  async fetchAll<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
    const items: T[] = [];
    let offset = 0;
    const limit = 25;
    
    while (true) {
      const response = await this.request<BsaleApiResponse<T>>(endpoint, {
        ...params, limit: String(limit), offset: String(offset)
      });
      
      if (!response.items?.length) break;
      items.push(...response.items);
      if (response.items.length < limit) break;
      
      offset += limit;
      await new Promise(r => setTimeout(r, RATE_LIMIT_CONFIG.batchDelayMs));
    }
    
    return items;
  }

  // Obtener una sola página de resultados (para carga incremental)
  async fetchPage<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
    const response = await this.request<BsaleApiResponse<T>>(endpoint, params);
    return response.items || [];
  }

  async getVariants(params: Record<string, string> = {}) {
    // Expandir product para obtener product_type (necesario para clasificar tienda)
    return this.fetchAll<unknown>('/variants.json', { ...params, expand: '[product]' });
  }

  async getClients(params: Record<string, string> = {}) {
    return this.fetchAll<unknown>('/clients.json', params);
  }

  async getDocuments(params: Record<string, string> = {}, maxPages = 8) {
    // Paginate up to maxPages (each page = 25 docs, so 8 pages = 200 docs)
    const items: unknown[] = [];
    let offset = 0;
    const limit = 25;
    
    for (let page = 0; page < maxPages; page++) {
      const response = await this.request<BsaleApiResponse<unknown>>('/documents.json', {
        ...params, limit: String(limit), offset: String(offset)
      });
      if (!response.items?.length) break;
      items.push(...response.items);
      if (response.items.length < limit) break;
      offset += limit;
      await new Promise(r => setTimeout(r, 100));
    }
    
    return items;
  }

  async getDocumentDetails(docId: number) {
    return this.request<{ items: unknown[] }>(`/documents/${docId}/details.json`);
  }

  async getStocks(params: Record<string, string> = {}) {
    // Si se especifica limit, usar fetchPage (una sola página)
    if (params.limit) {
      return this.fetchPage<unknown>('/stocks.json', params);
    }
    return this.fetchAll<unknown>('/stocks.json', params);
  }

  async getOffices() {
    return this.request<{ items: unknown[] }>('/offices.json');
  }

  // Obtener pagos recibidos
  async getPayments(params: Record<string, string> = {}) {
    return this.fetchAll<unknown>('/payments.json', params);
  }

  // Obtener documentos con saldo pendiente (para cobranza)
  async getReceivableDocuments(params: Record<string, string> = {}) {
    // Documentos tipo factura (documentTypeId 1) con saldo > 0
    return this.fetchAll<unknown>('/documents.json', {
      ...params,
      expand: '[client,document_type]'
    });
  }

  // Obtener tipos de documento
  async getDocumentTypes() {
    return this.request<{ items: unknown[] }>('/document_types.json');
  }

  // Obtener devoluciones (returns)
  async getReturns(params: Record<string, string> = {}) {
    if (params.limit) {
      return this.fetchPage<unknown>('/returns.json', params);
    }
    return this.fetchAll<unknown>('/returns.json', params);
  }

  // Obtener notas de crédito (credit notes)
  async getCreditNotes(params: Record<string, string> = {}) {
    // documentTypeId 8 = Nota de Crédito Electrónica
    return this.fetchAll<unknown>('/documents.json', {
      ...params,
      documenttypeid: '8',
      expand: '[client,details]'
    });
  }

  // Obtener detalle de un pago
  async getPaymentDetails(paymentId: number) {
    return this.request<unknown>(`/payments/${paymentId}.json`);
  }

  // Obtener listas de precios (para costos)
  async getPriceLists() {
    return this.fetchAll<unknown>('/price_lists.json');
  }

  // Obtener detalles de una lista de precios (variante → precio)
  async getPriceListDetails(priceListId: number) {
    return this.fetchAll<unknown>(`/price_lists/${priceListId}/details.json`);
  }
}

export function createBsaleClient(logger?: ETLLogger): BsaleClient {
  const token = Deno.env.get('BSALE_TOKEN');
  if (!token) throw new Error('BSALE_TOKEN no configurado');
  const apiUrl = Deno.env.get('BSALE_API_URL') || 'https://api.bsale.cl/v1';
  return new BsaleClient(token, apiUrl, logger);
}
