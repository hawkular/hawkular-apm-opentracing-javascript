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

import http from 'http';

import opentracing from 'opentracing';
import tracerInit from './tracer-init';
tracerInit.init();

const SERVER_PORT = 9000;

function getData() {
    const clientSpan = opentracing.globalTracer().startSpan('/api', {
        tags: {
            'http.method': 'GET',
            'http.url': 'http://localhost:' + SERVER_PORT + '/api',
        }
    });

    http.get({
        host: 'localhost',
        port: SERVER_PORT,
        path: '/api',
        headers: createCarrier(opentracing.globalTracer(), clientSpan),
    }, function (response) {
        let body = '';
        response.on('data', function (chunk) {
            body += chunk;
        });
        response.on('end', function() {
            clientSpan.setTag('http.status_code', response.statusCode);
            clientSpan.finish();
            window.document.getElementById("data").innerHTML = `Server response: ${body}`;
        });
    });
}

function createCarrier(tracer, span) {
    const carrier = {};
    tracer.inject(span.context(), opentracing.FORMAT_TEXT_MAP, carrier);
    return carrier;
}

module.exports = {
    getData,
};
