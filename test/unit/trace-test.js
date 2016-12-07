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

import test from 'tape';
import Constants from 'opentracing';
import { Trace } from '../../lib/Trace'; // TODO remove
import { NODE_TYPE_CONSUMER, NODE_TYPE_PRODUCER, NODE_TYPE_COMPONENT, CORR_ID_SCOPE_INTERACTION,
    CORR_ID_SCOPE_CAUSED_BY, CARRIER_CORRELATION_ID, CARRIER_TRACE_ID } from '../../lib/constants';
import { APMTracer } from '../../index';
import metaData from '../../lib/deployment-meta-data';

test('test one span Component', (t) => {
    const tracer = new APMTracer();
    const rootSpan = tracer.startSpan('Name');
    t.deepEqual(rootSpan.context().getTrace().findNode(rootSpan.getId()).getType(), NODE_TYPE_COMPONENT);
    t.end();
});

test('test one span Consumer', (t) => {
    const tracer = new APMTracer();
    const context = tracer.extract(Constants.FORMAT_TEXT_MAP, {});
    const rootSpan = tracer.startSpan('Name', { childOf: context });
    t.deepEqual(rootSpan.context().getTrace().findNode(rootSpan.getId()).getType(), NODE_TYPE_CONSUMER);
    t.end();
});

test('test one span Producer', (t) => {
    const tracer = new APMTracer();
    const rootSpan = tracer.startSpan('Name');
    t.deepEqual(rootSpan.context().getTrace().findNode(rootSpan.getId()).getType(), NODE_TYPE_COMPONENT);

    tracer.inject(rootSpan.context(), Constants.FORMAT_TEXT_MAP, {});
    t.deepEqual(rootSpan.context().getTrace().findNode(rootSpan.getId()).getType(), NODE_TYPE_PRODUCER);
    t.end();
});

test('test isRoot', (t) => {
    const tracer = new APMTracer();
    const rootSpan = tracer.startSpan('Name');
    t.deepEqual(rootSpan.context().getTrace().findNode(rootSpan.getId()).getType(), NODE_TYPE_COMPONENT);

    const child = tracer.startSpan('Name', { childOf: rootSpan });
    t.deepEqual(child.context().getTrace().findNode(child.getId()).getType(), NODE_TYPE_COMPONENT);
    t.deepEqual(child.context().getTrace(), rootSpan.context().getTrace());

    const rootSpan2 = tracer.startSpan('Name2');
    t.deepEqual(rootSpan2.context().getTrace().findNode(rootSpan2.getId()).getType(), NODE_TYPE_COMPONENT);
    // t.deepEqual(child.context().getTrace(), rootSpan2.context().getTrace()); // does not hold
    t.end();
});

test('test two spans, nodes', (t) => {
    const tracer = new APMTracer();
    const rootSpan = tracer.startSpan('Name');
    tracer.startSpan('Name', { childOf: rootSpan });
    t.true(rootSpan.context().getTrace().findNode(rootSpan.getId()).getNodes().length, 2);
    t.end();
});

test('test recording', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });
    const rootSpan = tracer.startSpan('Name');
    const child = tracer.startSpan('Name', { childOf: rootSpan });

    child.finish();
    t.deepEqual(recorder.getTraces().length, 0);

    rootSpan.finish();
    t.deepEqual(recorder.getTraces().length, 1);
    t.end();
});

test('test recording child finishes after parent', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });
    const rootSpan = tracer.startSpan('Name');
    const child = tracer.startSpan('Name', { childOf: rootSpan });

    rootSpan.finish();
    t.deepEqual(recorder.getTraces().length, 0);

    child.finish();
    t.deepEqual(recorder.getTraces().length, 1);
    t.end();
});

