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

import { Trace } from './Trace';

const SPAN_ID = Symbol('SPANID');
const TRACE_ID = Symbol('TRACEID');
const PARENT_ID = Symbol('PARENT_ID');
const TRACE = Symbol('TRACE');
const TRANSACTION = Symbol('TRANSACTION');
const LEVEL = Symbol('LEVEL');
const CONSUMER_CORR_ID = Symbol('CONSUMER_CORR_ID');

class APMSpanContext {
    constructor(spanId, traceId, parentId, transaction, level) {
        this[SPAN_ID] = spanId;
        this[TRACE_ID] = traceId;
        this[PARENT_ID] = parentId;
        this[TRANSACTION] = transaction;
        this[LEVEL] = level;

        this[TRACE] = new Trace();
    }

    getId() {
        return this[SPAN_ID];
    }

    getTraceId() {
        return this[TRACE_ID];
    }

    getParentId() {
        return this[PARENT_ID];
    }

    getTransaction() {
        return this[TRANSACTION];
    }

    getLevel() {
        return this[LEVEL];
    }

    setConsumerCorrelationId(correlationId) {
        this[CONSUMER_CORR_ID] = correlationId;
    }

    getConsumerCorrelationId() {
        return this[CONSUMER_CORR_ID];
    }

    setTrace(trace) {
        this[TRACE] = trace;
    }

    getTrace() {
        return this[TRACE];
    }
}

module.exports = {
    APMSpanContext,
};
