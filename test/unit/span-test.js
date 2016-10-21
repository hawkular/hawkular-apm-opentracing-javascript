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

import { APMTracer } from '../../lib/APMTracer';
import { nowMillis } from '../../lib/utils';

test('test operation and start time', (t) => {
    const tracer = new APMTracer();
    const span = tracer.startSpan('operation');
    t.equals(span.getOperationName(), 'operation');
    t.ok(span.getStartTime() <= nowMillis());
    t.end();
});

test('test log with timestamp', (t) => {
    const tracer = new APMTracer();
    const span = tracer.startSpan('operation');

    t.deepEquals(span.getLogs(), []);

    span.log({
        size: 15,
    }, 2);
    t.deepEquals(span.getLogs(), [{ key: 'size', value: 15, timestamp: 2 }]);
    t.end();
});

test('test log without timestamp', (t) => {
    const tracer = new APMTracer();
    const span = tracer.startSpan('operation');

    t.deepEquals(span.getLogs(), []);

    span.log({
        size: 15,
        prop: 'str',
    });
    const logs = span.getLogs();
    t.equals(logs.length, 2);
    t.equals(logs[0].key, 'size');
    t.equals(logs[0].value, 15);
    t.ok(logs[0].timestamp <= nowMillis());
    t.equals(logs[1].key, 'prop');
    t.equals(logs[1].value, 'str');
    t.ok(logs[1].timestamp <= nowMillis());
    t.end();
});

test('test log empty object', (t) => {
    const tracer = new APMTracer();
    const span = tracer.startSpan('operation');

    t.deepEquals(span.getLogs(), []);

    span.log({});
    t.deepEquals(span.getLogs(), []);
    t.end();
});

test('test setTag', (t) => {
    const tracer = new APMTracer();
    const span = tracer.startSpan('operation');

    t.deepEquals(span.getTags(), {});

    span.setTag('key', 'value');
    span.setTag('key2', 'value2')
    t.deepEquals(span.getTags(), { key: 'value', key2: 'value2' });
    t.end();
});

test('test setTag empty key or value', (t) => {
    const tracer = new APMTracer();
    const span = tracer.startSpan('operation');

    t.deepEquals(span.getTags(), {});

    span.setTag();
    t.deepEquals(span.getTags(), {});

    span.setTag(null, 'value');
    t.deepEquals(span.getTags(), {});

    span.setTag('key', null);
    t.deepEquals(span.getTags(), {});
    t.end();
});

test('test finish', (t) => {
    const tracer = new APMTracer();
    const span = tracer.startSpan('operation');
    span.finish();
    t.ok(span.getStartTime() <= span.getEndTime());
    t.ok(span.getEndTime() <= nowMillis());
    t.end();
});
