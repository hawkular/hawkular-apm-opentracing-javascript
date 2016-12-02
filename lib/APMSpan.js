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

import Constants from 'opentracing';
import * as utils from './utils';
import { APMSpanContext } from './APMSpanContext';
import { Node } from './Trace';
import * as constants from './constants';

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
            console.log('childOf and references should not be provided at the same time! Continuing only with childOf!');
        }

        if (fields.childOf) {
            fields.references = [new Constants.Reference(Constants.REFERENCE_CHILD_OF, fields.childOf)];
        }

        this[TRACER] = tracer;
        this[OPERATION_NAME] = fields.operationName;
        this[TAGS] = fields.tags || {};
        this[START_MILLIS] = fields.startTime || utils.nowMillis();
        this[LOGS] = [];
        this[FINISHED] = false;

        this._initReferences(fields.references);
    }

    _initReferences(references) {
        function findPrimaryReference() {
            const extractedContext = [];
            const childOf = [];
            const followsFrom = [];

            for (let i = 0; i < references.length; i += 1) {
                const reference = references[i];
                if (reference.referencedContext().getConsumerCorrelationId() !== undefined) {
                    extractedContext.push(reference);
                } else if (reference.type() === Constants.REFERENCE_FOLLOWS_FROM) {
                    followsFrom.push(reference);
                } else if (reference.type() === Constants.REFERENCE_CHILD_OF) {
                    childOf.push(reference);
                }
            }

            if (extractedContext.length === 1) {
                return extractedContext[0];
            } else if (extractedContext.length > 1) {
                return undefined;
            }

            if (childOf.length === 1) {
                return childOf[0];
            } else if (childOf.length > 1) {
                return undefined;
            }

            if (followsFrom.length === 1) {
                return followsFrom[0];
            }
            return undefined;
        }

        // standardise reference.referencedContext() to context.
        if (references) {
            references = references.map(item =>
                new Constants.Reference(item.type(), item.referencedContext() instanceof APMSpan ?
                    item.referencedContext().context() : item.referencedContext())
            );
        }

        if (!references || references.length === 0) {
            this._initChildOf(references);
            return;
        }

        const primaryReference = findPrimaryReference(references);

        if (primaryReference) {
            // if the context was extracted (tracer.extract()) use 'Interaction' scope
            if (primaryReference.referencedContext().getConsumerCorrelationId() !== undefined) {
                primaryReference._type = Constants.REFERENCE_CHILD_OF;
            }

            switch (primaryReference.type()) {
            case Constants.REFERENCE_CHILD_OF:
                this._initChildOf(primaryReference, references.filter(item => item !== primaryReference));
                break;
            case Constants.REFERENCE_FOLLOWS_FROM:
                this._initFollowsFromOrJoin(primaryReference, references.filter(item => item !== primaryReference));
                break;
            default:
                console.log('Undefined causal reference type');
            }
        } else {
            this._initFollowsFromOrJoin(references[0], references.slice(1));
        }
    }

    _initChildOf(primaryReference, otherReferences) {
        const parentContext = primaryReference ? primaryReference.referencedContext() : undefined;

        const id = utils.generateSpanId();
        let traceId;
        let parentId;

        if (parentContext && parentContext.getId() && parentContext.getTraceId()) {
            parentId = parentContext.getId();
            traceId = parentContext.getTraceId();
        } else {
            // new trace
            traceId = id;
        }

        let nodeType = constants.NODE_TYPE_COMPONENT;
        this[SPAN_CONTEXT] = new APMSpanContext(id, traceId, parentId,
            parentContext ? parentContext.getTransaction() : undefined,
            parentContext ? parentContext.getLevel() : undefined
        );

        if (parentContext) {
            if (parentContext.getConsumerCorrelationId() === undefined) {
                this[SPAN_CONTEXT].setTrace(parentContext.getTrace());
            }
        }

        const corrIds = APMSpan.remainingReferencesCorrIds(otherReferences);
        if (parentContext && parentContext.getConsumerCorrelationId() !== undefined) {
            nodeType = constants.NODE_TYPE_CONSUMER;
            if (parentContext.getConsumerCorrelationId() != null) {
                corrIds.splice(0, 0, {
                    value: parentContext.getConsumerCorrelationId(),
                    scope: constants.CORR_ID_SCOPE_INTERACTION,
                });
            }
        }

        this[SPAN_CONTEXT].getTrace().addNode(nodeType, this, corrIds);
    }

    _initFollowsFromOrJoin(primaryReference, otherReferences) {
        // check if references are from the same trace
        for (let i = 0; otherReferences && i < otherReferences.length; i += 1) {
            if (primaryReference.referencedContext().getTraceId() !==
                otherReferences[i].referencedContext().getTraceId()) {
                console.log('References are not from the same trace!');
            }
        }

        const corrIds = [APMSpan.primaryCorrelationId(primaryReference)]
            .concat(APMSpan.remainingReferencesCorrIds(otherReferences));

        const initialConsumer = new Node(null, constants.NODE_TYPE_CONSUMER, corrIds);
        const rootSpanPreviousTrace = APMSpan.findRootSpan(primaryReference.referencedContext());
        const rootNodePreviousTrace = rootSpanPreviousTrace.getTrace().findNode(rootSpanPreviousTrace.getId());
        initialConsumer.setTimestamp(this[START_MILLIS]);
        if (rootNodePreviousTrace) {
            initialConsumer.setOperation(rootNodePreviousTrace.getOperation());
            initialConsumer.setUri(rootNodePreviousTrace.getUri());
        }
        initialConsumer.setEndpointType(null);
        initialConsumer.getNodes().push(new Node(this, constants.NODE_TYPE_COMPONENT));

        this[SPAN_CONTEXT] = new APMSpanContext(utils.generateSpanId(),
            primaryReference.referencedContext().getTraceId(),
            undefined,
            primaryReference.referencedContext().getTransaction(),
            primaryReference.referencedContext().getLevel()
        );
        this[SPAN_CONTEXT].getTrace().addNodeWithoutSpan(initialConsumer);
    }

    static remainingReferencesCorrIds(references) {
        if (!references) {
            return [];
        }

        const correlationIds = [];
        for (let i = 0; i < references.length; i += 1) {
            let scope = constants.CORR_ID_SCOPE_CAUSED_BY;
            if (references[i].referencedContext().getConsumerCorrelationId() !== undefined) {
                scope = constants.CORR_ID_SCOPE_INTERACTION;
            }

            correlationIds.push({
                value: APMSpan.correlationIdValue(references[i].referencedContext()),
                scope,
            });
        }

        return correlationIds;
    }

    static primaryCorrelationId(reference) {
        function correlationIdScope(referenceType) {
            let corrIdScope = constants.CORR_ID_SCOPE_INTERACTION;
            switch (referenceType) {
            case Constants.REFERENCE_CHILD_OF:
                corrIdScope = constants.CORR_ID_SCOPE_INTERACTION;
                break;
            case Constants.REFERENCE_FOLLOWS_FROM:
                corrIdScope = constants.CORR_ID_SCOPE_CAUSED_BY;
                break;
            default:
                console.log(`Unrecognized reference type: ${referenceType}! Using ChildOf`);
            }

            return corrIdScope;
        }

        return {
            value: APMSpan.correlationIdValue(reference.referencedContext()),
            scope: correlationIdScope(reference.type()),
        };
    }

    static correlationIdValue(context) {
        const nodePosition = context.getTrace().nodePositionId(context.getId());
        return `${APMSpan.findRootSpan(context).getId()}:${nodePosition}`;
    }

    static findRootSpan(spanContext) {
        let rootSpanContext = spanContext;
        while (rootSpanContext.getParentId()) {
            const node = spanContext.getTrace().findNode(rootSpanContext.getParentId());
            if (node) {
                rootSpanContext = node.getSpan().context();
            } else {
                break;
            }
        }

        return rootSpanContext;
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
        if (key !== undefined && key != null && value !== undefined && value != null) {
            this[TAGS][key] = value;
            if (Constants.Tags.SAMPLING_PRIORITY === key) {
                const samplingPriority = Number(value);
                if (!isNaN(samplingPriority)) {
                    this[SPAN_CONTEXT].setLevel(samplingPriority > 0 ? constants.REPORTING_LEVEL_ALL :
                        constants.REPORTING_LEVEL_NONE);
                }
            }
        }
        return this;
    }

    addTags(keyValueMap) {
        Object.keys(keyValueMap).forEach((value, key) => {
            this.setTag(key, value);
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
            const level = this[SPAN_CONTEXT].getLevel() === constants.REPORTING_LEVEL_ALL ?
                this[SPAN_CONTEXT].getLevel() : spanToReport.context().getLevel();
            const isSampled = this.contextSampling(this[TRACER].getSampler(), this[SPAN_CONTEXT].getTrace(), level);

            if (isSampled) {
                this[TRACER].getRecorder().record(spanToReport);
            }
        }
    }

    contextSampling(sampler, trace, reportingLevel) {
        if (reportingLevel) {
            switch (reportingLevel) {
            case constants.REPORTING_LEVEL_NONE:
            case constants.REPORTING_LEVEL_IGNORE:
                return false;
            case constants.REPORTING_LEVEL_ALL:
            default:
                return true;
            }
        }

        return sampler.isSampled(trace);
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
