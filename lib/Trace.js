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

import * as nodeUtils from './nodeUtils';

const SPAN = Symbol('SPAN');
const TYPE = Symbol('TYPE');
const CORRELATION_ID = Symbol('CORRELATION_ID');
const NODES = Symbol('NODES');
const OPERATION = Symbol('OPERATION');
const URI = Symbol('URI');
const ENDPOINT_TYPE = Symbol('ENDPOINT_TYPE');
const TIMESTAMP = Symbol('TIMESTAMP');

class Node {
    constructor(span, type, correlationIds = []) {
        this[SPAN] = span;
        this[TYPE] = type;
        this[CORRELATION_ID] = correlationIds;
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

    getCorrelationIds() {
        return this[CORRELATION_ID];
    }

    addCorrelationId(correlationId) {
        this[CORRELATION_ID].push(correlationId);
    }

    setOperation(operation) {
        this[OPERATION] = operation;
    }

    getOperation() {
        if (this[OPERATION]) {
            return this[OPERATION];
        }

        return nodeUtils.deriveOperation(this[SPAN]);
    }

    setEndpointType(endpointType) {
        this[ENDPOINT_TYPE] = endpointType;
    }

    getEndpointType() {
        if (this[ENDPOINT_TYPE] === null) {
            return this[ENDPOINT_TYPE];
        }

        return nodeUtils.deriveEndpointType(this[SPAN].getTags());
    }

    getComponentType() {
        return this[SPAN] ? nodeUtils.deriveComponentType(this[SPAN].getTags()) : undefined;
    }

    setUri(uri) {
        this[URI] = uri;
    }

    getUri() {
        if (this[URI]) {
            return this[URI];
        }

        return this[SPAN] ? nodeUtils.deriveUrl(this[SPAN].getTags()) : null;
    }

    getTimestamp() {
        if (this[TIMESTAMP]) {
            return this[TIMESTAMP];
        }

        return this[SPAN] ? this[SPAN].getStartTime() : undefined;
    }

    setTimestamp(timestamp) {
        this[TIMESTAMP] = timestamp;
    }

    getDuration() {
        return this[SPAN] ? this[SPAN].getDuration() : 0;
    }

    getProperties() {
        return this[SPAN] ? nodeUtils.tagsToProperties(this[SPAN].getTags()) : undefined;
    }

    toJSON() {
        return nodeUtils.toJson(this);
    }
}

class Trace {
    constructor() {
        this[NODES] = [];
    }

    getNodes() {
        return this[NODES];
    }

    addNode(type, span, correlationIds) {
        let nodes = this[NODES];

        const node = this.findNode(span.getParentId());
        if (node) {
            nodes = node.getNodes();
        }

        nodes.push(new Node(span, type, correlationIds));
    }

    addNodeWithoutSpan(node, parentId) {
        let nodes = this[NODES];

        const parentNode = this.findNode(parentId, parentId);
        if (parentNode) {
            nodes = parentNode.getNodes();
        }

        nodes.push(node);
    }

    setNodeType(type, span, correlationId) {
        const node = this.findNode(span.getId());
        if (node) {
            node.setType(type);
            node.addCorrelationId(correlationId);
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
        function findNodeDFS(nodes) {
            if (!nodes) {
                return null;
            }

            for (let i = 0; i < nodes.length; i += 1) {
                if (nodes[i].getSpan() && spanId === nodes[i].getSpan().getId()) {
                    return nodes[i];
                }

                const ret = findNodeDFS(nodes[i].getNodes());
                if (ret) {
                    return ret;
                }
            }

            return null;
        }

        return findNodeDFS(this[NODES]);
    }

    nodePositionId(spanId) {
        function findNodeDFS(nodes) {
            if (!nodes) {
                return undefined;
            }

            for (let i = 0; i < nodes.length; i += 1) {
                if (spanId === nodes[i].getSpan().getId()) {
                    return i;
                }

                const ret = findNodeDFS(nodes[i].getNodes());
                if (ret !== undefined) {
                    return `${i}:${ret}`;
                }
            }

            return undefined;
        }

        return findNodeDFS(this[NODES]);
    }

    fromSpan(span) {
        return {
            traceId: span.getTraceId(),
            fragmentId: span.getId(),
            transaction: span.getTags().transaction,
            timestamp: span.getStartTime() * 1000,
            nodes: this[NODES],
        };
    }
}

module.exports = {
    Trace,
    Node,
};
