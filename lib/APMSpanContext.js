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

class APMSpanContext {
    constructor(spanId, traceId, parentId, parentSpanContext) {
        this._spanId = spanId;
        this._traceId = traceId;
        this._parentId = parentId;

        /**
         * Hawkular APM related
         */
        this._trace = parentSpanContext ? parentSpanContext.getTrace() : new Trace();
        this._transaction = parentSpanContext ? parentSpanContext.getTransaction() : undefined;
        this._level = parentSpanContext ? parentSpanContext.getLevel() : undefined;
    }

    getId() {
        return this._spanId;
    }

    getTraceId() {
        return this._traceId;
    }

    getParentId() {
        return this._parentId;
    }

    getTransaction() {
        return this._transaction;
    }

    setTransaction(transaction) {
        this._transaction = transaction;
    }

    getLevel() {
        return this._level;
    }

    setLevel(level) {
        this._level = level;
    }

    setConsumerCorrelationId(correlationId) {
        this._consumerCorrelationId = correlationId;
    }

    getConsumerCorrelationId() {
        return this._consumerCorrelationId;
    }

    getTrace() {
        return this._trace;
    }
}

module.exports = {
    APMSpanContext,
};
