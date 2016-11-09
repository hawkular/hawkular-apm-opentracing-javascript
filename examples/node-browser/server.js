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

import express from 'express';
import path from 'path';

import opentracing from 'opentracing';
import tracerInit from './tracer-init';
tracerInit.init();

const SERVER_PORT = 9000;

const app = express();
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, '/static')));
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/api', function(req, res) {
    const serverSpan = opentracing.globalTracer().startSpan('api', {
        childOf: extractSpanContext(opentracing.globalTracer(), req.headers),
        tags: {
            'http.method': 'GET',
            'http.url': extractUrl(req),
        }
    });

    res.writeHead(200);
    res.end('/api : ' + Math.random());
    serverSpan.setTag('http.status_code', 200);
    serverSpan.finish();
});

app.listen(SERVER_PORT);
console.log(`Listening on port ${SERVER_PORT}`);

function extractSpanContext(tracer, httpHeaders) {
    return tracer.extract(opentracing.FORMAT_TEXT_MAP, httpHeaders);
}

function extractUrl(request) {
    return 'http://' + request.headers.host + request.url;
}
