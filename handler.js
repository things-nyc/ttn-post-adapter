'use strict';

var _ = require('underscore')
module.exports.fetch = require('node-fetch') // Use export so that it can be stubbed


function relayPostComplete(method, url, header, authorization, data, callback) {
  var headers = {
    'Accept': "application/json, text/plain, */*",
    'Content-Type': "application/json"
  }
  headers[header] = authorization;
  module.exports.fetch(url, {
    method: method,
    headers: headers,
    body: JSON.stringify(data)
  }).then(function(res) {
      if (res.status==200) {
        return res.json();
      }

      console.log(res);
      console.log(res.body);
      throw new Error(res.body);
    })
    .then(function(res) {
            console.log(res);
            const response = {
              statusCode: 200,
              body: JSON.stringify(res)
            };

            callback(null, response);
          })
    .catch(function (err) {
      console.error(err);
      callback(err);
    });
}

function relayPost(url, authorization, data, callback) {
  relayPost('post', url, 'Authorization', authorization, data, callback);
}

function makeWithModulator(mod) {
  return function(event, context, callback) {

    console.log(event); // Contains incoming request data (e.g., query params, headers and more)

    var data = JSON.parse(event.body);
    data = _.extend({}, data);
    const url = event.queryStringParameters.url;
    var authorization = null;
    if (event.headers) {
      authorization = event.headers["Authorization"];
    }

    // console.log("Before:", data);
    mod(event, context, data, function(err, moddata) {
      // console.log("After:", moddata);
      relayPost(url, authorization, moddata, callback);
    });
  };
}

function wrapData(data, fieldname) {
  var newdata = {};
  newdata[fieldname] = data;
  return newdata;
}

var handlers = {}

handlers.rename = makeWithModulator(function (event, context, data, cb) {
  const rename = event.queryStringParameters.dataname;
  if (rename) {
    cb(null, wrapData(data, rename));
  }
  else {
    cb(new Error("Invalid 'dataname' query parameter '" + rename + "'."));
  }
});

handlers.opensensors = makeWithModulator(function (event, context, data, cb) {
  // OpenSensors.io required a text "data" field and NO other fields in JSON
  const newdata = {
    data: JSON.stringify(data.payload_fields)
  };
  cb(null, newdata);
});

handlers.slicingdice = makeWithModulator(function (event, context, data, cb) {
  const entity = data.hardware_serial;

  var newdata = {
    "auto-create": ["table", "column"]
  };
  newdata[entity] = {
      "device-name": data.dev_id,
      "temperature": [
        {
          "value": data.payload_fields.temperature,
          "date": data.metadata.time
        }
      ],
      "table": "sensor-data"
    };

  cb(null, newdata);
});

handlers.pyroclast = makeWithModulator(function (event, context, data, cb) {
  // Pyroclast will take the whole message under "value"
  cb(null, wrapData(data, "value"))
});

handlers.adafruit = function(event, context, callback) {

  console.log(event); // Contains incoming request data (e.g., query params, headers and more)

  var data = JSON.parse(event.body);
  const url = event.queryStringParameters.url;
  const field = event.queryStringParameters.field;
  var authorization = null;
  if (event.headers) {
    authorization = event.headers["Authorization"];
  }

  // console.log("Before:", data);
  const moddata = {
    "created_at": data.metadata.time,
    "value": "" + data.payload_fields[field]
  }
  // console.log("After:", moddata);
  relayPostComplete('post', url, 'X-AIO-Key', authorization, moddata, callback);
}

module.exports.dispatch = function(event, context, callback) {
  const path = event.path;
  const handler = path.substring(1);
  if (handler in handlers) {
    const fn = handlers[handler];
    fn(event, context, callback);
  }
  else {
    callback(new Error("Unknown path '" + path + "'"));
  }
}
