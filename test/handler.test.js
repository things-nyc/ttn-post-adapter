'use strict';

var _ = require('underscore')
var expect = require('chai').expect;
var sinon = require('sinon');

var LambdaTester = require('lambda-tester');

var myLambda = require('../handler');

describe('ttn-post-adapter', function() {
  beforeEach(() => {
    sinon.stub(myLambda, 'fetch');
  });

  afterEach(() => {
    myLambda.fetch.restore();
  });

  function fetchSuccessful() {
    myLambda.fetch.returns(Promise.resolve({
      status: 200,
      json: function() {
        return {
          valid: true
        };
      }
    }));
  }

  const postData = {
    hardware_serial: "THE_DEVICE_EUI",
    metadata: {"time": "2017-06-14T16:15:41.169291958Z"},
    payload_fields: {"temperature": 26.5}
  }

  const commonHeaders = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json"
  }

  function successfulTest(event, expectURL, expectHeaders, expectPostData) {
    fetchSuccessful();
    return LambdaTester(myLambda.dispatch)
      .event(event)
      .expectResult((result) => {
        expect(result.statusCode).to.equal(200);
        sinon.assert.calledOnce(myLambda.fetch);
        sinon.assert.calledWithExactly(myLambda.fetch,
          expectURL, {
          method: 'post',
          headers: expectHeaders,
          body: JSON.stringify(expectPostData)
        });
      });
  }

  it('opensensors', function() {
    const event = {
      "path": "/opensensors",
      "body": JSON.stringify(postData),
      "queryStringParameters": {
        "url": "OPENSENSORS_TOPIC_URL"},
      "headers": {"Authorization": "OPENSENSORS_AUTH_HEADER"}
    };
    const expectURL = "OPENSENSORS_TOPIC_URL";
    const expectHeaders = _.extend({}, commonHeaders, {
      Authorization: "OPENSENSORS_AUTH_HEADER"
    });
    const expectPostData = {
      "data": JSON.stringify({
        temperature: 26.5
      })
    };
    return successfulTest(event, expectURL, expectHeaders, expectPostData);
  });

  it('slicingdice', function() {
    const event = {
      "path": "/slicingdice",
      "body": JSON.stringify(postData),
      "queryStringParameters": {
        "url": "https://api.slicingdice.com/v1/test/insert"},
      "headers": {"Authorization": "SLICINGDICE_AUTH_HEADER"}
    };
    const expectURL = "https://api.slicingdice.com/v1/test/insert";
    const expectHeaders = _.extend({}, commonHeaders, {
      Authorization: "SLICINGDICE_AUTH_HEADER"
    });
    const expectPostData = {
      "auto-create":["table","column"],
      "THE_DEVICE_EUI": {
        "temperature":[{"value":26.5,"date":"2017-06-14T16:15:41.169291958Z"}],
        "table":"sensor-data"
      }
    };
    return successfulTest(event, expectURL, expectHeaders, expectPostData);
  });

  it('pyroclast', function() {
    const event = {
      "path": "/pyroclast",
      "body": JSON.stringify(postData),
      "queryStringParameters": {
        "url": "PYROCLAST_TOPIC_URL"},
      "headers": {"Authorization": "PYROCLAST_AUTH_HEADER"}
    };
    const expectURL = "PYROCLAST_TOPIC_URL";
    const expectHeaders = _.extend({}, commonHeaders, {
      Authorization: "PYROCLAST_AUTH_HEADER"
    });
    const expectPostData = {
      "value": postData
    };
    return successfulTest(event, expectURL, expectHeaders, expectPostData);
  });

  it('adafruit', function() {
    const event = {
      "path": "/adafruit",
      "body": JSON.stringify(postData),
      "queryStringParameters": {
        field: "temperature",
        url: "ADAFRUIT_URL"
      },
      "headers": {"Authorization": "ADAFRUIT_AUTH_HEADER"}
    };
    const expectURL = "ADAFRUIT_URL";
    const expectHeaders = _.extend({}, commonHeaders, {
      "X-AIO-Key": "ADAFRUIT_AUTH_HEADER"
    });
    const expectPostData = {
      created_at: "2017-06-14T16:15:41.169291958Z",
      value: "26.5"
    };
    return successfulTest(event, expectURL, expectHeaders, expectPostData);
  });

  it('unknown entrypoint', function() {
    const event = {
      "path": "/unknown"
    };
    return LambdaTester(myLambda.dispatch)
      .event(event)
      .expectError( ( err ) => {
        expect(err.message).to.equal("Unknown path '/unknown'");
      });
  });

  it('unspecified URL', function() {
    const event = {
      "path": "/adafruit",
      "body": JSON.stringify(postData),
      "queryStringParameters": {
        field: "temperature",
        url: null
      }
    };
    return LambdaTester(myLambda.dispatch)
      .event(event)
      .expectError( ( err ) => {
        expect(err.message).to.equal("Invalid URL query parameter 'null'");
      });
  });
});
