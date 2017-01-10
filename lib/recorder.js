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

import fetch from 'node-fetch';

const CONSOLE_RECORDER = Symbol('CONSOLE_RECORDER');
const AUTHORIZATION = Symbol('AUTHORIZATION');
const ENDPOINT = Symbol('ENDPOINT');
const TIMEOUT = Symbol('TIMEOUT');

class NoOpRecorder {
    record() {
    }
}

class ConsoleRecorder extends NoOpRecorder {
    record(span) {
        console.log(JSON.stringify({
            traceId: span.getTraceId(),
            parentId: span.getParentId(),
            spanId: span.getId(),

            operationName: span.getOperationName(),
            startTime: span.getStartTime(),
            duration: span.getDuration(),
            logs: span.getLogs(),
            tags: span.getTags(),
        }));
    }
}

class HttpRecorder {
    constructor(url, username, password, debug = false, timeout = 0) {
        function auth(name, pass) {
            const namePass = `${name}:${pass}`;
            return `Basic ${new Buffer(namePass).toString('base64')}`;
        }

        this[AUTHORIZATION] = auth(username, password);
        this[ENDPOINT] = `${url}/hawkular/apm/traces/fragments`;
        this[TIMEOUT] = timeout;

        if (debug) {
            this[CONSOLE_RECORDER] = new ConsoleRecorder();
        }
    }

    record(span) {
        if (!span) {
            return;
        }

        const trace = span.context().getTrace().fromSpan(span);

        if (this[CONSOLE_RECORDER]) {
            this[CONSOLE_RECORDER].record(span);
        }

        fetch(this[ENDPOINT], {
            method: 'POST',
            body: JSON.stringify([trace]),
            timeout: this[TIMEOUT],
            headers: {
                'Content-Type': 'application/json',
                Authorization: this[AUTHORIZATION],
            },
        }).then((response) => {
            if (response.status !== 204) {
                console.log(`Server did not accept trace data: ${response}`);
            }
        }).catch((err) => {
            console.log(`Error when reporting trace! Error: ${err}`);
        });
    }
}

module.exports = {
    NoOpRecorder,
    ConsoleRecorder,
    HttpRecorder,
};