test('test trace serialization, one span', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });
    const rootSpan = tracer.startSpan('Name', {
        tags: {
            'number': 22,
            'number2': '22.32',
            'text': '1a1',
        }
    });

    rootSpan.finish();
    t.deepEqual(recorder.getTraces().length, 1);

    t.deepEquals(recorder.getTraces(), [{
        traceId: rootSpan.getTraceId(),
        fragmentId: rootSpan.getId(),
        timestamp: rootSpan.getStartTime() * 1000,
        nodes: [{
            type: NODE_TYPE_COMPONENT,
            uri: null,
            timestamp: rootSpan.getStartTime() * 1000,
            operation: rootSpan.getOperationName(),
            duration: rootSpan.getDuration() * 1000,
            properties: [{
                name: 'number',
                value: 22,
                type: 'Number',
            }, {
                name: 'number2',
                value: 22.32,
                type: 'Number',
            }, {
                name: 'text',
                value: '1a1',
                type: 'Text',
            }],
        }],
    }]);
    t.end();
});

test('test trace serialization, two spans', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });
    const rootSpan = tracer.startSpan('root');
    const childSpan1 = tracer.startSpan('child1', { childOf: rootSpan });
    childSpan1.finish(new Date().getTime()  + 150);
    rootSpan.finish(new Date().getTime()  + 200);
    t.deepEqual(recorder.getTraces().length, 1);

    t.deepEquals(recorder.getTraces(), [{
        traceId: rootSpan.getTraceId(),
        fragmentId: rootSpan.getId(),
        timestamp: rootSpan.getStartTime() * 1000,
        nodes: [{
            type: NODE_TYPE_COMPONENT,
            uri: null,
            timestamp: rootSpan.getStartTime() * 1000,
            operation: rootSpan.getOperationName(),
            duration: rootSpan.getDuration() * 1000,
            nodes: [{
                type: NODE_TYPE_COMPONENT,
                uri: null,
                timestamp: childSpan1.getStartTime() * 1000,
                operation: childSpan1.getOperationName(),
                duration: childSpan1.getDuration() * 1000,
            },]
        }],
    }]);
    t.end();
});

test('test trace serialization, three spans', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });
    const carrier = {};
    carrier[CARRIER_CORRELATION_ID] = 5;
    const context = tracer.extract(Constants.FORMAT_TEXT_MAP, carrier);
    const rootSpan = tracer.startSpan('root', {
        childOf: context ,
        tags: {
            'foo': 'bar'
        }
    });
    const childSpan1 = tracer.startSpan('child1', {
        childOf: rootSpan,
        tags: {
            'typeFromUrl.url': 'localhost',
        }
    });
    const childSpan2 = tracer.startSpan('child2', {
        childOf: rootSpan,
        tags: {
            'http.url': 'http://localhost:9422/foo/bar'
        }
    });

    childSpan1.finish(new Date().getTime()  + 150);
    rootSpan.finish(new Date().getTime()  + 200);
    tracer.inject(childSpan2.context(), Constants.FORMAT_TEXT_MAP, carrier);
    childSpan2.finish(new Date().getTime()  + 300);
    t.deepEqual(recorder.getTraces().length, 1);

    t.deepEquals(recorder.getTraces(), [{
        traceId: rootSpan.getTraceId(),
        fragmentId: rootSpan.getId(),
        timestamp: rootSpan.getStartTime() * 1000,
        nodes: [{
            type: NODE_TYPE_CONSUMER,
            endpointType: 'HTTP',
            uri: null,
            timestamp: rootSpan.getStartTime() * 1000,
            operation: rootSpan.getOperationName(),
            duration: rootSpan.getDuration() * 1000,
            correlationIds: [{
                value: 5,
                scope: CORR_ID_SCOPE_INTERACTION,
            }],
            properties: [{
                name: 'foo',
                value: 'bar',
                type: 'Text',
            }],
            nodes: [{
                type: NODE_TYPE_COMPONENT,
                componentType: 'TYPEFROMURL',
                uri: null,
                timestamp: childSpan1.getStartTime() * 1000,
                operation: childSpan1.getOperationName(),
                duration: childSpan1.getDuration() * 1000,
                properties: [{
                    name: 'typeFromUrl.url',
                    value: 'localhost',
                    type: 'Text',
                }]
            }, {
                type: NODE_TYPE_PRODUCER,
                endpointType: 'HTTP',
                uri: '/foo/bar',
                timestamp: childSpan2.getStartTime() * 1000,
                operation: childSpan2.getOperationName(),
                duration: childSpan2.getDuration() * 1000,
                properties: [{
                    name: 'http.url',
                    value: 'http://localhost:9422/foo/bar',
                    type: 'Text',
                }],
                correlationIds: [{
                    value: carrier[CARRIER_CORRELATION_ID],
                    scope: CORR_ID_SCOPE_INTERACTION,
                }],
            }]
        }],
    }]);
    t.end();
});

