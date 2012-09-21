var request = require('request');
var redis = require('redis'),
    redisClient = redis.createClient();

var FIRST_TIME = 10;

var END_POINT = 'https://drivetoimprove.co.uk/api/m/TelemetryInfoByType/%SERVICE_ID%?from=%START%&to=%END%&type=1,3,4,25,13,51,52,94';
var events = {};
var getData = function getData(user, pass, service,
    start, end, onSuccess, onError) {

  var end_point = END_POINT.replace('%SERVICE_ID%', service).
    replace('%START%', start).
    replace('%END%', end);

  var auth = "Basic " + new Buffer(user +
   ":" + pass).toString("base64");

  request({
    url: end_point,
    headers: {
      "Authorization": auth
    }
  }, function requestResult(error, response, body) {
    if (error || response.statusCode != 200) {
      if (onError) {
        onError(error);
      } else {
        onError({'status': response.statusCode});
      }
      return;
    }

    onSuccess(service, JSON.parse(body));
  });
};

var parseData = function parseData(service, points) {
  var re1 = new RegExp("[0-9]+\b(.+)", "ig");
  var re2 = new RegExp(".+ \\[(.+)\\]", "ig");    
  points.GetTelemetryInfoByTypeResult.forEach(function(point) {    

    var streetName = point.geoStreet;

    if (streetName.length == 0) {
      return;
    }
    //console.log(streetName);
    var streetSplit = re1.exec(streetName);

    if (streetSplit != null) {
      streetName = streetSplit[1];
    }

    console.log(streetName);
    var cEvent = {
      town: point.geoTown,
      country: point.geoCountry,
      postCode: point.geoPostcode,
      speed: point.gpsSpeed,
      type: point.sysMsgType
    }
    redisClient.lpush(streetName + ':' + point.sysServiceId, JSON.stringify(cEvent));

    streetSplit = re2.exec(streetName);

    if (streetSplit != null) {
      //Double road
      var bigRoad = streetSplit[1];
      console.log(bigRoad);
      events[bigRoad] = events[bigRoad] || [];
      events[bigRoad].push(cEvent);
    }
    events[streetName] = events[streetName] || [];
    events[streetName].push(cEvent);
  });

  for (var st in events) {
    getScore(service, st, events[st], function(scoreObj) { 
      console.log('Score for street ' + scoreObj.street + ' : ' + scoreObj.score);
    });
  }
  redisClient.quit();
};

var getScore = function(service, street, events, callback) {
  var scoresByEvents = {
    '1': 1, // Gps tick
    '3': 1, // Journey start
    '4': 1, // Journey ends
    '25': 1, // Heartbeat
    '13': -1, // Overspeed
    '51': -1, // Harsh acceleration
    '52': -1, // Harsh breaking
    '94': -10 // Crash
  };
  var key = keyCounter(service, street);
  redisClient.incrby(key, events.length, 
    function (err, value) {
      var score = value;
      if (value == events.length) {
        //First time
        score += FIRST_TIME;
      }

      for(var i = 0; i < events.length; i++) {
        score += scoresByEvents[events[i].type];
      }

      callback({
        street: street,
        score: score
      });
  }); 
};

var _key = function (service, street) {
  return street + ':' + service;
};

var keyCounter = function(service, street) {
  return _key(service, street) + ':' + 'count';
}

if (!process.argv || process.argv.length !=7) {
  console.log('Execute node app.js <user> <pass> <service> <start> <end>');
} else {
  getData(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6], parseData, function(e) {
    console.error(e);
  });
}
