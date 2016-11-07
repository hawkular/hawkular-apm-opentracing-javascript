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

'use strict';

const http = require('http');
const dispatcher = require('httpdispatcher');

const opentracing = require('opentracing');
const hawkularAPM = require('../index');

const SERVER_PORT = 9000;

opentracing.initGlobalTracer(new hawkularAPM.APMTracer({
    recorder: new hawkularAPM.HttpRecorder('http://localhost:8080', 'jdoe', 'password'),
    // recorder: new hawkularAPM.ConsoleRecorder(),
    sampler: new hawkularAPM.AlwaysSampledSampler(),
}));

// /hello handler
dispatcher.onGet('/hello', function(req, res) {
    const serverSpan = opentracing.globalTracer().startSpan('hello', {
        childOf: extractSpanContext(opentracing.globalTracer(), req.headers),
        tags: {
            'http.method': 'GET',
            'http.url': extractUrl(req),
        }
    });
    serverSpan.log({
        foo: 'bar',
    });

    res.writeHead(200);
    res.end('Hello from Node.js!');
    serverSpan.setTag('http.status_code', 200);
    serverSpan.finish();
});

// /a handler
dispatcher.onGet('/a', function(req, res) {
    function getRequest(parentSpan, path, callback) {
        const clientSpan = opentracing.globalTracer().startSpan(path, {
            childOf: parentSpan,
            tags: {
                'http.method': 'GET',
                'http.url': 'http://localhost:' + SERVER_PORT + path,
            }
        });
        http.get({
            host: 'localhost',
            port: SERVER_PORT,
            path: path,
            headers: createCarrier(opentracing.globalTracer(), clientSpan),
        }, function (response) {
            clientSpan.setTag('http.status_code', response.statusCode);
            clientSpan.finish();
            callback(response);
        });
    }

    const serverSpan = opentracing.globalTracer().startSpan('/a', {
        childOf: extractSpanContext(opentracing.globalTracer(), req.headers),
        tags: {
            'http.method': 'GET',
            'http.url': extractUrl(req),
        }
    });

    getRequest(serverSpan, '/b', function (response) {
        getRequest(serverSpan, '/c', function (response) {
            serverSpan.setTag('http.status_code', 200);
            serverSpan.finish();
            res.writeHead(200);
            res.end('a operation');
        });
    });
});

// /b handler
dispatcher.onGet('/b', function(req, res) {
    const serverSpan = opentracing.globalTracer().startSpan('/b', {
        childOf: extractSpanContext(opentracing.globalTracer(), req.headers),
        tags: {
            'http.method': 'GET',
            'http.url': extractUrl(req),
        }
    });
    serverSpan.setTag('http.status_code', 200);
    serverSpan.finish();
    res.writeHead(200);
    res.end('b operation');
});

// /c handler
dispatcher.onGet('/c', function(req, res) {
const serverSpan = opentracing.globalTracer().startSpan('/c', {
        childOf: extractSpanContext(opentracing.globalTracer(), req.headers),
        tags: {
            'http.method': 'GET',
            'http.url': extractUrl(req),
        }
    });
    serverSpan.setTag('http.status_code', 200);
    serverSpan.finish();
    res.writeHead(200);
    res.end('c operation');
});

// create server
http.createServer(function(req, res) {
    console.log('<---' + req.url);
    dispatcher.dispatch(req, res);
}).listen(SERVER_PORT, function() {
    console.log('Server listening on: http://localhost:%s', SERVER_PORT);
});

function createCarrier(tracer, span) {
    const carrier = {};
    tracer.inject(span.context(), opentracing.FORMAT_TEXT_MAP, carrier);
    return carrier;
}

function extractSpanContext(tracer, httpHeaders) {
    return tracer.extract(opentracing.FORMAT_TEXT_MAP, httpHeaders);
}

function extractUrl(request) {
    return 'http://' + request.headers.host + request.url;
}
