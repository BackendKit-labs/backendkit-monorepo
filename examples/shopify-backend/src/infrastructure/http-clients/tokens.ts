import { defineHttpClient } from '@backendkit-labs/http-client';

export const PAYMENT_CLIENT  = defineHttpClient('payment-gateway');
export const SHIPPING_CLIENT = defineHttpClient('shipping-provider');
