import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  Min,
  validateSync,
} from 'class-validator';

export interface EventEnvelope<T = unknown> {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string; // ISO 8601 UTC
  data: T;
}

/** Lỗi hợp đồng: KHÔNG retry được, đi thẳng dead-letter (ngày 4 phân loại bằng instanceof). */
export class InvalidEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEventError';
  }
}

export const EVENT_VERSION = 1;

export function buildEnvelope<T>(
  type: string,
  data: T,
  opts: { eventId?: string; now?: Date } = {},
): EventEnvelope<T> {
  return {
    eventId: opts.eventId ?? randomUUID(),
    type,
    version: EVENT_VERSION,
    occurredAt: (opts.now ?? new Date()).toISOString(),
    data,
  };
}

/** Header của message thường (Phụ lục B). */
export function envelopeHeaders(e: EventEnvelope): Record<string, string> {
  return {
    'event-id': e.eventId,
    'event-type': e.type,
    'event-version': String(e.version),
    'produced-at': e.occurredAt,
  };
}

// ---- order.created ----

export const ORDER_CREATED = 'order.created';

export class OrderCreatedData {
  @IsInt() @Min(1) orderId!: number;
  @IsInt() @Min(1) userId!: number;
  @IsInt() @Min(0) totalAmount!: number;
  @IsIn(['COD', 'VNPAY']) paymentMethod!: 'COD' | 'VNPAY';
  @IsInt() @Min(1) itemCount!: number;
  @IsISO8601() createdAt!: string;
}

/** Parse + kiểm hợp đồng. Mọi sai lệch ném InvalidEventError. */
export function parseEnvelope<T extends object>(
  raw: string | null,
  expectedType: string,
  dataClass: new () => T,
): EventEnvelope<T> {
  if (raw === null) throw new InvalidEventError('message rỗng');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new InvalidEventError('JSON hỏng');
  }
  if (typeof json !== 'object' || json === null) {
    throw new InvalidEventError('envelope không phải object');
  }
  const o = json as Record<string, unknown>;
  if (typeof o.eventId !== 'string' || o.eventId === '') {
    throw new InvalidEventError('thiếu eventId');
  }
  if (o.type !== expectedType) {
    throw new InvalidEventError(`type sai: ${String(o.type)}`);
  }
  if (o.version !== EVENT_VERSION) {
    throw new InvalidEventError(`version không hỗ trợ: ${String(o.version)}`);
  }
  if (typeof o.occurredAt !== 'string' || Number.isNaN(Date.parse(o.occurredAt))) {
    throw new InvalidEventError('occurredAt sai');
  }
  if (typeof o.data !== 'object' || o.data === null) {
    throw new InvalidEventError('thiếu data');
  }
  const data = plainToInstance(dataClass, o.data);
  const errors = validateSync(data, { whitelist: true });
  if (errors.length > 0) {
    const fields = errors.map((e) => e.property).join(', ');
    throw new InvalidEventError(`data sai ở: ${fields}`);
  }
  return {
    eventId: o.eventId,
    type: expectedType,
    version: EVENT_VERSION,
    occurredAt: o.occurredAt,
    data,
  };
}

export const parseOrderCreated = (raw: string | null) =>
  parseEnvelope(raw, ORDER_CREATED, OrderCreatedData);
