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

const SERVICE_NAME = Symbol('SERVICE_NAME');
const BUILD_STAMP = Symbol('BUILD_STAMP');

const OPENSHIFT_BUILD_NAME = 'OPENSHIFT_BUILD_NAME';
const OPENSHIFT_BUILD_NAMESPACE = 'OPENSHIFT_BUILD_NAMESPACE';

const HAWKULAR_APM_SERVICE_NAME = 'HAWKULAR_APM_SERVICE_NAME';

class DeploymentMetaData {
    constructor(serviceName, buildStamp) {
        this[SERVICE_NAME] = serviceName;
        this[BUILD_STAMP] = buildStamp;
    }

    get serviceName() {
        return this[SERVICE_NAME];
    }

    get buildStamp() {
        return this[BUILD_STAMP];
    }
}

function openshiftBuildStampFromEnv() {
    if (!process) {
        return undefined;
    }

    let openshiftBuildName = process.env[OPENSHIFT_BUILD_NAME];
    if (openshiftBuildName && openshiftBuildName.length > 0) {
        // it seems it is deployed inside openfhift container
        const openshiftBuildNamespace = process.env[OPENSHIFT_BUILD_NAMESPACE];
        if (openshiftBuildNamespace && openshiftBuildNamespace.length > 0) {
            openshiftBuildName = `${openshiftBuildNamespace}.${openshiftBuildName}`;
        }
    }

    return openshiftBuildName && openshiftBuildName.length > 0 ? openshiftBuildName : undefined;
}

function serviceNameFromEnv() {
    if (!process) {
        return undefined;
    }

    let serviceName = process.env[HAWKULAR_APM_SERVICE_NAME];
    if (!serviceName || serviceName.length === 0) {
        const openshiftBuildStamp = openshiftBuildStampFromEnv();
        if (openshiftBuildStamp) {
            const indexOfLastDash = openshiftBuildStamp.lastIndexOf('-');
            serviceName = indexOfLastDash < 0 ? openshiftBuildStamp : openshiftBuildStamp.substring(0, indexOfLastDash);
        }
    }

    return serviceName && serviceName.length > 0 ? serviceName : undefined;
}

class ReloadableMetaData extends DeploymentMetaData {
    constructor(serviceNameProvider, buildStampProvier) {
        super(serviceNameProvider(), buildStampProvier());

        this.reload = function () {
            this[SERVICE_NAME] = serviceNameProvider();
            this[BUILD_STAMP] = buildStampProvier();
        };
    }
}

const DEFAULT_META_DATA = new ReloadableMetaData(serviceNameFromEnv, openshiftBuildStampFromEnv);

module.exports = {
    OPENSHIFT_BUILD_NAMESPACE,
    OPENSHIFT_BUILD_NAME,
    HAWKULAR_APM_SERVICE_NAME,
    DEFAULT_META_DATA,
    DeploymentMetaData,
};
