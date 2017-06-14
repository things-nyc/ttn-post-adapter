'use strict';

var _ = require('underscore')
var fetch = require('node-fetch')

function relayPost(url, authorization, data, callback) {
  fetch(url, {
    method: 'post',
    headers: {
      'Accept': "application/json, text/plain, */*",
      'Content-Type': "application/json",
      'Authorization': authorization
    },
    body: JSON.stringify(data)
  }).then(function(res) { return res.json(); })
    .then(function(res) {
            console.log(res);
            const response = {
              statusCode: 200,
              // headers: {
              //   "x-custom-header" : "My Header Value"
              // },
              body: JSON.stringify(res)
            };

            callback(null, response);
          })
    .catch(function (err) {
      console.error(err);
      callback(err);
    });
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

const rename = makeWithModulator(function (event, context, data, cb) {
  const rename = event.queryStringParameters.dataname;
  if (rename) {
    cb(null, wrapData(data, rename));
  }
  else {
    cb(new Error("Invalid 'dataname' query parameter '" + rename + "'."));
  }
});

const opensensors = makeWithModulator(function (event, context, data, cb) {
  // OpenSensors.io required a text "data" field and NO other fields in JSON
  const newdata = {
    data: JSON.stringify(data.payload_fields)
  };
  cb(null, newdata);
});

const slicingdice = makeWithModulator(function (event, context, data, cb) {
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

const pyroclast = makeWithModulator(function (event, context, data, cb) {
  // Pyroclast will take the whole message under "value"
  cb(null, wrapData(data, "value"))
});

const dispatchMap = {
  "/rename": rename,
  "/opensensors": opensensors,
  "/slicingdice": slicingdice,
  "/pyroclast": pyroclast
}

module.exports.dispatch = function(event, context, callback) {
  const path = event.path;
  if (path in dispatchMap) {
    const fn = dispatchMap[path];
    fn(event, context, callback);
  }
  else {
    callback(new Error("Unknown path '" + path + "'"));
  }
}
