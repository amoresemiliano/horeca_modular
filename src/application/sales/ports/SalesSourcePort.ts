/** Source facts only; canonical interpretation belongs to Sales. */
export interface SourceProduct {
  id: string; name: string; quantity: number; price?: number;
  originalPrice?: number; catalogProductId?: string | null; tabProductId?: string;
  catalogModifierId?: string; priceImpact?: number; deleted?: boolean;
  modifiers?: SourceProduct[]; comboProducts?: SourceProduct[];
}
export interface SourcePayment {
  id: string; billId?: string; type: string; amount: number; tip?: number;
  creationTime: string; deleted: boolean;
}
export interface SourceBill {
  id: string; number: string | number; rectifiedBillNumber?: string | number | null;
  creationTime: string; finalizingTime?: string | null; total: number;
  tax?: number; taxableBase?: number; taxPercentage?: number; discountTotal?: number;
  deliveryFee?: number; minimumBasketSurcharge?: number; terraceSurcharge?: number;
  terraceSurchargePercentage?: number; preferredPaymentMethod?: string;
  payments?: SourcePayment[]; products?: SourceProduct[];
}
export interface SourceTab {
  id: string; locationId: string; creationTime: string; source?: string; code?: string;
  closeTime?: string | null; cancelTime?: string | null; activationTime?: string | null;
  schedulingTime?: string | null; pickupType?: string | null; locationBrandId?: string;
  tableName?: string | null; seats?: number | null; products?: SourceProduct[]; bills?: SourceBill[];
}
export interface SourceWindow { locationId: string; startDate: string; endDate: string; limit?: number }
export interface SourcePage<T> { records: T[]; offset: number }
export interface SalesSourcePort {
  listOrganizations(): Promise<Array<{id: string; name: string}>>;
  listLocations(organizationId: string): Promise<Array<{id: string; name: string}>>;
  listTabs(window: SourceWindow): AsyncIterable<SourcePage<SourceTab>>;
  getTab(locationId: string, tabId: string): Promise<SourceTab>;
  listBills(window: SourceWindow): AsyncIterable<SourcePage<SourceBill>>;
  getBill(locationId: string, billId: string): Promise<SourceBill>;
  listPayments(window: SourceWindow): AsyncIterable<SourcePage<SourcePayment>>;
  getPayment(locationId: string, paymentId: string): Promise<SourcePayment>;
}
