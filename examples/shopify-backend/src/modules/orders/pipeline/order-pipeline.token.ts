import { definePipeline } from '@backendkit-labs/pipeline';
import type { OrderContext } from './order-pipeline.context';
import type { OrderError } from './order-pipeline.context';

export const ORDER_PIPELINE = definePipeline<OrderContext, OrderError>('order-fulfillment');