test('test followsFrom', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });

    const rootSpan = tracer.startSpan('root', {
        tags: {
            'http.url': 'http://localhost:8080/a/b',
        }
    });
    const childSpan1 = tracer.startSpan('child1', { childOf: rootSpan });
    const childSpan11 = tracer.startSpan('child11', { childOf: childSpan1 });
    const childSpan2 = tracer.startSpan('child2', { childOf: rootSpan });
    const childSpan22 = tracer.startSpan('child22', { childOf: childSpan2 });

    childSpan11.finish();
    childSpan1.finish();
    childSpan22.finish();
    childSpan2.finish();
    rootSpan.finish();

    const followsFromSpan = tracer.startSpan('follows', {
        references: [
            new Constants.Reference(Constants.REFERENCE_FOLLOWS_FROM, childSpan11),
        ]});
    followsFromSpan.finish();

    t.deepEqual(recorder.getTraces().length, 2);
    t.deepEquals(recorder.getTraces()[0], {
        traceId: rootSpan.getTraceId(),
        fragmentId: rootSpan.getId(),
        timestamp: rootSpan.getStartTime() * 1000,
        nodes: [{
            type: NODE_TYPE_COMPONENT,
            uri: '/a/b',
            componentType: 'HTTP',
            timestamp: rootSpan.getStartTime() * 1000,
            operation: rootSpan.getOperationName(),
            duration: rootSpan.getDuration() * 1000,
            properties: [{
                name: 'http.url',
                value: 'http://localhost:8080/a/b',
                type: 'Text',
            }],
            nodes: [{
                type: NODE_TYPE_COMPONENT,
                uri: null,
                timestamp: childSpan1.getStartTime() * 1000,
                operation: childSpan1.getOperationName(),
                duration: childSpan1.getDuration() * 1000,
                nodes: [{
                    type: NODE_TYPE_COMPONENT,
                    uri: null,
                    timestamp: childSpan11.getStartTime() * 1000,
                    operation: childSpan11.getOperationName(),
                    duration: childSpan11.getDuration() * 1000,
                }],
            }, {
                type: NODE_TYPE_COMPONENT,
                uri: null,
                timestamp: childSpan2.getStartTime() * 1000,
                operation: childSpan2.getOperationName(),
                duration: childSpan2.getDuration() * 1000,
                nodes: [{
                    type: NODE_TYPE_COMPONENT,
                    uri: null,
                    timestamp: childSpan22.getStartTime() * 1000,
                    operation: childSpan22.getOperationName(),
                    duration: childSpan22.getDuration() * 1000,
                }],
            }],
        }],
    });

    t.deepEquals(recorder.getTraces()[1], {
        traceId: rootSpan.getTraceId(),
        fragmentId: followsFromSpan.getId(),
        timestamp: followsFromSpan.getStartTime() * 1000,
        nodes: [{
            type: NODE_TYPE_CONSUMER,
            endpointType: null,
            uri: '/a/b',
            timestamp: followsFromSpan.getStartTime() * 1000,
            operation: rootSpan.getOperationName(),
            duration: 0,
            correlationIds: [{
                value: `${rootSpan.getId()}:0:0:0`,
                scope: CORR_ID_SCOPE_CAUSED_BY,
            }],
            nodes: [{
                type: NODE_TYPE_COMPONENT,
                uri: null,
                operation: followsFromSpan.getOperationName(),
                timestamp: followsFromSpan.getStartTime() * 1000,
                duration: followsFromSpan.getDuration() * 1000,
            }],
        }],
    });
    t.end();
});

