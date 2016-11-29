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

const BIT_SET = Symbol('BIT_SET');
const COUNTER = Symbol('COUNTER');

function neverSample(trace) { // eslint-disable-line no-unused-vars
    return false;
}

function alwaysSample(trace) { // eslint-disable-line no-unused-vars
    return true;
}

class Sampler {
    isSampled(trace) {} // eslint-disable-line no-unused-vars
}

class AlwaysSample extends Sampler {
    constructor() {
        super();
        this.isSampled = alwaysSample;
    }
}

class NeverSample extends Sampler {
    constructor() {
        super();
        this.isSampled = neverSample;
    }
}

class PercentageSampler {
    constructor(percentage) {
        if (percentage < 1) {
            this.isSampled = neverSample;
        } else if (percentage > 99) {
            this.isSampled = alwaysSample;
        }

        this[BIT_SET] = PercentageSampler.randomBitSet(100, percentage);
        this[COUNTER] = 0;
    }

    isSampled(trace) { // eslint-disable-line no-unused-vars
        const isSampled = this[BIT_SET][this[COUNTER]];
        this[COUNTER] += 1;

        this[COUNTER] = this[COUNTER] === 100 ? 0 : this[COUNTER];
        return isSampled;
    }

    static randomBitSet(size, cardinality) {
        const result = [];
        const chosen = [];

        for (let i = 0; i < cardinality; i += 1) {
            chosen[i] = i;
            result[i] = 1;
        }

        for (let i = cardinality; i < size; i += 1) {
            const j = Math.floor((Math.random() * (i + 1)));
            if (j < cardinality) {
                result[chosen[j]] = 0;
                result[i] = 1;
                chosen[j] = i;
            }
        }

        return result;
    }
}


module.exports = {
    AlwaysSample,
    NeverSample,
    PercentageSampler,
};
