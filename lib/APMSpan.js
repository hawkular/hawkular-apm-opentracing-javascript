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

import { generateSpanId, nowMillis } from './utils';
import { APMSpanContext } from './APMSpanContext';

class APMSpan {
    constructor(tracer, fields) {
        this._tracer = tracer;
        this._spanContext = APMSpan._createSpanContext(fields.childOf);

        this._operationName = fields.operationName;
        this._tags = fields.tags || {};
        this._startMillis = fields.startTime || nowMillis();
        this._endMillis = null;
        this._logs = [];
        this._sampled = tracer.getSampler().isSampled(this);

        this._finished = false;
    }

    static _createSpanContext(parentSpanOrContext) {
        const id = generateSpanId();
        let parentId;
        let traceId;
        if (parentSpanOrContext) {
            parentId = parentSpanOrContext.getId();
            traceId = parentSpanOrContext.getTraceId();
        } else {
            parentId = null;
            traceId = id;
        }

        return new APMSpanContext(id, traceId, parentId);
    }

    /**
     * Returns the Tracer object used to create this Span.
     *
     * @return {Tracer}
     */
    tracer() {
        return this._tracer;
    }

    /**
     * Returns the SpanContext object associated with this Span.
     *
     * @return {SpanContext}
     */
    context() {
        return this._spanContext;
    }

    /**
     * Sets the string name for the logical operation this span represents.
     *
     * @param {string} name
     */
    setOperationName(operationName) {
        this._operationName = operationName;
    }

    /**
     * Add a log record to this Span, optionally at a user-provided timestamp.
     *
     * For example:
     *
     *     span.log({
     *         size: rpc.size(),  // numeric value
     *         URI: rpc.URI(),  // string value
     *         payload: rpc.payload(),  // Object value
     *         "keys can be arbitrary strings": rpc.foo(),
     *     });
     *
     *     span.log({
     *         "error.description": error.description(),  // numeric value
     *     }, error.timestampMillis());
     *
     * @param {object} keyValuePairs
     *        An object mapping string keys to arbitrary value types. All
     *        Tracer implementations should support bool, string, and numeric
     *        value types, and some may also support Object values.
     * @param {number} timestamp
     *        An optional parameter specifying the timestamp in milliseconds
     *        since the Unix epoch. Fractional values are allowed so that
     *        timestamps with sub-millisecond accuracy can be represented. If
     *        not specified, the implementation is expected to use its notion
     *        of the current time of the call.
     */
    log(keyValuePairs, micros = nowMillis()) {
        Object.keys(keyValuePairs).forEach((objectKey) => {
            this._logs.push({
                key: objectKey,
                value: keyValuePairs[objectKey],
                timestamp: micros,
            });
        });
    }

    /**
     * Adds a single tag to the span.  See `addTags()` for details.
     *
     * @param {string} key
     * @param {any} value
     */
    setTag(key, value) {
        if (key && value) {
            this._tags[key] = value;
        }
    }

    addTags(keyValueMap) {
        keyValueMap.forEach((value, key) => {
            this._tags[key] = value;
        });
    }

    /**
     * Sets the end timestamp and finalizes Span state.
     *
     * With the exception of calls to Span.context() (which are always allowed),
     * finish() must be the last call made to any span instance, and to do
     * otherwise leads to undefined behavior.
     *
     * @param  {number} finishTime
     *         Optional finish time in milliseconds as a Unix timestamp. Decimal
     *         values are supported for timestamps with sub-millisecond accuracy.
     *         If not specified, the current time (as defined by the
     *         implementation) will be used.
     */
    finish(finishTime = nowMillis()) {
        if (this._finished === true) {
            return;
        }
        this._finished = true;
        this._endMillis = finishTime;
        this._tracer.getRecorder().record(this);
    }

    getOperationName() {
        return this._operationName;
    }

    getTags() {
        return this._tags;
    }

    getLogs() {
        return this._logs;
    }

    getTraceId() {
        return this._spanContext.getTraceId();
    }

    getId() {
        return this._spanContext.getId();
    }

    getParentId() {
        return this._spanContext.getParentId();
    }

    getStartTime() {
        return this._startMillis;
    }

    getEndTime() {
        return this._endMillis;
    }
}

module.exports = {
    APMSpan,
};
