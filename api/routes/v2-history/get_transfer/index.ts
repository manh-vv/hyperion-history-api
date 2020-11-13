import { FastifyInstance, RouteSchema } from 'fastify';

import { addApiRoute, extendQueryStringSchema, extendResponseSchema, getRouteName } from '../../../helpers/functions';
import { getTransfersHandler } from './get_transfers';

export const getTransferResponseSchema = {
  '@timestamp': { type: 'string' },
  timestamp: { type: 'string' },
  block_num: { type: 'number' },
  trx_id: { type: 'string' },
  act: {
    type: 'object',
    properties: {
      account: { type: 'string' },
      name: { type: 'string' },
    },
    additionalProperties: true,
  },
  notified: {
    type: 'array',
    items: { type: 'string' },
  },
  cpu_usage_us: { type: 'number' },
  net_usage_words: { type: 'number' },
  account_ram_deltas: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        account: { type: 'string' },
        delta: { type: 'number' },
      },
      additionalProperties: true,
    },
  },
  global_sequence: { type: 'number' },
  receiver: { type: 'string' },
  producer: { type: 'string' },
  parent: { type: 'number' },
  action_ordinal: { type: 'number' },
  creator_action_ordinal: { type: 'number' },
};

export default function (fastify: FastifyInstance, opts: any, next) {
  const schema: RouteSchema = {
    description: `Get token transactions by: code AND? account AND? symbol`,
    summary: 'Get token transactions',
    tags: ['history'],
    querystring: extendQueryStringSchema({
      code: {
        description: 'CAN Account of token provider',
        type: 'string',
        minLength: 1,
        maxLength: 12,
      },
      account: {
        description: 'CAN Account of token owner',
        type: 'string',
        minLength: 1,
        maxLength: 12,
      },
      symbol: {
        description: 'Token symbol - uppercase letter; ex: CAT',
        type: 'string',
        minLength: 1,
        maxLength: 7,
      },
      track: {
        description: 'total results to track (count) [number or true]',
        type: 'string',
      },
      sort: {
        description: 'sort direction',
        enum: ['desc', 'asc', '1', '-1'],
        type: 'string',
      },
      after: {
        description: 'filter after specified date (ISO8601)',
        type: 'string',
      },
      before: {
        description: 'filter before specified date (ISO8601)',
        type: 'string',
      },
      checkLib: {
        description: 'perform reversibility check',
        type: 'boolean',
      },
    }),
    response: extendResponseSchema({
      simple_actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            block: { type: 'number' },
            timestamp: { type: 'string' },
            irreversible: { type: 'boolean' },
            contract: { type: 'string' },
            action: { type: 'string' },
            actors: { type: 'string' },
            notified: { type: 'string' },
            transaction_id: { type: 'string' },
            data: {
              additionalProperties: true,
            },
          },
        },
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: getTransferResponseSchema,
        },
      },
    }),
  };
  addApiRoute(fastify, 'GET', getRouteName(__filename), getTransfersHandler, schema);
  next();
}