test('test followsFrom with additional span and inject', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });

    const rootSpan = tracer.startSpan('root');
    const childSpan1 = tracer.startSpan('child1', { childOf: rootSpan });
    const childSpan11 = tracer.startSpan('child11', { childOf: childSpan1 });
    const childSpan2 = tracer.startSpan('child2', { childOf: rootSpan });
    const childSpan22 = tracer.startSpan('child22', { childOf: childSpan2 });

    childSpan11.finish();
    childSpan1.finish();
    childSpan22.finish();
    childSpan2.finish();
    rootSpan.finish();

    const followsFromSpan = tracer.startSpan('follows', {
        references: [
            new Constants.Reference(Constants.REFERENCE_FOLLOWS_FROM, childSpan11),
        ]});

    const childOfFromFollwsFrom = tracer.startSpan('childOfFromFollowsFrom', {
        references: [
            new Constants.Reference(Constants.REFERENCE_CHILD_OF, followsFromSpan),
        ]});

    const carrier = {};
    tracer.inject(childOfFromFollwsFrom.context(), Constants.FORMAT_TEXT_MAP, carrier);
    followsFromSpan.finish();
    childOfFromFollwsFrom.finish();

    t.deepEqual(recorder.getTraces().length, 2);
    t.deepEquals(recorder.getTraces()[0], {
        traceId: rootSpan.getTraceId(),
        fragmentId: rootSpan.getId(),
        timestamp: rootSpan.getStartTime() * 1000,
        nodes: [{
            type: NODE_TYPE_COMPONENT,
            uri: null,
            timestamp: rootSpan.getStartTime() * 1000,
            operation: rootSpan.getOperationName(),
            duration: rootSpan.getDuration() * 1000,
            nodes: [{
                type: NODE_TYPE_COMPONENT,
                uri: null,
                timestamp: childSpan1.getStartTime() * 1000,
                operation: childSpan1.getOperationName(),
                duration: childSpan1.getDuration() * 1000,
                nodes: [{
                    type: NODE_TYPE_COMPONENT,
                    uri: null,
                    timestamp: childSpan11.getStartTime() * 1000,
                    operation: childSpan11.getOperationName(),
                    duration: childSpan11.getDuration() * 1000,
                }],
            }, {
                type: NODE_TYPE_COMPONENT,
                uri: null,
                timestamp: childSpan2.getStartTime() * 1000,
                operation: childSpan2.getOperationName(),
                duration: childSpan2.getDuration() * 1000,
                nodes: [{
                    type: NODE_TYPE_COMPONENT,
                    uri: null,
                    timestamp: childSpan22.getStartTime() * 1000,
                    operation: childSpan22.getOperationName(),
                    duration: childSpan22.getDuration() * 1000,
                }],
            }],
        }],
    });

    t.deepEquals(recorder.getTraces()[1], {
        traceId: rootSpan.getTraceId(),
        fragmentId: followsFromSpan.getId(),
        timestamp: followsFromSpan.getStartTime() * 1000,
        nodes: [{
            type: NODE_TYPE_CONSUMER,
            endpointType: null,
            uri: null,
            operation: rootSpan.getOperationName(),
            timestamp: followsFromSpan.getStartTime() * 1000,
            duration: 0,
            correlationIds: [{
                value: `${rootSpan.getId()}:0:0:0`,
                scope: CORR_ID_SCOPE_CAUSED_BY,
            }],
            nodes: [{
                type: NODE_TYPE_COMPONENT,
                uri: null,
                operation: followsFromSpan.getOperationName(),
                timestamp: followsFromSpan.getStartTime() * 1000,
                duration: followsFromSpan.getDuration() * 1000,
                nodes: [{
                    type: NODE_TYPE_PRODUCER,
                    uri: null,
                    endpointType: 'HTTP',
                    operation: childOfFromFollwsFrom.getOperationName(),
                    timestamp: childOfFromFollwsFrom.getStartTime() * 1000,
                    duration: childOfFromFollwsFrom.getDuration() * 1000,
                    correlationIds: [{
                        value: carrier[CARRIER_CORRELATION_ID],
                        scope: CORR_ID_SCOPE_INTERACTION,
                    }],
                }],
            }],
        }],
    });
    t.end();
});

