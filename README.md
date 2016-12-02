# Hawkular-APM OpenTracing JavaScript Implementation

[![Travis](https://travis-ci.org/hawkular/hawkular-apm-opentracing-javascript.svg?branch=master)](https://travis-ci.org/hawkular/hawkular-apm-opentracing-javascript)
[![Jira Issues](https://img.shields.io/badge/Jira-issues-blue.svg)](https://issues.jboss.org/issues/?jql=project+%3D+HWKAPM+AND+component+%3D+%22OpenTracing+%28Javascript%29%22)
[![Join the chat at freenode:hawkular](https://img.shields.io/badge/irc-freenode%3A%20%23hawkular-blue.svg)](http://webchat.freenode.net/?channels=%23hawkular)

[![NPM](https://nodei.co/npm/hawkular-apm-opentracing.png)](https://www.npmjs.com/package/hawkular-apm-opentracing)

This library is JavaScript implementation of OpenTracing API. It 
is intended to be used with [Hawkular-APM](https://github.com/hawkular/hawkular-apm) server.

## Install
```shell
$ npm install --save hawkular-apm-opentracing
```

## Usage 
```javascript
const opentracing = require('opentracing');
const hawkularAPM = require('hawkular-apm-opentracing');

const tracer = new hawkularAPM.APMTracer({
    recorder: new hawkularAPM.ConsoleRecorder(),
    sampler: new hawkularAPM.AlwaysSample(),
});

opentracing.initGlobalTracer(tracer);

const span = opentracing.globalTracer().startSpan('name');
span.finish();
```

## Develop
```shell
$ make test
$ make publish VERSION=(patch|minor|major)
```

