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

import utils from './utils';
import { APMSpanContext } from './APMSpanContext';

const SPAN_CONTEXT = Symbol('CONTEXT');
const TRACER = Symbol('TRACER');
const OPERATION_NAME = Symbol('OPERATION_NAME');
const START_MILLIS = Symbol('START_MILLIS');
const END_MILLIS = Symbol('END_MILLIS');
const FINISHED = Symbol('FINISHED');
const TAGS = Symbol('TAGS');
const LOGS = Symbol('LOGS');

class APMSpan {
    constructor(tracer, fields) {
        if (fields.childOf && fields.references) {
            throw new Error('ChildOf and FollowsFrom should not be specified at the same time!');
        }

        this[TRACER] = tracer;

        if (fields.references) {
            this._initFollowsFromSpanContext(fields.references);
        } else {
            if (fields.childOf && fields.childOf instanceof APMSpan) {
                fields.childOf = fields.childOf.context();
            }
            this._initChildOfSpanContext(fields.childOf);
        }

        this[OPERATION_NAME] = fields.operationName;
        this[TAGS] = fields.tags || {};
        this[START_MILLIS] = fields.startTime || utils.nowMillis();
        this[END_MILLIS] = null;
        this[LOGS] = [];

        this[FINISHED] = false;
    }

    _initChildOfSpanContext(parentSpanContext) {
        const id = utils.generateSpanId();
        let parentId;
        let traceId = utils.generateSpanId();

        if (parentSpanContext && parentSpanContext.getId() && parentSpanContext.getTraceId()) {
            parentId = parentSpanContext.getId();
            traceId = parentSpanContext.getTraceId();
        } else {
            traceId = id;
        }

        this[SPAN_CONTEXT] = new APMSpanContext(id, traceId, parentId, parentSpanContext);

        let nodeType = 'Component';
        const consumerCorrelationId = parentSpanContext && parentSpanContext.getConsumerCorrelationId();
        if (consumerCorrelationId !== undefined) {
            nodeType = 'Consumer';
        }

        this[SPAN_CONTEXT].getTrace().addNode(nodeType, this, [{
            value: consumerCorrelationId,
            scope: 'Interaction',
        }]);
    }

    _initFollowsFromSpanContext(parents) {
        const id = utils.generateSpanId();
        let traceId = null;

        const correlationIds = [];
        for (let i = 0; i < parents.length; i += 1) {
            const parent = parents[i] instanceof APMSpan ? parents[i].context() : parents[i];
            traceId = parent.getTraceId();
            const nodePosition = parent.getTrace().nodePositionId(parent.getId());
            correlationIds.push({
                value: parent.getId() + nodePosition,
                scope: 'CausedBy',
            });
        }

        this[SPAN_CONTEXT] = new APMSpanContext(id, traceId, null);
        this[SPAN_CONTEXT].getTrace().addNode('Component', this, correlationIds);
    }

    /**
     * Returns the Tracer object used to create this Span.
     *
     * @return {Tracer}
     */
    tracer() {
        return this[TRACER];
    }

    /**
     * Returns the SpanContext object associated with this Span.
     *
     * @return {SpanContext}
     */
    context() {
        return this[SPAN_CONTEXT];
    }

    /**
     * Sets the string name for the logical operation this span represents.
     *
     * @param {string} name
     */
    setOperationName(operationName) {
        this[OPERATION_NAME] = operationName;
        return this;
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
    log(keyValuePairs, micros = utils.nowMillis()) {
        Object.keys(keyValuePairs).forEach((objectKey) => {
            this[LOGS].push({
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
            this[TAGS][key] = value;
        }
        return this;
    }

    addTags(keyValueMap) {
        Object.keys(keyValueMap).forEach((value, key) => {
            this[TAGS][key] = value;
        });
        return this;
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
    finish(finishTime = utils.nowMillis()) {
        if (this[FINISHED] === true) {
            return;
        }
        this[FINISHED] = true;
        this[END_MILLIS] = finishTime;

        // only parent span should be recorded -> one Trace with all nodes
        const spanToReport = this[SPAN_CONTEXT].getTrace().isFinished(this);
        if (spanToReport) {
            this[TRACER].getRecorder().record(spanToReport);
        }
    }

    getOperationName() {
        return this[OPERATION_NAME];
    }

    getTags() {
        return this[TAGS];
    }

    getLogs() {
        return this[LOGS];
    }

    getTraceId() {
        return this[SPAN_CONTEXT].getTraceId();
    }

    getId() {
        return this[SPAN_CONTEXT].getId();
    }

    getParentId() {
        return this[SPAN_CONTEXT].getParentId();
    }

    getStartTime() {
        return this[START_MILLIS];
    }

    getEndTime() {
        return this[END_MILLIS];
    }

    getDuration() {
        return this[END_MILLIS] && this[START_MILLIS] ? this[END_MILLIS] - this[START_MILLIS] : 0;
    }

    isFinished() {
        return this[FINISHED];
    }

    /**
     * Deprecated
     */
    logEvent() {
        console.log('Deprecated call to logEvent(eventName, payload)');
    }

    setBaggageItem() {
        return this;
    }
    getBaggageItem() {
    }
}

module.exports = {
    APMSpan,
};
