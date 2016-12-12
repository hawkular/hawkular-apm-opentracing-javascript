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

import metaData from '../../lib/deployment-meta-data';

test('test service name from env variable', (t) => {
    process.env[metaData.HAWKULAR_APM_SERVICE_NAME] = 'foo';
    metaData.DEFAULT_META_DATA.reload();
    t.equal(metaData.DEFAULT_META_DATA.serviceName, 'foo');
    t.equal(metaData.DEFAULT_META_DATA.buildStamp, undefined);
    cleanEnvVariables();
    t.end();
});

test('test service name from openshift buildStamp', (t) => {
    process.env[metaData.OPENSHIFT_BUILD_NAMESPACE] = 'namespace';
    process.env[metaData.OPENSHIFT_BUILD_NAME] = 'name-1332521';
    metaData.DEFAULT_META_DATA.reload();
    t.equal(metaData.DEFAULT_META_DATA.serviceName, 'namespace.name');
    cleanEnvVariables();
    t.end();
});

test('test service name from openshift buildStamp without dash', (t) => {
    process.env[metaData.OPENSHIFT_BUILD_NAMESPACE] = 'namespace';
    process.env[metaData.OPENSHIFT_BUILD_NAME] = 'name';
    metaData.DEFAULT_META_DATA.reload();
    t.equal(metaData.DEFAULT_META_DATA.serviceName, 'namespace.name');
    cleanEnvVariables();
    t.end();
});

test('test openshift buildStamp', (t) => {
    process.env[metaData.OPENSHIFT_BUILD_NAMESPACE] = 'namespace';
    process.env[metaData.OPENSHIFT_BUILD_NAME] = 'name-1';
    metaData.DEFAULT_META_DATA.reload();
    t.equal(metaData.DEFAULT_META_DATA.buildStamp, 'namespace.name-1');
    t.equal(metaData.DEFAULT_META_DATA.serviceName, 'namespace.name');
    cleanEnvVariables();
    t.end();
});

test('test openshift buildStamp, missing namespace', (t) => {
    process.env[metaData.OPENSHIFT_BUILD_NAME] = 'name';
    metaData.DEFAULT_META_DATA.reload();
    t.equal(metaData.DEFAULT_META_DATA.buildStamp, 'name');
    cleanEnvVariables();
    t.end();
});

test('test metaData env variables do not set', (t) => {
    metaData.DEFAULT_META_DATA.reload();
    t.equal(metaData.DEFAULT_META_DATA.buildStamp, undefined);
    t.equal(metaData.DEFAULT_META_DATA.serviceName, undefined);
    cleanEnvVariables();
    t.end();
});

test('test all env variables of meta data set', (t) => {
    process.env[metaData.HAWKULAR_APM_SERVICE_NAME] = 'foo';
    process.env[metaData.OPENSHIFT_BUILD_NAMESPACE] = 'namespace';
    process.env[metaData.OPENSHIFT_BUILD_NAME] = 'name-12';
    metaData.DEFAULT_META_DATA.reload();
    t.equal(metaData.DEFAULT_META_DATA.buildStamp, 'namespace.name-12');
    t.equal(metaData.DEFAULT_META_DATA.serviceName, 'foo');
    cleanEnvVariables();
    t.end();
});

function cleanEnvVariables() {
    delete process.env[metaData.HAWKULAR_APM_SERVICE_NAME];
    delete process.env[metaData.OPENSHIFT_BUILD_NAMESPACE];
    delete process.env[metaData.OPENSHIFT_BUILD_NAME];
    metaData.DEFAULT_META_DATA.reload();
}