test('test mixed references, primary parent childOf', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });

    const rootSpan = tracer.startSpan('root');
    const childSpan1 = tracer.startSpan('child1', { childOf: rootSpan });
    const childSpan11 = tracer.startSpan('child11', { childOf: childSpan1 });
    const childSpan2 = tracer.startSpan('child2', { childOf: rootSpan });
    const childSpan22 = tracer.startSpan('child22', { childOf: childSpan2 });

    childSpan1.finish();
    childSpan2.finish();
    rootSpan.finish();
    childSpan11.finish();

    const multipleReferencesSpan = tracer.startSpan('follows', {
        references: [
            new Constants.Reference(Constants.REFERENCE_FOLLOWS_FROM, childSpan11),
            new Constants.Reference(Constants.REFERENCE_CHILD_OF, childSpan22.context()),
        ]});

    childSpan22.finish();
    multipleReferencesSpan.finish();

    t.deepEqual(recorder.getTraces().length, 1);
    t.deepEquals(recorder.getTraces()[0], {
        traceId: rootSpan.getTraceId(),
        fragmentId: rootSpan.getId(),
        timestamp: rootSpan.getStartTime() * 1000,
        nodes: [{
            type: NODE_TYPE_COMPONENT,
            uri: null,
            timestamp: rootSpan.getStartTime() * 1000,
            operation: rootSpan.getOperationName(),
            duration: rootSpan.getDuration() * 1000,
            nodes: [{
                type: NODE_TYPE_COMPONENT,
                uri: null,
                timestamp: childSpan1.getStartTime() * 1000,
                operation: childSpan1.getOperationName(),
                duration: childSpan1.getDuration() * 1000,
                nodes: [{
                    type: NODE_TYPE_COMPONENT,
                    uri: null,
                    timestamp: childSpan11.getStartTime() * 1000,
                    operation: childSpan11.getOperationName(),
                    duration: childSpan11.getDuration() * 1000,
                }],
            }, {
                type: NODE_TYPE_COMPONENT,
                uri: null,
                timestamp: childSpan2.getStartTime() * 1000,
                operation: childSpan2.getOperationName(),
                duration: childSpan2.getDuration() * 1000,
                nodes: [{
                    type: NODE_TYPE_COMPONENT,
                    uri: null,
                    timestamp: childSpan22.getStartTime() * 1000,
                    operation: childSpan22.getOperationName(),
                    duration: childSpan22.getDuration() * 1000,
                    nodes:[{
                        type: NODE_TYPE_COMPONENT,
                        uri: null,
                        timestamp: multipleReferencesSpan.getStartTime() * 1000,
                        operation: multipleReferencesSpan.getOperationName(),
                        duration: multipleReferencesSpan.getDuration() * 1000,
                        correlationIds: [{
                            value: `${rootSpan.getId()}:0:0:0`,
                            scope: CORR_ID_SCOPE_CAUSED_BY
                        }],
                    }],
                }],
            }],
        }],
    });
    t.end();
});

