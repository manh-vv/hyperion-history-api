import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ServerResponse } from 'http';

import { getTrackTotalHits, mergeActionMeta, timedQuery } from '../../../helpers/functions';
import { addSortedBy, applyGenericFilters, applyTimeFilter, applyTokenFilters, getSkipLimit, getSortDir } from './functions';

async function getTransfers(fastify: FastifyInstance, request: FastifyRequest) {
  const query = request.query;
  if (query.simple == null) {
    query.simple = true;
  }

  const queryStruct = {
    bool: {
      must: [],
      must_not: [],
      boost: 1.0,
    },
  };

  const { skip, limit } = getSkipLimit(query);
  const sort_direction = getSortDir(query);
  applyTokenFilters(query, queryStruct);
  applyGenericFilters(query, queryStruct);
  applyTimeFilter(query, queryStruct);
  // allow precise counting of total hits
  const trackTotalHits = getTrackTotalHits(query);

  // Prepare query body
  const query_body = {
    track_total_hits: trackTotalHits,
    query: queryStruct,
  };

  // Include sorting
  addSortedBy(query, query_body, sort_direction);

  // Perform search
  const maxActions = fastify.manager.config.api.limits.get_actions;
  const esResults = await fastify.elastic.search({
    index: fastify.manager.chain + '-action-*',
    from: skip || 0,
    size: (limit > maxActions ? maxActions : limit) || 10,
    body: query_body,
  });

  const results = esResults['body']['hits'];
  const response: any = {
    cached: false,
    lib: 0,
    total: results['total'],
  };

  if (query.checkLib) {
    response.lib = (await fastify.eosjs.rpc.get_info()).last_irreversible_block_num;
  }

  if (query.simple) {
    response['simple_actions'] = [];
  } else {
    response['actions'] = [];
  }

  if (results['hits'].length > 0) {
    const actions = results['hits'];
    for (let action of actions) {
      action = action._source;
      mergeActionMeta(action);

      if (query.noBinary === true) {
        for (const key in action['act']['data']) {
          if (action['act']['data'].hasOwnProperty(key)) {
            if (
              typeof action['act']['data'][key] === 'string' &&
              action['act']['data'][key].length > 256
            ) {
              action['act']['data'][key] = action['act']['data'][key].slice(0, 32) + '...';
            }
          }
        }
      }

      if (query.simple) {
        response.simple_actions.push({
          block: action['block_num'],
          irreversible: response.lib !== 0 ? action['block_num'] < response.lib : undefined,
          timestamp: action['@timestamp'],
          transaction_id: action['trx_id'],
          actors: action['act']['authorization'].map((a) => `${a.actor}@${a.permission}`).join(','),
          notified: action['notified'].join(','),
          contract: action['act']['account'],
          action: action['act']['name'],
          data: action['act']['data'],
        });
      } else {
        response.actions.push(action);
      }
    }
  }
  return response;
}

export function getTransfersHandler(fastify: FastifyInstance, route: string) {
  return async (request: FastifyRequest, reply: FastifyReply<ServerResponse>) => {
    reply.send(await timedQuery(getTransfers, fastify, request, route));
  };
}
