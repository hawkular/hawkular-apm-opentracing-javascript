/*
 * Copyright 2015-2016 Red Hat, Inc. and/or its affiliates
 * and other contributors as indicated by the @author tags.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const CARRIER_PREFIX = 'HWKAPM';
const CARRIER_CORRELATION_ID = `${CARRIER_PREFIX}ID`;
const CARRIER_TRACE_ID = `${CARRIER_PREFIX}TRACEID`;
const CARRIER_TRANSACTION = `${CARRIER_PREFIX}TXN`;
const CARRIER_LEVEL = `${CARRIER_PREFIX}LEVEL`;

const NODE_TYPE_CONSUMER = 'Consumer';
const NODE_TYPE_PRODUCER = 'Producer';
const NODE_TYPE_COMPONENT = 'Component';

const CORR_ID_SCOPE_INTERACTION = 'Interaction';
const CORR_ID_SCOPE_CAUSED_BY = 'CausedBy';

const REPORTING_LEVEL_ALL = 'All';
const REPORTING_LEVEL_NONE = 'None';
const REPORTING_LEVEL_IGNORE = 'Ignore';

module.exports = {
    NODE_TYPE_COMPONENT,
    NODE_TYPE_CONSUMER,
    NODE_TYPE_PRODUCER,
    CORR_ID_SCOPE_CAUSED_BY,
    CORR_ID_SCOPE_INTERACTION,
    REPORTING_LEVEL_ALL,
    REPORTING_LEVEL_IGNORE,
    REPORTING_LEVEL_NONE,
    CARRIER_TRACE_ID,
    CARRIER_CORRELATION_ID,
    CARRIER_LEVEL,
    CARRIER_TRANSACTION,
};
