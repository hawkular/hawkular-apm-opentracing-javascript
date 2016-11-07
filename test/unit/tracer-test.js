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

import { APMTracer, CARRIER_TRACE_ID, CARRIER_CORRELATION_ID, CARRIER_TRANSACTION, CARRIER_LEVEL } from '../../lib/APMTracer';
import { APMSpanContext } from '../../lib/APMSpanContext';

test('test carrier constants', (t) => {
    t.deepEquals(CARRIER_TRACE_ID, 'HWKAPMTRACEID');
    t.deepEquals(CARRIER_CORRELATION_ID, 'HWKAPMID');
    t.deepEquals(CARRIER_TRANSACTION, 'HWKAPMTXN');
    t.deepEquals(CARRIER_LEVEL, 'HWKAPMLEVEL');
    t.end();
});

test('test extract FORMAT_HTTP_HEADERS', (t) => {
    const carrier = {};
    carrier[CARRIER_TRACE_ID] = '1';
    carrier[CARRIER_CORRELATION_ID] = '2';
    carrier[CARRIER_TRANSACTION] = 'foo';
    carrier[CARRIER_LEVEL] = 'All';

    const spanContext = new APMTracer().extract(Constants.FORMAT_HTTP_HEADERS, carrier);
    t.deepEquals(spanContext.getTraceId(), '1');
    t.deepEquals(spanContext.getConsumerCorrelationId(), '2');
    t.deepEquals(spanContext.getTransaction(), 'foo');
    t.deepEquals(spanContext.getLevel(), 'All');
    t.end();
});

test('test extract FORMAT_TEXT_MAP', (t) => {
    const carrier = {};
    carrier[CARRIER_TRACE_ID] = '1';
    carrier[CARRIER_CORRELATION_ID] = '2';
    carrier[CARRIER_TRANSACTION] = 'foo';
    carrier[CARRIER_LEVEL] = 'All';

    const spanContext = new APMTracer().extract(Constants.FORMAT_TEXT_MAP, carrier);
    t.deepEquals(spanContext.getTraceId(), '1');
    t.deepEquals(spanContext.getConsumerCorrelationId(), '2');
    t.deepEquals(spanContext.getTransaction(), 'foo');
    t.deepEquals(spanContext.getLevel(), 'All');
    t.end();
});

test('test extract unknown format', (t) => {
    const carrier = {};
    carrier[CARRIER_TRACE_ID] = '1';
    carrier[CARRIER_CORRELATION_ID] = '2';
    carrier[CARRIER_TRANSACTION] = 'foo';
    carrier[CARRIER_LEVEL] = 'All';

    const spanContext = new APMTracer().extract('unknown', carrier);
    t.deepEquals(spanContext.getTraceId(), undefined);
    t.deepEquals(spanContext.getConsumerCorrelationId(), undefined);
    t.deepEquals(spanContext.getTransaction(), undefined);
    t.deepEquals(spanContext.getLevel(), undefined);
    t.end();
});

test('test inject FORMAT_HTTP_HEADERS', (t) => {
    const spanContext = new APMSpanContext(2, 1, null, null, 'foo', 'All');
    const carrier = {};

    new APMTracer().inject(spanContext, Constants.FORMAT_HTTP_HEADERS, carrier);
    t.ok(carrier[CARRIER_CORRELATION_ID]);
    t.deepEquals(carrier[CARRIER_TRACE_ID], spanContext.getTraceId());
    t.deepEquals(carrier[CARRIER_TRANSACTION], spanContext.getTransaction());
    t.deepEquals(carrier[CARRIER_LEVEL], spanContext.getLevel());
    t.end();
});

test('test extract inject', (t) => {
    const tracer = new APMTracer();
    const extractCarrier = {};
    extractCarrier[CARRIER_CORRELATION_ID] = '12345';
    extractCarrier[CARRIER_TRACE_ID] = '555';
    extractCarrier[CARRIER_LEVEL] = 'All';
    extractCarrier[CARRIER_TRANSACTION] = 'foo';

    const extractSpanContext = tracer.extract(Constants.FORMAT_HTTP_HEADERS, extractCarrier);

    const rootSpan = tracer.startSpan('root', { childOf: extractSpanContext });
    let injectCarrier = {};
    tracer.inject(rootSpan.context(), Constants.FORMAT_HTTP_HEADERS, injectCarrier);
    t.ok(injectCarrier[CARRIER_CORRELATION_ID]);
    t.deepEquals(injectCarrier[CARRIER_TRACE_ID], '555');
    t.deepEquals(injectCarrier[CARRIER_TRANSACTION], 'foo');
    t.deepEquals(injectCarrier[CARRIER_LEVEL], 'All');

    const childSpan = tracer.startSpan('child', { childOf: rootSpan });
    tracer.inject(childSpan.context(), Constants.FORMAT_HTTP_HEADERS, injectCarrier);
    t.ok(injectCarrier[CARRIER_CORRELATION_ID]);
    t.deepEquals(injectCarrier[CARRIER_TRACE_ID], '555');
    t.deepEquals(injectCarrier[CARRIER_TRANSACTION], 'foo');
    t.deepEquals(injectCarrier[CARRIER_LEVEL], 'All');
    t.end();
});

test('test startSpan', (t) => {
    const spanContext = new APMSpanContext(2, 1);
    const tracer = new APMTracer();

    const rootSpan = tracer.startSpan('root', {
        childOf: spanContext,
    });
    const childSpan = tracer.startSpan('child', {
        childOf: rootSpan,
    });

    t.deepEquals(rootSpan.getParentId(), spanContext.getId());
    t.deepEquals(rootSpan.getOperationName(), 'root');

    t.deepEquals(childSpan.getParentId(), rootSpan.getId());
    t.deepEquals(childSpan.getTraceId(), rootSpan.getTraceId());
    t.deepEquals(childSpan.getOperationName(), 'child');
    t.end();
});

test('test startSpan without spanContext', (t) => {
    const tracer = new APMTracer();

    const rootSpan = tracer.startSpan('root', {});
    const childSpan = tracer.startSpan('child', {
        childOf: rootSpan,
    });

    t.true(rootSpan.getParentId() == undefined);
    t.deepEquals(rootSpan.getOperationName(), 'root');

    t.deepEquals(childSpan.getParentId(), rootSpan.getId());
    t.deepEquals(childSpan.getTraceId(), rootSpan.getTraceId());
    t.deepEquals(childSpan.getOperationName(), 'child');
    t.end();
});
