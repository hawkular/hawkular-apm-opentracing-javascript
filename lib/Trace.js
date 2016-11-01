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

import nodeUtils from './nodeUtils';

const SPAN = Symbol('SPAN');
const TYPE = Symbol('TYPE');
const CORRELATION_ID = Symbol('CORRELATION_ID');
const NODES = Symbol('NODES');

class Node {
    constructor(span, type, correlationId) {
        this[SPAN] = span;
        this[TYPE] = type;
        this[CORRELATION_ID] = correlationId;
        this[NODES] = [];
    }

    getSpan() {
        return this[SPAN];
    }

    getNodes() {
        return this[NODES];
    }

    setType(type) {
        this[TYPE] = type;
    }

    getType() {
        return this[TYPE];
    }

    getCorrelationId() {
        return this[CORRELATION_ID];
    }

    setCorrelationId(correlationId) {
        this[CORRELATION_ID] = correlationId;
    }

    toJSON() {
        return nodeUtils.toJson(this);
    }
}

class Trace {
    constructor() {
        this[NODES] = [];
    }

    addNode(type, span, correlationId) {
        let nodes = this[NODES];

        const node = this.findNode(span.getParentId());
        if (node) {
            nodes = node.getNodes();
        }

        // TODO throw exception if span is already there?
        nodes.push(new Node(span, type, correlationId));
    }

    setNodeType(type, span, correlationId) {
        const node = this.findNode(span.getId());
        if (node) {
            node.setType(type);
            node.setCorrelationId(correlationId);
        } else {
            console.log('Error setNode node not found');
        }
    }

    /**
     * Returns root span all spans (parents descendants) of given span
     * have been finished.
     */
    isFinished(span) {
        function finishedRecur(node) {
            if (!node.getSpan().isFinished()) {
                return undefined;
            }

            const nodes = node.getNodes();
            for (let i = 0; i < nodes.length; i += 1) {
                if (!nodes[i].getSpan().isFinished()) {
                    return undefined;
                }

                if (!finishedRecur(nodes[i])) {
                    return undefined;
                }
            }
            return node;
        }

        let rootSpan = span;
        while (rootSpan.getParentId()) {
            const node = this.findNode(rootSpan.getParentId());
            if (node) {
                rootSpan = node.getSpan();
            } else {
                break;
            }
        }

        const rootNode = this.findNode(rootSpan.getId());
        // first check if all descendants are finished
        return finishedRecur(rootNode) ? rootNode.getSpan() : undefined;
    }

    /**
     * Find Node associated with spanId
     */
    findNode(spanId) {
        function findNode(nodes) {
            if (!nodes) {
                return null;
            }

            for (let i = 0; i < nodes.length; i += 1) {
                if (spanId === nodes[i].getSpan().getId()) {
                    return nodes[i];
                }

                const ret = findNode(nodes[i].getNodes());
                if (ret) {
                    return ret;
                }
            }

            return null;
        }

        return findNode(this[NODES]);
    }

    fromSpan(span) {
        return {
            traceId: span.getTraceId(),
            fragmentId: span.getId(),
            businessTransaction: span.getTags().transaction,
            timestamp: span.getStartTime() * 1000,
            nodes: [this.findNode(span.getId())],
        };
    }
}

module.exports = {
    Trace,
};
