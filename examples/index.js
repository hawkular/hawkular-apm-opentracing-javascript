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
    recorder: new hawkularAPM.ConsoleRecorder(),
    sampler: new hawkularAPM.AlwaysSampledSampler(),
}));

// /hello handler
dispatcher.onGet('/hello', function(req, res) {
    const serverSpan = opentracing.globalTracer().startSpan('hello', {
        tags: {
            'http.url': extractUrl(req),
            'http.status_code': 200,
        }
    });
    res.writeHead(200);
    res.end('Hello from Node.js!');
    serverSpan.finish();
});

// /a handler
dispatcher.onGet("/a", function(req, res) {
    const serverSpan = opentracing.globalTracer().startSpan('/a', {
        tags: {
            'http.url': extractUrl(req),
            'http.status_code': 200,
        }
    });

    const clientSpan = opentracing.globalTracer().startSpan('/b', {
        childOf: serverSpan,
        tags: {
            'http.url': extractUrl(req),
            'http.status_code': 200,
        }
    });
    http.get({
        host: 'localhost',
        port: SERVER_PORT,
        path: '/b',
        headers: createCarrier(opentracing.globalTracer(), clientSpan),
    }, function (response) {
        clientSpan.finish();
    });

    res.writeHead(200);
    res.end('/a');
    serverSpan.finish();
});

// /b handler
dispatcher.onGet('/b', function(req, res) {
    const spanContext = extractSpanContext(opentracing.globalTracer(), req.headers);
    const serverSpan = opentracing.globalTracer().startSpan('/b', {
        childOf: spanContext,
        tags: {
            'http.url': extractUrl(req),
            'http.status_code': 200,
        }
    });
    res.writeHead(200);
    res.end('Hello from Node.js!');
    serverSpan.finish();
});

function createCarrier(tracer, span) {
    const carrier = {};
    tracer.inject(span, opentracing.FORMAT_TEXT_MAP, carrier);
    return carrier;
}

function extractSpanContext(tracer, httpHeaders) {
    return tracer.extract(opentracing.FORMAT_TEXT_MAP, httpHeaders);
}

function extractUrl(request) {
    return 'http://' + request.headers.host + request.url;
}

//We need a function which handles requests and send response
function handleRequest(request, response) {
    try {
        //log the request on console
        console.log(request.url);
        dispatcher.dispatch(request, response);
    } catch(err) {
        console.log(err);
    }
}

// create server
const server = http.createServer(handleRequest);
server.listen(SERVER_PORT, function() {
    //Callback triggered when server is successfully listening. Hurray!
    console.log('Server listening on: http://localhost:%s', SERVER_PORT);
});
