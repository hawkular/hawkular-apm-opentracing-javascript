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
import test from 'tape';

import { APMTracer, NeverSample, AlwaysSample, PercentageSampler} from '../../index';
import constants from '../../lib/constants';

test('test never sample', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({
        sampler: new PercentageSampler(0),
        recorder: recorder,
    });

    const span = tracer.startSpan('foo');
    span.finish();

    t.equals(recorder.getTraces().length, 0);
    t.end();
});

test('test never sample extracted context All level', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({
        sampler: new NeverSample(),
        recorder: recorder,
    });

    const extractedContext = tracer.extract(Constants.FORMAT_TEXT_MAP, createCarrier(constants.REPORTING_LEVEL_ALL));

    const span = tracer.startSpan('foo', { childOf: extractedContext });
    span.finish();

    t.equals(recorder.getTraces().length, 1);
    t.end();
});

test('test always sample', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({
        sampler: new AlwaysSample(),
        recorder: recorder,
    });

    const span = tracer.startSpan('foo');
    span.finish();

    t.equals(recorder.getTraces().length, 1);
    t.end();
});

test('test always sample extracted context None level', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({
        sampler: new AlwaysSample(),
        recorder: recorder,
    });

    const extractedContext = tracer.extract(Constants.FORMAT_TEXT_MAP, createCarrier(constants.REPORTING_LEVEL_NONE));

    const span = tracer.startSpan('foo', { childOf: extractedContext });
    span.finish();

    t.equals(recorder.getTraces().length, 0);
    t.end();
});

test('test sample All changed to zero', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({
        sampler: new AlwaysSample(),
        recorder: recorder,
    });

    const rootSpan = tracer.startSpan('foo', {
        childOf: tracer.extract(Constants.FORMAT_TEXT_MAP, createCarrier(constants.REPORTING_LEVEL_ALL)),
    });

    const descendant = tracer.startSpan('foo', {
        childOf: rootSpan,
    });

    let carrier = {};
    tracer.inject(descendant, Constants.FORMAT_TEXT_MAP, carrier);
    t.equals(carrier[constants.CARRIER_LEVEL], constants.REPORTING_LEVEL_ALL);

    const descendantZeroSampling = tracer.startSpan('foo', {
        childOf: rootSpan,
    });

    descendantZeroSampling.setTag(Constants.Tags.SAMPLING_PRIORITY, 0);
    carrier = {};
    tracer.inject(descendantZeroSampling, Constants.FORMAT_TEXT_MAP, carrier);
    t.equals(carrier[constants.CARRIER_LEVEL], constants.REPORTING_LEVEL_NONE);

    rootSpan.finish();
    descendant.finish();
    descendantZeroSampling.finish();
    t.equals(recorder.getTraces().length, 1);

    const descendantDescendantZeroSampling = tracer.startSpan('foo', {
        references: [new Constants.Reference(Constants.REFERENCE_FOLLOWS_FROM, descendantZeroSampling)],
    });

    carrier = {};
    tracer.inject(descendantZeroSampling, Constants.FORMAT_TEXT_MAP, carrier);
    t.equals(carrier[constants.CARRIER_LEVEL], constants.REPORTING_LEVEL_NONE);

    recorder.clear();
    descendantDescendantZeroSampling.finish();
    t.equals(recorder.getTraces().length, 0);
    t.end();
});

test('test sample None changed to one', (t) => {
    const recorder = new ListRecorder();
    const tracer = new APMTracer({
        sampler: new AlwaysSample(),
        recorder: recorder,
    });

    const rootSpan = tracer.startSpan('foo', {
        childOf: tracer.extract(Constants.FORMAT_TEXT_MAP, createCarrier(constants.REPORTING_LEVEL_NONE)),
    });

    const descendant = tracer.startSpan('foo', {
        childOf: rootSpan,
    });

    let carrier = {};
    tracer.inject(descendant, Constants.FORMAT_TEXT_MAP, carrier);
    t.equals(carrier[constants.CARRIER_LEVEL], constants.REPORTING_LEVEL_NONE);

    const descendantOneSampling = tracer.startSpan('fo', {
        childOf: rootSpan,
    });

    descendantOneSampling.setTag(Constants.Tags.SAMPLING_PRIORITY, 1);
    carrier = {};
    tracer.inject(descendantOneSampling, Constants.FORMAT_TEXT_MAP, carrier);
    t.equals(carrier[constants.CARRIER_LEVEL], constants.REPORTING_LEVEL_ALL);

    rootSpan.finish();
    descendant.finish();
    descendantOneSampling.finish();

    const descendantDescendantOneSampling = tracer.startSpan('foo', {
        references: [new Constants.Reference(Constants.REFERENCE_FOLLOWS_FROM, descendantOneSampling)],
    });

    carrier = {};
    tracer.inject(descendantOneSampling, Constants.FORMAT_TEXT_MAP, carrier);
    t.equals(carrier[constants.CARRIER_LEVEL], constants.REPORTING_LEVEL_ALL);

    descendantDescendantOneSampling.finish();
    t.equals(recorder.getTraces().length, 2);
    t.end();
});

function createCarrier(level) {
    const carrier = {};
    carrier[constants.CARRIER_TRACE_ID] = 'foo';
    carrier[constants.CARRIER_CORRELATION_ID] = 'foo';
    carrier[constants.CARRIER_LEVEL] = level;
    return carrier;
}

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
    clear() {
        this._traces = [];
    }
}