test('test mixed references, primary parent extracted empty context', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });

    const extractedContext = tracer.extract(Constants.FORMAT_TEXT_MAP, {});
    const rootSpan = tracer.startSpan('root', { childOf: extractedContext});
    const childSpan1 = tracer.startSpan('child1', { childOf: rootSpan });
    const childSpan11 = tracer.startSpan('child11', { childOf: childSpan1 });
    const childSpan2 = tracer.startSpan('child2', { childOf: rootSpan });
    const childSpan22 = tracer.startSpan('child22', { childOf: childSpan2 });

    childSpan1.finish();
    childSpan11.finish();
    childSpan2.finish();
    rootSpan.finish();

    const multipleReferencesSpan = tracer.startSpan('follows', {
        references: [
            new Constants.Reference(Constants.REFERENCE_FOLLOWS_FROM, extractedContext),
            new Constants.Reference(Constants.REFERENCE_CHILD_OF, childSpan22.context()),
        ]});

    multipleReferencesSpan.finish();
    childSpan22.finish();

    t.deepEqual(recorder.getTraces().length, 2);
    t.deepEquals(recorder.getTraces()[0], {
        traceId: multipleReferencesSpan.getTraceId(),
        fragmentId: multipleReferencesSpan.getId(),
        timestamp: multipleReferencesSpan.getStartTime() * 1000,
        nodes: [{
            type: NODE_TYPE_CONSUMER,
            endpointType: 'HTTP',
            uri: null,
            operation: multipleReferencesSpan.getOperationName(),
            timestamp: multipleReferencesSpan.getStartTime() * 1000,
            duration: multipleReferencesSpan.getDuration() * 1000,
            correlationIds: [{
                value: `${rootSpan.getId()}:0:1:0`,
                scope: CORR_ID_SCOPE_CAUSED_BY,
            }],
        }],
    });
    t.end();
});

test('test mixed references, primary parent extracted valid context', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });

    const carrier = {};
    carrier[CARRIER_CORRELATION_ID] = 'foobar';
    carrier[CARRIER_TRACE_ID] = 'trace';

    const extractedContext = tracer.extract(Constants.FORMAT_TEXT_MAP, carrier);
    const rootSpan = tracer.startSpan('root', { childOf: extractedContext});
    const childSpan1 = tracer.startSpan('child1', { childOf: rootSpan });
    const childSpan11 = tracer.startSpan('child11', { childOf: childSpan1 });
    const childSpan2 = tracer.startSpan('child2', { childOf: rootSpan });
    const childSpan22 = tracer.startSpan('child22', { childOf: childSpan2 });

    childSpan1.finish();
    childSpan11.finish();
    childSpan2.finish();
    rootSpan.finish();

    const multipleReferencesSpan = tracer.startSpan('follows', {
        references: [
            new Constants.Reference(Constants.REFERENCE_FOLLOWS_FROM, extractedContext),
            new Constants.Reference(Constants.REFERENCE_CHILD_OF, childSpan22.context()),
        ]});

    multipleReferencesSpan.finish();
    childSpan22.finish();

    t.deepEqual(recorder.getTraces().length, 2);
    t.deepEquals(recorder.getTraces()[0], {
        traceId: multipleReferencesSpan.getTraceId(),
        fragmentId: multipleReferencesSpan.getId(),
        timestamp: multipleReferencesSpan.getStartTime() * 1000,
        nodes: [{
            type: NODE_TYPE_CONSUMER,
            endpointType: 'HTTP',
            uri: null,
            operation: multipleReferencesSpan.getOperationName(),
            timestamp: multipleReferencesSpan.getStartTime() * 1000,
            duration: multipleReferencesSpan.getDuration() * 1000,
            correlationIds: [{
                value: carrier[CARRIER_CORRELATION_ID],
                scope: CORR_ID_SCOPE_INTERACTION,
            },{
                value: `${rootSpan.getId()}:0:1:0`,
                scope: CORR_ID_SCOPE_CAUSED_BY,
            }],
        }],
    });
    t.end();
});

