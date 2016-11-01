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

import { APMTracer, CARRIER_TRACE_ID, CARRIER_SPAN_ID, CARRIER_SAMPLED } from '../../lib/APMTracer';
import { APMSpanContext } from '../../lib/APMSpanContext';

test('test carrier constants', (t) => {
    const carrier = {};
    carrier[CARRIER_TRACE_ID] = '1';
    carrier[CARRIER_SPAN_ID] = '2';
    carrier[CARRIER_SAMPLED] = true;
    t.deepEquals(carrier[CARRIER_TRACE_ID], '1');
    t.deepEquals(carrier[CARRIER_SPAN_ID], '2');
    t.deepEquals(carrier[CARRIER_SAMPLED], true);
    t.end();
});

test('test extract FORMAT_HTTP_HEADERS', (t) => {
    const carrier = {};
    carrier[CARRIER_TRACE_ID] = '1';
    carrier[CARRIER_SPAN_ID] = '2';

    const spanContext = new APMTracer().extract(Constants.FORMAT_HTTP_HEADERS, carrier);
    t.deepEquals(spanContext.getTraceId(), '1');
    t.deepEquals(spanContext.getId(), '2');
    t.end();
});

test('test extract FORMAT_TEXT_MAP', (t) => {
    const carrier = {};
    carrier[CARRIER_TRACE_ID] = '1';
    carrier[CARRIER_SPAN_ID] = '2';

    const spanContext = new APMTracer().extract(Constants.FORMAT_TEXT_MAP, carrier);
    t.deepEquals(spanContext.getTraceId(), '1');
    t.deepEquals(spanContext.getId(), '2');
    t.end();
});

test('test extract unknown format', (t) => {
    const carrier = {};
    carrier[CARRIER_TRACE_ID] = '1';
    carrier[CARRIER_SPAN_ID] = '2';

    const spanContext = new APMTracer().extract('unknown', carrier);
    t.deepEquals(spanContext.getTraceId(), undefined);
    t.deepEquals(spanContext.getId(), undefined);
    t.end();
});

test('test inject FORMAT_HTTP_HEADERS', (t) => {
    const spanContext = new APMSpanContext(2, 1);
    const carrier = {};

    new APMTracer().inject(spanContext, Constants.FORMAT_HTTP_HEADERS, carrier);
    t.deepEquals(carrier[CARRIER_SPAN_ID], spanContext.getId());
    t.deepEquals(carrier[CARRIER_TRACE_ID], spanContext.getTraceId());
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

    t.true(rootSpan.getParentId() === null);
    t.deepEquals(rootSpan.getOperationName(), 'root');

    t.deepEquals(childSpan.getParentId(), rootSpan.getId());
    t.deepEquals(childSpan.getTraceId(), rootSpan.getTraceId());
    t.deepEquals(childSpan.getOperationName(), 'child');
    t.end();
});
