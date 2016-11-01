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
import { Trace } from '../../lib/Trace';
import { APMTracer, CARRIER_CORRELATION_ID } from '../../lib/APMTracer';

test('test one span Component', (t) => {
    const tracer = new APMTracer();
    const rootSpan = tracer.startSpan('Name');
    t.deepEqual(rootSpan.context().getTrace().findNode(rootSpan.getId()).getType(), 'Component');
    t.end();
});

test('test one span Consumer', (t) => {
    const tracer = new APMTracer();
    const context = tracer.extract(Constants.FORMAT_TEXT_MAP, {});
    const rootSpan = tracer.startSpan('Name', { childOf: context });
    t.deepEqual(rootSpan.context().getTrace().findNode(rootSpan.getId()).getType(), 'Consumer');
    t.end();
});

test('test one span Producer', (t) => {
    const tracer = new APMTracer();
    const rootSpan = tracer.startSpan('Name');
    t.deepEqual(rootSpan.context().getTrace().findNode(rootSpan.getId()).getType(), 'Component');

    tracer.inject(rootSpan.context(), Constants.FORMAT_TEXT_MAP, {});
    t.deepEqual(rootSpan.context().getTrace().findNode(rootSpan.getId()).getType(), 'Producer');
    t.end();
});

test('test isRoot', (t) => {
    const tracer = new APMTracer();
    const rootSpan = tracer.startSpan('Name');
    t.deepEqual(rootSpan.context().getTrace().findNode(rootSpan.getId()).getType(), 'Component');

    const child = tracer.startSpan('Name', { childOf: rootSpan });
    t.deepEqual(child.context().getTrace().findNode(child.getId()).getType(), 'Component');
    t.deepEqual(child.context().getTrace(), rootSpan.context().getTrace());

    const rootSpan2 = tracer.startSpan('Name2');
    t.deepEqual(rootSpan2.context().getTrace().findNode(rootSpan2.getId()).getType(), 'Component');
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
            type: 'Component',
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
            type: 'Component',
            uri: null,
            timestamp: rootSpan.getStartTime() * 1000,
            operation: rootSpan.getOperationName(),
            duration: rootSpan.getDuration() * 1000,
            nodes: [{
                type: 'Component',
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
            type: 'Consumer',
            endpointType: 'HTTP',
            uri: null,
            timestamp: rootSpan.getStartTime() * 1000,
            operation: rootSpan.getOperationName(),
            duration: rootSpan.getDuration() * 1000,
            correlationIds: [{
                value: 5,
                scope: 'Interaction',
            }],
            properties: [{
                name: 'foo',
                value: 'bar',
                type: 'Text',
            }],
            nodes: [{
                type: 'Component',
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
                type: 'Producer',
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
                    scope: 'Interaction',
                }],
            }]
        }],
    }]);
    t.end();
});

test('test trace add and find node', (t) => {
    const tracer = new APMTracer();
    const trace = new Trace();

    const rootSpan = tracer.startSpan('root');
    const childSpan1 = tracer.startSpan('child1', { childOf: rootSpan });
    const childSpan2 = tracer.startSpan('child2', { childOf: rootSpan });

    trace.addNode('Component', rootSpan);
    trace.addNode('Component', childSpan1);
    trace.addNode('Component', childSpan2);
    t.deepEquals(trace.findNode(rootSpan.getId()).getSpan(), rootSpan);
    t.deepEquals(trace.findNode(childSpan1.getId()).getSpan(), childSpan1);
    t.deepEquals(trace.findNode(childSpan2.getId()).getSpan(), childSpan2);

    t.deepEquals(trace.findNode(rootSpan.getId()).getNodes().length, 2);
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