test('test mixed references, join scenario', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });

    const extractedContext = tracer.extract(Constants.FORMAT_TEXT_MAP, {});
    const rootSpan = tracer.startSpan('root', { childOf: extractedContext});
    const childSpan1 = tracer.startSpan('child1', { childOf: rootSpan });
    const childSpan11 = tracer.startSpan('child11', { childOf: childSpan1 });
    const childSpan2 = tracer.startSpan('child2', { childOf: rootSpan });
    const childSpan22 = tracer.startSpan('child22', { childOf: childSpan2 });

    childSpan1.finish();
    childSpan22.finish();
    childSpan2.finish();
    rootSpan.finish();
    childSpan11.finish();

    const multipleReferencesSpan = tracer.startSpan('follows', {
        references: [
            new Constants.Reference(Constants.REFERENCE_FOLLOWS_FROM, rootSpan),
            new Constants.Reference(Constants.REFERENCE_FOLLOWS_FROM, childSpan22.context()),
        ]});

    multipleReferencesSpan.finish();

    t.deepEqual(recorder.getTraces().length, 2);
    t.deepEquals(recorder.getTraces()[1], {
        traceId: rootSpan.getTraceId(),
        fragmentId: multipleReferencesSpan.getId(),
        timestamp: multipleReferencesSpan.getStartTime() * 1000,
        nodes: [{
            type: NODE_TYPE_CONSUMER,
            endpointType: null,
            uri: null,
            operation: rootSpan.getOperationName(),
            timestamp: multipleReferencesSpan.getStartTime() * 1000,
            duration: 0,
            correlationIds: [{
                value: `${rootSpan.getId()}:0`,
                scope: CORR_ID_SCOPE_CAUSED_BY,
            }, {
                value: `${rootSpan.getId()}:0:1:0`,
                scope: CORR_ID_SCOPE_CAUSED_BY,
            }],
            nodes: [{
                type: NODE_TYPE_COMPONENT,
                uri: null,
                operation: multipleReferencesSpan.getOperationName(),
                timestamp: multipleReferencesSpan.getStartTime() * 1000,
                duration: multipleReferencesSpan.getDuration() * 1000,
            }],
        }],
    });
    t.end();
});

test('test trace add and find node', (t) => {
    const tracer = new APMTracer();
    const trace = new Trace();

    const rootSpan = tracer.startSpan('root');
    const childSpan1 = tracer.startSpan('child1', { childOf: rootSpan });
    const childSpan2 = tracer.startSpan('child2', { childOf: rootSpan });

    trace.addNode(NODE_TYPE_COMPONENT, rootSpan);
    trace.addNode(NODE_TYPE_COMPONENT, childSpan1);
    trace.addNode(NODE_TYPE_COMPONENT, childSpan2);
    t.deepEquals(trace.findNode(rootSpan.getId()).getSpan(), rootSpan);
    t.deepEquals(trace.findNode(childSpan1.getId()).getSpan(), childSpan1);
    t.deepEquals(trace.findNode(childSpan2.getId()).getSpan(), childSpan2);

    t.deepEquals(trace.findNode(rootSpan.getId()).getNodes().length, 2);
    t.end();
});

test('test serviceName and buildStamp from env vars', (t) => {
    process.env[metaData.OPENSHIFT_BUILD_NAMESPACE] = 'namespace';
    process.env[metaData.OPENSHIFT_BUILD_NAME] = 'name-1';
    process.env[metaData.HAWKULAR_APM_SERVICE_NAME] = 'foo';
    metaData.DEFAULT_META_DATA.reload();

    const recorder = new ListRecorder();
    const tracer = new APMTracer({ recorder: recorder });

    const rootSpan = tracer.startSpan('root');
    const childSpan1 = tracer.startSpan('child1', { childOf: rootSpan });
    const childSpan2 = tracer.startSpan('child2', { childOf: rootSpan });

    childSpan2.finish();
    childSpan1.finish();
    rootSpan.finish();

    console.log(JSON.stringify(recorder.getTraces()[0].nodes[0].properties))
    t.deepEquals(recorder.getTraces()[0].nodes[0].properties, [{
        name: "service",
        value: "foo",
        type: "Text",
    }, {
        name: "buildStamp",
        value: "namespace.name-1",
        type: "Text",
    }]);

    cleanEnvVariables();
    t.end();
});

class ListRecorder {
    constructor() {
        this._traces = [];
    }
    record(span) {
        const trace = span.context().getTrace().fromSpan(span);
        this._traces.push(JSON.parse(JSON.stringify(trace)));
    }
    getTraces() {
        return this._traces;
    }
}

function cleanEnvVariables() {
    delete process.env[metaData.HAWKULAR_APM_SERVICE_NAME];
    delete process.env[metaData.OPENSHIFT_BUILD_NAMESPACE];
    delete process.env[metaData.OPENSHIFT_BUILD_NAME];
    metaData.DEFAULT_META_DATA.reload();
}
