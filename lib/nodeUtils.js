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

function deriveTypeFromUrl(tags) {
    const urlTypes = new Set();
    Object.keys(tags).forEach((objectKey) => {
        if (objectKey.indexOf('.url') !== -1 || objectKey.indexOf('.uri') !== -1) {
            urlTypes.add(objectKey.substring(0, objectKey.length - 4).toUpperCase());
        }
    });

    if (urlTypes.size > 0) {
        return urlTypes.values().next().value;
    }

    return undefined;
}

function deriveEndpointType(tags) {
    const endpointType = deriveTypeFromUrl(tags);
    if (!endpointType) {
        return 'HTTP';
    }

    return endpointType;
}

function deriveOperation(span) {
    if (!span.getOperationName()) {
        return span.getTags()['http.method'];
    }
    return span.getOperationName();
}

function deriveComponentType(tags) {
    let componentType = tags.component;
    if (!componentType) {
        componentType = deriveTypeFromUrl(tags);
    }

    return componentType;
}

function deriveUrl(tags) {
    function parsePathFromURL(urlStr) {
        let path = urlStr;
        try {
            path = require('url').parse(urlStr, true).pathname;
        } catch (error) {}

        return path;
    }

    let url = tags['http.url'];
    if (url) {
        return parsePathFromURL(url);
    }

    url = tags['http.uri'];
    if (url) {
        return parsePathFromURL(url);
    }

    url = tags['http.path'];
    if (url) {
        return url;
    }

    return null;
}

function tagsToProperties(tags) {
    if (!tags || Object.keys(tags).length === 0) {
        return undefined;
    }

    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    const properties = [];
    Object.keys(tags).forEach((objectKey) => {
        let value = tags[objectKey];
        const type = isNumber(value) ? 'Number' : 'Text';
        if (type === 'Number') {
            value = Number(value);
        }

        properties.push({
            name: objectKey,
            value,
            type,
        });
    });
    return properties;
}

function toJson(node) {
    const nodeJSON = {
        type: node.getType(),
        uri: deriveUrl(node.getSpan().getTags()),
        operation: deriveOperation(node.getSpan()),
        timestamp: node.getSpan().getStartTime() * 1000,
        duration: node.getSpan().getDuration() * 1000,
        properties: tagsToProperties(node.getSpan().getTags()),
        nodes: node.getNodes().length > 0 ? node.getNodes() : undefined,
    };

    switch (node.getType()) {
    case 'Consumer':
    case 'Producer': {
        nodeJSON.endpointType = deriveEndpointType(node.getSpan().getTags());
        if (node.getCorrelationIds()) {
            nodeJSON.correlationIds = node.getCorrelationIds();
        }
        break;
    }
    case 'Component':
    default:
        nodeJSON.componentType = deriveComponentType(node.getSpan().getTags());
    }

    return nodeJSON;
}

module.exports = {
    toJson,
};
