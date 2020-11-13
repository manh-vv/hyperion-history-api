import { extendedActions, primaryTerms } from './definitions';

export function addSortedBy(query, queryBody, sort_direction) {
  if (query['sortedBy']) {
    const opts = query['sortedBy'].split(':');
    const sortedByObj = {};
    sortedByObj[opts[0]] = opts[1];
    queryBody['sort'] = sortedByObj;
  } else {
    queryBody['sort'] = {
      global_sequence: sort_direction,
    };
  }
}

export function processMultiVars(queryStruct, parts, field) {
  const must = [];
  const mustNot = [];

  parts.forEach((part) => {
    if (part.startsWith('!')) {
      mustNot.push(part.replace('!', ''));
    } else {
      must.push(part);
    }
  });

  if (must.length > 1) {
    queryStruct.bool.must.push({
      bool: {
        should: must.map((elem) => {
          const _q = {};
          _q[field] = elem;
          return { term: _q };
        }),
      },
    });
  } else if (must.length === 1) {
    const mustQuery = {};
    mustQuery[field] = must[0];
    queryStruct.bool.must.push({ term: mustQuery });
  }

  if (mustNot.length > 1) {
    queryStruct.bool.must_not.push({
      bool: {
        should: mustNot.map((elem) => {
          const _q = {};
          _q[field] = elem;
          return { term: _q };
        }),
      },
    });
  } else if (mustNot.length === 1) {
    const mustNotQuery = {};
    mustNotQuery[field] = mustNot[0].replace('!', '');
    queryStruct.bool.must_not.push({ term: mustNotQuery });
  }
}

function addRangeQuery(queryStruct, prop, pkey, query) {
  const _termQuery = {};
  const parts = query[prop].split('-');
  _termQuery[pkey] = {
    gte: parts[0],
    lte: parts[1],
  };
  queryStruct.bool.must.push({ range: _termQuery });
}

export function applyTimeFilter(query, queryStruct) {
  if (query['after'] || query['before']) {
    let _lte = 'now';
    let _gte = '0';
    if (query['before']) {
      _lte = query['before'];
      if (!_lte.endsWith('Z')) {
        _lte += 'Z';
      }
    }
    if (query['after']) {
      _gte = query['after'];
      if (!_gte.endsWith('Z')) {
        _gte += 'Z';
      }
    }
    if (!queryStruct.bool['filter']) {
      queryStruct.bool['filter'] = [];
    }
    queryStruct.bool['filter'].push({
      range: {
        '@timestamp': {
          gte: _gte,
          lte: _lte,
        },
      },
    });
  }
}

export function applyGenericFilters(query, queryStruct) {
  for (const prop in query) {
    if (Object.prototype.hasOwnProperty.call(query, prop)) {
      const pair = prop.split('.');
      if (pair.length > 1 || primaryTerms.includes(pair[0])) {
        let pkey;
        if (pair.length > 1) {
          pkey = extendedActions.has(pair[0]) ? '@' + prop : prop;
        } else {
          pkey = prop;
        }
        if (query[prop].indexOf('-') !== -1) {
          addRangeQuery(queryStruct, prop, pkey, query);
        } else {
          const _termQuery = {};
          const parts = query[prop].split(',');
          if (parts.length > 1) {
            processMultiVars(queryStruct, parts, prop);
          } else if (parts.length === 1) {
            const andParts = parts[0].split(' ');
            if (andParts.length > 1) {
              andParts.forEach((value) => {
                const _q = {};
                console.log(value);
                _q[pkey] = value;
                queryStruct.bool.must.push({ term: _q });
              });
            } else {
              if (parts[0].startsWith('!')) {
                _termQuery[pkey] = parts[0].replace('!', '');
                queryStruct.bool.must_not.push({ term: _termQuery });
              } else {
                _termQuery[pkey] = parts[0];
                queryStruct.bool.must.push({ term: _termQuery });
              }
            }
          }
        }
      }
    }
  }
}

export function getSkipLimit(query) {
  let skip, limit;
  skip = parseInt(query.skip, 10);
  if (skip < 0) {
    throw new Error('invalid skip parameter');
  }
  limit = parseInt(query.limit, 10);
  if (limit < 1) {
    throw new Error('invalid limit parameter');
  }
  return { skip, limit };
}

export function getSortDir(query) {
  let sort_direction = 'desc';
  if (query.sort) {
    if (query.sort === 'asc' || query.sort === '1') {
      sort_direction = 'asc';
    } else if (query.sort === 'desc' || query.sort === '-1') {
      sort_direction = 'desc';
    } else {
      throw new Error('invalid sort direction');
    }
  }
  return sort_direction;
}

export function applyTokenFilters(query, queryStruct) {
  const must = queryStruct.bool.must;
  if (query.smAccount) {
    must.push({
      term: {
        'act.account': query.smAccount,
      },
    });
    delete query.smAccount;
  }

  if (query.canAccount) {
    must.push({
      bool: {
        should: [
          {
            term: {
              '@transfer.from': query.canAccount,
            },
          },
          {
            term: {
              '@transfer.to': query.canAccount,
            },
          },
        ],
      },
    });

    delete query.canAccount;
  }

  if (query.symbol) {
    must.push({
      term: {
        '@transfer.symbol': query.symbol,
      },
    });

    delete query.symbol;
  }
}
