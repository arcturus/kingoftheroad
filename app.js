var request = require('request');
var redis = require('redis'),
    redisClient = redis.createClient();

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

    onSuccess(JSON.parse(body));
  });
};

var parseData = function parseData(points) {
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
      console.log(bigRoad + " from previous");
    }
    events[streetName] = events[streetName] || [];
    events[streetName] = cEvent;
  });

  for (var st in events) {
    var score = getScore(events[st]);
    console.log(st + " SCORE " + score);
  }
  redisClient.quit();
}

var getScore = function(events) {
  //TODO
  return 0;
}

if (!process.argv || process.argv.length !=7) {
  console.log('Execute node app.js <user> <pass> <service> <start> <end>');
} else {
  getData(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6], parseData, function(e) {
    console.error(e);
  });
}
